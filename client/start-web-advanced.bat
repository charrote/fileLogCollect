@echo off
chcp 65001 >nul
setlocal enabledelayedexpansion

:: AT测试采集客户端 - Web版高级启动脚本
:: 提供更多配置选项和功能

title AT测试采集客户端 - Web版（高级模式）

:: 设置颜色
color 0B

:: 默认配置
set DEFAULT_PORT=3002
set DEFAULT_LOG_LEVEL=info

:: 检查是否在正确的目录
if not exist "web-client.js" (
    echo.
    echo ========================================
    echo   错误：未找到 web-client.js 文件
    echo ========================================
    echo.
    echo 请确保在 client 目录下运行此脚本
    echo.
    pause
    exit /b 1
)

:: 检查Node.js是否安装
where node >nul 2>&1
if %errorlevel% neq 0 (
    echo.
    echo ========================================
    echo   错误：未找到Node.js
    echo ========================================
    echo.
    echo 请先安装Node.js
    echo 下载地址：https://nodejs.org/
    echo.
    pause
    exit /b 1
)

:: 显示Node.js版本
for /f "tokens=*" %%i in ('node -v') do set NODE_VERSION=%%i

:: 显示欢迎信息
cls
echo.
echo ╔════════════════════════════════════════╗
echo ║   AT测试采集客户端 - Web版 v1.0       ║
echo ║   高级启动模式                          ║
echo ╚════════════════════════════════════════╝
echo.
echo [环境] Node.js版本: %NODE_VERSION%
echo [目录] %CD%
echo.

:: 菜单选择
:MENU
echo ========================================
echo   请选择操作
echo ========================================
echo.
echo   1. 快速启动（使用默认配置）
echo   2. 自定义端口启动
echo   3. 调试模式启动
echo   4. 检查并安装依赖
echo   5. 查看运行状态
echo   6. 停止运行中的服务
echo   0. 退出
echo.
echo ========================================
set /p CHOICE=请输入选项 (0-6): 

if "%CHOICE%"=="1" goto QUICK_START
if "%CHOICE%"=="2" goto CUSTOM_PORT
if "%CHOICE%"=="3" goto DEBUG_MODE
if "%CHOICE%"=="4" goto INSTALL_DEPS
if "%CHOICE%"=="5" goto CHECK_STATUS
if "%CHOICE%"=="6" goto STOP_SERVICE
if "%CHOICE%"=="0" goto EXIT
goto MENU

:: 快速启动
:QUICK_START
set WEB_PORT=%DEFAULT_PORT%
goto START_SERVER

:: 自定义端口启动
:CUSTOM_PORT
echo.
set /p WEB_PORT=请输入端口号 (默认 %DEFAULT_PORT%): 
if "%WEB_PORT%"=="" set WEB_PORT=%DEFAULT_PORT%
goto START_SERVER

:: 调试模式启动
:DEBUG_MODE
set WEB_PORT=%DEFAULT_PORT%
set DEBUG=1
echo.
echo [模式] 调试模式已启用
goto START_SERVER

:: 安装依赖
:INSTALL_DEPS
echo.
echo ========================================
echo   安装依赖包
echo ========================================
echo.
echo [执行] npm install
call npm install
if %errorlevel% neq 0 (
    echo.
    echo [错误] 依赖安装失败
    pause
    goto MENU
)
echo.
echo [成功] 依赖安装完成
pause
goto MENU

:: 检查状态
:CHECK_STATUS
echo.
echo ========================================
echo   检查运行状态
echo ========================================
echo.
netstat -ano | findstr ":%WEB_PORT%" >nul 2>&1
if %errorlevel% equ 0 (
    echo [状态] 端口 %WEB_PORT% 正在使用中
    echo [信息] Web客户端可能正在运行
    echo.
    netstat -ano | findstr ":%WEB_PORT%"
) else (
    echo [状态] 端口 %WEB_PORT% 未被使用
    echo [信息] Web客户端未运行
)
echo.
pause
goto MENU

:: 停止服务
:STOP_SERVICE
echo.
echo ========================================
echo   停止服务
echo ========================================
echo.
set /p CONFIRM=确认停止端口 %WEB_PORT% 的服务？ (Y/N): 
if /i not "%CONFIRM%"=="Y" goto MENU

echo.
echo [执行] 正在查找并停止进程...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":%WEB_PORT%"') do (
    echo [找到] 进程ID: %%a
    taskkill /F /PID %%a >nul 2>&1
    if %errorlevel% equ 0 (
        echo [成功] 进程 %%a 已停止
    ) else (
        echo [失败] 无法停止进程 %%a
    )
)
echo.
echo [完成] 服务停止操作完成
pause
goto MENU

:: 启动服务器
:START_SERVER
cls
echo.
echo ========================================
echo   启动Web客户端
echo ========================================
echo.
echo [配置] 端口: %WEB_PORT%
if defined DEBUG echo [模式] 调试模式
echo [地址] http://localhost:%WEB_PORT%
echo.

:: 检查端口是否被占用
netstat -ano | findstr ":%WEB_PORT%" >nul 2>&1
if %errorlevel% equ 0 (
    echo [警告] 端口 %WEB_PORT% 已被占用
    echo.
    set /p OVERRIDE=是否继续启动？ (Y/N): 
    if /i not "%OVERRIDE%"=="Y" goto MENU
)

:: 检查依赖
if not exist "node_modules" (
    echo [检查] 未找到依赖包，正在安装...
    call npm install
    if %errorlevel% neq 0 (
        echo [错误] 依赖安装失败
        pause
        goto MENU
    )
)

echo [启动] 正在启动服务器...
echo.

:: 设置环境变量
set WEB_PORT=%WEB_PORT%

:: 启动服务器
if defined DEBUG (
    node web-client.js
) else (
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
        echo [端口] %WEB_PORT%
        echo [地址] http://localhost:%WEB_PORT%
        echo [提示] 按Ctrl+C停止服务器
        echo ========================================
        echo.
        
        :: 保持窗口打开
        node web-client.js
    ) else (
        echo [错误] 服务器启动失败
        echo [提示] 请检查端口 %WEB_PORT% 是否被占用
        echo.
        pause
        goto MENU
    )
)

:: 退出
:EXIT
echo.
echo [再见] 感谢使用AT测试采集客户端
echo.
exit /b 0