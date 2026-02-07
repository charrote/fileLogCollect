#!/bin/bash
# 内网客户端启动脚本
# run_client_internal.sh

echo "启动内网AT测试采集客户端..."

# 确保使用HTTP协议
export SERVER_URL=http://192.168.1.100:3000  # 请根据实际情况修改IP地址

# 可选：设置其他参数
export CLIENT_NAME=${CLIENT_NAME:-"内网测试客户端"}
export LOG_DIR=${LOG_DIR:-"./logs"}

echo "服务端地址: $SERVER_URL"
echo "客户端名称: $CLIENT_NAME"
echo "日志目录: $LOG_DIR"

# 启动客户端
cd "$(dirname "$0")"
node client.js

echo "客户端已停止"