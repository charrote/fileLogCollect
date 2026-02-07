// src/services/LogParser.js
const fs = require('fs').promises;
const path = require('path');
const iconv = require('iconv-lite');

class LogParser {
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
      let deviceName = this.extractDeviceName(filePath);
      
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
        currentSession.result = currentSession.ngCount > 0 ? 'NG' : 'OK';
        testSessions.push(currentSession);
      }
      
      // 返回所有测试会话
      return testSessions.map(session => ({
        deviceName: deviceName,
        startTime: session.startTime ? session.startTime.toISOString() : null,
        endTime: session.endTime ? session.endTime.toISOString() : null,
        result: session.result,
        ngCount: session.ngCount,
        okCount: session.okCount,
        details: session.details,
        filePath
      }));
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

  extractDeviceName(filePath) {
    const pathParts = filePath.split(/[\/\\]/);
    // 尝试从路径中提取设备名
    const devicePart = pathParts.find(part => part.toLowerCase().includes('device') || part.toLowerCase().includes('dev'));
    return devicePart || 'Unknown Device';
  }
}

module.exports = LogParser;