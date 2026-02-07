// src/services/LogCollector.js
const fs = require('fs').promises;
const path = require('path');

class LogCollector {
  constructor(config, databaseManager, logParser) {
    this.config = config;
    this.databaseManager = databaseManager;
    this.logParser = logParser;
    this.processedFiles = new Set(); // 避免重复处理
    this.fsWatcher = null;
    this.processingQueue = []; // 处理队列
    this.isProcessing = false;
  }

  async startWatching() {
    console.log('开始监控日志目录...');
    
    // 初始化已处理文件集合
    await this.loadProcessedFiles();
    
    // 为每个启用的设备设置监控
    for (const device of this.config.collection.devices) {
      if (device.enabled) {
        await this.setupDeviceWatch(device);
      }
    }
  }

  async loadProcessedFiles() {
    // 加载已处理的文件列表到内存中以提高性能
    // 注意：在实际生产环境中，如果文件很多，可能需要优化此部分
  }

  async setupDeviceWatch(device) {
    try {
      // 确保目录存在
      if (!await this.dirExists(device.logDir)) {
        console.log(`创建日志目录: ${device.logDir}`);
        await fs.mkdir(device.logDir, { recursive: true });
      }
      
      // 先处理已存在的日志文件
      await this.processExistingFiles(device);
      
      // 设置文件监控
      this.fsWatcher = fs.watch(device.logDir);
      
      // 使用异步迭代器处理文件变化
      const self = this;
      (async () => {
        try {
          for await (const event of this.fsWatcher) {
            if (event.eventType === 'rename') { // 文件创建或重命名
              const filePath = path.join(device.logDir, event.filename);
              await self.handleNewFile(filePath, device.name);
            }
          }
        } catch (error) {
          console.error('文件监控出错:', error);
        }
      })();
      
      console.log(`已设置设备 ${device.name} 的日志监控: ${device.logDir}`);
    } catch (error) {
      console.error(`设置设备监控失败 ${device.name}:`, error);
    }
  }

  async dirExists(dir) {
    try {
      const stat = await fs.stat(dir);
      return stat.isDirectory();
    } catch (error) {
      return false;
    }
  }

  async processExistingFiles(device) {
    try {
      const files = await fs.readdir(device.logDir);
      for (const filename of files) {
        const filePath = path.join(device.logDir, filename);
        const stats = await fs.stat(filePath);
        if (stats.isFile() && this.isValidLogFile(filename)) {
          await this.handleNewFile(filePath, device.name);
        }
      }
    } catch (error) {
      console.error(`处理现有文件失败 ${device.logDir}:`, error);
    }
  }

  isValidLogFile(filename) {
    // 检查是否为日志文件
    return /\.(log|txt)$/i.test(filename);
  }

  async handleNewFile(filePath, deviceName) {
    try {
      const stats = await fs.stat(filePath);
      if (stats.isFile() && this.isValidLogFile(path.basename(filePath))) {
        // 检查是否已处理过
        const isAlreadyProcessed = await this.databaseManager.isAlreadyProcessed(filePath);
        if (isAlreadyProcessed) {
          return;
        }

        // 添加到处理队列
        this.addToQueue({
          filePath,
          deviceName
        });
      }
    } catch (error) {
      console.error(`处理新文件失败 ${filePath}:`, error);
    }
  }

  addToQueue(item) {
    this.processingQueue.push(item);
    // 如果没有正在处理，则开始处理队列
    if (!this.isProcessing) {
      this.processQueue();
    }
  }

  async processQueue() {
    if (this.processingQueue.length === 0) {
      this.isProcessing = false;
      return;
    }

    this.isProcessing = true;
    const item = this.processingQueue.shift();

    try {
      // 新的解析逻辑返回多个测试会话
      const testSessions = await this.logParser.parseLogFile(item.filePath);
      
      // 保存每个测试会话
      for (const session of testSessions) {
        // 保存测试记录
        const testRecordId = await this.databaseManager.saveTestRecord(session);
        
        // 如果有测试详情，保存它们
        if (session.details && session.details.length > 0) {
          await this.databaseManager.saveTestDetails(testRecordId, session.details);
        }
        
        console.log(`成功处理测试会话: ${item.deviceName}, 结果: ${session.result}, 开始时间: ${session.startTime}`);
      }
      
      // 标记文件为已处理
      await this.databaseManager.markAsProcessed(item.filePath);
      console.log(`文件处理完成: ${item.filePath}, 共处理 ${testSessions.length} 个测试会话`);
    } catch (error) {
      console.error(`处理队列中的文件失败 ${item.filePath}:`, error);
    }

    // 处理下一个队列项
    setTimeout(() => {
      this.processQueue();
    }, 100); // 添加小延迟以避免过于频繁的操作
  }

  stopWatching() {
    if (this.fsWatcher) {
      this.fsWatcher.close();
    }
  }
}

module.exports = LogCollector;