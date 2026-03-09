# AT测试采集客户端 - Web版部署指南

本指南将帮助您在各种环境下部署AT测试采集客户端的Web版，解决老旧Win7系统的兼容性问题。

## 部署概述

Web版客户端采用纯Node.js + Web界面的架构，相比Electron版本具有以下优势：

- **兼容性更好**：支持所有Windows版本，包括Win7无SP1
- **体积更小**：无需Electron，部署更简单
- **内网友好**：在内网环境下运行更稳定，依赖更少
- **跨平台访问**：可以从任何设备上的浏览器访问客户端界面

## 快速部署

### Windows系统

1. **下载并安装Node.js**
   - 访问 [Node.js官网](https://nodejs.org/)
   - 下载LTS版本（推荐v14.x或v16.x）
   - 运行安装程序，按默认设置安装

2. **部署客户端**
   ```bash
   # 进入client目录
   cd client
   
   # 运行部署脚本
   deploy-windows.bat
   ```

3. **启动客户端**
   - 简单启动：双击 `start-web.bat`
   - 高级启动：双击 `start-web-advanced.bat`（可修改端口）
   - 命令行启动：`npm run start-web`

4. **访问界面**
   - 本地访问：http://localhost:3002
   - 局域网访问：http://[计算机名]:3002

### Linux系统

1. **安装Node.js**
   ```bash
   # Ubuntu/Debian
   sudo apt-get update
   sudo apt-get install nodejs npm
   
   # CentOS/RHEL
   sudo yum install nodejs npm
   
   # 或使用NodeSource仓库安装最新版本
   curl -fsSL https://deb.nodesource.com/setup_lts.x | sudo -E bash -
   sudo apt-get install -y nodejs
   ```

2. **部署客户端**
   ```bash
   # 进入client目录
   cd client
   
   # 给脚本添加执行权限
   chmod +x deploy-linux.sh
   
   # 运行部署脚本
   ./deploy-linux.sh
   ```

3. **启动客户端**
   ```bash
   # 使用启动脚本
   ./start-web.sh
   
   # 或直接运行
   node web-client.js
   
   # 或使用npm
   npm run start-web
   ```

4. **访问界面**
   - 本地访问：http://localhost:3002
   - 局域网访问：http://[主机名]:3002

### macOS系统

1. **安装Node.js**
   ```bash
   # 使用Homebrew
   brew install node
   
   # 或下载安装包
   # 访问 https://nodejs.org/ 下载macOS安装包
   ```

2. **部署客户端**
   ```bash
   # 进入client目录
   cd client
   
   # 给脚本添加执行权限
   chmod +x deploy-linux.sh
   
   # 运行部署脚本
   ./deploy-linux.sh
   ```

3. **启动客户端**
   ```bash
   # 使用启动脚本
   ./start-web.sh
   
   # 或直接运行
   node web-client.js
   ```

4. **访问界面**
   - 本地访问：http://localhost:3002
   - 局域网访问：http://[主机名]:3002

## 高级部署选项

### 修改端口

默认端口为3002，可以通过以下方式修改：

1. **环境变量方式**
   ```bash
   # Windows
   set WEB_PORT=8080 && node web-client.js
   
   # Linux/Mac
   WEB_PORT=8080 node web-client.js
   ```

2. **使用高级启动脚本**
   - Windows：运行 `start-web-advanced.bat`
   - Linux/Mac：修改 `start-web.sh` 中的PORT变量

### 作为系统服务运行

#### Windows系统

1. **安装NSSM**
   - 下载 [NSSM](https://nssm.cc/download)
   - 解压并将nssm.exe路径添加到系统PATH

2. **安装服务**
   ```bash
   # 运行部署脚本时选择创建服务脚本
   deploy-windows.bat
   
   # 然后运行
   install-service.bat
   ```

3. **管理服务**
   ```bash
   # 启动服务
   net start ATTestWebClient
   
   # 停止服务
   net stop ATTestWebClient
   ```

#### Linux系统

1. **创建systemd服务**
   ```bash
   # 运行部署脚本时选择创建服务脚本
   ./deploy-linux.sh
   
   # 然后执行以下命令
   sudo cp at-test-web-client.service /etc/systemd/system/
   sudo systemctl daemon-reload
   sudo systemctl enable at-test-web-client
   sudo systemctl start at-test-web-client
   ```

2. **管理服务**
   ```bash
   # 查看状态
   sudo systemctl status at-test-web-client
   
   # 查看日志
   sudo journalctl -u at-test-web-client -f
   
   # 重启服务
   sudo systemctl restart at-test-web-client
   ```

### 内网环境部署

对于完全隔离的内网环境：

1. **离线安装Node.js**
   - 下载Node.js二进制包
   - 解压到目标系统
   - 配置PATH环境变量

2. **离线安装依赖**
   ```bash
   # 在有网络的环境打包依赖
   npm pack
   
   # 在目标环境解压安装
   npm install <packaged-file>.tgz
   ```

3. **使用本地文件服务器**
   - 如果需要从其他设备访问，确保防火墙允许相应端口的连接

## 配置说明

### 环境变量

可以通过环境变量配置客户端行为：

```bash
# Web服务器端口
WEB_PORT=3002

# 默认服务端地址
SERVER_URL=http://server:3000

# 默认日志目录
LOG_DIR=/path/to/logs

# 默认设备名称
CLIENT_NAME=TestDevice

# 默认客户端ID
CLIENT_ID=TestDevice001
```

### 配置文件

客户端配置存储在 `config.js` 文件中，可以根据需要修改：

```javascript
module.exports = {
  // 服务端配置
  server: {
    url: process.env.SERVER_URL || 'http://localhost:3001',
    uploadEndpoint: '/api/upload-log',
    heartbeatInterval: 30000,
  },
  
  // 本地日志监控配置
  collector: {
    logDir: process.env.LOG_DIR || './logs',
    filePattern: /\.(log|txt)$/i,
    pollInterval: 5000,
    batchSize: 10,
  },
  
  // 客户端标识
  client: {
    id: process.env.CLIENT_ID || require('os').hostname(),
    name: process.env.CLIENT_NAME || 'Default Client',
    deviceType: process.env.DEVICE_TYPE || 'Test Device',
  }
};
```

## 故障排除

### 常见问题

1. **端口被占用**
   ```bash
   # 查看端口占用情况
   # Windows
   netstat -ano | findstr :3002
   
   # Linux/Mac
   lsof -i :3002
   
   # 解决方案：修改端口或停止占用进程
   ```

2. **无法访问Web界面**
   - 检查防火墙设置
   - 确认服务器已启动
   - 尝试使用127.0.0.1替代localhost

3. **无法连接到服务端**
   - 检查服务端地址是否正确
   - 尝试使用HTTP而非HTTPS
   - 检查网络连接

4. **日志文件无法上传**
   - 检查日志文件路径是否正确
   - 检查日志文件格式是否符合要求
   - 查看实时日志了解详细错误信息

### 日志查看

1. **控制台日志**
   - 启动客户端后，控制台会显示实时日志
   - 包含详细的错误信息和调试信息

2. **Web界面日志**
   - 在Web界面的"实时日志"区域查看运行日志
   - 包含操作记录和错误信息

3. **系统日志**
   - Windows：事件查看器
   - Linux：`/var/log/syslog`或`journalctl`

### 性能优化

1. **内存使用**
   - 调整Node.js堆内存大小
   ```bash
   node --max-old-space-size=2048 web-client.js
   ```

2. **并发处理**
   - 修改配置中的batchSize和pollInterval参数

3. **网络优化**
   - 使用HTTP而非HTTPS减少握手开销
   - 调整心跳间隔减少网络负载

## 卸载

### Windows系统

```bash
# 运行卸载脚本
uninstall.bat
```

### Linux系统

```bash
# 停止并禁用服务
sudo systemctl stop at-test-web-client
sudo systemctl disable at-test-web-client

# 删除服务文件
sudo rm /etc/systemd/system/at-test-web-client.service
sudo systemctl daemon-reload

# 删除应用文件
rm -rf /path/to/client
```

## 技术支持

如有问题或建议，请联系：
- 邮箱：charrote.vinson@163.com
- 华澄·AI Team

## 版本历史

- v1.0.0: 初始版本，提供基本的日志监控和上传功能
- v1.1.0: 添加Web界面，解决老旧系统兼容性问题
- v1.2.0: 添加系统服务支持和高级部署选项