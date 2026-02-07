// server.js
const express = require('express');
const cors = require('cors'); // 添加CORS支持
const path = require('path');
const fs = require('fs');

// 导入配置和服务
const config = require('./src/config/config');
const DatabaseManager = require('./src/models/DatabaseManager');
const LogParser = require('./src/services/LogParser');
const LogCollector = require('./src/services/LogCollector');
const ReportService = require('./src/services/ReportService');
const apiRoutes = require('./src/routes/api');

// 创建Express应用
const app = express();

// 中间件
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// 静态文件服务
app.use('/static', express.static(path.join(__dirname, 'public')));
app.use(express.static(path.join(__dirname, 'public')));

// API路由
app.use('/api', apiRoutes);

// 根路径返回前端界面
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// API文档路径
app.get('/api', (req, res) => {
  res.json({
    message: 'AT测试采集系统API服务',
    version: '1.0.0',
    status: 'running',
    endpoints: {
      status: '/api/status',
      records: '/api/records',
      report: '/api/report',
      devices: '/api/devices',
      export: '/api/export-excel'
    }
  });
});

// 错误处理中间件
app.use((err, req, res, next) => {
  console.error('服务器错误:', err);
  res.status(500).json({
    error: 'Internal Server Error',
    message: process.env.NODE_ENV === 'development' ? err.message : 'An error occurred'
  });
});

// 初始化数据库和服务
let dbManager;
let logCollector;

async function initializeServices() {
  try {
    // 创建数据目录
    const dataDir = path.dirname(config.database.path);
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
      console.log(`创建数据目录: ${dataDir}`);
    }

    // 初始化数据库
    dbManager = new DatabaseManager(config.database.path);
    dbManager.connect();
    console.log('数据库连接已建立');

    // 初始化服务
    const logParser = new LogParser();
    logCollector = new LogCollector(config, dbManager, logParser);
    
    // 启动日志收集器
    await logCollector.startWatching();
    console.log('日志收集器已启动');

    // 启动服务器
    const server = app.listen(config.server.port, config.server.host, () => {
      console.log(`AT测试采集系统服务器运行在 http://${config.server.host}:${config.server.port}`);
    });

    // 处理程序退出信号
    process.on('SIGINT', gracefulShutdown);
    process.on('SIGTERM', gracefulShutdown);

    function gracefulShutdown() {
      console.log('正在关闭服务器...');
      if (logCollector) {
        logCollector.stopWatching();
      }
      if (dbManager) {
        dbManager.close();
      }
      process.exit(0);
    }

    return server;
  } catch (error) {
    console.error('初始化服务时出错:', error);
    process.exit(1);
  }
}

// 启动应用程序
if (require.main === module) {
  initializeServices();
}

module.exports = app;