// 下载依赖脚本
const fs = require('fs');
const https = require('https');
const path = require('path');

// 确保目录存在
const jsDir = path.join(__dirname, 'public', 'js');
const cssDir = path.join(__dirname, 'public', 'css');

if (!fs.existsSync(jsDir)) {
    fs.mkdirSync(jsDir, { recursive: true });
}

if (!fs.existsSync(cssDir)) {
    fs.mkdirSync(cssDir, { recursive: true });
}

// 下载文件函数
function downloadFile(url, dest) {
    return new Promise((resolve, reject) => {
        const file = fs.createWriteStream(dest);
        https.get(url, (response) => {
            response.pipe(file);
            file.on('finish', () => {
                file.close();
                resolve();
            });
        }).on('error', (err) => {
            fs.unlink(dest);
            reject(err);
        });
    });
}

// 依赖列表
const dependencies = [
    {
        url: 'https://cdn.jsdelivr.net/npm/vue@3/dist/vue.global.js',
        dest: path.join(jsDir, 'vue.global.js')
    },
    {
        url: 'https://cdn.jsdelivr.net/npm/axios/dist/axios.min.js',
        dest: path.join(jsDir, 'axios.min.js')
    },
    {
        url: 'https://cdn.jsdelivr.net/npm/element-plus/dist/index.css',
        dest: path.join(cssDir, 'index.css')
    },
    {
        url: 'https://cdn.jsdelivr.net/npm/element-plus/dist/index.full.js',
        dest: path.join(jsDir, 'index.full.js')
    }
];

// 下载所有依赖
async function downloadDependencies() {
    console.log('开始下载依赖...');
    
    for (const dep of dependencies) {
        try {
            console.log(`正在下载: ${dep.url}`);
            await downloadFile(dep.url, dep.dest);
            console.log(`下载完成: ${dep.dest}`);
        } catch (error) {
            console.error(`下载失败: ${dep.url}`, error);
        }
    }
    
    console.log('所有依赖下载完成！');
}

downloadDependencies();
// 下载依赖脚本
const fs = require('fs');
const https = require('https');
const path = require('path');

// 确保目录存在
const jsDir = path.join(__dirname, 'public', 'js');
const cssDir = path.join(__dirname, 'public', 'css');

if (!fs.existsSync(jsDir)) {
    fs.mkdirSync(jsDir, { recursive: true });
}

if (!fs.existsSync(cssDir)) {
    fs.mkdirSync(cssDir, { recursive: true });
}

// 下载文件函数
function downloadFile(url, dest) {
    return new Promise((resolve, reject) => {
        const file = fs.createWriteStream(dest);
        https.get(url, (response) => {
            response.pipe(file);
            file.on('finish', () => {
                file.close();
                resolve();
            });
        }).on('error', (err) => {
            fs.unlink(dest);
            reject(err);
        });
    });
}

// 依赖列表
const dependencies = [
    {
        url: 'https://cdn.jsdelivr.net/npm/vue@3/dist/vue.global.js',
        dest: path.join(jsDir, 'vue.global.js')
    },
    {
        url: 'https://cdn.jsdelivr.net/npm/axios/dist/axios.min.js',
        dest: path.join(jsDir, 'axios.min.js')
    },
    {
        url: 'https://cdn.jsdelivr.net/npm/element-plus/dist/index.css',
        dest: path.join(cssDir, 'index.css')
    },
    {
        url: 'https://cdn.jsdelivr.net/npm/element-plus/dist/index.full.js',
        dest: path.join(jsDir, 'index.full.js')
    }
];

// 下载所有依赖
async function downloadDependencies() {
    console.log('开始下载依赖...');
    
    for (const dep of dependencies) {
        try {
            console.log(`正在下载: ${dep.url}`);
            await downloadFile(dep.url, dep.dest);
            console.log(`下载完成: ${dep.dest}`);
        } catch (error) {
            console.error(`下载失败: ${dep.url}`, error);
        }
    }
    
    console.log('所有依赖下载完成！');
}

downloadDependencies();
// 下载依赖脚本
const fs = require('fs');
const https = require('https');
const path = require('path');

// 确保目录存在
const jsDir = path.join(__dirname, 'public', 'js');
const cssDir = path.join(__dirname, 'public', 'css');

if (!fs.existsSync(jsDir)) {
    fs.mkdirSync(jsDir, { recursive: true });
}

if (!fs.existsSync(cssDir)) {
    fs.mkdirSync(cssDir, { recursive: true });
}

// 下载文件函数
function downloadFile(url, dest) {
    return new Promise((resolve, reject) => {
        const file = fs.createWriteStream(dest);
        https.get(url, (response) => {
            response.pipe(file);
            file.on('finish', () => {
                file.close();
                resolve();
            });
        }).on('error', (err) => {
            fs.unlink(dest);
            reject(err);
        });
    });
}

// 依赖列表
const dependencies = [
    {
        url: 'https://cdn.jsdelivr.net/npm/vue@3/dist/vue.global.js',
        dest: path.join(jsDir, 'vue.global.js')
    },
    {
        url: 'https://cdn.jsdelivr.net/npm/axios/dist/axios.min.js',
        dest: path.join(jsDir, 'axios.min.js')
    },
    {
        url: 'https://cdn.jsdelivr.net/npm/element-plus/dist/index.css',
        dest: path.join(cssDir, 'index.css')
    },
    {
        url: 'https://cdn.jsdelivr.net/npm/element-plus/dist/index.full.js',
        dest: path.join(jsDir, 'index.full.js')
    }
];

// 下载所有依赖
async function downloadDependencies() {
    console.log('开始下载依赖...');
    
    for (const dep of dependencies) {
        try {
            console.log(`正在下载: ${dep.url}`);
            await downloadFile(dep.url, dep.dest);
            console.log(`下载完成: ${dep.dest}`);
        } catch (error) {
            console.error(`下载失败: ${dep.url}`, error);
        }
    }
    
    console.log('所有依赖下载完成！');
}

downloadDependencies();