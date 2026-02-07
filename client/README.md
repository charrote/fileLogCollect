# AT测试采集客户端

这是一个带有GUI界面的客户端程序，用于在测试电脑上采集日志并发送到中央服务端。

## 功能特性

- **图形化界面**：提供直观的用户界面，支持设备选择和配置
- **实时监控**：监控本地指定目录中的日志文件变化
- **自动上传**：自动将解析后的测试数据上传到中央服务端
- **心跳机制**：定期向服务端发送心跳，报告客户端状态
- **断线重连**：在网络中断时缓存数据，网络恢复后继续上传
- **设备标识**：每个客户端都有唯一的标识符
- **实时状态**：显示采集过程和系统状态
- **日志追踪**：实时显示采集和上传日志

## 安装与运行

### 环境要求

- Node.js >= 14.x
- npm

### 安装依赖

```bash
npm install
```

### 配置

修改 `config.js` 来配置客户端参数：

**注意：内网部署请务必使用HTTP协议（http://）而非HTTPS（https://），以避免SSL握手问题**

```javascript
module.exports = {
  // 服务端配置
  server: {
    url: process.env.SERVER_URL || 'http://localhost:3000', // 服务端地址，内网使用HTTP
    uploadEndpoint: '/api/client-log', // 上传日志的API端点
    heartbeatInterval: 30000, // 心跳间隔（毫秒）
  },
  
  // 本地日志监控配置
  collector: {
    logDir: process.env.LOG_DIR || './logs', // 本地日志目录
    filePattern: /\.(log|txt)$/i, // 日志文件模式
    pollInterval: 5000, // 轮询间隔（毫秒）
    batchSize: 10, // 批量上传数量
  },
  
  // 客户端标识
  client: {
    id: process.env.CLIENT_ID || require('os').hostname(), // 客户端ID，默认为主机名
    name: process.env.CLIENT_NAME || 'Default Client', // 客户端名称
    deviceType: process.env.DEVICE_TYPE || 'Test Device', // 设备类型
  }
};
```

### 内网配置建议

对于内网环境，推荐使用环境变量配置：

```bash
# 内网部署示例
SERVER_URL=http://192.168.1.100:3000 CLIENT_NAME="内网测试设备001" LOG_DIR=/var/log/tests npm run start-cli
```

## SSL安全配置说明

为避免SSL握手失败问题，本客户端默认禁用SSL/TLS加密，强制使用HTTP协议：

- 所有配置均使用HTTP而非HTTPS协议
- 如果在GUI界面输入HTTPS URL，系统会自动转换为HTTP
- 如果通过环境变量设置HTTPS URL，客户端也会自动转换为HTTP
- 这样做是为了简化内网部署，避免SSL证书相关问题
- 在安全敏感环境中，请确保网络层安全措施到位（如VPN、防火墙规则等）

### SSL握手失败解决方案

如果您遇到 "handshake failed; returned -1, SSL error code 1, net_error -101" 或类似的SSL错误，请尝试以下解决方案：

#### 方案一：使用启动脚本（推荐）

我们提供了自动处理SSL问题的启动脚本：

**Linux/macOS:**
```bash
chmod +x start-client.sh
./start-client.sh
```

**Windows:**
```cmd
start-client.bat
```

#### 方案二：使用精简版客户端

精简版客户端无外部依赖，专门用于解决SSL问题：

```bash
node simple-client.js
```

#### 方案三：手动设置环境变量

```bash
# Linux/macOS
export NODE_TLS_REJECT_UNAUTHORIZED=0
npm run start-cli

# Windows
set NODE_TLS_REJECT_UNAUTHORIZED=0
npm run start-cli
```

#### 方案四：修改配置文件

确保 `config.js` 中的服务器URL使用HTTP协议：

```javascript
server: {
  url: 'http://your-server:3000', // 使用HTTP而非HTTPS
  // ...
}
```

#### 方案五：使用HTTPS Agent配置

如果必须使用HTTPS，可以在 `LogUploader.js` 中配置更宽松的SSL设置：

```javascript
httpsAgent: new https.Agent({
  rejectUnauthorized: false, // 忽略证书验证
  checkServerIdentity: () => undefined, // 跳过服务器身份验证
  keepAlive: true,
  secureProtocol: 'TLSv1_method' // 支持旧版SSL/TLS协议
})
```

### 启动客户端

有两种运行模式：

**1. 图形界面模式（推荐）**
```bash
# 安装Electron（首次运行需要）
npm install electron electron-builder --save-dev

# 启动GUI界面
npm start
# 或者
npm run start
```

**注意**：GUI模式会尝试加载图标文件（位于`assets/`目录）。如果缺少图标文件，应用仍会正常运行，只是使用系统默认图标。

**2. 命令行模式**
```bash
# 启动CLI版本
npm run start-cli

# 或者
node client.js

# 使用环境变量配置
SERVER_URL=http://your-server:3000 CLIENT_NAME="My Test PC" LOG_DIR=/path/to/logs npm run start-cli
```

### 图标文件（可选）

为了获得最佳用户体验，可以在 `client/assets/` 目录下放置图标文件：

- `icon.png` - 主窗口图标 (512x512 或 1024x1024)
- `tray-icon.png` - 系统托盘图标 (16x16, 24x24, 32x32)
- `icon.ico` - Windows图标
- `icon.icns` - macOS图标

如果缺少这些文件，应用将使用系统默认图标并正常运行。
```

## GUI界面使用说明

GUI界面提供以下功能：

### 配置区域
- **设备名称**：输入当前测试设备的名称（必填）
- **服务端地址**：输入中央服务端的URL（必填）
- **日志目录**：指定要监控的日志文件目录（必填）
- **客户端ID**：可选，用于标识客户端（默认使用主机名）

### 状态区域
- **运行状态**：显示客户端当前状态（运行/停止）
- **连接状态**：显示与服务端的连接状态
- **统计信息**：显示已处理文件数、上传成功/失败次数等
- **控制按钮**：启动/停止采集、刷新系统信息

### 实时日志区域
- 显示采集过程中的详细日志
- 包括文件处理、上传状态、错误信息等
- 不同类型的消息用不同颜色区分

## 界面截图

GUI界面包含：
- 配置面板：设备名称、服务端地址、日志目录等设置
- 状态面板：运行状态、连接状态、统计信息
- 控制按钮：启动、停止、刷新等功能
- 日志面板：实时显示采集和上传日志

## 部署建议

### 内网部署解决方案

由于客户端机位于内网，提供了多种部署方案：

#### 方案一：预安装依赖包
- 在有外网的机器上预先下载所有依赖包（.tgz格式）
- 将依赖包复制到内网环境
- 使用离线安装：`npm install ./path/to/package.tgz`

#### 方案二：完整分发包
- 创建包含所有依赖的完整分发包
- 直接复制到内网环境使用

#### 方案三：精简版客户端（推荐用于内网）
- 使用Node.js内置模块，无外部依赖
- 运行：`node simple-client.js`

### Windows服务部署

可以使用 NSSM (Non-Sucking Service Manager) 将客户端注册为Windows服务：

1. 下载并安装NSSM
2. 运行命令：
```cmd
nssm install ATTestClient "C:\Program Files\nodejs\node.exe" "C:\path\to\client\client.js"
nssm start ATTestClient
```

### Linux守护进程部署

创建systemd服务文件 `/etc/systemd/system/at-test-client.service`：

```ini
[Unit]
Description=AT Test Collection Client
After=network.target

[Service]
Type=simple
User=your-user
WorkingDirectory=/path/to/client
ExecStart=/usr/bin/node client.js
Restart=always
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
```

然后运行：
```bash
sudo systemctl enable at-test-client
sudo systemctl start at-test-client
```

## 精简版客户端

为了适应内网环境，我们提供了精简版客户端（simple-client.js），具有以下特点：

- 仅使用Node.js内置模块（fs, http, https, path, readline等）
- 无需安装任何外部依赖
- 仍具备完整的日志采集和上传功能
- 提供基本的命令行界面和交互功能

### 运行精简版客户端

```bash
node simple-client.js
```

### 精简版功能
- 日志文件监控
- 自动解析和上传
- 基本统计信息
- 命令行交互控制
- 服务端通信

## API端点（服务端）

客户端会调用以下服务端API：

- `POST /api/client-log` - 上传解析后的日志数据
- `GET /api/heartbeat` - 发送心跳信息
- `GET /api/client-status` - 检查服务端状态

## 日志格式支持

客户端支持以下常见的日志格式：

```
2024-01-15 10:30:15 - 测试开始
2024-01-15 10:30:20 - 执行步骤1: OK
2024-01-15 10:30:25 - 执行步骤2: OK
2024-01-15 10:30:30 - 执行步骤3: NG
2024-01-15 10:30:35 - 测试结束
```

系统会自动解析时间、统计OK/NG数量，并判断最终测试结果。

## 故障排除

- 确保服务端正在运行且可以从客户端访问
- 检查防火墙设置，确保端口开放
- 验证日志目录路径是否正确
- 查看客户端日志输出以获取更多信息