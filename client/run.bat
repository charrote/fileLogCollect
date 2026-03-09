@echo off
chcp 65001 >nul 2>&1  :: 设置编码为UTF-8，避免中文乱码

:: ======================== 配置区域 ========================
:: 请根据实际情况修改以下参数
set "SERVER_URL=http://192.168.x.x:3000"
set "CLIENT_NAME=内网测试设备001"
:: 日志目录改为批处理文件所在目录下的 logs 文件夹（相对路径）
set "LOG_DIR=%~dp0logs"
:: client.js 的路径，如果和批处理文件同目录，直接写 client.js 即可
set "CLIENT_JS_PATH=client.js"
:: ==========================================================

:: 检查日志目录是否存在，不存在则创建
if not exist "%LOG_DIR%" (
    echo 日志目录不存在，正在创建：%LOG_DIR%
    md "%LOG_DIR%" >nul 2>&1
    if errorlevel 1 (
        echo 错误：创建日志目录失败，请检查路径权限！
        pause
        exit /b 1
    )
)

:: 检查 node 是否安装
where node >nul 2>&1
if errorlevel 1 (
    echo 错误：未找到 Node.js，请先安装 Node.js 并配置到系统环境变量！
    pause
    exit /b 1
)

:: 检查 client.js 文件是否存在
if not exist "%CLIENT_JS_PATH%" (
    echo 错误：未找到 client.js 文件，路径：%CLIENT_JS_PATH%
    pause
    exit /b 1
)

:: 执行核心命令
echo 正在启动客户端...
echo 服务器地址：%SERVER_URL%
echo 客户端名称：%CLIENT_NAME%
echo 日志目录：%LOG_DIR%
echo ==========================================================
node "%CLIENT_JS_PATH%"

:: 执行完成后的提示
echo ==========================================================
echo 客户端脚本执行完成！
pause