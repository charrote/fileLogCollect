# AT测试采集系统

这是一个基于客户端-服务端架构的自动化测试日志采集与分析系统。系统分为两部分：

1. **服务端**：中央数据收集和管理系统，负责存储、分析和展示测试数据
2. **客户端**：部署在各测试电脑上的轻量级程序，负责采集本地日志并上传到服务端

系统能够从多个测试设备收集日志，统一存储到中央数据库，并提供Web界面进行数据分析和报表生成。

## 功能特性

- **实时日志监控**：自动监控指定目录（本地或网络共享）中的日志文件变化
- **智能解析**：自动识别测试开始/结束时间、结果（OK/NG）、统计NG/OK数量
- **数据存储**：使用SQLite数据库存储测试记录
- **报表生成**：提供时间段统计和详细记录
- **Excel导出**：支持将报表导出为Excel格式
- **多设备支持**：支持同时监控多个设备的日志目录
- **Web界面**：服务端提供友好的图形化界面进行数据监控和管理
- **客户端GUI**：客户端提供图形化界面，支持设备选择和实时采集状态显示
- **集中管理**：单一系统可监控分布在不同位置的日志目录

## 技术栈

- **后端**: Node.js + Express
- **数据库**: SQLite
- **前端**: Vue.js 3 + Element Plus
- **报表**: Excel导出功能

## 安装与运行

### 环境要求

- Node.js >= 14.x
- npm

### 安装依赖

```bash
npm install
```

### 配置

修改 `src/config/config.js` 来配置系统参数：

```javascript
module.exports = {
  database: {
    path: process.env.DB_PATH || './data/test_data.db'  // SQLite数据库路径
  },
  
  collection: {
    devices: [
      {
        name: "Device_001",
        logDir: process.env.LOG_DIR_001 || './DemoDatas/device001',
        enabled: true
      },
      {
        name: "Device_002", 
        logDir: process.env.LOG_DIR_002 || './DemoDatas/device002',
        enabled: true
      }
    ],
    pollInterval: 5000, // 5秒轮询一次
    maxConcurrent: 3   // 最大并发处理数
  },

  server: {
    port: process.env.PORT || 3000,
    // HOST设置说明:
    // '0.0.0.0' - 允许所有网络接口访问（包括外部网络）
    // '127.0.0.1' 或 'localhost' - 仅允许本地访问
    // 根据安全需求选择合适的设置
    host: process.env.HOST || '0.0.0.0'
  }
};
```

### 启动服务

```bash
# 生产模式
npm start

# 开发模式（需要安装nodemon）
npm install -g nodemon
npm run dev
```

## API接口

### 获取系统状态
```
GET /api/status
```

### 获取测试记录
```
GET /api/records?startDate=2024-01-01&endDate=2024-01-31&deviceName=Device_001&page=1&limit=50
```

### 搜索测试记录
```
POST /api/records/search
Content-Type: application/json

{
  "startDate": "2024-01-01",
  "endDate": "2024-01-31",
  "deviceName": "Device_001"
}
```

### 获取报表
```
GET /api/report?startDate=2024-01-01&endDate=2024-01-31&deviceName=Device_001
```

### 获取设备列表
```
GET /api/devices
```

### 导出Excel报表
```
POST /api/export-excel
Content-Type: application/json

{
  "startDate": "2024-01-01",
  "endDate": "2024-01-31",
  "deviceName": "Device_001"
}
```

## 使用示例

系统会自动监控配置的目录中的日志文件，支持以下格式的测试日志：

```
2024-01-15 10:30:15 - 测试开始
2024-01-15 10:30:20 - 执行步骤1: OK
2024-01-15 10:30:25 - 执行步骤2: OK
2024-01-15 10:30:30 - 执行步骤3: NG
2024-01-15 10:30:35 - 测试结束
```

系统会自动解析时间、统计OK/NG数量，并判断最终测试结果。

## 目录结构

```
src/                  # 服务端源代码
├── config/           # 服务端配置文件
├── controllers/      # 服务端控制器
├── models/           # 数据模型
├── routes/           # 路由定义
├── services/         # 业务服务
│   ├── LogCollector.js   # 日志收集器
│   ├── LogParser.js      # 日志解析器
│   └── ReportService.js  # 报表服务
public/               # 前端静态文件
├── index.html        # 主页面
├── css/              # 样式文件
├── js/               # JavaScript文件
├── assets/           # 静态资源
client/               # 客户端程序
├── config.js         # 客户端配置
├── client.js         # 客户端主程序
├── LogCollector.js   # 客户端日志收集器
├── LogUploader.js    # 客户端上传器
├── package.json      # 客户端依赖
├── README.md         # 客户端说明
├── gui/              # 客户端GUI界面
│   ├── main.js       # Electron主进程
│   ├── renderer.js   # Electron渲染进程
│   └── index.html    # GUI界面
└── assets/           # 客户端资源文件
test/                 # 测试文件
demo/                 # 演示数据
```

## 部署建议

### 服务端部署
- 将服务端应用部署在中心服务器或专用机器上
- 配置适当的网络访问权限，确保客户端可以访问
- 使用PM2进行进程管理
- 定期备份SQLite数据库文件
- 监控磁盘空间使用情况

### 客户端部署
- 在每个需要监控的测试设备上部署客户端程序
- 配置客户端指向中央服务端地址
- 确保客户端可以访问本地测试日志目录
- 将客户端配置为开机自启或系统服务

### 网络配置
- **服务端**: 开放相应端口（默认3000），配置防火墙规则
- **客户端**: 确保可以访问服务端地址和端口
- **HOST设置**: 服务端根据网络安全需求设置适当的HOST值：
  - 对于仅局域网访问：设置为具体IP地址
  - 对于网络访问：设置为 '0.0.0.0'（默认）
  - 对于仅本地访问：设置为 '127.0.0.1' 或 'localhost'

## 进程管理 (PM2)

```bash
# 安装PM2
npm install -g pm2

# 启动应用
pm2 start server.js --name "at-test-collector"

# 查看应用状态
pm2 status

# 查看日志
pm2 logs

# 停止应用
pm2 stop at-test-collector
```

## 开发

如有定制需求，可以参考以下核心模块：

- `LogParser.js`: 日志解析逻辑，可根据实际日志格式进行调整
- `LogCollector.js`: 文件监控逻辑
- `DatabaseManager.js`: 数据库操作
- `ReportService.js`: 报表生成逻辑