// client/web-client.js
// 纯Node.js + Web界面的客户端实现，兼容老旧Win7系统

// 在引入模块前设置忽略SSL错误
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'; // 忽略TLS证书验证

// 处理未捕获的SSL相关异常
process.on('uncaughtException', (error) => {
  if (error.message.includes('SSL') || error.message.includes('certificate') || 
      error.code === 'UNABLE_TO_VERIFY_LEAF_SIGNATURE' || error.code === 'CERT_HAS_EXPIRED' ||
      error.code === 'DEPTH_ZERO_SELF_SIGNED_CERT' || error.message.includes('handshake')) {
    console.warn('客户端SSL相关错误已被忽略:', error.message);
  } else {
    console.error('未捕获的异常:', error);
    process.exit(1);
  }
});

// 处理未处理的Promise拒绝
process.on('unhandledRejection', (reason, promise) => {
  if (reason && (reason.message.includes('SSL') || reason.message.includes('certificate') || 
      reason.code === 'UNABLE_TO_VERIFY_LEAF_SIGNATURE' || reason.code === 'CERT_HAS_EXPIRED' ||
      reason.code === 'DEPTH_ZERO_SELF_SIGNED_CERT' || reason.message.includes('handshake'))) {
    console.warn('客户端Promise SSL相关错误已被忽略:', reason.message);
  } else {
    console.error('未处理的Promise拒绝:', reason);
  }
});

const express = require('express');
const path = require('path');
const os = require('os');
const { spawn } = require('child_process');
const fs = require('fs').promises;

// 导入现有模块
const config = require('./config');
const LogCollector = require('./LogCollector');
const LogUploader = require('./LogUploader');

// 获取本机IP地址的函数
function getLocalIPAddress() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      // 跳过内部IP和IPv6地址
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address;
      }
    }
  }
  // 如果没有找到外部IP，返回localhost
  return '127.0.0.1';
}

class WebClient {
  constructor() {
    this.app = express();
    this.port = process.env.WEB_PORT || 3002; // 本地Web服务器端口
    this.uploader = null;
    this.collector = null;
    this.clientProcess = null;
    this.isRunning = false;
    
    // 持久化存储路径
    this.appPath = path.resolve(__dirname, '..');
    this.userDataPath = path.join(this.appPath, 'data');
    this.successItemsPath = path.join(this.userDataPath, 'success-items.json');
    this.failedItemsPath = path.join(this.userDataPath, 'failed-items.json');
    
    this.setupExpress();
  }

  setupExpress() {
    // 设置静态文件目录
    this.app.use(express.static(path.join(__dirname, 'web-ui')));
    this.app.use(express.json());
    
    // API路由
    this.setupApiRoutes();
    
    // 默认路由返回Web界面
    this.app.get('/', (req, res) => {
      res.sendFile(path.join(__dirname, 'web-ui', 'index.html'));
    });
  }

  setupApiRoutes() {
    // 获取系统信息
    this.app.get('/api/system-info', (req, res) => {
      const localIP = getLocalIPAddress();
      res.json({
        hostname: os.hostname(),
        localIP: localIP,
        platform: os.platform(),
        arch: os.arch(),
        totalmem: os.totalmem(),
        freemem: os.freemem(),
        cpus: os.cpus().length
      });
    });
    
    // 获取当前配置
    this.app.get('/api/config', (req, res) => {
      const localIP = getLocalIPAddress();
      // 设备名称默认为本机IP地址
      const defaultDeviceName = process.env.CLIENT_NAME || localIP;
      res.json({
        deviceName: defaultDeviceName,
        serverUrl: process.env.SERVER_URL || config.server.url,
        logDir: process.env.LOG_DIR || config.collector.logDir,
        clientId: process.env.CLIENT_ID || config.client.id
      });
    });
    
    // 更新配置
    this.app.post('/api/config', (req, res) => {
      const { deviceName, serverUrl, logDir, clientId } = req.body;
      
      // 更新环境变量
      if (deviceName) process.env.CLIENT_NAME = deviceName;
      if (serverUrl) process.env.SERVER_URL = serverUrl;
      if (logDir) process.env.LOG_DIR = logDir;
      if (clientId) process.env.CLIENT_ID = clientId;
      
      res.json({ success: true });
    });
    
    // 启动客户端
    this.app.post('/api/client/start', async (req, res) => {
      if (this.isRunning) {
        return res.json({ success: false, error: '客户端已在运行中' });
      }
      
      try {
        // 更新配置
        const { deviceName, serverUrl, logDir, clientId } = req.body;
        
        // 设置环境变量
        process.env.CLIENT_NAME = deviceName;
        process.env.SERVER_URL = serverUrl;
        process.env.LOG_DIR = logDir;
        process.env.CLIENT_ID = clientId;
        
        // 创建配置对象
        const clientConfig = {
          client: {
            id: clientId,
            name: deviceName,
            deviceType: config.client.deviceType
          },
          server: {
            url: serverUrl,
            uploadEndpoint: config.server.uploadEndpoint,
            heartbeatInterval: config.server.heartbeatInterval
          },
          collector: {
            logDir: logDir,
            filePattern: config.collector.filePattern,
            pollInterval: config.collector.pollInterval,
            batchSize: config.collector.batchSize
          }
        };
        
        // 创建上传器和采集器实例
        this.uploader = new LogUploader(clientConfig);
        this.collector = new LogCollector(clientConfig, this.uploader);
        
        // 测试连接
        const isConnected = await this.uploader.testConnection();
        if (!isConnected) {
          return res.json({ success: false, error: '无法连接到服务端，请检查服务端是否正在运行以及网络连接是否正常' });
        }
        
        // 启动日志采集器
        await this.collector.start();
        
        // 启动心跳机制
        this.startHeartbeat();
        
        this.isRunning = true;
        
        res.json({ success: true, message: '客户端启动成功' });
      } catch (error) {
        console.error('启动客户端失败:', error);
        res.json({ success: false, error: error.message });
      }
    });
    
    // 停止客户端
    this.app.post('/api/client/stop', async (req, res) => {
      if (!this.isRunning) {
        return res.json({ success: false, error: '客户端未在运行' });
      }
      
      try {
        // 停止心跳
        if (this.heartbeatInterval) {
          clearInterval(this.heartbeatInterval);
        }
        
        // 停止日志采集器
        if (this.collector) {
          await this.collector.stop();
        }
        
        this.isRunning = false;
        
        res.json({ success: true, message: '客户端已停止' });
      } catch (error) {
        console.error('停止客户端失败:', error);
        res.json({ success: false, error: error.message });
      }
    });
    
    // 获取客户端状态
    this.app.get('/api/client/status', (req, res) => {
      res.json({
        isRunning: this.isRunning,
        lastActivity: new Date().toISOString()
      });
    });
    
    // 获取失败项目列表
    this.app.get('/api/failed-items', async (req, res) => {
      try {
        const failedItems = await this.loadFailedItems();
        res.json(failedItems);
      } catch (error) {
        console.error('获取失败项目列表失败:', error);
        res.json([]);
      }
    });
    
    // 重新上传文件
    this.app.post('/api/retry-upload', async (req, res) => {
      try {
        const { filePath } = req.body;
        
        if (!this.uploader || !this.collector) {
          return res.json({ success: false, error: '客户端未启动' });
        }
        
        // 加载成功项目列表
        await this.collector.loadSuccessItems();
        
        // 检查文件是否已成功上传
        if (this.collector.isFileAlreadyUploaded(filePath)) {
          return res.json({ success: false, error: '文件已成功上传过，无需重复上传' });
        }
        
        // 解析并重新上传文件
        const stats = await fs.stat(filePath);
        
        if (stats.isFile()) {
          const testSessions = await this.collector.parseLogFile(filePath);
          
          if (testSessions.length === 0) {
            return res.json({ success: false, error: '文件中没有有效的测试会话' });
          }
          
          // 上传每个测试会话到服务端
          let allUploadSuccess = true;
          let firstError = null;
          
          for (const session of testSessions) {
            const uploadResult = await this.uploader.uploadLog(session, filePath);
            
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
            await this.collector.addSuccessItem(filePath);
            console.log(`文件重新上传全部成功: ${filePath}, 共处理 ${testSessions.length} 个测试会话`);
          } else {
            console.error(`文件重新上传部分或全部失败: ${filePath}, 错误: ${firstError}, 共处理 ${testSessions.length} 个测试会话`);
          }
          
          res.json({ 
            filePath, 
            success: allUploadSuccess, 
            error: firstError 
          });
        } else {
          res.json({ 
            filePath, 
            success: false, 
            error: '文件不存在或不是有效文件' 
          });
        }
      } catch (error) {
        console.error(`重新上传文件失败 ${filePath}:`, error);
        res.json({ 
          filePath: req.body.filePath, 
          success: false, 
          error: error.message 
        });
      }
    });
    
    // 批量重新上传
    this.app.post('/api/retry-all-uploads', async (req, res) => {
      try {
        const { filePaths } = req.body;
        const results = [];
        
        if (!this.uploader || !this.collector) {
          return res.json({ success: false, error: '客户端未启动' });
        }
        
        for (const filePath of filePaths) {
          // 加载成功项目列表
          await this.collector.loadSuccessItems();
          
          // 检查文件是否已成功上传
          if (this.collector.isFileAlreadyUploaded(filePath)) {
            results.push({ 
              filePath, 
              success: false, 
              error: '文件已成功上传过，无需重复上传' 
            });
            continue;
          }
          
          // 解析并重新上传文件
          const stats = await fs.stat(filePath);
          
          if (stats.isFile()) {
            const testSessions = await this.collector.parseLogFile(filePath);
            
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
              const uploadResult = await this.uploader.uploadLog(session, filePath);
              
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
              await this.collector.addSuccessItem(filePath);
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
        }
        
        res.json(results);
      } catch (error) {
        console.error(`批量重新上传失败:`, error);
        res.json({ success: false, error: error.message });
      }
    });
    
    // 清空失败记录
    this.app.post('/api/clear-failed-items', async (req, res) => {
      try {
        await this.saveFailedItems([]);
        res.json({ success: true });
      } catch (error) {
        console.error('清空失败记录失败:', error);
        res.json({ success: false, error: error.message });
      }
    });
    
    // 选择目录（仅返回预设目录选项，因为无法在Web环境中打开系统对话框）
    this.app.get('/api/directory-options', (req, res) => {
      const platform = os.platform();
      const options = platform === 'win32' 
        ? [
            { path: 'C:\\Logs', label: 'C:\\Logs' },
            { path: 'D:\\Logs', label: 'D:\\Logs' },
            { path: 'C:\\TestLogs', label: 'C:\\TestLogs' },
            { path: 'D:\\TestLogs', label: 'D:\\TestLogs' }
          ]
        : [
            { path: '/var/log/tests', label: '/var/log/tests' },
            { path: '/tmp/logs', label: '/tmp/logs' },
            { path: './logs', label: './logs' }
          ];
      
      res.json(options);
    });
    
    // 获取指定目录的子目录列表
    this.app.get('/api/directories', async (req, res) => {
      try {
        const { path: dirPath } = req.query;
        
        if (!dirPath) {
          // 如果没有指定路径，返回根目录（盘符列表）
          const platform = os.platform();
          let rootItems = [];
          
          if (platform === 'win32') {
            // Windows系统，返回可用的驱动器列表
            const possibleDrives = ['C:\\', 'D:\\', 'E:\\', 'F:\\', 'G:\\', 'H:\\'];
            for (const drive of possibleDrives) {
              try {
                await fs.access(drive);
                rootItems.push({
                  name: drive.replace('\\', ''),
                  path: drive,
                  hasChildren: true
                });
              } catch (error) {
                // 驱动器不可访问，跳过
              }
            }
          } else {
            // Unix系统，返回根目录
            rootItems.push({
              name: '/',
              path: '/',
              hasChildren: true
            });
          }
          
          res.json(rootItems);
          return;
        }
        
        // 检查目录是否存在
        try {
          const stats = await fs.stat(dirPath);
          if (!stats.isDirectory()) {
            return res.status(400).json({ error: '指定路径不是目录' });
          }
        } catch (error) {
          return res.status(404).json({ error: '目录不存在' });
        }
        
        // 读取目录内容
        const entries = await fs.readdir(dirPath, { withFileTypes: true });
        
        // 只返回目录
        const directories = entries
          .filter(entry => entry.isDirectory())
          .map(entry => ({
            name: entry.name,
            path: path.join(dirPath, entry.name),
            hasChildren: true
          }));
        
        res.json(directories);
      } catch (error) {
        console.error('读取目录失败:', error);
        res.status(500).json({ error: error.message });
      }
    });
    
    // 验证目录是否可访问
    this.app.post('/api/validate-directory', async (req, res) => {
      try {
        const { path: dirPath } = req.body;
        
        if (!dirPath) {
          return res.status(400).json({ valid: false, error: '路径不能为空' });
        }
        
        // 检查目录是否存在
        try {
          const stats = await fs.stat(dirPath);
          if (!stats.isDirectory()) {
            return res.json({ valid: false, error: '指定路径不是目录' });
          }
        } catch (error) {
          return res.json({ valid: false, error: '目录不存在' });
        }
        
        // 检查是否可读
        try {
          await fs.access(dirPath, fs.constants.R_OK);
        } catch (error) {
          return res.json({ valid: false, error: '目录不可读' });
        }
        
        res.json({ valid: true, path: dirPath });
      } catch (error) {
        console.error('验证目录失败:', error);
        res.status(500).json({ valid: false, error: error.message });
      }
    });
  }

  // 启动心跳机制
  startHeartbeat() {
    this.heartbeatInterval = setInterval(async () => {
      try {
        if (this.uploader) {
          await this.uploader.sendHeartbeat();
        }
      } catch (error) {
        console.error('心跳请求失败:', error);
      }
    }, config.server.heartbeatInterval);
  }

  // 加载失败项目列表
  async loadFailedItems() {
    try {
      // 确保用户数据目录存在
      await fs.mkdir(this.userDataPath, { recursive: true });
      
      // 加载失败项目列表
      try {
        const failedData = await fs.readFile(this.failedItemsPath, 'utf8');
        return JSON.parse(failedData);
      } catch (error) {
        // 文件不存在或解析错误，使用空数组
        return [];
      }
    } catch (error) {
      console.error('加载失败项目列表失败:', error);
      return [];
    }
  }

  // 保存失败项目列表
  async saveFailedItems(items) {
    try {
      await fs.mkdir(this.userDataPath, { recursive: true });
      await fs.writeFile(this.failedItemsPath, JSON.stringify(items, null, 2));
    } catch (error) {
      console.error('保存失败项目列表失败:', error);
    }
  }

  // 启动Web服务器
  start() {
    this.app.listen(this.port, '0.0.0.0', () => {
      console.log(`Web客户端已启动，请访问: http://localhost:${this.port}`);
      console.log(`或者从其他设备访问: http://${os.hostname()}:${this.port}`);
      console.log(`按 Ctrl+C 停止服务器`);
      
      // 尝试自动打开浏览器
      const platform = os.platform();
      if (platform === 'win32') {
        spawn('cmd', ['/c', 'start', `http://localhost:${this.port}`], { detached: true });
      } else if (platform === 'darwin') {
        spawn('open', [`http://localhost:${this.port}`], { detached: true });
      } else {
        spawn('xdg-open', [`http://localhost:${this.port}`], { detached: true });
      }
    });
  }
}

// 如果直接运行此文件，则启动Web客户端
if (require.main === module) {
  const webClient = new WebClient();
  webClient.start();
}

module.exports = WebClient;