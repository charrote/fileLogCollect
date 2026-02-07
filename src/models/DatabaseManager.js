// src/models/DatabaseManager.js
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

class DatabaseManager {
  constructor(dbPath = './data/test_data.db') {
    this.dbPath = dbPath;
    this.db = null;
  }

  connect() {
    // 确保数据目录存在
    const dir = path.dirname(this.dbPath);
    if (!require('fs').existsSync(dir)) {
      require('fs').mkdirSync(dir, { recursive: true });
    }
    
    this.db = new sqlite3.Database(this.dbPath);
    
    // 创建表
    this.db.serialize(() => {
      // 测试记录表
      this.db.run(`
        CREATE TABLE IF NOT EXISTS test_records (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          device_name TEXT NOT NULL,
          start_time DATETIME,
          end_time DATETIME,
          result TEXT CHECK(result IN ('OK', 'NG')),
          ng_count INTEGER DEFAULT 0,
          ok_count INTEGER DEFAULT 0,
          file_path TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // 已处理文件记录表
      this.db.run(`
        CREATE TABLE IF NOT EXISTS processed_files (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          filepath TEXT UNIQUE NOT NULL,
          filesize INTEGER,
          mtime INTEGER,
          processed_time DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // 测试详情表
      this.db.run(`
        CREATE TABLE IF NOT EXISTS test_details (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          test_record_id INTEGER NOT NULL,
          log_sequence INTEGER,
          test_time DATETIME,
          test_content TEXT,
          test_result TEXT CHECK(test_result IN ('OK', 'NG')),
          measured_value REAL,
          spec_min REAL,
          spec_max REAL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (test_record_id) REFERENCES test_records (id)
        )
      `);

      // 添加索引提高查询性能
      this.db.run('CREATE INDEX IF NOT EXISTS idx_created_at ON test_records(created_at)');
      this.db.run('CREATE INDEX IF NOT EXISTS idx_filepath ON processed_files(filepath)');
      this.db.run('CREATE INDEX IF NOT EXISTS idx_device_name ON test_records(device_name)');
      this.db.run('CREATE INDEX IF NOT EXISTS idx_result ON test_records(result)');
      this.db.run('CREATE INDEX IF NOT EXISTS idx_test_record_id ON test_details(test_record_id)');
    });
  }

  getDatabase() {
    return this.db;
  }

  async saveTestRecord(record) {
    return new Promise((resolve, reject) => {
      this.db.run(
        'INSERT INTO test_records (device_name, start_time, end_time, result, ng_count, ok_count, file_path) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [record.deviceName, record.startTime, record.endTime, record.result, record.ngCount, record.okCount, record.filePath],
        function(err) {
          if (err) {
            console.error('保存测试记录时出错:', err);
            reject(err);
          } else {
            resolve(this.lastID);
          }
        }
      );
    });
  }

  async saveTestDetails(testRecordId, details) {
    if (!details || details.length === 0) {
      return Promise.resolve([]);
    }

    return new Promise((resolve, reject) => {
      const stmt = this.db.prepare(`
        INSERT INTO test_details (test_record_id, log_sequence, test_time, test_content, test_result, measured_value, spec_min, spec_max)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `);

      const results = [];
      let completed = 0;
      let hasError = false;

      for (const detail of details) {
        stmt.run([
          testRecordId,
          detail.logSequence,
          detail.testTime,
          detail.testContent,
          detail.testResult,
          detail.measuredValue,
          detail.specMin,
          detail.specMax
        ], function(err) {
          if (err) {
            console.error('保存测试详情时出错:', err);
            if (!hasError) {
              hasError = true;
              stmt.finalize();
              reject(err);
            }
          } else {
            results.push(this.lastID);
            completed++;
            if (completed === details.length && !hasError) {
              stmt.finalize();
              resolve(results);
            }
          }
        });
      }
    });
  }

  async getTestDetails(testRecordId) {
    return new Promise((resolve, reject) => {
      this.db.all(
        'SELECT * FROM test_details WHERE test_record_id = ? ORDER BY log_sequence',
        [testRecordId],
        (err, rows) => {
          if (err) reject(err);
          else resolve(rows);
        }
      );
    });
  }

  async getTestRecords(startDate, endDate, deviceName = null, result = null) {
    let sql = 'SELECT * FROM test_records WHERE created_at BETWEEN ? AND ?';
    let params = [startDate, endDate];
    
    if (deviceName) {
      sql += ' AND device_name = ?';
      params.push(deviceName);
    }
    
    if (result) {
      sql += ' AND result = ?';
      params.push(result);
    }
    
    sql += ' ORDER BY created_at DESC';
    
    return new Promise((resolve, reject) => {
      this.db.all(sql, params, (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  }

  async getSummaryStats(startDate, endDate, deviceName = null) {
    let sql = `
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN result = 'OK' THEN 1 ELSE 0 END) as ok_count,
        SUM(CASE WHEN result = 'NG' THEN 1 ELSE 0 END) as ng_count,
        CAST(SUM(CASE WHEN result = 'OK' THEN 1 ELSE 0 END) AS FLOAT) * 100 / COUNT(*) as ok_rate
      FROM test_records 
      WHERE created_at BETWEEN ? AND ?
    `;
    let params = [startDate, endDate];
    
    if (deviceName) {
      sql += ' AND device_name = ?';
      params.push(deviceName);
    }
    
    return new Promise((resolve, reject) => {
      this.db.all(sql, params, (err, rows) => {
        if (err) reject(err);
        else resolve(rows[0]);
      });
    });
  }

  async getAllDevices() {
    return new Promise((resolve, reject) => {
      this.db.all(`
        SELECT DISTINCT device_name as name FROM test_records ORDER BY device_name
      `, (err, rows) => {
        if (err) reject(err);
        else resolve(rows.map(row => row.name));
      });
    });
  }

  async isAlreadyProcessed(filePath) {
    return new Promise((resolve, reject) => {
      this.db.get(
        'SELECT id FROM processed_files WHERE filepath = ?',
        [filePath],
        (err, row) => {
          if (err) reject(err);
          else resolve(!!row);
        }
      );
    });
  }

  async markAsProcessed(filePath) {
    const fs = require('fs').promises;
    try {
      const stats = await fs.stat(filePath);
      return new Promise((resolve, reject) => {
        this.db.run(
          'INSERT INTO processed_files (filepath, filesize, mtime, processed_time) VALUES (?, ?, ?, ?)',
          [filePath, stats.size, stats.mtime.getTime(), Date.now()],
          (err) => {
            if (err) {
              if (err.code === 'SQLITE_CONSTRAINT') {
                // 文件可能已经被处理过了
                console.warn(`文件已被标记为已处理: ${filePath}`);
                resolve(false);
              } else {
                reject(err);
              }
            } else {
              resolve(true);
            }
          }
        );
      });
    } catch (error) {
      console.error(`获取文件状态失败 ${filePath}:`, error);
      throw error;
    }
  }

  close() {
    if (this.db) {
      this.db.close();
    }
  }
}

module.exports = DatabaseManager;