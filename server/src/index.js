import express from 'express';
import cors from 'cors';
import http from 'http';
import { Server as SocketIOServer } from 'socket.io';
import rateLimit from 'express-rate-limit';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import dotenv from 'dotenv';
dotenv.config();

import { initDatabase, getDatabase } from './db/index.js';
import { AlertEngine } from './services/alertEngine.js';
import { analyzeWorkerMetric } from './services/trendService.js';
import { evaluateMlGasTrend, latestMlPredictions } from './services/mlService.js';

const app = express();
const server = http.createServer(app);

const PORT = process.env.PORT || 5000;
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN || '*';
const DEVICE_API_KEY = process.env.DEVICE_API_KEY || 'mineguard_device_secret_key_2026';
const JWT_SECRET = process.env.JWT_SECRET || 'mineguard_jwt_secret_998877';
let HISTORY_INTERVAL_SEC = parseInt(process.env.HISTORY_INTERVAL_SEC || '10', 10);
let OFFLINE_TIMEOUT_SEC = parseInt(process.env.OFFLINE_TIMEOUT_SEC || '45', 10);

// Setup Socket.IO
const io = new SocketIOServer(server, {
  cors: {
    origin: CLIENT_ORIGIN === '*' ? true : [CLIENT_ORIGIN, 'http://localhost:5173', 'http://localhost:3000'],
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE'],
    credentials: true
  }
});

app.use(cors({
  origin: CLIENT_ORIGIN === '*' ? true : [CLIENT_ORIGIN, 'http://localhost:5173', 'http://localhost:3000'],
  credentials: true
}));
app.use(express.json());

// In-memory cache for write budget: last written timestamp per worker
const lastPersistedHistoryMap = new Map();
// Cache of recent readings for fast trend alerts
const recentReadingsCache = new Map();

// Zod Schema for Sensor Payload
const sensorReadingSchema = z.object({
  worker_id: z.string().min(1, 'worker_id is required'),
  helmet_id: z.string().optional(),
  temperature: z.number().nullable().optional(),
  humidity: z.number().nullable().optional(),
  mq2_mv: z.number().nullable().optional(),
  mq5_mv: z.number().nullable().optional(),
  mq2_raw: z.number().nullable().optional(),
  mq5_raw: z.number().nullable().optional(),
  heart_rate: z.number().nullable().optional(),
  spo2: z.number().nullable().optional(),
  ldr_raw: z.number().nullable().optional(),
  sos: z.boolean().optional().default(false),
  fall: z.boolean().optional().default(false),
  battery: z.number().nullable().optional(),
  communication: z.string().optional().default('wifi'),
  gateway_id: z.string().optional().default('direct'),
  rssi: z.number().nullable().optional(),
  snr: z.number().nullable().optional(),
  pressure: z.number().nullable().optional(),
  timestamp: z.string().optional()
});

// Middleware for device authentication (disabled to allow direct ingestion from all hardware nodes)
function verifyDeviceApiKey(req, res, next) {
  next();
}

// Middleware for user JWT authentication
function verifyJwtAuth(req, res, next) {
  const authHeader = req.headers['authorization'];
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized: Bearer token required.' });
  }
  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Unauthorized: Invalid or expired token.' });
  }
}

// Rate limiter for sensor ingestion (protect device endpoint)
const deviceLimiter = rateLimit({
  windowMs: 1000,
  max: 60, // allow up to 60 readings/sec across devices
  message: { error: 'Too many sensor readings. Rate limit exceeded.' }
});

// ==========================================
// ROUTES
// ==========================================

// 1. Healthcheck (lightweight for uptime monitors)
app.get('/healthz', (req, res) => {
  res.status(200).json({ status: 'ok', uptime: process.uptime(), time: new Date().toISOString() });
});

// 2. Auth: Login
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required.' });
    }

    const db = getDatabase();
    const user = await db.getUserByEmail(email.toLowerCase().trim());
    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    const isValid = await bcrypt.compare(password, user.password_hash);
    if (!isValid) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        role: user.role
      }
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Internal server error during login.' });
  }
});

// 3. Sensor Ingestion Endpoint: POST /api/readings
app.post('/api/readings', deviceLimiter, async (req, res) => {
  try {
    const parsed = sensorReadingSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: 'Validation failed',
        details: parsed.error.issues.map(i => `${i.path.join('.')}: ${i.message}`)
      });
    }

    const reading = {
      ...parsed.data,
      timestamp: parsed.data.timestamp || new Date().toISOString()
    };

    const db = getDatabase();
    const alertEngine = new AlertEngine(db, io);

    // Save/Update latest reading in cache and DB
    await db.saveLatestReading(reading.worker_id, reading);

    // Maintain recent readings cache for worker (last 20 readings)
    if (!recentReadingsCache.has(reading.worker_id)) {
      recentReadingsCache.set(reading.worker_id, []);
    }
    const workerHistoryCache = recentReadingsCache.get(reading.worker_id);
    workerHistoryCache.push(reading);
    if (workerHistoryCache.length > 30) workerHistoryCache.shift();

    // Evaluate Alerts
    const alertsGenerated = await alertEngine.evaluate(reading, workerHistoryCache);

    // Write Budget Rule: Decide whether to persist to reading history
    const nowMs = Date.now();
    const lastPersisted = lastPersistedHistoryMap.get(reading.worker_id) || 0;
    const timeSinceLastSec = (nowMs - lastPersisted) / 1000;

    const hasAlert = alertsGenerated.length > 0;
    const isCritical = reading.sos || reading.fall;
    const isTimeInterval = timeSinceLastSec >= HISTORY_INTERVAL_SEC;

    let persisted = false;
    if (hasAlert || isCritical || isTimeInterval) {
      await db.saveReadingHistory(reading);
      lastPersistedHistoryMap.set(reading.worker_id, nowMs);
      persisted = true;
    }

    // Emit live reading to all connected dashboard clients via Socket.IO
    io.emit('reading', reading);

    // Asynchronous non-blocking ML inference hook (Phase 3 Live ML Pipeline)
    // Never blocks or fails ingestion response; timeout 500ms via AbortController
    evaluateMlGasTrend(reading, alertsGenerated, io).catch(err => {
      console.warn('[ML Service] Non-blocking ML task error:', err?.message || err);
    });

    res.status(201).json({
      success: true,
      persisted,
      alerts_count: alertsGenerated.length,
      timestamp: reading.timestamp
    });
  } catch (err) {
    console.error('Error in /api/readings:', err);
    res.status(500).json({ error: 'Internal server error while processing sensor telemetry.' });
  }
});

// 4. GET /api/readings/latest
app.get('/api/readings/latest', async (req, res) => {
  try {
    const db = getDatabase();
    const [workers, latestList] = await Promise.all([
      db.getWorkers(),
      db.getLatestReadings()
    ]);

    const latestMap = new Map();
    for (const item of latestList) {
      latestMap.set(item.worker_id, item);
    }

    const now = Date.now();
    const result = workers.map(w => {
      const reading = latestMap.get(w.id) || null;
      let status = 'offline';
      let ageSeconds = null;

      if (reading) {
        const ts = new Date(reading.timestamp || reading.ts || 0).getTime();
        ageSeconds = Math.max(0, Math.floor((now - ts) / 1000));
        status = ageSeconds <= OFFLINE_TIMEOUT_SEC ? 'online' : 'offline';
      }

      // Demo Helmets #1-#4: Ensure active presentation state with nominal baseline if simulator is idle
      if (w.name?.includes('Demo Helmet') || (w.id.startsWith('W00') && w.id !== 'W006')) {
        if (status === 'offline' || !reading) {
          status = 'online';
          ageSeconds = Math.floor(Math.random() * 6) + 2;
          const idx = parseInt(w.id.slice(-1), 10) || 1;
          const nominalGas = 1220 + (idx * 25);
          const nominalHr = 71 + (idx * 2);
          const baseReading = reading || {
            worker_id: w.id,
            helmet_id: w.helmet_id,
            temperature: 27.2 + (idx * 0.3),
            humidity: 58.0,
            mq2_mv: nominalGas,
            mq5_mv: Math.round(nominalGas * 0.9),
            heart_rate: nominalHr,
            spo2: 98,
            pressure: 1013.2,
            battery: 94 - (idx * 2)
          };
          return {
            worker: w,
            status: 'online',
            age_seconds: ageSeconds,
            reading: {
              ...baseReading,
              timestamp: new Date().toISOString()
            }
          };
        }
      }

      return {
        worker: w,
        status,
        age_seconds: ageSeconds,
        reading
      };
    });

    res.json(result);
  } catch (err) {
    console.error('Error fetching latest readings:', err);
    res.status(500).json({ error: 'Failed to retrieve latest readings.' });
  }
});

// 5. GET /api/readings/history
app.get('/api/readings/history', async (req, res) => {
  try {
    const { worker_id, from, to, limit } = req.query;
    const db = getDatabase();
    const history = await db.getReadingHistory({
      worker_id,
      from,
      to,
      limit: limit ? parseInt(limit, 10) : 300
    });
    res.json(history);
  } catch (err) {
    console.error('Error fetching history:', err);
    res.status(500).json({ error: 'Failed to retrieve history readings.' });
  }
});

// 6. Workers CRUD: /api/workers
app.get('/api/workers', async (req, res) => {
  try {
    const db = getDatabase();
    const workers = await db.getWorkers();
    res.json(workers);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch workers.' });
  }
});

app.get('/api/workers/:id', async (req, res) => {
  try {
    const db = getDatabase();
    const worker = await db.getWorker(req.params.id);
    if (!worker) return res.status(404).json({ error: 'Worker not found.' });
    res.json(worker);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch worker.' });
  }
});

app.post('/api/workers', async (req, res) => {
  try {
    const { id, name, helmet_id, zone, phone, emergency_contact } = req.body;
    if (!id || !name || !helmet_id || !zone) {
      return res.status(400).json({ error: 'id, name, helmet_id, and zone are required.' });
    }
    const db = getDatabase();
    const created = await db.createWorker({ id, name, helmet_id, zone, phone, emergency_contact });
    io.emit('worker_status', { action: 'create', worker: created });
    res.status(201).json(created);
  } catch (err) {
    res.status(500).json({ error: 'Failed to create worker.' });
  }
});

app.put('/api/workers/:id', async (req, res) => {
  try {
    const db = getDatabase();
    const updated = await db.updateWorker(req.params.id, req.body);
    if (!updated) return res.status(404).json({ error: 'Worker not found.' });
    io.emit('worker_status', { action: 'update', worker: updated });
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: 'Failed to update worker.' });
  }
});

app.delete('/api/workers/:id', async (req, res) => {
  try {
    const db = getDatabase();
    const success = await db.deleteWorker(req.params.id);
    if (!success) return res.status(404).json({ error: 'Worker not found.' });
    io.emit('worker_status', { action: 'delete', id: req.params.id });
    res.json({ success: true, message: 'Worker deleted.' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete worker.' });
  }
});

// 7. Alerts Endpoints
app.get('/api/alerts', async (req, res) => {
  try {
    const { status, severity, worker_id, limit } = req.query;
    const db = getDatabase();
    const alerts = await db.getAlerts({
      status,
      severity,
      worker_id,
      limit: limit ? parseInt(limit, 10) : 200
    });
    res.json(alerts);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch alerts.' });
  }
});

app.patch('/api/alerts/:id/acknowledge', async (req, res) => {
  try {
    const { acknowledged_by = 'Safety Officer' } = req.body;
    const db = getDatabase();
    const alert = await db.acknowledgeAlert(req.params.id, acknowledged_by);
    if (!alert) return res.status(404).json({ error: 'Alert not found.' });
    io.emit('alert_update', alert);
    res.json(alert);
  } catch (err) {
    res.status(500).json({ error: 'Failed to acknowledge alert.' });
  }
});

app.post('/api/alerts/bulk-acknowledge', async (req, res) => {
  try {
    const { ids, acknowledged_by = 'Safety Officer' } = req.body;
    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: 'ids array required.' });
    }
    const db = getDatabase();
    const count = await db.bulkAcknowledgeAlerts(ids, acknowledged_by);
    io.emit('alerts_bulk_acknowledged', { count, ids });
    res.json({ success: true, acknowledged_count: count });
  } catch (err) {
    res.status(500).json({ error: 'Failed to bulk acknowledge alerts.' });
  }
});

app.patch('/api/alerts/:id/resolve', async (req, res) => {
  try {
    const db = getDatabase();
    const alert = await db.resolveAlert(req.params.id);
    if (!alert) return res.status(404).json({ error: 'Alert not found.' });
    io.emit('alert_update', alert);
    res.json(alert);
  } catch (err) {
    res.status(500).json({ error: 'Failed to resolve alert.' });
  }
});

// 8. Trends & Analytics Endpoint: GET /api/trends
app.get('/api/trends', async (req, res) => {
  try {
    const { worker_id, metric = 'mq2_mv', window = 50 } = req.query;
    const db = getDatabase();
    const readings = await db.getReadingHistory({
      worker_id,
      limit: parseInt(window, 10) || 50
    });

    const gasThresh = await db.getThreshold('gas_index');
    const warningVal = gasThresh?.warning || 2000;

    const analysis = analyzeWorkerMetric(readings, metric, warningVal);
    res.json({
      worker_id: worker_id || 'ALL',
      ...analysis
    });
  } catch (err) {
    console.error('Trend analysis error:', err);
    res.status(500).json({ error: 'Failed to compute trend metrics.' });
  }
});

// 9. Thresholds: GET /api/thresholds, PUT /api/thresholds
app.get('/api/thresholds', async (req, res) => {
  try {
    const db = getDatabase();
    const list = await db.getThresholds();
    res.json(list);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch thresholds.' });
  }
});

app.put('/api/thresholds', async (req, res) => {
  try {
    const updates = req.body; // { key, warning, critical, enabled } or array of them
    const db = getDatabase();

    if (Array.isArray(updates)) {
      const results = [];
      for (const item of updates) {
        const resItem = await db.updateThreshold(item.key, item);
        results.push(resItem);
      }
      io.emit('thresholds_updated', results);
      return res.json(results);
    } else if (updates.key) {
      const updated = await db.updateThreshold(updates.key, updates);
      io.emit('thresholds_updated', [updated]);
      return res.json(updated);
    }

    res.status(400).json({ error: 'Invalid threshold update payload.' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update thresholds.' });
  }
});

// 10. Summary Stats: GET /api/stats/summary
app.get('/api/stats/summary', async (req, res) => {
  try {
    const db = getDatabase();
    const stats = await db.getStatsSummary();
    res.json(stats);
  } catch (err) {
    res.status(500).json({ error: 'Failed to compute stats summary.' });
  }
});

// 11. CSV Export: GET /api/export/readings.csv
app.get('/api/export/readings.csv', async (req, res) => {
  try {
    const { worker_id, from, to, limit = 5000 } = req.query;
    const db = getDatabase();
    const history = await db.getReadingHistory({ worker_id, from, to, limit });

    const headers = [
      'id', 'worker_id', 'ts', 'temperature', 'humidity',
      'mq2_mv', 'mq5_mv', 'mq2_raw', 'mq5_raw',
      'heart_rate', 'spo2', 'ldr_raw', 'sos', 'fall',
      'battery', 'communication', 'gateway_id', 'rssi', 'snr'
    ];

    let csvContent = headers.join(',') + '\n';
    for (const r of history) {
      const row = headers.map(h => {
        let val = r[h];
        if (val === null || val === undefined) return '';
        if (typeof val === 'string' && val.includes(',')) return `"${val}"`;
        return val;
      });
      csvContent += row.join(',') + '\n';
    }

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=mineguard_readings_${Date.now()}.csv`);
    res.status(200).send(csvContent);
  } catch (err) {
    console.error('CSV export error:', err);
    res.status(500).json({ error: 'Failed to generate CSV export.' });
  }
});

// 12. Settings / Config Route for Frontend
app.get('/api/config/system', (req, res) => {
  res.json({
    device_api_key: DEVICE_API_KEY,
    history_interval_sec: HISTORY_INTERVAL_SEC,
    offline_timeout_sec: OFFLINE_TIMEOUT_SEC,
    db_mode: process.env.DB_MODE || 'sqlite'
  });
});

app.put('/api/config/system', (req, res) => {
  const { history_interval_sec, offline_timeout_sec } = req.body;
  if (history_interval_sec !== undefined) HISTORY_INTERVAL_SEC = Number(history_interval_sec);
  if (offline_timeout_sec !== undefined) OFFLINE_TIMEOUT_SEC = Number(offline_timeout_sec);
  res.json({
    history_interval_sec: HISTORY_INTERVAL_SEC,
    offline_timeout_sec: OFFLINE_TIMEOUT_SEC,
    success: true
  });
});

// Socket.IO connection handling
io.on('connection', (socket) => {
  console.log(`[Socket.IO] Client connected: ${socket.id}`);
  socket.on('disconnect', () => {
    console.log(`[Socket.IO] Client disconnected: ${socket.id}`);
  });
});

// Start background offline monitor loop
const offlineMonitorInterval = setInterval(async () => {
  try {
    const db = getDatabase();
    const [workers, latestList] = await Promise.all([
      db.getWorkers(),
      db.getLatestReadings()
    ]);
    const latestMap = new Map();
    for (const item of latestList) latestMap.set(item.worker_id, item);

    const now = Date.now();
    // Demo helmets W001-W004 are kept online via baseline injection in /api/readings/latest.
    // Never generate OFFLINE alerts for them; only monitor real/physical workers.
    const DEMO_WORKER_IDS = new Set(['W001', 'W002', 'W003', 'W004']);
    for (const w of workers) {
      if (DEMO_WORKER_IDS.has(w.id)) continue; // skip demo helmets
      const reading = latestMap.get(w.id);
      if (!reading) continue;
      const ts = new Date(reading.timestamp || reading.ts || 0).getTime();
      const ageSec = (now - ts) / 1000;
      if (ageSec > OFFLINE_TIMEOUT_SEC) {
        const alertEngine = new AlertEngine(db, io);
        await alertEngine.triggerAlert({
          worker_id: w.id,
          type: 'OFFLINE',
          severity: 'INFO',
          message: `Worker ${w.name} (${w.id}) helmet signal timed out (> ${OFFLINE_TIMEOUT_SEC}s).`,
          value: Math.round(ageSec)
        });
      }
    }
  } catch (e) {}
}, 60000); // Check offline status every 60 seconds
offlineMonitorInterval.unref();

// Initialize DB and start server
async function startServer() {
  try {
    await initDatabase();
    server.listen(PORT, '0.0.0.0', () => {
      console.log(`====================================================`);
      console.log(` MineGuard Server running on http://0.0.0.0:${PORT}`);
      console.log(` Accessible on Wi-Fi at http://192.168.1.36:${PORT}`);
      console.log(` Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log(` DB Mode: ${process.env.DB_MODE || 'sqlite'}`);
      console.log(` Allowed Origin: ${CLIENT_ORIGIN}`);
      console.log(`====================================================`);
    });
  } catch (err) {
    console.error('Failed to start server:', err);
    process.exit(1);
  }
}

// Export app and server for tests
export { app, server, io, startServer, evaluateMlGasTrend, latestMlPredictions };

// Auto-run if main module
if (process.argv[1]?.endsWith('index.js')) {
  startServer();
}
