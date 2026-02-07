// src/controllers/ClientController.js
const DatabaseManager = require('../models/DatabaseManager');
const config = require('../config/config');

// 初始化数据库
const dbManager = new DatabaseManager(config.database.path);
dbManager.connect();

class ClientController {
  // 接收客户端上传的日志数据
  static async receiveClientLog(req, res) {
    try {
      const { deviceName, startTime, endTime, result, ngCount, okCount, originalFilePath, clientInfo, uploadTimestamp, details } = req.body;
      
      // 记录接收到的数据
      console.log(`接收到日志数据: deviceName=${deviceName}, result=${result}, details数量=${details ? details.length : 0}`);
      
      // 验证必要字段
      if (!deviceName || result === undefined || result === null) {
        console.error(`验证失败: deviceName=${deviceName}, result=${result}`);
        return res.status(400).json({
          success: false,
          error: '缺少必要字段: deviceName 或 result'
        });
      }
      
      // 准备要保存的记录
      const record = {
        deviceName: deviceName,
        startTime: startTime,
        endTime: endTime,
        result: result,
        ngCount: ngCount || 0,
        okCount: okCount || 0,
        filePath: originalFilePath || ''
      };
      
      // 保存到数据库
      const recordId = await dbManager.saveTestRecord(record);
      
      // 如果有测试详情，保存它们
      if (details && details.length > 0) {
        await dbManager.saveTestDetails(recordId, details);
      }
      
      res.json({
        success: true,
        message: '日志数据接收成功',
        recordId: recordId,
        detailsCount: details ? details.length : 0
      });
    } catch (error) {
      console.error(`接收客户端日志时出错:`, error);
      console.error('错误详情:', error.stack);
      console.error('请求体:', JSON.stringify(req.body, null, 2));
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  // 处理客户端心跳
  static async heartbeat(req, res) {
    try {
      const { clientId, clientName, timestamp } = req.query;
      
      // 可以在这里记录客户端状态或执行健康检查
      console.log(`收到心跳: Client[${clientId}] - ${clientName} at ${timestamp}`);
      
      res.json({
        success: true,
        message: '心跳接收成功',
        timestamp: new Date().toISOString(),
        serverStatus: 'running'
      });
    } catch (error) {
      console.error('处理心跳时出错:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  // 获取客户端状态
  static async getClientStatus(req, res) {
    try {
      res.json({
        success: true,
        status: 'running',
        timestamp: new Date().toISOString(),
        message: '服务端运行正常，准备接收客户端数据'
      });
    } catch (error) {
      console.error('获取客户端状态时出错:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }
}

module.exports = ClientController;