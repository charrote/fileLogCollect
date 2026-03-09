#!/bin/bash

# AT测试采集客户端 - Web版部署脚本 (Linux/Mac)

echo "========================================"
echo "AT测试采集客户端 - Web版部署脚本"
echo "========================================"
echo

# 检查Node.js是否安装
if ! command -v node &> /dev/null; then
    echo "[错误] 未检测到Node.js，请先安装Node.js"
    echo "下载地址: https://nodejs.org/"
    echo "或使用包管理器安装:"
    echo "  Ubuntu/Debian: sudo apt-get install nodejs npm"
    echo "  CentOS/RHEL: sudo yum install nodejs npm"
    echo "  macOS: brew install node"
    exit 1
fi

echo "[信息] Node.js已安装，版本:"
node --version
echo

# 检查npm是否安装
if ! command -v npm &> /dev/null; then
    echo "[错误] 未检测到npm，请先安装npm"
    exit 1
fi

echo "[信息] npm已安装，版本:"
npm --version
echo

# 检查是否在client目录
if [ ! -f "package.json" ]; then
    echo "[错误] 请在client目录下运行此脚本"
    exit 1
fi

# 检查依赖是否安装
if [ ! -d "node_modules" ]; then
    echo "[信息] 正在安装依赖..."
    npm install
    if [ $? -ne 0 ]; then
        echo "[错误] 依赖安装失败"
        exit 1
    fi
    echo "[信息] 依赖安装完成"
    echo
fi

# 创建启动脚本
echo "[信息] 创建启动脚本..."
cat > start-web.sh << 'EOF'
#!/bin/bash

# AT测试采集客户端 - Web版启动脚本

# 设置端口（可通过环境变量WEB_PORT修改）
PORT=${WEB_PORT:-3002}

echo "[信息] 正在启动Web版客户端..."
echo "[信息] 服务端口: $PORT"
echo "[信息] 访问地址: http://localhost:$PORT"
echo "[信息] 局域网访问地址: http://$(hostname):$PORT"
echo "[信息] 按Ctrl+C停止服务器"
echo

# 尝试打开浏览器（仅对支持的系统）
if command -v xdg-open &> /dev/null; then
    # Linux
    sleep 3
    xdg-open "http://localhost:$PORT" &
elif command -v open &> /dev/null; then
    # macOS
    sleep 3
    open "http://localhost:$PORT" &
fi

# 启动服务器
WEB_PORT=$PORT node web-client.js
EOF

chmod +x start-web.sh
echo "[信息] 启动脚本创建完成: start-web.sh"
echo

# 创建系统服务脚本（可选）
read -p "是否创建系统服务脚本？(y/n): " create_service
if [ "$create_service" = "y" ] || [ "$create_service" = "Y" ]; then
    echo "[信息] 创建系统服务脚本..."
    
    # 获取当前目录
    CURRENT_DIR=$(pwd)
    
    cat > at-test-web-client.service << EOF
[Unit]
Description=AT Test Web Client
After=network.target

[Service]
Type=simple
User=$USER
WorkingDirectory=$CURRENT_DIR
Exec=/usr/bin/node web-client.js
Restart=on-failure
RestartSec=10
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
EOF
    
    echo "[信息] 系统服务脚本创建完成: at-test-web-client.service"
    echo "[信息] 安装服务命令:"
    echo "  sudo cp at-test-web-client.service /etc/systemd/system/"
    echo "  sudo systemctl daemon-reload"
    echo "  sudo systemctl enable at-test-web-client"
    echo "  sudo systemctl start at-test-web-client"
    echo
fi

# 创建桌面快捷方式（可选）
if [ "$XDG_CURRENT_DESKTOP" != "" ]; then
    read -p "是否创建桌面快捷方式？(y/n): " create_shortcut
    if [ "$create_shortcut" = "y" ] || [ "$create_shortcut" = "Y" ]; then
        echo "[信息] 创建桌面快捷方式..."
        
        # 获取当前目录
        CURRENT_DIR=$(pwd)
        
        cat > ~/Desktop/AT测试采集客户端Web版.desktop << EOF
[Desktop Entry]
Version=1.0
Type=Application
Name=AT测试采集客户端Web版
Comment=AT测试采集客户端Web版
Exec=gnome-terminal --working-directory=$CURRENT_DIR -- $CURRENT_DIR/start-web.sh
Icon=application-x-executable
Terminal=true
Categories=Development;
EOF
        
        chmod +x ~/Desktop/AT测试采集客户端Web版.desktop
        echo "[信息] 桌面快捷方式创建完成"
        echo
    fi
fi

echo "========================================"
echo "部署完成！"
echo "========================================"
echo
echo "启动方式:"
echo "1. 直接运行: ./start-web.sh"
echo "2. 手动运行: node web-client.js"
echo "3. 使用npm: npm run start-web"
echo
echo "访问地址:"
echo "本地访问: http://localhost:3002"
echo "局域网访问: http://$(hostname):3002"
echo
echo "如需修改端口，可设置环境变量WEB_PORT:"
echo "  WEB_PORT=8080 ./start-web.sh"
echo