// client/LogCollector.js
const fs = require('fs').promises;
const path = require('path');
const axios = require('axios');
const iconv = require('iconv-lite');
const os = require('os');

// 持久化存储路径 - 改为应用目录下的data文件夹
const appPath = path.resolve(__dirname, '..');
const userDataPath = path.join(appPath, 'data');
const successItemsPath = path.join(userDataPath, 'success-items.json');
const failedItemsPath = path.join(userDataPath, 'failed-items.json');

class LogCollector {
  constructor(config, uploader) {
    this.config = config;
    this.uploader = uploader;
    this.processedFiles = new Set(); // 已处理文件集合
    this.successItems = new Set(); // 成功上传文件集合
    this.failedItems = new Map(); // 失败上传文件映射
    this.fsWatcher = null;
    this.isRunning = false;
  }

  async start() {
    console.log(`开始监控日志目录: ${this.config.collector.logDir}`);
    this.isRunning = true;
    
    // 确保日志目录存在
    if (!(await this.dirExists(this.config.collector.logDir))) {
      console.log(`创建日志目录: ${this.config.collector.logDir}`);
      await fs.mkdir(this.config.collector.logDir, { recursive: true });
    }
    
    // 加载成功项目列表
    await this.loadSuccessItems();
    
    // 加载失败项目列表
    await this.loadFailedItems();
    
    // 先处理已存在的日志文件
    await this.processExistingFiles();
    
    // 设置文件监控
    await this.setupFileWatch();
  }

  // 加载成功项目列表
  async loadSuccessItems() {
    try {
      // 确保用户数据目录存在
      await fs.mkdir(userDataPath, { recursive: true });
      
      // 加载成功项目列表
      try {
        const successData = await fs.readFile(successItemsPath, 'utf8');
        const successItemsArray = JSON.parse(successData);
        this.successItems = new Set(successItemsArray);
        console.log(`已加载 ${this.successItems.size} 个成功上传记录`);
      } catch (error) {
        // 文件不存在或解析错误，使用空集合
        this.successItems = new Set();
      }
    } catch (error) {
      console.error('加载成功项目列表失败:', error);
      this.successItems = new Set();
    }
  }

  // 保存成功项目列表
  async saveSuccessItems() {
    try {
      await fs.writeFile(successItemsPath, JSON.stringify([...this.successItems], null, 2));
    } catch (error) {
      console.error('保存成功项目列表失败:', error);
    }
  }

  // 检查文件是否已成功上传
  isFileAlreadyUploaded(filePath) {
    return this.successItems.has(filePath);
  }

  // 添加成功上传的文件
  async addSuccessItem(filePath) {
    this.successItems.add(filePath);
    await this.saveSuccessItems();
    
    // 从失败列表中移除（如果存在）
    if (this.failedItems.has(filePath)) {
      this.failedItems.delete(filePath);
      await this.saveFailedItems();
    }
  }

  // 加载失败项目列表
  async loadFailedItems() {
    try {
      // 确保用户数据目录存在
      await fs.mkdir(userDataPath, { recursive: true });
      
      // 加载失败项目列表
      try {
        const failedData = await fs.readFile(failedItemsPath, 'utf8');
        const failedItemsArray = JSON.parse(failedData);
        this.failedItems = new Map(failedItemsArray.map(item => [item.filePath, item]));
        console.log(`已加载 ${this.failedItems.size} 个失败上传记录`);
      } catch (error) {
        // 文件不存在或解析错误，使用空映射
        this.failedItems = new Map();
      }
    } catch (error) {
      console.error('加载失败项目列表失败:', error);
      this.failedItems = new Map();
    }
  }

  // 保存失败项目列表
  async saveFailedItems() {
    try {
      const failedItemsArray = Array.from(this.failedItems.values());
      await fs.writeFile(failedItemsPath, JSON.stringify(failedItemsArray, null, 2));
    } catch (error) {
      console.error('保存失败项目列表失败:', error);
    }
  }

  // 添加失败上传的文件
  async addFailedItem(filePath, errorReason) {
    const item = {
      filePath,
      errorReason,
      timestamp: new Date().toISOString()
    };
    
    this.failedItems.set(filePath, item);
    await this.saveFailedItems();
    
    // 从成功列表中移除（如果存在）
    if (this.successItems.has(filePath)) {
      this.successItems.delete(filePath);
      await this.saveSuccessItems();
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

  async processExistingFiles() {
    try {
      const files = await fs.readdir(this.config.collector.logDir);
      for (const filename of files) {
        if (this.config.collector.filePattern.test(filename)) {
          const filePath = path.join(this.config.collector.logDir, filename);
          const stats = await fs.stat(filePath);
          if (stats.isFile()) {
            await this.handleNewFile(filePath);
          }
        }
      }
    } catch (error) {
      console.error(`处理现有文件失败:`, error);
    }
  }

  async setupFileWatch() {
    try {
      this.fsWatcher = fs.watch(this.config.collector.logDir);
      
      const self = this;
      (async () => {
        try {
          for await (const event of this.fsWatcher) {
            if (event.eventType === 'rename') { // 文件创建或重命名
              const filePath = path.join(this.config.collector.logDir, event.filename);
              
              // 检查是否为日志文件
              if (self.config.collector.filePattern.test(event.filename)) {
                await self.handleNewFile(filePath);
              }
            }
          }
        } catch (error) {
          if (this.isRunning) {
            console.error('文件监控出错:', error);
          }
        }
      })();
    } catch (error) {
      console.error(`设置文件监控失败:`, error);
    }
  }

  async handleNewFile(filePath) {
    try {
      const stats = await fs.stat(filePath);
      if (stats.isFile()) {
        // 检查是否已处理过
        if (this.processedFiles.has(filePath)) {
          return;
        }

        // 检查是否已成功上传过（防重复上传）
        if (this.isFileAlreadyUploaded(filePath)) {
          console.log(`文件已成功上传过，跳过: ${filePath}`);
          return;
        }

        // 解析日志文件
        const testSessions = await this.parseLogFile(filePath);
        
        if (testSessions.length === 0) {
          console.log(`文件中没有有效的测试会话: ${filePath}`);
          return;
        }
        
        // 上传每个测试会话到服务端
        let allUploadSuccess = true;
        let firstError = null;
        let successCount = 0;
        let failCount = 0;
        
        for (let i = 0; i < testSessions.length; i++) {
          const session = testSessions[i];
          let uploadSuccess = false;
          
          // 尝试上传，最多重试3次
          for (let retry = 0; retry <= 2 && !uploadSuccess; retry++) {
            try {
              const uploadResult = await this.uploader.uploadLog(session, filePath);
              
              if (uploadResult === true) {
                // 上传成功
                successCount++;
                uploadSuccess = true;
                console.log(`已上传测试会话 ${i+1}/${testSessions.length}: ${session.deviceName}, 结果: ${session.result}, 开始时间: ${session.startTime}`);
              } else {
                // 上传失败
                if (retry < 2) {
                  // 重试前等待更长时间
                  console.warn(`上传测试会话失败，准备第${retry+1}次重试 ${i+1}/${testSessions.length}: ${session.deviceName}`);
                  await new Promise(resolve => setTimeout(resolve, 1000 * (retry + 1))); // 递增延迟：1s, 2s
                } else {
                  // 最后一次重试也失败
                  allUploadSuccess = false;
                  failCount++;
                  if (!firstError) {
                    firstError = uploadResult.error || '未知错误';
                  }
                  console.error(`上传测试会话失败，已重试3次 ${i+1}/${testSessions.length}: ${session.deviceName}, 错误: ${firstError}`);
                }
              }
            } catch (error) {
              // 捕获异常
              if (retry < 2) {
                // 重试前等待更长时间
                console.warn(`上传测试会话异常，准备第${retry+1}次重试 ${i+1}/${testSessions.length}: ${session.deviceName}, 错误: ${error.message}`);
                await new Promise(resolve => setTimeout(resolve, 1000 * (retry + 1))); // 递增延迟：1s, 2s
              } else {
                // 最后一次重试也失败
                allUploadSuccess = false;
                failCount++;
                uploadSuccess = false;
                if (!firstError) {
                  firstError = error.message || '未知错误';
                }
                console.error(`上传测试会话异常，已重试3次 ${i+1}/${testSessions.length}: ${session.deviceName}, 错误: ${firstError}`);
              }
            }
          }
          
          // 添加延迟，避免服务器过载
          if (i < testSessions.length - 1) {
            await new Promise(resolve => setTimeout(resolve, 100)); // 100ms延迟
          }
        }
        
        // 如果全部上传成功，添加到成功列表
        if (allUploadSuccess) {
          await this.addSuccessItem(filePath);
          console.log(`文件全部上传成功: ${filePath}, 成功: ${successCount}, 失败: ${failCount}, 共处理 ${testSessions.length} 个测试会话`);
        } else {
          // 如果部分成功，也记录到成功列表，但保留失败记录
          if (successCount > 0) {
            await this.addSuccessItem(filePath);
            console.log(`文件部分上传成功: ${filePath}, 成功: ${successCount}, 失败: ${failCount}, 共处理 ${testSessions.length} 个测试会话`);
          } else {
            await this.addFailedItem(filePath, firstError);
            console.error(`文件全部上传失败: ${filePath}, 错误: ${firstError}, 成功: ${successCount}, 失败: ${failCount}, 共处理 ${testSessions.length} 个测试会话`);
          }
        }
        
        // 标记为已处理
        this.processedFiles.add(filePath);
      }
    } catch (error) {
      console.error(`处理文件失败 ${filePath}:`, error);
    }
  }

  async parseLogFile(filePath) {
    try {
      // 以二进制方式读取文件
      const buffer = await fs.readFile(filePath);
      
      // 尝试使用utf16le编码解码
      let content;
      try {
        content = iconv.decode(buffer, 'utf16le');
      } catch (error) {
        // 如果utf16le失败，回退到utf8
        content = buffer.toString('utf8');
      }
      
      const lines = content.split('\n');
      
      const testSessions = [];  // 存储所有测试会话
      let currentSession = null;
      
      for (let line of lines) {
        // 检查是否是测试开始的标记
        if (this.isTestStart(line)) {
          // 如果已有当前会话，先保存它
          if (currentSession) {
            testSessions.push(currentSession);
          }
          
          // 创建新的测试会话
          const timeInfo = this.extractTimeInfo(line);
          currentSession = {
            startTime: timeInfo.time,
            endTime: null,
            details: [],
            ngCount: 0,
            okCount: 0
          };
          continue;
        }
        
        // 检查是否是测试结束的标记
        if (this.isTestEnd(line) && currentSession) {
          const timeInfo = this.extractTimeInfo(line);
          currentSession.endTime = timeInfo.time;
          
          // 计算测试结果
          currentSession.result = currentSession.ngCount > 0 ? 'NG' : 'OK';
          
          // 保存当前会话
          testSessions.push(currentSession);
          currentSession = null;
          continue;
        }
        
        // 如果在测试会话中，解析测试详情
        if (currentSession) {
          const detail = this.parseTestDetail(line);
          if (detail) {
            currentSession.details.push(detail);
            if (detail.testResult === 'NG') {
              currentSession.ngCount++;
            } else {
              currentSession.okCount++;
            }
          }
        }
      }
      
      // 如果文件结束时还有未保存的会话，保存它
      if (currentSession) {
        // 计算测试结果
        currentSession.result = currentSession.ngCount > 0 ? 'NG' : 'OK';
        // 如果没有结束时间，使用最后一个详情的时间作为结束时间
        if (!currentSession.endTime && currentSession.details.length > 0) {
          const lastDetail = currentSession.details[currentSession.details.length - 1];
          currentSession.endTime = new Date(lastDetail.testTime);
        }
        // 如果仍然没有结束时间，使用开始时间加1小时作为默认结束时间
        if (!currentSession.endTime && currentSession.startTime) {
          const endTime = new Date(currentSession.startTime);
          endTime.setHours(endTime.getHours() + 1);
          currentSession.endTime = endTime;
        }
        testSessions.push(currentSession);
      }
      
      // 返回所有测试会话
      return testSessions.map(session => {
        // 如果没有结束时间，使用最后一个详情的时间作为结束时间
        if (!session.endTime && session.details.length > 0) {
          const lastDetail = session.details[session.details.length - 1];
          session.endTime = new Date(lastDetail.testTime);
        }
        // 如果仍然没有结束时间，使用开始时间加1小时作为默认结束时间
        if (!session.endTime && session.startTime) {
          const endTime = new Date(session.startTime);
          endTime.setHours(endTime.getHours() + 1);
          session.endTime = endTime;
        }
        
        return {
          deviceName: this.config.client.name,
          startTime: session.startTime ? session.startTime.toISOString() : null,
          endTime: session.endTime ? session.endTime.toISOString() : null,
          result: session.result || (session.ngCount > 0 ? 'NG' : 'OK'), // 确保result不为undefined
          ngCount: session.ngCount,
          okCount: session.okCount,
          details: session.details,
          filePath: path.basename(filePath),
          clientInfo: {
            clientId: this.config.client.id,
            clientName: this.config.client.name,
            deviceType: this.config.client.deviceType
          }
        };
      });
    } catch (error) {
      console.error(`解析日志文件失败 ${filePath}:`, error);
      throw error;
    }
  }

  isTestStart(line) {
    // 匹配测试开始标记: "来了一块新板卡，开始测试"
    return /来了一块新板卡，开始测试/.test(line);
  }

  isTestEnd(line) {
    // 匹配测试结束标记: "************测试结束,没有发现问题*************"
    return /测试结束.*没有发现问题/.test(line);
  }

  extractTimeInfo(line) {
    // 从日志行中提取时间信息: [7018][2025-05-26][16:57:16][T03576][OneBoardTest.cpp    ][0446][T]OneBoardTest::MainTestFunc--> 来了一块新板卡，开始测试
    const dateMatch = line.match(/^\[(\d+)\]\[(\d{4}-\d{2}-\d{2})\]\[(\d{2}:\d{2}:\d{2})\]/);
    if (dateMatch) {
      const dateStr = dateMatch[2];
      const timeStr = dateMatch[3];
      const dateTimeStr = `${dateStr} ${timeStr}`;
      return { time: new Date(dateTimeStr), raw: dateTimeStr };
    }
    return { time: null, raw: null };
  }

  parseTestDetail(line) {
    // 解析测试详情: [7025][2025-05-26][16:57:24][T03576][OneBoardTest_Currenc][1672][W]OneBoardTest::NewLevelTestPinByPin--> 第3个管脚LVDS OK 电压值：5.27(4.50,5.50)
    const logSequenceMatch = line.match(/^\[(\d+)\]/);
    const timeInfo = this.extractTimeInfo(line);
    
    // 检查是否是测试详情行
    if (!logSequenceMatch || !timeInfo.time || !line.includes('OneBoardTest::NewLevelTestPinByPin-->')) {
      return null;
    }
    
    // 提取测试内容、结果和数值
    const detailMatch = line.match(/OneBoardTest::NewLevelTestPinByPin--> (.+?) (OK|NG) (.+?)：([\d.]+)\(([\d.]+),([\d.]+)\)/);
    if (!detailMatch) {
      return null;
    }
    
    return {
      logSequence: parseInt(logSequenceMatch[1]),
      testTime: timeInfo.time.toISOString(),
      testContent: detailMatch[1],
      testResult: detailMatch[2],
      measuredValue: parseFloat(detailMatch[4]),
      specMin: parseFloat(detailMatch[5]),
      specMax: parseFloat(detailMatch[6])
    };
  }

  parseDateTime(timeStr) {
    // 尝试多种时间格式解析
    let date = new Date(timeStr);
    
    if (isNaN(date.getTime())) {
      // 如果年份缺失，添加当前年份
      if (timeStr.includes(':')) {
        const currentYear = new Date().getFullYear();
        if (timeStr.length <= 8) { // HH:MM:SS format
          date = new Date(`${currentYear}-01-01 ${timeStr}`);
        } else { // MM/DD or DD/MM format
          date = new Date(`${currentYear}-${timeStr}`);
        }
      }
    }
    
    return date;
  }

  containsNG(line) {
    return /NG|Fail|Failed|Error|ERROR|ng|fail|failed|error/gi.test(line);
  }

  containsOK(line) {
    return /OK|Pass|Passed|Success|SUCCESS|ok|pass|passed|success/gi.test(line);
  }

  async stop() {
    this.isRunning = false;
    if (this.fsWatcher) {
      this.fsWatcher.close();
    }
    console.log('日志采集器已停止');
  }
}

module.exports = LogCollector;