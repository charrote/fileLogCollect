#!/bin/bash
# client/start-client.sh
# AT测试采集客户端启动脚本
# 此脚本会自动设置必要的环境变量以解决SSL问题

echo "========================================"
echo "AT测试采集客户端启动脚本"
echo "========================================"

# 设置环境变量以解决SSL问题
export NODE_TLS_REJECT_UNAUTHORIZED=0
export ELECTRON_DISABLE_SECURITY_WARNINGS=true

# 获取脚本所在目录
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$SCRIPT_DIR"

# 显示菜单
echo "请选择客户端类型："
echo "1. GUI界面客户端（推荐）"
echo "2. 命令行客户端"
echo "3. 精简版客户端（无外部依赖，最佳SSL兼容性）"
echo "4. 退出"
echo "========================================"

read -p "请输入选项 (1-4): " choice

case $choice in
    1)
        echo "启动GUI界面客户端..."
        # 检查是否安装了electron
        if ! command -v npx &> /dev/null || ! npx electron --version &> /dev/null; then
            echo "Electron未安装，正在安装..."
            npm install electron --save-dev
        fi
        
        # 启动GUI
        npm start
        ;;
    2)
        echo "启动命令行客户端..."
        node client.js
        ;;
    3)
        echo "启动精简版客户端（最佳SSL兼容性）..."
        node simple-client.js
        ;;
    4)
        echo "退出"
        exit 0
        ;;
    *)
        echo "无效选项，启动默认的命令行客户端..."
        node client.js
        ;;
esac