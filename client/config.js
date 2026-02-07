// client/config.js
module.exports = {
  // 服务端配置
  server: {
    url: process.env.SERVER_URL || 'http://localhost:3001', // 服务端地址 - 注意：使用HTTP而非HTTPS以避免SSL握手问题
    uploadEndpoint: '/api/upload-log', // 上传日志的API端点
    heartbeatInterval: 30000, // 心跳间隔（毫秒）
  },
  
  // 本地日志监控配置
  collector: {
    logDir: process.env.LOG_DIR || './logs', // 本地日志目录
    filePattern: /\.(log|txt)$/i, // 日志文件模式
    pollInterval: 5000, // 轮询间隔（毫秒）
    batchSize: 10, // 批量上传数量
  },
  
  // 客户端标识
  client: {
    id: process.env.CLIENT_ID || require('os').hostname(), // 客户端ID，默认为主机名
    name: process.env.CLIENT_NAME || 'Default Client', // 客户端名称
    deviceType: process.env.DEVICE_TYPE || 'Test Device', // 设备类型
  }
};