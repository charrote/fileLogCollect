// client/LogUploader.js
// 在引入模块前设置忽略SSL错误
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'; // 忽略TLS证书验证

const axios = require('axios');
const http = require('http');
const https = require('https');

class LogUploader {
  constructor(config) {
    this.config = config;
    
    // 强制使用HTTP协议以避免SSL问题
    let serverUrl = this.config.server.url;
    if (serverUrl.startsWith('https://')) {
      serverUrl = serverUrl.replace(/^https:\/\//, 'http://');
      console.warn(`警告: 已将HTTPS URL转换为HTTP以避免SSL握手问题: ${serverUrl}`);
    }
    
    // 调试：输出实际使用的URL
    console.log(`初始化LogUploader，服务端URL: ${serverUrl}`);
    
    // 创建axios实例
    this.axiosInstance = axios.create({
      baseURL: serverUrl,
      timeout: 30000, // 30秒超时
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'AT-Test-Client/1.0'
      },
      // 防止重定向到HTTPS
      maxRedirects: 0,  // 禁止重定向，防止HTTP到HTTPS的重定向
      // HTTP Agent配置
      httpAgent: new http.Agent({ 
        keepAlive: true,
        rejectUnauthorized: false
      }),
      // HTTPS Agent配置 - 添加更宽松的SSL设置
      httpsAgent: new https.Agent({
        rejectUnauthorized: false, // 忽略证书验证
        checkServerIdentity: () => undefined, // 跳过服务器身份验证
        keepAlive: true,
        // 支持旧版SSL/TLS协议
        secureProtocol: 'TLSv1_method'
      })
    });
  }

  async uploadLog(logData, originalFilePath) {
    try {
      const response = await this.axiosInstance.post('/api/client-log', {
        ...logData,
        originalFilePath: originalFilePath,
        uploadTimestamp: new Date().toISOString()
      });
      
      if (response.data.success) {
        console.log(`日志上传成功: ${originalFilePath}`);
        return true;
      } else {
        const errorMsg = response.data.error || '未知错误';
        console.error(`日志上传失败: ${errorMsg}`);
        return { success: false, error: errorMsg };
      }
    } catch (error) {
      // 详细的SSL错误处理
      if (error.code === 'UNABLE_TO_VERIFY_LEAF_SIGNATURE' || 
          error.code === 'CERT_HAS_EXPIRED' ||
          error.code === 'DEPTH_ZERO_SELF_SIGNED_CERT' ||
          error.message.includes('SSL') ||
          error.message.includes('certificate') ||
          error.message.includes('handshake')) {
        console.warn(`SSL证书错误已被忽略 ${originalFilePath}:`, error.message);
        // 尝试使用HTTP重试一次
        try {
          const httpUrl = this.config.server.url.replace(/^https:\/\//, 'http://');
          const httpInstance = axios.create({
            baseURL: httpUrl,
            timeout: 30000,
            headers: {
              'Content-Type': 'application/json',
              'User-Agent': 'AT-Test-Client/1.0'
            }
          });
          
          const response = await httpInstance.post('/api/client-log', {
            ...logData,
            originalFilePath: originalFilePath,
            uploadTimestamp: new Date().toISOString()
          });
          
          if (response.data.success) {
            console.log(`通过HTTP成功上传日志: ${originalFilePath}`);
            return true;
          } else {
            const errorMsg = response.data.error || 'HTTP重试失败';
            return { success: false, error: errorMsg };
          }
        } catch (httpError) {
          console.error(`HTTP重试也失败 ${originalFilePath}:`, httpError.message);
          return { success: false, error: `SSL错误且HTTP重试失败: ${httpError.message}` };
        }
      }
      
      const errorMsg = error.message || '网络错误';
      console.error(`上传日志时发生错误 ${originalFilePath}:`, errorMsg);
      return { success: false, error: errorMsg };
    }
  }

  async sendHeartbeat() {
    try {
      const response = await this.axiosInstance.get('/api/heartbeat', {
        params: {
          clientId: this.config.client.id,
          clientName: this.config.client.name,
          timestamp: new Date().toISOString()
        }
      });
      
      return response.data;
    } catch (error) {
      // SSL错误处理
      if (error.code === 'UNABLE_TO_VERIFY_LEAF_SIGNATURE' || 
          error.code === 'CERT_HAS_EXPIRED' ||
          error.code === 'DEPTH_ZERO_SELF_SIGNED_CERT' ||
          error.message.includes('SSL') ||
          error.message.includes('certificate') ||
          error.message.includes('handshake')) {
        console.warn('心跳请求SSL错误已被忽略:', error.message);
        // 尝试使用HTTP重试一次
        try {
          const httpUrl = this.config.server.url.replace(/^https:\/\//, 'http://');
          const httpInstance = axios.create({
            baseURL: httpUrl,
            timeout: 30000,
            headers: {
              'Content-Type': 'application/json',
              'User-Agent': 'AT-Test-Client/1.0'
            }
          });
          
          const response = await httpInstance.get('/api/heartbeat', {
            params: {
              clientId: this.config.client.id,
              clientName: this.config.client.name,
              timestamp: new Date().toISOString()
            }
          });
          
          return response.data;
        } catch (httpError) {
          console.warn('心跳请求HTTP重试也失败:', httpError.message);
        }
      }
      
      console.error('心跳请求失败:', error.message);
      return null;
    }
  }

  async testConnection() {
    try {
      const response = await this.axiosInstance.get('/api/status');
      return response.data.status === 'running';
    } catch (error) {
      // SSL错误处理
      if (error.code === 'UNABLE_TO_VERIFY_LEAF_SIGNATURE' || 
          error.code === 'CERT_HAS_EXPIRED' ||
          error.code === 'DEPTH_ZERO_SELF_SIGNED_CERT' ||
          error.message.includes('SSL') ||
          error.message.includes('certificate') ||
          error.message.includes('handshake')) {
        console.warn('连接测试SSL错误已被忽略:', error.message);
        // 尝试使用HTTP重试一次
        try {
          const httpUrl = this.config.server.url.replace(/^https:\/\//, 'http://');
          const httpInstance = axios.create({
            baseURL: httpUrl,
            timeout: 30000,
            headers: {
              'Content-Type': 'application/json',
              'User-Agent': 'AT-Test-Client/1.0'
            }
          });
          
          const response = await httpInstance.get('/api/status');
          return response.data.status === 'running';
        } catch (httpError) {
          console.warn('连接测试HTTP重试也失败:', httpError.message);
        }
      }
      
      console.error('连接测试失败:', error.message);
      return false;
    }
  }
}

module.exports = LogUploader;