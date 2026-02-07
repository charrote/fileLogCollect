// client/client.js
// 在引入模块前设置忽略SSL错误
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'; // 忽略TLS证书验证

// 处理未捕获的SSL相关异常
process.on('uncaughtException', (error) => {
  if (error.message.includes('SSL') || error.message.includes('certificate') || 
      error.code === 'UNABLE_TO_VERIFY_LEAF_SIGNATURE' || error.code === 'CERT_HAS_EXPIRED' ||
      error.code === 'DEPTH_ZERO_SELF_SIGNED_CERT' || error.message.includes('handshake')) {
    console.warn('客户端SSL相关错误已被忽略:', error.message);
  } else {
    console.error('未捕获的异常:', error);
    process.exit(1);
  }
});

// 处理未处理的Promise拒绝
process.on('unhandledRejection', (reason, promise) => {
  if (reason && (reason.message.includes('SSL') || reason.message.includes('certificate') || 
      reason.code === 'UNABLE_TO_VERIFY_LEAF_SIGNATURE' || reason.code === 'CERT_HAS_EXPIRED' ||
      reason.code === 'DEPTH_ZERO_SELF_SIGNED_CERT' || reason.message.includes('handshake'))) {
    console.warn('客户端Promise SSL相关错误已被忽略:', reason.message);
  } else {
    console.error('未处理的Promise拒绝:', reason);
  }
});

const config = require('./config');
const LogCollector = require('./LogCollector');
const LogUploader = require('./LogUploader');

class Client {
  constructor() {
    this.uploader = new LogUploader(config);
    this.collector = new LogCollector(config, this.uploader);
    this.heartbeatInterval = null;
  }

  async initialize() {
    console.log('初始化AT测试客户端...');
    
    // 测试与服务端的连接
    const isConnected = await this.uploader.testConnection();
    if (!isConnected) {
      console.error('无法连接到服务端，请检查服务端是否正在运行以及网络连接是否正常');
      console.log(`预期的服务端地址: ${config.server.url}`);
      return false;
    }
    
    console.log('客户端初始化成功');
    return true;
  }

  async start() {
    console.log(`启动AT测试客户端 - ID: ${config.client.id}, Name: ${config.client.name}`);
    
    // 启动日志采集器
    await this.collector.start();
    
    // 启动心跳机制
    this.startHeartbeat();
    
    console.log('AT测试客户端已启动并开始监控日志目录');
  }

  startHeartbeat() {
    this.heartbeatInterval = setInterval(async () => {
      try {
        await this.uploader.sendHeartbeat();
        // 可以在这里添加更多的健康检查逻辑
      } catch (error) {
        console.error('心跳请求失败:', error);
      }
    }, config.server.heartbeatInterval);
  }

  async stop() {
    console.log('正在停止AT测试客户端...');
    
    // 停止心跳
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }
    
    // 停止日志采集器
    await this.collector.stop();
    
    console.log('AT测试客户端已停止');
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
  const client = new Client();
  
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

module.exports = Client;