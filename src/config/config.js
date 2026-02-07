// config/config.js
module.exports = {
  database: {
    path: process.env.DB_PATH || './data/test_data.db'  // SQLite数据库路径
  },
  
  collection: {
    devices: [
      {
        name: "Device_001",
        // logDir可以是本地路径或网络共享路径
        // Windows网络路径示例: '\\\\192.168.1.100\\shared\\logs'
        // Linux/Mac网络路径示例: '/mnt/network/logs/device1'
        logDir: process.env.LOG_DIR_001 || './DemoDatas/device001',
        enabled: true
      },
      {
        name: "Device_002", 
        logDir: process.env.LOG_DIR_002 || './DemoDatas/device002',
        enabled: true
      }
    ],
    pollInterval: 5000, // 5秒轮询一次
    maxConcurrent: 3   // 最大并发处理数
  },

  server: {
    port: process.env.PORT || 3000,
    // HOST设置说明:
    // '0.0.0.0' - 允许所有网络接口访问（包括外部网络）
    // '127.0.0.1' 或 'localhost' - 仅允许本地访问
    // 根据安全需求选择合适的设置
    host: process.env.HOST || '0.0.0.0'
  }
};