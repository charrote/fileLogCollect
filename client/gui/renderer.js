// client/gui/renderer.js
const { ipcRenderer } = require('electron');
const os = require('os');
const path = require('path');
const fs = require('fs').promises;

// DOM元素引用
const deviceNameInput = document.getElementById('deviceName');
const serverUrlInput = document.getElementById('serverUrl');
const logDirInput = document.getElementById('logDir');
const clientIdInput = document.getElementById('clientId');
const startBtn = document.getElementById('startBtn');
const stopBtn = document.getElementById('stopBtn');
const refreshBtn = document.getElementById('refreshBtn');
const browseBtn = document.getElementById('browseBtn');
const statusIndicator = document.getElementById('statusIndicator');
const connectionStatus = document.getElementById('connectionStatus');
const logsContainer = document.getElementById('logsContainer');
const filesProcessedEl = document.getElementById('filesProcessed');
const uploadsSuccessEl = document.getElementById('uploadsSuccess');
const uploadsFailedEl = document.getElementById('uploadsFailed');
const lastActivityEl = document.getElementById('lastActivity');

// 弹窗相关元素
const failedItemsModal = document.getElementById('failedItemsModal');
const failedItemsTableBody = document.getElementById('failedItemsTableBody');
const noFailedItems = document.getElementById('noFailedItems');
const retryAllBtn = document.getElementById('retryAllBtn');
const clearAllBtn = document.getElementById('clearAllBtn');
const modalCloseBtn = document.querySelector('.close');

// 持久化存储路径 - 改为应用目录下的data文件夹
const appPath = path.resolve(__dirname, '..');
const userDataPath = path.join(appPath, 'data');
const failedItemsPath = path.join(userDataPath, 'failed-items.json');
const successItemsPath = path.join(userDataPath, 'success-items.json');

// 状态变量
let isRunning = false;
let stats = {
  filesProcessed: 0,
  uploadsSuccess: 0,
  uploadsFailed: 0,
  lastActivity: '-'
};

// 失败项目和成功项目列表
let failedItems = [];
let successItems = [];

// 初始化
document.addEventListener('DOMContentLoaded', () => {
  // 设置默认值
  deviceNameInput.value = os.hostname();
  serverUrlInput.value = 'http://localhost:3000';
  logDirInput.value = getDefaultLogDir();
  clientIdInput.value = os.hostname(); // 客户端ID设为只读，使用主机名
  
  // 绑定事件
  startBtn.addEventListener('click', startClient);
  stopBtn.addEventListener('click', stopClient);
  refreshBtn.addEventListener('click', refreshSystemInfo);
  browseBtn && browseBtn.addEventListener('click', selectLogDirectory);
  
  // 弹窗相关事件
  uploadsFailedEl.addEventListener('click', showFailedItemsModal);
  modalCloseBtn.addEventListener('click', hideFailedItemsModal);
  retryAllBtn.addEventListener('click', retryAllFailedItems);
  clearAllBtn.addEventListener('click', clearAllFailedItems);
  
  // 点击弹窗外部关闭弹窗
  window.addEventListener('click', (event) => {
    if (event.target === failedItemsModal) {
      hideFailedItemsModal();
    }
  });
  
  // 初始化持久化存储
  initializePersistentStorage();
  
  // 初始化日志
  addLog('info', '客户端界面已加载');
});

// 获取默认日志目录
function getDefaultLogDir() {
  const platform = os.platform();
  if (platform === 'win32') {
    return 'C:\\Logs';
  } else {
    return '/var/log/tests';
  }
}

// 选择日志目录
function selectLogDirectory() {
  // 发送IPC消息到主进程打开目录选择对话框
  ipcRenderer.invoke('select-directory').then((result) => {
    if (!result.canceled && result.filePaths.length > 0) {
      logDirInput.value = result.filePaths[0];
      addLog('info', `已选择日志目录: ${result.filePaths[0]}`);
    }
  }).catch((error) => {
    console.error('选择目录时出错:', error);
    addLog('error', `选择目录时出错: ${error.message}`);
  });
}

// 启动客户端
function startClient() {
  let serverUrl = serverUrlInput.value.trim();
  
  // 检查并警告HTTPS使用
  if (serverUrl.startsWith('https://')) {
    // 自动转换为HTTP以避免SSL握手问题
    serverUrl = serverUrl.replace(/^https:\/\//, 'http://');
    addLog('warn', `检测到HTTPS URL，已自动转换为HTTP以避免SSL握手问题: ${serverUrl}`);
  }
  
  const config = {
    deviceName: deviceNameInput.value.trim(),
    serverUrl: serverUrl,
    logDir: logDirInput.value.trim(),
    clientId: clientIdInput.value.trim() // 客户端ID不再允许为空，始终使用只读值
  };
  
  // 验证输入
  if (!config.deviceName || !config.serverUrl || !config.logDir || !config.clientId) {
    addLog('error', '请填写所有必填项');
    return;
  }
  
  try {
    new URL(config.serverUrl); // 验证URL格式
  } catch (e) {
    addLog('error', '服务端地址格式不正确');
    return;
  }
  
  // 更新状态
  isRunning = true;
  updateStatus('running', '');
  startBtn.disabled = true;
  stopBtn.disabled = false;
  
  // 发送启动请求到主进程
  ipcRenderer.send('start-client', config);
  addLog('info', `客户端已启动 - 设备: ${config.deviceName}, 服务端: ${config.serverUrl}`);
}

// 停止客户端
function stopClient() {
  isRunning = false;
  updateStatus('stopped', '');
  startBtn.disabled = false;
  stopBtn.disabled = true;
  
  addLog('info', '停止客户端');
  
  // 发送停止指令到主进程
  ipcRenderer.send('stop-client');
}

// 更新状态显示
function updateStatus(status, text) {
  statusIndicator.className = `status-indicator status-${status}`;
  statusIndicator.textContent = text;
  
  // 更新连接状态
  if (status === 'running') {
    connectionStatus.className = 'connection-status connection-ok';
    connectionStatus.innerHTML = '<span>✅ 已连接到服务端</span>';
  } else {
    connectionStatus.className = 'connection-status connection-error';
    connectionStatus.innerHTML = '<span>⚠️ 未连接到服务端</span>';
  }
}

// 添加日志消息
function addLog(type, message) {
  const timestamp = new Date().toLocaleTimeString();
  const logEntry = document.createElement('div');
  logEntry.className = `log-entry log-${type}`;
  logEntry.textContent = `[${timestamp}] ${message}`;
  
  logsContainer.appendChild(logEntry);
  
  // 限制日志条目数量，最多保留500条
  const maxLogEntries = 500;
  while (logsContainer.children.length > maxLogEntries) {
    logsContainer.removeChild(logsContainer.firstChild);
  }
  
  // 使用setTimeout确保DOM更新后再滚动，这样可以解决某些情况下滚动不生效的问题
  setTimeout(() => {
    // 自动滚动到底部
    logsContainer.scrollTop = logsContainer.scrollHeight;
  }, 10);
  
  // 更新最后活动时间
  stats.lastActivity = timestamp;
  lastActivityEl.textContent = timestamp;
}

// 更新统计信息
function updateStats() {
  filesProcessedEl.textContent = stats.filesProcessed;
  uploadsSuccessEl.textContent = stats.uploadsSuccess;
  uploadsFailedEl.textContent = stats.uploadsFailed;
}

// 刷新系统信息
function refreshSystemInfo() {
  const sysInfo = ipcRenderer.sendSync('get-system-info');
  addLog('info', `系统信息 - 主机: ${sysInfo.hostname}, 平台: ${sysInfo.platform}, CPU: ${sysInfo.cpus}核, 内存: ${(sysInfo.totalmem / (1024**3)).toFixed(1)}GB`);
}

// 监听主进程发送的消息
ipcRenderer.on('log-message', (event, message) => {
  // 解析日志级别
  if (message.includes('上传成功') || message.includes('已处理')) {
    addLog('success', message.trim());
    
    // 如果是上传成功，提取文件路径并添加到成功列表
    if (message.includes('上传成功')) {
      const filePathMatch = message.match(/上传成功: (.+)/);
      if (filePathMatch) {
        const filePath = filePathMatch[1].trim();
        addSuccessItem(filePath);
        stats.uploadsSuccess++;
        updateStats();
      }
    } else if (message.includes('已处理')) {
      stats.filesProcessed++;
      updateStats();
    }
  } else if (message.includes('错误') || message.includes('error') || message.includes('Error')) {
    addLog('error', message.trim());
    
    // 如果是上传失败，提取文件路径和错误原因并添加到失败列表
    if (message.includes('上传失败')) {
      const filePathMatch = message.match(/上传失败: (.+?): (.+)/);
      if (filePathMatch) {
        const filePath = filePathMatch[1].trim();
        const errorReason = filePathMatch[2].trim();
        addFailedItem(filePath, errorReason);
      }
    } else if (message.includes('文件部分或全部上传失败')) {
      const filePathMatch = message.match(/文件部分或全部上传失败: (.+?) 错误: (.+?) 共处理/);
      if (filePathMatch) {
        const filePath = filePathMatch[1].trim();
        const errorReason = filePathMatch[2].trim();
        addFailedItem(filePath, errorReason);
      }
    }
  } else {
    addLog('info', message.trim());
  }
});

ipcRenderer.on('log-error', (event, error) => {
  addLog('error', `错误: ${error.trim()}`);
});

ipcRenderer.on('client-started', () => {
  addLog('success', '客户端启动成功');
});

ipcRenderer.on('client-stopped', (event, code) => {
  isRunning = false;
  updateStatus('stopped', '');
  startBtn.disabled = false;
  stopBtn.disabled = true;
  
  addLog('info', `客户端已停止 (退出码: ${code})`);
});

// 处理重新上传结果
ipcRenderer.on('retry-result', async (event, { filePath, success, error }) => {
  if (success) {
    addLog('success', `重新上传成功: ${filePath}`);
    await addSuccessItem(filePath);
    stats.uploadsSuccess++;
    updateStats();
    renderFailedItemsTable(); // 更新弹窗中的表格
  } else {
    addLog('error', `重新上传失败: ${filePath}, 错误: ${error}`);
    await addFailedItem(filePath, error);
    renderFailedItemsTable(); // 更新弹窗中的表格
  }
});

// 处理批量重新上传结果
ipcRenderer.on('retry-all-result', async (event, results) => {
  const successCount = results.filter(r => r.success).length;
  const failCount = results.length - successCount;
  
  addLog('info', `批量重新上传完成: 成功 ${successCount} 个，失败 ${failCount} 个`);
  
  // 更新持久化数据
  for (const result of results) {
    if (result.success) {
      await addSuccessItem(result.filePath);
      stats.uploadsSuccess++;
    } else {
      await addFailedItem(result.filePath, result.error);
    }
  }
  
  updateStats();
  renderFailedItemsTable(); // 更新弹窗中的表格
});

// 初始化系统信息
refreshSystemInfo();

// 初始化持久化存储
async function initializePersistentStorage() {
  try {
    // 确保用户数据目录存在
    await fs.mkdir(userDataPath, { recursive: true });
    
    // 加载失败项目列表
    try {
      const failedData = await fs.readFile(failedItemsPath, 'utf8');
      failedItems = JSON.parse(failedData);
      updateFailedStats();
    } catch (error) {
      // 文件不存在或解析错误，使用空数组
      failedItems = [];
    }
    
    // 加载成功项目列表
    try {
      const successData = await fs.readFile(successItemsPath, 'utf8');
      successItems = JSON.parse(successData);
    } catch (error) {
      // 文件不存在或解析错误，使用空数组
      successItems = [];
    }
    
    addLog('info', '已加载持久化数据');
  } catch (error) {
    console.error('初始化持久化存储失败:', error);
    addLog('error', `初始化持久化存储失败: ${error.message}`);
  }
}

// 保存失败项目列表
async function saveFailedItems() {
  try {
    await fs.writeFile(failedItemsPath, JSON.stringify(failedItems, null, 2));
  } catch (error) {
    console.error('保存失败项目列表失败:', error);
    addLog('error', `保存失败项目列表失败: ${error.message}`);
  }
}

// 保存成功项目列表
async function saveSuccessItems() {
  try {
    await fs.writeFile(successItemsPath, JSON.stringify(successItems, null, 2));
  } catch (error) {
    console.error('保存成功项目列表失败:', error);
    addLog('error', `保存成功项目列表失败: ${error.message}`);
  }
}

// 添加失败项目
async function addFailedItem(filePath, errorReason) {
  // 检查是否已存在
  const existingIndex = failedItems.findIndex(item => item.filePath === filePath);
  
  const item = {
    filePath,
    errorReason,
    timestamp: new Date().toISOString()
  };
  
  if (existingIndex >= 0) {
    // 更新现有项目
    failedItems[existingIndex] = item;
  } else {
    // 添加新项目
    failedItems.push(item);
  }
  
  await saveFailedItems();
  updateFailedStats();
}

// 添加成功项目
async function addSuccessItem(filePath) {
  // 检查是否已存在
  if (!successItems.includes(filePath)) {
    successItems.push(filePath);
    await saveSuccessItems();
  }
  
  // 从失败列表中移除（如果存在）
  const failedIndex = failedItems.findIndex(item => item.filePath === filePath);
  if (failedIndex >= 0) {
    failedItems.splice(failedIndex, 1);
    await saveFailedItems();
    updateFailedStats();
  }
}

// 检查文件是否已成功上传
function isFileAlreadyUploaded(filePath) {
  return successItems.includes(filePath);
}

// 更新失败统计
function updateFailedStats() {
  stats.uploadsFailed = failedItems.length;
  uploadsFailedEl.textContent = stats.uploadsFailed;
}

// 显示失败项目弹窗
function showFailedItemsModal() {
  renderFailedItemsTable();
  failedItemsModal.style.display = 'block';
}

// 隐藏失败项目弹窗
function hideFailedItemsModal() {
  failedItemsModal.style.display = 'none';
}

// 渲染失败项目表格
function renderFailedItemsTable() {
  if (failedItems.length === 0) {
    failedItemsTableBody.innerHTML = '';
    noFailedItems.style.display = 'block';
    return;
  }
  
  noFailedItems.style.display = 'none';
  
  failedItemsTableBody.innerHTML = '';
  
  failedItems.forEach((item, index) => {
    const row = document.createElement('tr');
    
    const fileName = document.createElement('td');
    fileName.textContent = path.basename(item.filePath);
    
    const errorReason = document.createElement('td');
    errorReason.textContent = item.errorReason;
    
    const timestamp = document.createElement('td');
    timestamp.textContent = new Date(item.timestamp).toLocaleString();
    
    const actions = document.createElement('td');
    const retryBtn = document.createElement('button');
    retryBtn.textContent = '重新上传';
    retryBtn.className = 'btn-retry';
    retryBtn.addEventListener('click', () => retryFailedItem(index));
    actions.appendChild(retryBtn);
    
    row.appendChild(fileName);
    row.appendChild(errorReason);
    row.appendChild(timestamp);
    row.appendChild(actions);
    
    failedItemsTableBody.appendChild(row);
  });
}

// 重新上传单个失败项目
async function retryFailedItem(index) {
  const item = failedItems[index];
  if (!item) return;
  
  addLog('info', `尝试重新上传: ${item.filePath}`);
  
  // 发送重新上传请求到主进程
  ipcRenderer.send('retry-upload', item.filePath);
}

// 重新上传所有失败项目
async function retryAllFailedItems() {
  if (failedItems.length === 0) {
    addLog('info', '没有失败项目需要重新上传');
    return;
  }
  
  addLog('info', `开始重新上传 ${failedItems.length} 个失败项目`);
  
  // 发送批量重新上传请求到主进程
  const filePaths = failedItems.map(item => item.filePath);
  ipcRenderer.send('retry-all-uploads', filePaths);
}

// 清空所有失败记录
async function clearAllFailedItems() {
  if (failedItems.length === 0) {
    addLog('info', '没有失败记录需要清空');
    return;
  }
  
  if (confirm(`确定要清空所有 ${failedItems.length} 条失败记录吗？`)) {
    failedItems = [];
    await saveFailedItems();
    updateFailedStats();
    renderFailedItemsTable();
    addLog('info', '已清空所有失败记录');
  }
}