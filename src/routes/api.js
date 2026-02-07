// src/routes/api.js
const express = require('express');
const router = express.Router();

// 导入控制器
const TestController = require('../controllers/TestController');
const ClientController = require('../controllers/ClientController');

// 原有的测试数据API
router.get('/status', TestController.getStatus);
router.get('/records', TestController.getTestRecords);
router.post('/records/search', TestController.searchTestRecords);
router.get('/report', TestController.getReport);
router.get('/devices', TestController.getDevices);
router.get('/test-details', TestController.getTestDetails);
router.post('/export-excel', TestController.exportExcel);

// 新增的客户端API
router.post('/client-log', ClientController.receiveClientLog);
router.get('/heartbeat', ClientController.heartbeat);
router.get('/client-status', ClientController.getClientStatus);

module.exports = router;