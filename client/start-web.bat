@echo off
chcp 65001 >nul
setlocal enabledelayedexpansion

:: AT测试采集客户端 - Web版启动脚本
:: 一键启动Web版客户端，自动检查环境和依赖

title AT测试采集客户端 - Web版

:: 设置颜色
color 0A

:: 设置端口（可通过环境变量WEB_PORT修改）
if not defined WEB_PORT set WEB_PORT=3002

echo.
echo ========================================
echo   AT测试采集客户端 - Web版启动
echo ========================================
echo.

:: 检查是否在正确的目录
if not exist "web-client.js" (
    echo [错误] 未找到 web-client.js 文件
    echo [提示] 请确保在 client 目录下运行此脚本
    echo.
    pause
    exit /b 1
)

:: 检查Node.js是否安装
echo [检查] 正在检查Node.js环境...
where node >nul 2>&1
if %errorlevel% neq 0 (
    echo [错误] 未找到Node.js，请先安装Node.js
    echo [提示] 访问 https://nodejs.org/ 下载安装
    echo.
    pause
    exit /b 1
)

:: 显示Node.js版本
for /f "tokens=*" %%i in ('node -v') do set NODE_VERSION=%%i
echo [成功] Node.js版本: !NODE_VERSION!

:: 检查依赖是否安装
echo [检查] 正在检查依赖包...
if not exist "node_modules" (
    echo [警告] 未找到依赖包，正在安装...
    echo.
    call npm install
    if %errorlevel% neq 0 (
        echo [错误] 依赖安装失败
        echo.
        pause
        exit /b 1
    )
    echo [成功] 依赖安装完成
) else (
    echo [成功] 依赖包已安装
)

echo.
echo ========================================
echo   启动信息
echo ========================================
echo [端口] %WEB_PORT%
echo [地址] http://localhost:%WEB_PORT%
echo [状态] 正在启动服务器...
echo [提示] 按Ctrl+C停止服务器
echo ========================================
echo.

:: 启动服务器（在后台启动）
start /B node web-client.js

:: 等待服务器启动
echo [等待] 正在等待服务器启动...
timeout /t 3 /nobreak >nul

:: 检查服务器是否启动成功
curl -s http://localhost:%WEB_PORT% >nul 2>&1
if %errorlevel% equ 0 (
    echo [成功] 服务器启动成功！
    echo.
    
    :: 尝试打开浏览器
    echo [浏览器] 正在打开浏览器...
    start http://localhost:%WEB_PORT%
    
    echo.
    echo ========================================
    echo   服务器运行中
    echo ========================================
    echo [提示] 关闭此窗口将停止服务器
    echo [提示] 或按Ctrl+C停止服务器
    echo ========================================
    echo.
    
    :: 保持窗口打开
    node web-client.js
) else (
    echo [错误] 服务器启动失败
    echo [提示] 请检查端口 %WEB_PORT% 是否被占用
    echo.
    pause
    exit /b 1
)

endlocal