/**
 * 测试日志显示功能的脚本
 * 此脚本用于验证日志窗口的滚动和限制功能
 */

const fs = require('fs');
const path = require('path');

// 生成测试日志
function generateTestLogs() {
    console.log('开始生成测试日志...');
    
    for (let i = 0; i < 600; i++) {
        const timestamp = new Date().toISOString();
        const logMessage = `[${timestamp}] 测试日志条目 ${i+1}: 这是一条模拟的日志消息`;
        
        // 输出到控制台
        console.log(logMessage);
        
        // 如果有日志文件，也可以写入文件
        // appendToLogFile(logMessage);
        
        // 短暂延迟，模拟实际的日志产生
        if (i % 50 === 0) {
            console.log(`--- 已生成 ${i+1} 条日志 ---`);
        }
    }
    
    console.log('测试日志生成完成！');
}

// 将日志追加到文件（可选）
function appendToLogFile(message) {
    const logDir = './logs';
    if (!fs.existsSync(logDir)) {
        fs.mkdirSync(logDir, { recursive: true });
    }
    
    const logFilePath = path.join(logDir, 'test.log');
    fs.appendFileSync(logFilePath, message + '\n');
}

// 如果直接运行此文件，则执行测试
if (require.main === module) {
    generateTestLogs();
}

module.exports = {
    generateTestLogs,
    appendToLogFile