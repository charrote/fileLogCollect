// client/gui/main.js
// 在引入模块前设置忽略SSL错误
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'; // 忽略TLS证书验证

const { app, BrowserWindow, ipcMain, Tray, Menu, dialog } = require('electron');
const path = require('path');
const isDev = require('electron-is-dev');
const { spawn } = require('child_process');

// 忽略SSL错误，这对内网环境很重要
app.commandLine.appendSwitch('ignore-certificate-errors');
app.commandLine.appendSwitch('ignore-certificate-errors-spki-list');
app.commandLine.appendSwitch('disable-web-security');
app.commandLine.appendSwitch('allow-running-insecure-content');
app.commandLine.appendSwitch('disable-features', 'VizDisplayCompositor');

// 处理SSL证书错误
app.on('certificate-error', (event, webContents, url, error, certificate, callback) => {
  // 忽略SSL证书错误，这对于内网部署很重要
  event.preventDefault();
  callback(true); // 接受证书
});

// 处理未捕获的异常
process.on('uncaughtException', (error) => {
  if (error.message.includes('SSL') || error.message.includes('certificate') || 
      error.code === 'UNABLE_TO_VERIFY_LEAF_SIGNATURE' || error.code === 'CERT_HAS_EXPIRED' ||
      error.code === 'DEPTH_ZERO_SELF_SIGNED_CERT' || error.message.includes('handshake')) {
    console.warn('SSL相关错误已被忽略:', error.message);
  } else {
    console.error('未捕获的异常:', error);
  }
});

let mainWindow;
let tray = null;
let clientProcess = null;
let logCollector = null;

function createWindow() {
  // 检查图标文件是否存在
  const iconPath = path.join(__dirname, '../assets/icon.png');
  const windowOptions = {
    width: 1000,
    height: 700,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  };

  // 如果图标文件存在，则添加到窗口选项中
  if (require('fs').existsSync(iconPath)) {
    windowOptions.icon = iconPath;
  }

  mainWindow = new BrowserWindow(windowOptions);

  // 加载界面
  mainWindow.loadFile(path.join(__dirname, 'index.html'));

  if (isDev) {
    mainWindow.webContents.openDevTools();
  }

  // 创建托盘图标
  createTray();
}

function createTray() {
  try {
    // 尝试加载托盘图标，如果不存在则使用默认系统图标
    const iconPath = path.join(__dirname, '../assets/tray-icon.png');
    if (require('fs').existsSync(iconPath)) {
      tray = new Tray(iconPath);
    } else {
      // 如果图标文件不存在，使用系统默认图标
      tray = new Tray(getDefaultIconPath());
    }
    
    const contextMenu = Menu.buildFromTemplate([
      { label: '显示窗口', click: () => mainWindow.show() },
      { label: '退出', click: () => { app.quit(); } }
    ]);
    tray.setContextMenu(contextMenu);
    tray.setTooltip('AT测试采集客户端');
    tray.on('click', () => {
      mainWindow.show();
    });
  } catch (error) {
    console.warn('创建托盘图标失败，将继续运行 without tray icon:', error.message);
    // 如果托盘创建失败，不影响应用的其他功能
  }
}

// 获取默认图标路径的辅助函数
function getDefaultIconPath() {
  const os = require('os');
  const platform = os.platform();
  
  // 根据平台返回适当的默认图标或空路径
  if (platform === 'win32') {
    return path.join(__dirname, '../assets/icon.ico');
  } else if (platform === 'darwin') {
    return path.join(__dirname, '../assets/icon.icns');
  } else {
    return path.join(__dirname, '../assets/icon.png');
  }
}

// 启动客户端后台进程
function startClientProcess() {
  if (clientProcess) {
    clientProcess.kill();
  }

  // 确保SSL相关环境变量传递给子进程
  const clientEnv = {
    ...process.env,
    NODE_TLS_REJECT_UNAUTHORIZED: '0' // 确保子进程也忽略SSL错误
  };

  clientProcess = spawn('node', ['client.js'], {
    cwd: __dirname + '/..',
    env: clientEnv,
    stdio: ['pipe', 'pipe', 'pipe']
  });

  clientProcess.stdout.on('data', (data) => {
    const logMsg = data.toString();
    console.log('[CLIENT]', logMsg);
    
    // 发送日志到渲染进程
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('log-message', logMsg);
    }
  });

  clientProcess.stderr.on('data', (data) => {
    const errorMsg = data.toString();
    console.error('[CLIENT ERROR]', errorMsg);
    
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('log-error', errorMsg);
    }
  });

  clientProcess.on('close', (code) => {
    console.log(`客户端进程退出，代码: ${code}`);
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('client-stopped', code);
    }
  });
}

// 停止客户端进程
function stopClientProcess() {
  if (clientProcess) {
    clientProcess.kill();
    clientProcess = null;
  }
}

// IPC通信处理
ipcMain.on('start-client', (event, config) => {
  // 设置环境变量
  process.env.CLIENT_NAME = config.deviceName;
  process.env.SERVER_URL = config.serverUrl;
  process.env.LOG_DIR = config.logDir;
  process.env.CLIENT_ID = config.clientId; // 确保客户端ID也被传递
  
  startClientProcess();
  event.reply('client-started');
});

ipcMain.on('stop-client', () => {
  stopClientProcess();
});

ipcMain.on('get-system-info', (event) => {
  const os = require('os');
  event.returnValue = {
    hostname: os.hostname(),
    platform: os.platform(),
    arch: os.arch(),
    totalmem: os.totalmem(),
    freemem: os.freemem(),
    cpus: os.cpus().length
  };
});

// 处理目录选择请求
ipcMain.handle('select-directory', async (event) => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory', 'createDirectory'],
    title: '选择日志目录',
    buttonLabel: '选择目录'
  });
  return result;
});

// 处理重新上传请求
ipcMain.on('retry-upload', async (event, filePath) => {
  try {
    // 获取当前配置
    const config = {
      client: {
        id: process.env.CLIENT_ID,
        name: process.env.CLIENT_NAME,
        deviceType: 'ATE'
      },
      server: {
        url: process.env.SERVER_URL
      },
      collector: {
        logDir: process.env.LOG_DIR
      }
    };
    
    // 创建上传器和采集器实例
    const LogUploader = require('../LogUploader');
    const LogCollector = require('../LogCollector');
    
    const uploader = new LogUploader(config);
    const collector = new LogCollector(config, uploader);
    
    // 加载成功项目列表
    await collector.loadSuccessItems();
    
    // 检查文件是否已成功上传
    if (collector.isFileAlreadyUploaded(filePath)) {
      event.reply('retry-result', { 
        filePath, 
        success: false, 
        error: '文件已成功上传过，无需重复上传' 
      });
      return;
    }
    
    // 解析并重新上传文件
    const fs = require('fs').promises;
    const stats = await fs.stat(filePath);
    
    if (stats.isFile()) {
      const testSessions = await collector.parseLogFile(filePath);
      
      if (testSessions.length === 0) {
        event.reply('retry-result', { 
          filePath, 
          success: false, 
          error: '文件中没有有效的测试会话' 
        });
        return;
      }
      
      // 上传每个测试会话到服务端
      let allUploadSuccess = true;
      let firstError = null;
      
      for (const session of testSessions) {
        const uploadResult = await uploader.uploadLog(session, filePath);
        
        if (uploadResult === true) {
          // 上传成功
          console.log(`重新上传测试会话成功: ${session.deviceName}, 结果: ${session.result}, 开始时间: ${session.startTime}`);
        } else {
          // 上传失败
          allUploadSuccess = false;
          if (!firstError) {
            firstError = uploadResult.error || '未知错误';
          }
          console.error(`重新上传测试会话失败: ${session.deviceName}, 错误: ${firstError}`);
        }
      }
      
      // 如果全部上传成功，添加到成功列表
      if (allUploadSuccess) {
        await collector.addSuccessItem(filePath);
        console.log(`文件重新上传全部成功: ${filePath}, 共处理 ${testSessions.length} 个测试会话`);
      } else {
        console.error(`文件重新上传部分或全部失败: ${filePath}, 错误: ${firstError}, 共处理 ${testSessions.length} 个测试会话`);
      }
      
      // 发送结果到渲染进程
      event.reply('retry-result', { 
        filePath, 
        success: allUploadSuccess, 
        error: firstError 
      });
    } else {
      event.reply('retry-result', { 
        filePath, 
        success: false, 
        error: '文件不存在或不是有效文件' 
      });
    }
  } catch (error) {
    console.error(`重新上传文件失败 ${filePath}:`, error);
    event.reply('retry-result', { 
      filePath, 
      success: false, 
      error: error.message 
    });
  }
});

// 处理批量重新上传请求
ipcMain.on('retry-all-uploads', async (event, filePaths) => {
  const results = [];
  
  for (const filePath of filePaths) {
    try {
      // 获取当前配置
      const config = {
        client: {
          id: process.env.CLIENT_ID,
          name: process.env.CLIENT_NAME,
          deviceType: 'ATE'
        },
        server: {
          url: process.env.SERVER_URL
        },
        collector: {
          logDir: process.env.LOG_DIR
        }
      };
      
      // 创建上传器和采集器实例
      const LogUploader = require('../LogUploader');
      const LogCollector = require('../LogCollector');
      
      const uploader = new LogUploader(config);
      const collector = new LogCollector(config, uploader);
      
      // 加载成功项目列表
      await collector.loadSuccessItems();
      
      // 检查文件是否已成功上传
      if (collector.isFileAlreadyUploaded(filePath)) {
        results.push({ 
          filePath, 
          success: false, 
          error: '文件已成功上传过，无需重复上传' 
        });
        continue;
      }
      
      // 解析并重新上传文件
      const fs = require('fs').promises;
      const stats = await fs.stat(filePath);
      
      if (stats.isFile()) {
        const testSessions = await collector.parseLogFile(filePath);
        
        if (testSessions.length === 0) {
          results.push({ 
            filePath, 
            success: false, 
            error: '文件中没有有效的测试会话' 
          });
          continue;
        }
        
        // 上传每个测试会话到服务端
        let allUploadSuccess = true;
        let firstError = null;
        
        for (const session of testSessions) {
          const uploadResult = await uploader.uploadLog(session, filePath);
          
          if (uploadResult === true) {
            // 上传成功
            console.log(`批量重新上传测试会话成功: ${session.deviceName}, 结果: ${session.result}, 开始时间: ${session.startTime}`);
          } else {
            // 上传失败
            allUploadSuccess = false;
            if (!firstError) {
              firstError = uploadResult.error || '未知错误';
            }
            console.error(`批量重新上传测试会话失败: ${session.deviceName}, 错误: ${firstError}`);
          }
        }
        
        // 如果全部上传成功，添加到成功列表
        if (allUploadSuccess) {
          await collector.addSuccessItem(filePath);
          console.log(`文件批量重新上传全部成功: ${filePath}, 共处理 ${testSessions.length} 个测试会话`);
        } else {
          console.error(`文件批量重新上传部分或全部失败: ${filePath}, 错误: ${firstError}, 共处理 ${testSessions.length} 个测试会话`);
        }
        
        // 添加结果
        results.push({ 
          filePath, 
          success: allUploadSuccess, 
          error: firstError 
        });
      } else {
        results.push({ 
          filePath, 
          success: false, 
          error: '文件不存在或不是有效文件' 
        });
      }
    } catch (error) {
      console.error(`批量重新上传文件失败 ${filePath}:`, error);
      results.push({ 
        filePath, 
        success: false, 
        error: error.message 
      });
    }
  }
  
  // 发送结果到渲染进程
  event.reply('retry-all-result', results);
});

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});