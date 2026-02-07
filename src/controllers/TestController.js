// src/controllers/TestController.js
const DatabaseManager = require('../models/DatabaseManager');
const ReportService = require('../services/ReportService');
const config = require('../config/config');

// 初始化服务
const dbManager = new DatabaseManager(config.database.path);
dbManager.connect();
const reportService = new ReportService(dbManager);

class TestController {
  static async getStatus(req, res) {
    try {
      const now = new Date();
      res.json({
        status: 'running',
        timestamp: now.toISOString(),
        uptime: process.uptime(),
        message: 'AT测试采集系统运行正常'
      });
    } catch (error) {
      console.error('获取状态时出错:', error);
      res.status(500).json({ error: error.message });
    }
  }

  static async getTestRecords(req, res) {
    try {
      const { startDate, endDate, deviceName, result, page = 1, limit = 50 } = req.query;
      
      const start = startDate ? new Date(startDate).toISOString() : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(); // 默认最近30天
      const end = endDate ? new Date(endDate).toISOString() : new Date().toISOString();
      
      const records = await dbManager.getTestRecords(start, end, deviceName, result);
      
      // 获取统计数据
      const summaryStats = await dbManager.getSummaryStats(start, end, deviceName);
      
      // 分页
      const startIndex = (page - 1) * limit;
      const endIndex = startIndex + parseInt(limit);
      const paginatedRecords = records.slice(startIndex, endIndex);
      
      res.json({
        success: true,
        data: paginatedRecords,
        summary: {
          total: summaryStats.total || 0,
          okCount: summaryStats.ok_count || 0,
          ngCount: summaryStats.ng_count || 0,
          okRate: summaryStats.ok_rate ? parseFloat(summaryStats.ok_rate.toFixed(2)) : 0
        },
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(records.length / parseInt(limit)),
          totalRecords: records.length,
          hasNext: endIndex < records.length,
          hasPrev: startIndex > 0
        }
      });
    } catch (error) {
      console.error('获取测试记录时出错:', error);
      res.status(500).json({ error: error.message });
    }
  }

  static async searchTestRecords(req, res) {
    try {
      const { startDate, endDate, deviceName } = req.body;
      
      const start = startDate ? new Date(startDate).toISOString() : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(); // 默认最近7天
      const end = endDate ? new Date(endDate).toISOString() : new Date().toISOString();
      
      const records = await dbManager.getTestRecords(start, end, deviceName);
      
      res.json({
        success: true,
        data: records
      });
    } catch (error) {
      console.error('搜索测试记录时出错:', error);
      res.status(500).json({ error: error.message });
    }
  }

  static async getReport(req, res) {
    try {
      const { startDate, endDate, deviceName } = req.query;
      
      const start = startDate ? new Date(startDate).toISOString() : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(); // 默认最近7天
      const end = endDate ? new Date(endDate).toISOString() : new Date().toISOString();
      
      const report = await reportService.generateReport(start, end, deviceName);
      
      res.json({
        success: true,
        data: report
      });
    } catch (error) {
      console.error('生成报表时出错:', error);
      res.status(500).json({ error: error.message });
    }
  }

  static async getDevices(req, res) {
    try {
      const devices = await reportService.getAvailableDevices();
      
      res.json({
        success: true,
        data: devices
      });
    } catch (error) {
      console.error('获取设备列表时出错:', error);
      res.status(500).json({ error: error.message });
    }
  }

  // 获取测试记录的详细信息
  static async getTestDetails(req, res) {
    try {
      const { recordId } = req.query;
      
      if (!recordId) {
        return res.status(400).json({
          success: false,
          error: '缺少记录ID'
        });
      }
      
      const details = await dbManager.getTestDetails(recordId);
      
      res.json({
        success: true,
        details: details
      });
    } catch (error) {
      console.error('获取测试详情时出错:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  static async exportExcel(req, res) {
    try {
      const { startDate, endDate, deviceName } = req.body;
      
      const start = startDate ? new Date(startDate).toISOString() : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(); // 默认最近7天
      const end = endDate ? new Date(endDate).toISOString() : new Date().toISOString();
      
      const report = await reportService.generateReport(start, end, deviceName);
      
      // 生成临时文件名
      const fileName = `test_report_${Date.now()}.xlsx`;
      const outputPath = `./exports/${fileName}`;
      
      // 确保导出目录存在
      const fs = require('fs');
      if (!fs.existsSync('./exports')) {
        fs.mkdirSync('./exports', { recursive: true });
      }
      
      await reportService.exportToExcel(report, outputPath);
      
      // 发送文件给客户端
      res.download(outputPath, fileName, (err) => {
        if (err) {
          console.error('下载文件时出错:', err);
        }
        // 删除临时文件
        setTimeout(() => {
          fs.unlink(outputPath, (unlinkErr) => {
            if (unlinkErr) {
              console.error('删除临时文件时出错:', unlinkErr);
            }
          });
        }, 5000); // 5秒后删除临时文件
      });
    } catch (error) {
      console.error('导出Excel时出错:', error);
      res.status(500).json({ error: error.message });
    }
  }
}

module.exports = TestController;