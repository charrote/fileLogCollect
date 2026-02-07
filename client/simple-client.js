// client/simple-client.js
// 精简版AT测试采集客户端 - 专门用于解决SSL问题
// 在引入模块前设置忽略SSL错误
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'; // 忽略TLS证书验证

// 仅使用Node.js内置模块，无外部依赖
const fs = require('fs');
const path = require('path');
const http = require('http');
const https = require('https');
const { spawn } = require('child_process');
const readline = require('readline');
const os = require('os');

// 处理未捕获的SSL相关异常
process.on('uncaughtException', (error) => {
  if (error.message.includes('SSL') || error.message.includes('certificate') || 
      error.code === 'UNABLE_TO_VERIFY_LEAF_SIGNATURE' || error.code === 'CERT_HAS_EXPIRED' ||
      error.code === 'DEPTH_ZERO_SELF_SIGNED_CERT' || error.message.includes('handshake')) {
    console.warn('精简版客户端SSL相关错误已被忽略:', error.message);
  } else {
    console.error('未捕获的异常:', error);
    process.exit(1);
  }
});

// 简单的配置对象
const config = {
  server: {
    url: process.env.SERVER_URL || 'http://localhost:3000',
    uploadEndpoint: '/api/client-log',
    heartbeatInterval: 30000,
  },
  collector: {
    logDir: process.env.LOG_DIR || './logs',
    filePattern: /\.(log|txt)$/i,
    pollInterval: 5000,
    batchSize: 10,
  },
  client: {
    id: process.env.CLIENT_ID || os.hostname(),
    name: process.env.CLIENT_NAME || 'Simple Client',
    deviceType: process.env.DEVICE_TYPE || 'Test Device',
  }
};

// 简单的HTTP客户端，自动处理SSL问题
class SimpleHttpClient {
  constructor(baseUrl) {
    // 强制使用HTTP协议
    this.baseUrl = baseUrl.startsWith('https://') 
      ? baseUrl.replace(/^https:\/\//, 'http://') 
      : baseUrl;
    
    console.log(`精简版HTTP客户端初始化，服务端URL: ${this.baseUrl}`);
  }

  // 发送HTTP请求，自动处理SSL问题
  async request(method, path, data = null) {
    return new Promise((resolve, reject) => {
      const url = new URL(path, this.baseUrl);
      const isHttps = url.protocol === 'https:';
      const httpModule = isHttps ? https : http;
      
      const options = {
        hostname: url.hostname,
        port: url.port || (isHttps ? 443 : 80),
        path: url.pathname + url.search,
        method: method,
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'AT-Test-Simple-Client/1.0'
        }
      };

      // 如果是HTTPS，添加SSL相关配置
      if (isHttps) {
        options.rejectUnauthorized = false; // 忽略证书验证
        options.checkServerIdentity = () => undefined; // 跳过服务器身份验证
      }

      const req = httpModule.request(options, (res) => {
        let body = '';
        res.on('data', (chunk) => {
          body += chunk;
        });
        
        res.on('end', () => {
          try {
            const data = JSON.parse(body);
            resolve({ status: res.statusCode, data });
          } catch (e) {
            resolve({ status: res.statusCode, data: body });
          }
        });
      });

      req.on('error', (error) => {
        // 如果HTTPS失败，尝试HTTP
        if (isHttps && (error.code === 'UNABLE_TO_VERIFY_LEAF_SIGNATURE' || 
            error.code === 'CERT_HAS_EXPIRED' ||
            error.code === 'DEPTH_ZERO_SELF_SIGNED_CERT' ||
            error.message.includes('SSL') ||
            error.message.includes('certificate') ||
            error.message.includes('handshake'))) {
          
          console.warn(`HTTPS请求失败，尝试HTTP: ${error.message}`);
          const httpUrl = this.baseUrl.replace(/^https:\/\//, 'http://');
          const httpClient = new SimpleHttpClient(httpUrl);
          return httpClient.request(method, path, data).then(resolve).catch(reject);
        }
        
        reject(error);
      });

      if (data) {
        req.write(JSON.stringify(data));
      }
      
      req.end();
    });
  }

  async get(path) {
    return this.request('GET', path);
  }

  async post(path, data) {
    return this.request('POST', path, data);
  }
}

// 简单的日志收集器
class SimpleLogCollector {
  constructor(config, uploader) {
    this.config = config;
    this.uploader = uploader;
    this.isRunning = false;
    this.pollInterval = null;
    this.processedFiles = new Set(); // 记录已处理的文件
  }

  async start() {
    console.log(`启动日志收集器，监控目录: ${this.config.collector.logDir}`);
    this.isRunning = true;
    
    // 确保日志目录存在
    if (!fs.existsSync(this.config.collector.logDir)) {
      console.log(`创建日志目录: ${this.config.collector.logDir}`);
      fs.mkdirSync(this.config.collector.logDir, { recursive: true });
    }
    
    // 立即扫描一次
    await this.scanLogFiles();
    
    // 定期扫描
    this.pollInterval = setInterval(async () => {
      if (this.isRunning) {
        await this.scanLogFiles();
      }
    }, this.config.collector.pollInterval);
  }

  async stop() {
    console.log('停止日志收集器');
    this.isRunning = false;
    
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }
  }

  async scanLogFiles() {
    try {
      const files = fs.readdirSync(this.config.collector.logDir, { withFileTypes: true })
        .filter(dirent => dirent.isFile())
        .filter(dirent => this.config.collector.filePattern.test(dirent.name))
        .map(dirent => dirent.name);
      
      for (const filename of files) {
        const filePath = path.join(this.config.collector.logDir, filename);
        const fileKey = `${filePath}_${fs.statSync(filePath).mtime.getTime()}`;
        
        // 如果文件未处理过，则处理它
        if (!this.processedFiles.has(fileKey)) {
          await this.processLogFile(filePath);
          this.processedFiles.add(fileKey);
        }
      }
    } catch (error) {
      console.error('扫描日志文件时出错:', error.message);
    }
  }

  async processLogFile(filePath) {
    try {
      console.log(`处理日志文件: ${filePath}`);
      const content = fs.readFileSync(filePath, 'utf8');
      
      // 简单的日志解析逻辑
      const logData = {
        client: {
          id: this.config.client.id,
          name: this.config.client.name,
          deviceType: this.config.client.deviceType
        },
        filename: path.basename(filePath),
        content: content,
        timestamp: new Date().toISOString()
      };
      
      // 上传日志
      await this.uploader.uploadLog(logData, filePath);
    } catch (error) {
      console.error(`处理日志文件失败 ${filePath}:`, error.message);
    }
  }
}

// 简单的日志上传器
class SimpleLogUploader {
  constructor(config) {
    this.config = config;
    this.httpClient = new SimpleHttpClient(config.server.url);
  }

  async uploadLog(logData, originalFilePath) {
    try {
      const response = await this.httpClient.post(this.config.server.uploadEndpoint, logData);
      
      if (response.status === 200 && response.data.success) {
        console.log(`日志上传成功: ${originalFilePath}`);
        return true;
      } else {
        console.error(`日志上传失败:`, response.data.error || '未知错误');
        return false;
      }
    } catch (error) {
      console.error(`上传日志时发生错误 ${originalFilePath}:`, error.message);
      return false;
    }
  }

  async sendHeartbeat() {
    try {
      const response = await this.httpClient.get('/api/heartbeat', {
        clientId: this.config.client.id,
        clientName: this.config.client.name,
        timestamp: new Date().toISOString()
      });
      
      return response.data;
    } catch (error) {
      console.error('心跳请求失败:', error.message);
      return null;
    }
  }

  async testConnection() {
    try {
      const response = await this.httpClient.get('/api/status');
      return response.status === 200 && response.data.status === 'running';
    } catch (error) {
      console.error('连接测试失败:', error.message);
      return false;
    }
  }
}

// 简单的客户端类
class SimpleClient {
  constructor() {
    this.uploader = new SimpleLogUploader(config);
    this.collector = new SimpleLogCollector(config, this.uploader);
    this.heartbeatInterval = null;
  }

  async initialize() {
    console.log('初始化精简版AT测试客户端...');
    
    // 测试与服务端的连接
    const isConnected = await this.uploader.testConnection();
    if (!isConnected) {
      console.error('无法连接到服务端，请检查服务端是否正在运行以及网络连接是否正常');
      console.log(`预期的服务端地址: ${config.server.url}`);
      return false;
    }
    
    console.log('精简版客户端初始化成功');
    return true;
  }

  async start() {
    console.log(`启动精简版AT测试客户端 - ID: ${config.client.id}, Name: ${config.client.name}`);
    
    // 启动日志采集器
    await this.collector.start();
    
    // 启动心跳机制
    this.startHeartbeat();
    
    console.log('精简版AT测试客户端已启动并开始监控日志目录');
    
    // 显示简单的交互界面
    this.showInteractiveInterface();
  }

  startHeartbeat() {
    this.heartbeatInterval = setInterval(async () => {
      try {
        await this.uploader.sendHeartbeat();
      } catch (error) {
        console.error('心跳请求失败:', error.message);
      }
    }, config.server.heartbeatInterval);
  }

  async stop() {
    console.log('正在停止精简版AT测试客户端...');
    
    // 停止心跳
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }
    
    // 停止日志采集器
    await this.collector.stop();
    
    console.log('精简版AT测试客户端已停止');
  }

  // 简单的交互界面
  showInteractiveInterface() {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    console.log('\n===== 精简版AT测试客户端控制台 =====');
    console.log('输入 "status" 查看状态');
    console.log('输入 "stop" 停止客户端');
    console.log('输入 "exit" 退出程序');
    console.log('=====================================\n');

    const promptUser = () => {
      rl.question('> ', (answer) => {
        switch (answer.trim().toLowerCase()) {
          case 'status':
            console.log(`客户端状态: 运行中`);
            console.log(`客户端ID: ${config.client.id}`);
            console.log(`客户端名称: ${config.client.name}`);
            console.log(`服务端地址: ${config.server.url}`);
            console.log(`监控目录: ${config.collector.logDir}`);
            break;
          case 'stop':
            this.stop().then(() => {
              console.log('客户端已停止，输入 "start" 重新启动');
            });
            break;
          case 'start':
            this.start();
            break;
          case 'exit':
            this.stop().then(() => {
              rl.close();
              process.exit(0);
            });
            return;
          default:
            console.log('未知命令');
        }
        
        if (this.collector.isRunning) {
          promptUser();
        }
      });
    };

    promptUser();

    rl.on('close', () => {
      this.stop().then(() => {
        process.exit(0);
      });
    });
  }

  // 优雅关闭
  setupGracefulShutdown() {
    process.on('SIGINT', async () => {
      console.log('\n接收到终止信号，正在优雅关闭...');
      await this.stop();
      process.exit(0);
    });

    process.on('SIGTERM', async () => {
      console.log('\n接收到终止信号，正在优雅关闭...');
      await this.stop();
      process.exit(0);
    });
  }
}

// 如果直接运行此文件，则启动客户端
if (require.main === module) {
  const client = new SimpleClient();
  
  // 设置优雅关闭
  client.setupGracefulShutdown();
  
  // 启动客户端
  (async () => {
    try {
      const initialized = await client.initialize();
      if (initialized) {
        await client.start();
      } else {
        console.log('客户端初始化失败，退出...');
        process.exit(1);
      }
    } catch (error) {
      console.error('启动客户端时发生错误:', error);
      process.exit(1);
    }
  })();
}

module.exports = SimpleClient;