# AT测试采集客户端 - Web版

这是一个轻量级的Web版客户端，专为解决老旧Win7系统（特别是未安装SP1的系统）的兼容性问题而设计。

## 快速开始

### 1. 安装依赖

```bash
cd client
npm install
```

### 2. 部署客户端

#### Windows系统

**方式一：使用启动脚本（推荐）**

```bash
# 简单启动
start-web.bat

# 高级启动（带菜单）
start-web-advanced.bat
```

**方式二：使用部署脚本**

```bash
# 运行部署脚本
deploy-windows.bat
```

#### Linux/Mac系统

```bash
# 给脚本添加执行权限
chmod +x deploy-linux.sh

# 运行部署脚本
./deploy-linux.sh

# 或者直接启动
npm run start-web
```

### 3. 访问界面

- 本地访问：http://localhost:3002
- 局域网访问：http://[计算机名]:3002

### 4. 配置客户端

1. 在"客户端配置"区域填写必要信息：
   - 设备名称：测试设备的唯一标识，**默认为本机IP地址**
   - 服务端地址：中央服务器的URL（建议使用HTTP而非HTTPS）
   - 日志目录：点击"浏览..."按钮选择目录
     - **Windows系统**：首先选择盘符（C:、D:等），然后浏览该盘符下的目录
     - **Unix系统**：从根目录（/）开始浏览目录
   - 客户端ID：自动生成，通常使用主机名

## 主要优势

- **兼容性更好**：支持所有Windows版本，包括Win7无SP1
- **体积更小**：无需Electron，部署更简单
- **内网友好**：在内网环境下运行更稳定，依赖更少
- **跨平台访问**：可以从任何设备上的浏览器访问客户端界面

## 文件说明

- `web-client.js` - Web版客户端主程序
- `web-ui/` - Web界面文件
  - `index.html` - 主界面
  - `app.js` - 前端JavaScript
- `deploy-windows.bat` - Windows部署脚本
- `deploy-linux.sh` - Linux/Mac部署脚本
- `start-web.bat` - Windows简单启动脚本
- `DEPLOY.md` - 详细部署指南

## 与Electron版本比较

| 特性 | Electron版本 | Web版 |
|------|-------------|-------|
| 兼容性 | 需要Win7 SP1或更高 | 支持所有Windows版本 |
| 体积 | 大（约100MB+） | 小（约10MB） |
| 依赖 | 需要Electron环境 | 只需Node.js |
| 部署 | 需要安装Electron | 简单的npm安装 |
| 访问方式 | 只能在本机访问 | 可从任何设备浏览器访问 |
| 内网支持 | 依赖下载可能有问题 | 更适合内网环境 |

## 技术支持

如有问题或建议，请联系：
- 邮箱：charrote.vinson@163.com
- 华澄·AI Team

详细部署指南请参考 [DEPLOY.md](DEPLOY.md)