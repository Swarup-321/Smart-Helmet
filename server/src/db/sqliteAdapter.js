import sqlite3 from 'sqlite3';
import fs from 'fs';
import path from 'path';
import bcrypt from 'bcryptjs';

export class SQLiteAdapter {
  constructor(dbPath = './data/mineguard.db') {
    this.dbPath = dbPath;
    this.db = null;
  }

  // Promise helper for db.run
  run(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db.run(sql, params, function (err) {
        if (err) reject(err);
        else resolve({ lastID: this.lastID, changes: this.changes });
      });
    });
  }

  // Promise helper for db.get
  get(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db.get(sql, params, (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
  }

  // Promise helper for db.all
  all(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db.all(sql, params, (err, rows) => {
        if (err) reject(err);
        else resolve(rows || []);
      });
    });
  }

  // Promise helper for db.exec
  exec(sql) {
    return new Promise((resolve, reject) => {
      this.db.exec(sql, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }

  async init() {
    const dir = path.dirname(this.dbPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    return new Promise((resolve, reject) => {
      this.db = new sqlite3.Database(this.dbPath, async (err) => {
        if (err) return reject(err);
        try {
          await this.createTables();
          await this.seedDefaults();
          resolve();
        } catch (setupErr) {
          reject(setupErr);
        }
      });
    });
  }

  async createTables() {
    await this.exec(`
      CREATE TABLE IF NOT EXISTS workers (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        helmet_id TEXT NOT NULL,
        zone TEXT NOT NULL,
        phone TEXT,
        emergency_contact TEXT,
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS workers_latest (
        worker_id TEXT PRIMARY KEY,
        ts TEXT NOT NULL,
        data_json TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY (worker_id) REFERENCES workers(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS readings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        worker_id TEXT NOT NULL,
        ts TEXT NOT NULL,
        temperature REAL,
        humidity REAL,
        mq2_mv REAL,
        mq5_mv REAL,
        mq2_raw REAL,
        mq5_raw REAL,
        heart_rate REAL,
        spo2 REAL,
        ldr_raw REAL,
        sos INTEGER,
        fall INTEGER,
        battery REAL,
        communication TEXT,
        gateway_id TEXT,
        rssi REAL,
        snr REAL,
        FOREIGN KEY (worker_id) REFERENCES workers(id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_readings_worker_ts ON readings(worker_id, ts);
      CREATE INDEX IF NOT EXISTS idx_readings_ts ON readings(ts);

      CREATE TABLE IF NOT EXISTS alerts (
        id TEXT PRIMARY KEY,
        worker_id TEXT NOT NULL,
        ts TEXT NOT NULL,
        type TEXT NOT NULL,
        severity TEXT NOT NULL,
        message TEXT NOT NULL,
        value REAL,
        acknowledged INTEGER DEFAULT 0,
        acknowledged_by TEXT,
        acknowledged_at TEXT,
        resolved_at TEXT,
        FOREIGN KEY (worker_id) REFERENCES workers(id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_alerts_worker_ts ON alerts(worker_id, ts);
      CREATE INDEX IF NOT EXISTS idx_alerts_type_status ON alerts(type, acknowledged, resolved_at);

      CREATE TABLE IF NOT EXISTS thresholds (
        key TEXT PRIMARY KEY,
        warning REAL,
        critical REAL,
        enabled INTEGER DEFAULT 1
      );

      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'admin'
      );
    `);
  }

  async seedDefaults() {
    const defaultThresholds = [
      { key: 'gas_index', warning: 2000, critical: 2500, enabled: 1 },
      { key: 'heart_rate_low', warning: 55, critical: 50, enabled: 1 },
      { key: 'heart_rate_high', warning: 110, critical: 120, enabled: 1 },
      { key: 'spo2', warning: 94, critical: 90, enabled: 1 },
      { key: 'temperature', warning: 35, critical: 40, enabled: 1 },
      { key: 'humidity', warning: 80, critical: 85, enabled: 1 },
      { key: 'battery', warning: 25, critical: 20, enabled: 1 },
      { key: 'offline_timeout', warning: 30, critical: 60, enabled: 1 }
    ];

    for (const item of defaultThresholds) {
      await this.run(
        `INSERT OR IGNORE INTO thresholds (key, warning, critical, enabled) VALUES (?, ?, ?, ?)`,
        [item.key, item.warning, item.critical, item.enabled]
      );
    }

    const adminEmail = process.env.ADMIN_EMAIL || 'admin@mineguard.local';
    const adminPass = process.env.ADMIN_PASSWORD || 'Admin@123';
    const existing = await this.get('SELECT id FROM users WHERE email = ?', [adminEmail]);
    if (!existing) {
      const hash = bcrypt.hashSync(adminPass, 10);
      await this.run(
        `INSERT INTO users (id, email, password_hash, role) VALUES ('USR-ADMIN-1', ?, ?, 'admin')`,
        [adminEmail, hash]
      );
    }

    const workerRow = await this.get('SELECT count(*) as count FROM workers');
    if (workerRow.count === 0) {
      const seedWorkers = [
        { id: 'W001', name: 'Rajesh Kumar', helmet_id: 'H001', zone: 'Zone A - Shaft 3', phone: '+91 98765 43210', emergency_contact: 'Sunita Kumar (+91 98765 43211)', created_at: new Date().toISOString() },
        { id: 'W002', name: 'Vikram Singh', helmet_id: 'H002', zone: 'Zone B - Drift 1', phone: '+91 98765 43212', emergency_contact: 'Anita Singh (+91 98765 43213)', created_at: new Date().toISOString() },
        { id: 'W003', name: 'Amit Patel', helmet_id: 'H003', zone: 'Zone C - Extraction Face', phone: '+91 98765 43214', emergency_contact: 'Pooja Patel (+91 98765 43215)', created_at: new Date().toISOString() },
        { id: 'W004', name: 'Suresh Raina', helmet_id: 'H004', zone: 'Zone B - Conveyor 2', phone: '+91 98765 43216', emergency_contact: 'Kavita Raina (+91 98765 43217)', created_at: new Date().toISOString() },
        { id: 'W005', name: 'Dinesh Karthik', helmet_id: 'H005', zone: 'Main Access Gate', phone: '+91 98765 43218', emergency_contact: 'Deepika K (+91 98765 43219)', created_at: new Date().toISOString() }
      ];

      for (const w of seedWorkers) {
        await this.run(
          `INSERT INTO workers (id, name, helmet_id, zone, phone, emergency_contact, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [w.id, w.name, w.helmet_id, w.zone, w.phone, w.emergency_contact, w.created_at]
        );
      }
    }
  }

  // --- Workers ---
  async getWorkers() {
    return this.all('SELECT * FROM workers ORDER BY id ASC');
  }

  async getWorker(id) {
    const row = await this.get('SELECT * FROM workers WHERE id = ?', [id]);
    return row || null;
  }

  async createWorker(worker) {
    const record = {
      id: worker.id,
      name: worker.name,
      helmet_id: worker.helmet_id,
      zone: worker.zone,
      phone: worker.phone || '',
      emergency_contact: worker.emergency_contact || '',
      created_at: worker.created_at || new Date().toISOString()
    };
    await this.run(
      `INSERT INTO workers (id, name, helmet_id, zone, phone, emergency_contact, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [record.id, record.name, record.helmet_id, record.zone, record.phone, record.emergency_contact, record.created_at]
    );
    return record;
  }

  async updateWorker(id, updates) {
    const current = await this.getWorker(id);
    if (!current) return null;

    const merged = { ...current, ...updates };
    await this.run(
      `UPDATE workers SET name = ?, helmet_id = ?, zone = ?, phone = ?, emergency_contact = ? WHERE id = ?`,
      [merged.name, merged.helmet_id, merged.zone, merged.phone, merged.emergency_contact, id]
    );
    return merged;
  }

  async deleteWorker(id) {
    const res = await this.run('DELETE FROM workers WHERE id = ?', [id]);
    return res.changes > 0;
  }

  // --- Latest Readings ---
  async getLatestReadings() {
    const rows = await this.all('SELECT data_json FROM workers_latest');
    return rows.map(r => JSON.parse(r.data_json));
  }

  async getLatestReading(worker_id) {
    const row = await this.get('SELECT data_json FROM workers_latest WHERE worker_id = ?', [worker_id]);
    return row ? JSON.parse(row.data_json) : null;
  }

  async saveLatestReading(worker_id, reading) {
    const now = new Date().toISOString();
    const dataJson = JSON.stringify(reading);
    await this.run(
      `INSERT INTO workers_latest (worker_id, ts, data_json, updated_at)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(worker_id) DO UPDATE SET
         ts = excluded.ts,
         data_json = excluded.data_json,
         updated_at = excluded.updated_at`,
      [worker_id, reading.timestamp || now, dataJson, now]
    );
  }

  // --- Reading History ---
  async saveReadingHistory(reading) {
    const payload = [
      reading.worker_id,
      reading.timestamp || new Date().toISOString(),
      reading.temperature ?? null,
      reading.humidity ?? null,
      reading.mq2_mv ?? null,
      reading.mq5_mv ?? null,
      reading.mq2_raw ?? null,
      reading.mq5_raw ?? null,
      reading.heart_rate ?? null,
      reading.spo2 ?? null,
      reading.ldr_raw ?? null,
      reading.sos ? 1 : 0,
      reading.fall ? 1 : 0,
      reading.battery ?? null,
      reading.communication ?? 'wifi',
      reading.gateway_id ?? 'direct',
      reading.rssi ?? null,
      reading.snr ?? null
    ];

    const res = await this.run(`
      INSERT INTO readings (
        worker_id, ts, temperature, humidity, mq2_mv, mq5_mv, mq2_raw, mq5_raw,
        heart_rate, spo2, ldr_raw, sos, fall, battery, communication, gateway_id, rssi, snr
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, payload);

    return { id: res.lastID, ...reading };
  }

  async saveReadingHistoryBatch(readings) {
    await this.exec('BEGIN TRANSACTION');
    try {
      for (const r of readings) {
        await this.run(`
          INSERT INTO readings (
            worker_id, ts, temperature, humidity, mq2_mv, mq5_mv, mq2_raw, mq5_raw,
            heart_rate, spo2, ldr_raw, sos, fall, battery, communication, gateway_id, rssi, snr
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
          r.worker_id,
          r.timestamp || r.ts || new Date().toISOString(),
          r.temperature ?? null,
          r.humidity ?? null,
          r.mq2_mv ?? null,
          r.mq5_mv ?? null,
          r.mq2_raw ?? null,
          r.mq5_raw ?? null,
          r.heart_rate ?? null,
          r.spo2 ?? null,
          r.ldr_raw ?? null,
          r.sos ? 1 : 0,
          r.fall ? 1 : 0,
          r.battery ?? null,
          r.communication ?? 'wifi',
          r.gateway_id ?? 'direct',
          r.rssi ?? null,
          r.snr ?? null
        ]);
      }
      await this.exec('COMMIT');
    } catch (err) {
      await this.exec('ROLLBACK');
      throw err;
    }
  }

  async getReadingHistory({ worker_id, from, to, limit = 500 } = {}) {
    let query = 'SELECT * FROM readings WHERE 1=1';
    const params = [];

    if (worker_id) {
      query += ' AND worker_id = ?';
      params.push(worker_id);
    }
    if (from) {
      query += ' AND ts >= ?';
      params.push(from);
    }
    if (to) {
      query += ' AND ts <= ?';
      params.push(to);
    }

    query += ' ORDER BY ts DESC LIMIT ?';
    params.push(Number(limit) || 500);

    const rows = await this.all(query, params);
    return rows.reverse().map(r => ({
      ...r,
      sos: Boolean(r.sos),
      fall: Boolean(r.fall)
    }));
  }

  // --- Alerts ---
  async createAlert(alert) {
    const record = {
      id: alert.id || `ALT-${Date.now()}-${Math.random().toString(36).substr(2, 4).toUpperCase()}`,
      worker_id: alert.worker_id,
      ts: alert.ts || new Date().toISOString(),
      type: alert.type,
      severity: alert.severity,
      message: alert.message,
      value: alert.value ?? null,
      acknowledged: alert.acknowledged ? 1 : 0,
      acknowledged_by: alert.acknowledged_by || null,
      acknowledged_at: alert.acknowledged_at || null,
      resolved_at: alert.resolved_at || null
    };

    await this.run(`
      INSERT INTO alerts (
        id, worker_id, ts, type, severity, message, value, acknowledged, acknowledged_by, acknowledged_at, resolved_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      record.id, record.worker_id, record.ts, record.type, record.severity,
      record.message, record.value, record.acknowledged, record.acknowledged_by,
      record.acknowledged_at, record.resolved_at
    ]);

    return { ...record, acknowledged: Boolean(record.acknowledged) };
  }

  async getAlerts({ status, severity, worker_id, limit = 200 } = {}) {
    let query = `
      SELECT a.*, w.name as worker_name, w.zone as worker_zone, w.helmet_id
      FROM alerts a
      LEFT JOIN workers w ON a.worker_id = w.id
      WHERE 1=1
    `;
    const params = [];

    if (status === 'active') {
      query += ' AND a.resolved_at IS NULL AND a.acknowledged = 0';
    } else if (status === 'acknowledged') {
      query += ' AND a.acknowledged = 1 AND a.resolved_at IS NULL';
    } else if (status === 'resolved') {
      query += ' AND a.resolved_at IS NOT NULL';
    } else if (status === 'unresolved') {
      query += ' AND a.resolved_at IS NULL';
    }

    if (severity) {
      query += ' AND a.severity = ?';
      params.push(severity.toUpperCase());
    }

    if (worker_id) {
      query += ' AND a.worker_id = ?';
      params.push(worker_id);
    }

    query += ' ORDER BY a.ts DESC LIMIT ?';
    params.push(Number(limit) || 200);

    const rows = await this.all(query, params);
    return rows.map(r => ({
      ...r,
      acknowledged: Boolean(r.acknowledged)
    }));
  }

  async getAlert(id) {
    const row = await this.get('SELECT * FROM alerts WHERE id = ?', [id]);
    if (!row) return null;
    return { ...row, acknowledged: Boolean(row.acknowledged) };
  }

  async acknowledgeAlert(id, acknowledgedBy = 'Safety Officer') {
    const now = new Date().toISOString();
    await this.run(
      `UPDATE alerts SET acknowledged = 1, acknowledged_by = ?, acknowledged_at = ? WHERE id = ?`,
      [acknowledgedBy, now, id]
    );
    return this.getAlert(id);
  }

  async bulkAcknowledgeAlerts(ids, acknowledgedBy = 'Safety Officer') {
    if (!ids || ids.length === 0) return 0;
    const now = new Date().toISOString();
    const placeholders = ids.map(() => '?').join(',');
    const res = await this.run(
      `UPDATE alerts SET acknowledged = 1, acknowledged_by = ?, acknowledged_at = ? WHERE id IN (${placeholders}) AND acknowledged = 0`,
      [acknowledgedBy, now, ...ids]
    );
    return res.changes;
  }

  async resolveAlert(id) {
    const now = new Date().toISOString();
    await this.run('UPDATE alerts SET resolved_at = ? WHERE id = ?', [now, id]);
    return this.getAlert(id);
  }

  async resolveAlertsByType(worker_id, type) {
    const now = new Date().toISOString();
    await this.run(
      `UPDATE alerts SET resolved_at = ? WHERE worker_id = ? AND type = ? AND resolved_at IS NULL`,
      [now, worker_id, type]
    );
  }

  async getRecentUnresolvedAlert(worker_id, type, cooldownSec = 60) {
    const cutoff = new Date(Date.now() - cooldownSec * 1000).toISOString();
    const row = await this.get(
      `SELECT * FROM alerts WHERE worker_id = ? AND type = ? AND resolved_at IS NULL AND ts >= ? ORDER BY ts DESC LIMIT 1`,
      [worker_id, type, cutoff]
    );

    if (!row) return null;
    return { ...row, acknowledged: Boolean(row.acknowledged) };
  }

  // --- Thresholds ---
  async getThresholds() {
    const rows = await this.all('SELECT * FROM thresholds');
    return rows.map(r => ({ ...r, enabled: Boolean(r.enabled) }));
  }

  async getThreshold(key) {
    const row = await this.get('SELECT * FROM thresholds WHERE key = ?', [key]);
    if (!row) return null;
    return { ...row, enabled: Boolean(row.enabled) };
  }

  async updateThreshold(key, updates) {
    const current = await this.getThreshold(key);
    const warning = updates.warning !== undefined ? updates.warning : current?.warning;
    const critical = updates.critical !== undefined ? updates.critical : current?.critical;
    const enabled = updates.enabled !== undefined ? (updates.enabled ? 1 : 0) : (current?.enabled ? 1 : 0);

    await this.run(
      `INSERT INTO thresholds (key, warning, critical, enabled)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(key) DO UPDATE SET
         warning = excluded.warning,
         critical = excluded.critical,
         enabled = excluded.enabled`,
      [key, warning, critical, enabled]
    );

    return this.getThreshold(key);
  }

  // --- Users ---
  async getUserByEmail(email) {
    return this.get('SELECT * FROM users WHERE email = ?', [email]);
  }

  async getUserById(id) {
    return this.get('SELECT * FROM users WHERE id = ?', [id]);
  }

  async createUser(user) {
    await this.run(
      `INSERT INTO users (id, email, password_hash, role) VALUES (?, ?, ?, ?)`,
      [user.id, user.email, user.password_hash, user.role]
    );
    return user;
  }

  // --- Stats Summary ---
  async getStatsSummary() {
    const workerCountRow = await this.get('SELECT count(*) as count FROM workers');
    const totalWorkers = workerCountRow ? workerCountRow.count : 0;
    
    const activeAlertsRow = await this.get('SELECT count(*) as count FROM alerts WHERE resolved_at IS NULL');
    const activeAlerts = activeAlertsRow ? activeAlertsRow.count : 0;

    const criticalAlertsRow = await this.get('SELECT count(*) as count FROM alerts WHERE resolved_at IS NULL AND severity = "CRITICAL"');
    const criticalAlerts = criticalAlertsRow ? criticalAlertsRow.count : 0;

    const latestRows = await this.all('SELECT data_json FROM workers_latest');
    let heartRateSum = 0, heartRateCount = 0;
    let tempSum = 0, tempCount = 0;
    let maxGas = 0;
    let onlineCount = 0;
    const now = Date.now();

    for (const row of latestRows) {
      try {
        const data = JSON.parse(row.data_json);
        const ageSec = (now - new Date(data.timestamp || data.ts || 0).getTime()) / 1000;
        if (ageSec <= 30) onlineCount++;

        if (typeof data.heart_rate === 'number') {
          heartRateSum += data.heart_rate;
          heartRateCount++;
        }
        if (typeof data.temperature === 'number') {
          tempSum += data.temperature;
          tempCount++;
        }
        const gasVal = Math.max(data.mq2_mv || 0, data.mq5_mv || 0);
        if (gasVal > maxGas) maxGas = gasVal;
      } catch (e) {}
    }

    return {
      total_workers: totalWorkers,
      online_workers: onlineCount,
      offline_workers: totalWorkers - onlineCount,
      active_alerts: activeAlerts,
      critical_alerts: criticalAlerts,
      avg_heart_rate: heartRateCount > 0 ? Math.round(heartRateSum / heartRateCount) : null,
      avg_temperature: tempCount > 0 ? +(tempSum / tempCount).toFixed(1) : null,
      highest_gas_mv: maxGas || null,
      system_uptime_sec: Math.floor(process.uptime())
    };
  }
}
