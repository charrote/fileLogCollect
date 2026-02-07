// ecosystem.config.js
module.exports = {
  apps: [{
    name: 'at-test-collector',
    script: './server.js',
    instances: 1,  // SQLite不支持并发，设为1
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    env: {
      NODE_ENV: 'production',
      PORT: 3000
    },
    error_file: './logs/err.log',
    out_file: './logs/out.log',
    log_file: './logs/combined.log',
    time: true
  }]
};