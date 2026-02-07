@echo off
REM client/start-client.bat
REM AT测试采集客户端启动脚本（Windows版本）
REM 此脚本会自动设置必要的环境变量以解决SSL问题

echo ========================================
echo AT测试采集客户端启动脚本
echo ========================================

REM 设置环境变量以解决SSL问题
set NODE_TLS_REJECT_UNAUTHORIZED=0
set ELECTRON_DISABLE_SECURITY_WARNINGS=true

REM 获取脚本所在目录
cd /d "%~dp0"

REM 显示菜单
echo 请选择客户端类型：
echo 1. GUI界面客户端（推荐）
echo 2. 命令行客户端
echo 3. 精简版客户端（无外部依赖，最佳SSL兼容性）
echo 4. 退出
echo ========================================

set /p choice=请输入选项 (1-4): 

if "%choice%"=="1" (
    echo 启动GUI界面客户端...
    REM 检查是否安装了electron
    npm list electron >nul 2>&1
    if %errorlevel% neq 0 (
        echo Electron未安装，正在安装...
        npm install electron --save-dev
    )
    
    REM 启动GUI
    npm start
) else if "%choice%"=="2" (
    echo 启动命令行客户端...
    node client.js
) else if "%choice%"=="3" (
    echo 启动精简版客户端（最佳SSL兼容性）...
    node simple-client.js
) else if "%choice%"=="4" (
    echo 退出
    exit /b 0
) else (
    echo 无效选项，启动默认的命令行客户端...
    node client.js
)

pause