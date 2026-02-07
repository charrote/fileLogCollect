// src/services/ReportService.js
const XLSX = require('xlsx');

class ReportService {
  constructor(databaseManager) {
    this.db = databaseManager;
  }

  async generateReport(startDate, endDate, deviceName = null) {
    try {
      // 获取统计摘要
      const summary = await this.db.getSummaryStats(startDate, endDate);
      
      // 获取详细记录用于Excel导出
      const details = await this.db.getTestRecords(startDate, endDate, deviceName);

      return {
        summary: {
          total: summary.total || 0,
          okCount: summary.ok_count || 0,
          ngCount: summary.ng_count || 0,
          okRate: summary.ok_rate ? parseFloat(summary.ok_rate.toFixed(2)) : 0
        },
        details: details
      };
    } catch (error) {
      console.error('生成报表时出错:', error);
      throw error;
    }
  }

  async exportToExcel(reportData, outputPath) {
    try {
      // 创建工作簿
      const wb = XLSX.utils.book_new();
      
      // 汇总表
      const summaryData = [
        ['统计项', '数量'],
        ['总测试数', reportData.summary.total],
        ['OK数量', reportData.summary.okCount],
        ['NG数量', reportData.summary.ngCount],
        ['OK比例', reportData.summary.okRate + '%']
      ];
      const summaryWs = XLSX.utils.aoa_to_sheet(summaryData);
      XLSX.utils.book_append_sheet(wb, summaryWs, '汇总统计');
      
      // 详细记录表
      const detailHeaders = ['设备名称', '开始时间', '结束时间', '结果', 'NG数量', 'OK数量', '记录时间'];
      const detailRows = [detailHeaders];
      
      reportData.details.forEach(record => {
        detailRows.push([
          record.device_name,
          record.start_time,
          record.end_time,
          record.result,
          record.ng_count,
          record.ok_count,
          record.created_at
        ]);
      });
      
      const detailWs = XLSX.utils.aoa_to_sheet(detailRows);
      XLSX.utils.book_append_sheet(wb, detailWs, '详细记录');
      
      // 写入文件
      XLSX.writeFile(wb, outputPath);
      return outputPath;
    } catch (error) {
      console.error('导出Excel时出错:', error);
      throw error;
    }
  }

  async getAvailableDevices() {
    try {
      return await this.db.getAllDevices();
    } catch (error) {
      console.error('获取设备列表时出错:', error);
      throw error;
    }
  }
}

module.exports = ReportService;