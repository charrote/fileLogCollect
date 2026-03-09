// client/web-ui/app.js
// Web版客户端的前端JavaScript代码

// DOM元素引用
const deviceNameInput = document.getElementById('deviceName');
const serverUrlInput = document.getElementById('serverUrl');
const logDirInput = document.getElementById('logDir');
const logDirSelect = document.getElementById('logDirSelect');
const clientIdInput = document.getElementById('clientId');
const startBtn = document.getElementById('startBtn');
const stopBtn = document.getElementById('stopBtn');
const refreshBtn = document.getElementById('refreshBtn');
const statusIndicator = document.getElementById('statusIndicator');
const statusText = document.getElementById('statusText');
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

// 通知元素
const notification = document.getElementById('notification');

// 状态变量
let isRunning = false;
let stats = {
  filesProcessed: 0,
  uploadsSuccess: 0,
  uploadsFailed: 0,
  lastActivity: '-'
};

// 失败项目列表
let failedItems = [];

// 初始化
document.addEventListener('DOMContentLoaded', () => {
  // 加载配置
  loadConfig();
  
  // 加载目录选项
  loadDirectoryOptions();
  
  // 绑定事件
  startBtn.addEventListener('click', startClient);
  stopBtn.addEventListener('click', stopClient);
  refreshBtn.addEventListener('click', refreshSystemInfo);
  logDirSelect.addEventListener('change', selectLogDirectory);
  
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
  
  // 定期更新状态
  setInterval(updateStatus, 5000);
  
  // 初始化日志
  addLog('info', 'Web客户端界面已加载');
});

// 加载配置
async function loadConfig() {
  try {
    const response = await fetch('/api/config');
    const config = await response.json();
    
    deviceNameInput.value = config.deviceName;
    serverUrlInput.value = config.serverUrl;
    logDirInput.value = config.logDir;
    clientIdInput.value = config.clientId;
  } catch (error) {
    console.error('加载配置失败:', error);
    addLog('error', `加载配置失败: ${error.message}`);
  }
}

// 加载目录选项
async function loadDirectoryOptions() {
  try {
    const response = await fetch('/api/directory-options');
    const options = await response.json();
    
    // 清空现有选项
    logDirSelect.innerHTML = '<option value="">选择预设目录</option>';
    
    // 添加新选项
    options.forEach(option => {
      const optionElement = document.createElement('option');
      optionElement.value = option.path;
      optionElement.textContent = option.label;
      logDirSelect.appendChild(optionElement);
    });
  } catch (error) {
    console.error('加载目录选项失败:', error);
    addLog('error', `加载目录选项失败: ${error.message}`);
  }
}

// 选择日志目录
function selectLogDirectory() {
  const selectedPath = logDirSelect.value;
  if (selectedPath) {
    logDirInput.value = selectedPath;
    addLog('info', `已选择日志目录: ${selectedPath}`);
  }
}

// 启动客户端
async function startClient() {
  let serverUrl = serverUrlInput.value.trim();
  
  // 检查并警告HTTPS使用
  if (serverUrl.startsWith('https://')) {
    // 自动转换为HTTP以避免SSL握手问题
    serverUrl = serverUrl.replace(/^https:\/\//, 'http://');
    serverUrlInput.value = serverUrl;
    addLog('warning', `检测到HTTPS URL，已自动转换为HTTP以避免SSL握手问题: ${serverUrl}`);
  }
  
  const config = {
    deviceName: deviceNameInput.value.trim(),
    serverUrl: serverUrl,
    logDir: logDirInput.value.trim(),
    clientId: clientIdInput.value.trim()
  };
  
  // 验证输入
  if (!config.deviceName || !config.serverUrl || !config.logDir || !config.clientId) {
    showNotification('请填写所有必填项', 'error');
    return;
  }
  
  try {
    new URL(config.serverUrl); // 验证URL格式
  } catch (e) {
    showNotification('服务端地址格式不正确', 'error');
    return;
  }
  
  try {
    // 发送启动请求
    const response = await fetch('/api/client/start', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(config)
    });
    
    const result = await response.json();
    
    if (result.success) {
      // 更新状态
      isRunning = true;
      updateUIState('running');
      
      addLog('success', `客户端已启动 - 设备: ${config.deviceName}, 服务端: ${config.serverUrl}`);
      showNotification('客户端启动成功', 'success');
    } else {
      addLog('error', `启动客户端失败: ${result.error}`);
      showNotification(`启动客户端失败: ${result.error}`, 'error');
    }
  } catch (error) {
    console.error('启动客户端失败:', error);
    addLog('error', `启动客户端失败: ${error.message}`);
    showNotification(`启动客户端失败: ${error.message}`, 'error');
  }
}

// 停止客户端
async function stopClient() {
  try {
    // 发送停止请求
    const response = await fetch('/api/client/stop', {
      method: 'POST'
    });
    
    const result = await response.json();
    
    if (result.success) {
      // 更新状态
      isRunning = false;
      updateUIState('stopped');
      
      addLog('info', '客户端已停止');
      showNotification('客户端已停止', 'success');
    } else {
      addLog('error', `停止客户端失败: ${result.error}`);
      showNotification(`停止客户端失败: ${result.error}`, 'error');
    }
  } catch (error) {
    console.error('停止客户端失败:', error);
    addLog('error', `停止客户端失败: ${error.message}`);
    showNotification(`停止客户端失败: ${error.message}`, 'error');
  }
}

// 更新UI状态
function updateUIState(state) {
  if (state === 'running') {
    statusIndicator.className = 'status-indicator running';
    statusText.textContent = '运行中';
    connectionStatus.innerHTML = '<span>✅ 已连接到服务端</span>';
    connectionStatus.className = 'connection-status connected';
    startBtn.disabled = true;
    stopBtn.disabled = false;
  } else {
    statusIndicator.className = 'status-indicator stopped';
    statusText.textContent = '已停止';
    connectionStatus.innerHTML = '<span>⚠️ 未连接到服务端</span>';
    connectionStatus.className = 'connection-status disconnected';
    startBtn.disabled = false;
    stopBtn.disabled = true;
  }
}

// 更新状态
async function updateStatus() {
  try {
    const response = await fetch('/api/client/status');
    const status = await response.json();
    
    // 更新运行状态
    if (status.isRunning !== isRunning) {
      isRunning = status.isRunning;
      updateUIState(isRunning ? 'running' : 'stopped');
    }
    
    // 更新最后活动时间
    if (status.lastActivity) {
      const lastActivity = new Date(status.lastActivity);
      lastActivityEl.textContent = lastActivity.toLocaleTimeString();
    }
    
    // 加载失败项目统计
    await loadFailedItemsStats();
  } catch (error) {
    console.error('更新状态失败:', error);
  }
}

// 加载失败项目统计
async function loadFailedItemsStats() {
  try {
    const response = await fetch('/api/failed-items');
    const items = await response.json();
    
    stats.uploadsFailed = items.length;
    uploadsFailedEl.textContent = stats.uploadsFailed;
  } catch (error) {
    console.error('加载失败项目统计失败:', error);
  }
}

// 添加日志消息
function addLog(type, message) {
  const timestamp = new Date().toLocaleTimeString();
  const logEntry = document.createElement('div');
  logEntry.className = `log-entry ${type}`;
  logEntry.textContent = `[${timestamp}] ${message}`;
  
  logsContainer.appendChild(logEntry);
  
  // 限制日志条目数量，最多保留500条
  const maxLogEntries = 500;
  while (logsContainer.children.length > maxLogEntries) {
    logsContainer.removeChild(logsContainer.firstChild);
  }
  
  // 自动滚动到底部
  logsContainer.scrollTop = logsContainer.scrollHeight;
  
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
async function refreshSystemInfo() {
  try {
    const response = await fetch('/api/system-info');
    const sysInfo = await response.json();
    
    addLog('info', `系统信息 - 主机: ${sysInfo.hostname}, 平台: ${sysInfo.platform}, CPU: ${sysInfo.cpus}核, 内存: ${(sysInfo.totalmem / (1024**3)).toFixed(1)}GB`);
    showNotification('系统信息已刷新', 'success');
  } catch (error) {
    console.error('刷新系统信息失败:', error);
    addLog('error', `刷新系统信息失败: ${error.message}`);
    showNotification(`刷新系统信息失败: ${error.message}`, 'error');
  }
}

// 显示通知
function showNotification(message, type = 'info') {
  notification.textContent = message;
  notification.className = `notification ${type}`;
  notification.classList.add('show');
  
  // 3秒后自动隐藏
  setTimeout(() => {
    notification.classList.remove('show');
  }, 3000);
}

// 显示失败项目弹窗
async function showFailedItemsModal() {
  try {
    const response = await fetch('/api/failed-items');
    const items = await response.json();
    
    failedItems = items;
    renderFailedItemsTable();
    failedItemsModal.style.display = 'block';
  } catch (error) {
    console.error('获取失败项目列表失败:', error);
    addLog('error', `获取失败项目列表失败: ${error.message}`);
    showNotification(`获取失败项目列表失败: ${error.message}`, 'error');
  }
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
    fileName.textContent = getFileName(item.filePath);
    
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

// 获取文件名
function getFileName(filePath) {
  if (!filePath) return '未知文件';
  
  // 处理Windows和Unix路径
  const parts = filePath.split(/[/\\]/);
  return parts[parts.length - 1];
}

// 重新上传单个失败项目
async function retryFailedItem(index) {
  const item = failedItems[index];
  if (!item) return;
  
  addLog('info', `尝试重新上传: ${item.filePath}`);
  
  try {
    const response = await fetch('/api/retry-upload', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ filePath: item.filePath })
    });
    
    const result = await response.json();
    
    if (result.success) {
      addLog('success', `重新上传成功: ${result.filePath}`);
      showNotification(`重新上传成功: ${getFileName(result.filePath)}`, 'success');
      
      // 从失败列表中移除
      failedItems.splice(index, 1);
      renderFailedItemsTable();
      
      // 更新统计
      stats.uploadsSuccess++;
      updateStats();
    } else {
      addLog('error', `重新上传失败: ${result.filePath}, 错误: ${result.error}`);
      showNotification(`重新上传失败: ${getFileName(result.filePath)}, 错误: ${result.error}`, 'error');
    }
  } catch (error) {
    console.error('重新上传失败:', error);
    addLog('error', `重新上传失败: ${error.message}`);
    showNotification(`重新上传失败: ${error.message}`, 'error');
  }
}

// 重新上传所有失败项目
async function retryAllFailedItems() {
  if (failedItems.length === 0) {
    showNotification('没有失败项目需要重新上传', 'warning');
    return;
  }
  
  addLog('info', `开始重新上传 ${failedItems.length} 个失败项目`);
  
  try {
    const filePaths = failedItems.map(item => item.filePath);
    
    const response = await fetch('/api/retry-all-uploads', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ filePaths })
    });
    
    const results = await response.json();
    
    const successCount = results.filter(r => r.success).length;
    const failCount = results.length - successCount;
    
    addLog('info', `批量重新上传完成: 成功 ${successCount} 个，失败 ${failCount} 个`);
    showNotification(`批量重新上传完成: 成功 ${successCount} 个，失败 ${failCount} 个`, 'info');
    
    // 更新统计
    stats.uploadsSuccess += successCount;
    updateStats();
    
    // 重新加载失败项目列表
    await showFailedItemsModal();
  } catch (error) {
    console.error('批量重新上传失败:', error);
    addLog('error', `批量重新上传失败: ${error.message}`);
    showNotification(`批量重新上传失败: ${error.message}`, 'error');
  }
}

// 清空所有失败记录
async function clearAllFailedItems() {
  if (failedItems.length === 0) {
    showNotification('没有失败记录需要清空', 'warning');
    return;
  }
  
  if (!confirm(`确定要清空所有 ${failedItems.length} 条失败记录吗？`)) {
    return;
  }
  
  try {
    const response = await fetch('/api/clear-failed-items', {
      method: 'POST'
    });
    
    const result = await response.json();
    
    if (result.success) {
      failedItems = [];
      renderFailedItemsTable();
      addLog('info', '已清空所有失败记录');
      showNotification('已清空所有失败记录', 'success');
      
      // 更新统计
      stats.uploadsFailed = 0;
      updateStats();
    } else {
      addLog('error', `清空失败记录失败: ${result.error}`);
      showNotification(`清空失败记录失败: ${result.error}`, 'error');
    }
  } catch (error) {
    console.error('清空失败记录失败:', error);
    addLog('error', `清空失败记录失败: ${error.message}`);
    showNotification(`清空失败记录失败: ${error.message}`, 'error');
  }
}