:: 这是一个简单的批处理脚本，用于启动日志采集客户端 CLI 模式,不带图形界面
@echo off
setlocal enabledelayedexpansion

:: 配置环境变量（请根据你的实际情况修改）
set "SERVER_URL=http://192.168.88.1:3000"
set "CLIENT_NAME=60#1-01"
set "LOG_DIR=./logs"

:: 启动 CLI 客户端
echo 正在启动日志采集客户端 CLI 模式...
npm run start-cli

if %ERRORLEVEL% neq 0 (
    echo 客户端启动失败，错误代码: %ERRORLEVEL%
    pause
) else (
    echo 客户端已正常退出
)

endlocal