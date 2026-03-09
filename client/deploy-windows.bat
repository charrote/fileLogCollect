@echo off
setlocal enabledelayedexpansion

:: AT测试采集客户端 - Web版部署脚本 (Windows)

echo ========================================
echo AT测试采集客户端 - Web版部署脚本
echo ========================================
echo.

:: 检查Node.js是否安装
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [错误] 未检测到Node.js，请先安装Node.js
    echo 下载地址: https://nodejs.org/
    echo.
    echo 请安装Node.js后重新运行此脚本
    pause
    exit /b 1
)

echo [信息] Node.js已安装，版本:
node --version
echo.

:: 检查npm是否安装
npm --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [错误] 未检测到npm，请重新安装Node.js
    pause
    exit /b 1
)

echo [信息] npm已安装，版本:
npm --version
echo.

:: 检查是否在client目录
if not exist "package.json" (
    echo [错误] 请在client目录下运行此脚本
    pause
    exit /b 1
)

:: 检查依赖是否安装
if not exist "node_modules" (
    echo [信息] 正在安装依赖...
    npm install
    if %errorlevel% neq 0 (
        echo [错误] 依赖安装失败
        pause
        exit /b 1
    )
    echo [信息] 依赖安装完成
    echo.
)

:: 创建启动脚本
echo [信息] 创建启动脚本...
(
echo @echo off
echo echo [信息] 正在启动Web版客户端...
echo echo [信息] 服务端口: %%WEB_PORT%%
echo echo [信息] 访问地址: http://localhost:%%WEB_PORT%%
echo echo [信息] 按Ctrl+C停止服务器
echo echo.
echo.
echo :: 设置端口（可通过环境变量WEB_PORT修改）
echo if not defined WEB_PORT set WEB_PORT=3002
echo.
echo :: 尝试打开浏览器
echo timeout /t 3 /nobreak ^>nul
echo start http://localhost:%%WEB_PORT%%
echo.
echo :: 启动服务器
echo node web-client.js
) > start-web.bat

echo [信息] 启动脚本创建完成: start-web.bat
echo.

:: 创建高级启动脚本（带端口选择）
echo [信息] 创建高级启动脚本...
(
echo @echo off
echo setlocal enabledelayedexpansion
echo.
echo echo ========================================
echo echo AT测试采集客户端 - Web版
echo echo ========================================
echo echo.
echo.
echo :: 设置默认端口
echo set PORT=3002
echo.
echo :: 读取上次的端口设置
echo if exist port.cfg set /p PORT=<port.cfg
echo.
echo :: 显示菜单
echo :menu
echo echo 请选择操作:
echo echo 1. 启动客户端（端口: !PORT!）
echo echo 2. 修改端口
echo echo 3. 退出
echo echo.
echo set /p choice=请输入选项（1-3）: 
echo.
echo if "!choice!"=="1" goto start
echo if "!choice!"=="2" goto changeport
echo if "!choice!"=="3" goto end
echo goto menu
echo.
echo :: 修改端口
echo :changeport
echo set /p PORT=请输入端口号（默认3002）: 
echo if "!PORT!"=="" set PORT=3002
echo.
echo :: 保存端口设置
echo echo !PORT!^>port.cfg
echo echo 端口已设置为: !PORT!
echo pause
echo goto menu
echo.
echo :: 启动客户端
echo :start
echo echo [信息] 正在启动Web版客户端...
echo echo [信息] 服务端口: !PORT!
echo echo [信息] 访问地址: http://localhost:!PORT!
echo echo [信息] 按Ctrl+C停止服务器
echo echo.
echo.
echo :: 尝试打开浏览器
echo timeout /t 3 /nobreak ^>nul
echo start http://localhost:!PORT!
echo.
echo :: 启动服务器
echo set WEB_PORT=!PORT!
echo node web-client.js
echo goto end
echo.
echo :end
echo pause
) > start-web-advanced.bat

echo [信息] 高级启动脚本创建完成: start-web-advanced.bat
echo.

:: 创建Windows服务脚本（可选）
set /p create_service=是否创建Windows服务脚本？(y/n): 
if /i "!create_service!"=="y" (
    echo [信息] 创建Windows服务脚本...
    
    :: 获取当前目录
    for /f "delims=" %%i in ('cd') do set CURRENT_DIR=%%i
    
    (
    echo @echo off
    echo echo 安装AT测试采集客户端Web版服务...
    echo.
    echo :: 检查管理员权限
    echo net session ^>nul 2^>^&1
    echo if %%errorlevel%% neq 0 (
    echo     echo 错误: 需要管理员权限安装服务
    echo     echo 请右键点击此脚本，选择"以管理员身份运行"
    echo     pause
    echo     exit /b 1
    echo ^)
    echo.
    echo :: 设置服务名称和路径
    echo set SERVICE_NAME=ATTestWebClient
    echo set SERVICE_PATH=!CURRENT_DIR!\web-client.js
    echo.
    echo :: 使用NSSM安装服务
    echo echo 检查NSSM是否存在...
    echo where nssm ^>nul 2^>^&1
    echo if %%errorlevel%% neq 0 (
    echo     echo 错误: 未找到NSSM
    echo     echo 请从 https://nssm.cc/download 下载并安装NSSM
    echo     然后将NSSM路径添加到系统PATH环境变量
    echo     pause
    echo     exit /b 1
    echo ^)
    echo.
    echo echo 安装服务...
    echo nssm install "!SERVICE_NAME!" "node" "!SERVICE_PATH!"
    echo nssm set "!SERVICE_NAME!" AppDirectory "!CURRENT_DIR!"
    echo nssm set "!SERVICE_NAME!" DisplayName "AT测试采集客户端Web版"
    echo nssm set "!SERVICE_NAME!" Description "AT测试采集客户端Web版服务"
    echo.
    echo echo 服务安装完成
    echo echo 启动命令: net start !SERVICE_NAME!
    echo echo 停止命令: net stop !SERVICE_NAME!
    echo echo 删除命令: nssm remove !SERVICE_NAME!
    echo.
    echo pause
    ) > install-service.bat
    
    echo [信息] Windows服务安装脚本创建完成: install-service.bat
    echo [信息] 注意: 需要先安装NSSM (https://nssm.cc/download)
    echo.
)

:: 创建桌面快捷方式
set /p create_shortcut=是否创建桌面快捷方式？(y/n): 
if /i "!create_shortcut!"=="y" (
    echo [信息] 创建桌面快捷方式...
    
    :: 使用PowerShell创建快捷方式
    powershell -command "& {$WshShell = New-Object -comObject WScript.Shell; $Shortcut = $WshShell.CreateShortcut($WshShell.SpecialFolders('Desktop') + '\AT测试采集客户端Web版.lnk'); $Shortcut.TargetPath = '%CD%\start-web-advanced.bat'; $Shortcut.IconLocation = 'shell32.dll,25'; $Shortcut.WorkingDirectory = '%CD%'; $Shortcut.Save()}"
    
    echo [信息] 桌面快捷方式创建完成
    echo.
)

:: 创建卸载脚本
echo [信息] 创建卸载脚本...
(
echo @echo off
echo echo ========================================
echo echo AT测试采集客户端 - Web版卸载脚本
echo echo ========================================
echo echo.
echo.
echo set /p confirm=确定要卸载AT测试采集客户端Web版吗？(y/n): 
echo if /i not "!confirm!"=="y" goto end
echo.
echo echo [信息] 正在卸载...
echo.
echo :: 删除桌面快捷方式
echo if exist "%USERPROFILE%\Desktop\AT测试采集客户端Web版.lnk" (
echo     del "%USERPROFILE%\Desktop\AT测试采集客户端Web版.lnk"
echo     echo [信息] 已删除桌面快捷方式
echo ^)
echo.
echo :: 删除Windows服务（可选）
echo set /p remove_service=是否删除Windows服务？(y/n): 
echo if /i "!remove_service!"=="y" (
echo     where nssm ^>nul 2^>^&1
echo     if %%errorlevel%% equ 0 (
echo         nssm remove ATTestWebClient confirm
echo         echo [信息] 已删除Windows服务
echo     ^) else (
echo         echo [警告] 未找到NSSM，跳过服务删除
echo     ^)
echo ^)
echo.
echo :: 删除生成的文件
echo if exist start-web.bat del start-web.bat
echo if exist start-web-advanced.bat del start-web-advanced.bat
echo if exist install-service.bat del install-service.bat
echo if exist port.cfg del port.cfg
echo.
echo echo [信息] 卸载完成
echo echo 注意: node_modules目录和package.json文件需要手动删除
echo.
echo :end
echo pause
) > uninstall.bat

echo [信息] 卸载脚本创建完成: uninstall.bat
echo.

echo ========================================
echo 部署完成！
echo ========================================
echo.
echo 启动方式:
echo 1. 简单启动: start-web.bat
echo 2. 高级启动: start-web-advanced.bat
echo 3. 手动运行: node web-client.js
echo 4. 使用npm: npm run start-web
echo.
echo 访问地址:
echo 本地访问: http://localhost:3002
echo 局域网访问: http://%COMPUTERNAME%:3002
echo.
echo 其他工具:
echo - 安装服务: install-service.bat
echo - 卸载程序: uninstall.bat
echo.
pause