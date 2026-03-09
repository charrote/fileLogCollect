@echo off
:: AT测试采集客户端 - Web版简单启动脚本

:: 设置端口（可通过环境变量WEB_PORT修改）
if not defined WEB_PORT set WEB_PORT=3002

echo [信息] 正在启动Web版客户端...
echo [信息] 服务端口: %WEB_PORT%
echo [信息] 访问地址: http://localhost:%WEB_PORT%
echo [信息] 按Ctrl+C停止服务器
echo.

:: 尝试打开浏览器
timeout /t 3 /nobreak >nul
start http://localhost:%WEB_PORT%

:: 启动服务器
node web-client.js