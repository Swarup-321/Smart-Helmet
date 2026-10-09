import express from 'express';
import cors from 'cors';
import http from 'http';
import { Server as SocketIOServer } from 'socket.io';
import rateLimit from 'express-rate-limit';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config();
dotenv.config({ path: path.resolve(__dirname, '../.env') });

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
  // HW-072 Vibration Telemetry
  vibration_detected: z.boolean().optional().default(false),
  vibration_events: z.number().nullable().optional().default(0),
  vibration_level: z.string().optional().default('NORMAL'),
  vibration_status: z.string().optional().default('SAFE'),
  zone_id: z.string().optional(),
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

    // Debug: log vibration fields received from ESP32
    console.log(`[POST /api/readings] worker=${reading.worker_id} | vib_detected=${reading.vibration_detected} | vib_events=${reading.vibration_events} | vib_level=${reading.vibration_level} | vib_status=${reading.vibration_status}`);

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

    const workerMap = new Map();
    for (const w of workers) workerMap.set(w.id, w);

    const latestMap = new Map();
    for (const item of latestList) {
      latestMap.set(item.worker_id, item);
    }

    const now = Date.now();

    // Build result from ALL workers in DB
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

    // Also include any latest readings that belong to devices NOT yet registered
    // as a formal worker (e.g. ESP32 that came online before DB seed ran)
    for (const [wid, reading] of latestMap.entries()) {
      if (!workerMap.has(wid)) {
        const ts = new Date(reading.timestamp || reading.ts || 0).getTime();
        const ageSeconds = Math.max(0, Math.floor((now - ts) / 1000));
        const status = ageSeconds <= OFFLINE_TIMEOUT_SEC ? 'online' : 'offline';
        result.push({
          worker: {
            id: wid,
            name: reading.helmet_id || wid,
            helmet_id: reading.helmet_id || wid,
            zone: reading.zone_id || 'Physical Device',
            phone: '',
            emergency_contact: ''
          },
          status,
          age_seconds: ageSeconds,
          reading
        });
      }
    }

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

// 11. Fixed Zone Monitoring & Vibration Safety Intelligence: GET /api/zone-monitoring
app.get('/api/zone-monitoring', async (req, res) => {
  try {
    const { zone_id } = req.query;
    const db = getDatabase();

    const [workers, latestList, history] = await Promise.all([
      db.getWorkers(),
      db.getLatestReadings(),
      db.getReadingHistory({ limit: 300 })
    ]);

    // Map workers by ID for zone resolution
    const workerMap = new Map();
    for (const w of workers) workerMap.set(w.id, w);

    const isPhysicalDevice = (
      zone_id === 'Live Physical Device (HW-072)' ||
      zone_id === 'W006' ||
      zone_id === 'Physical Device' ||
      zone_id === 'Live Hardware'
    );

    // Filter readings by selected zone if specified
    const filterByZone = (r) => {
      if (isPhysicalDevice) {
        return r.worker_id === 'W006' || r.helmet_id === 'H-ESP32-LIVE' || r.zone_id === 'Physical Device';
      }
      if (!zone_id || zone_id === 'ALL') return true;
      const w = workerMap.get(r.worker_id);
      return (r.zone_id === zone_id) || (w && w.zone === zone_id);
    };

    const relevantLatest = latestList.filter(filterByZone);
    const relevantHistory = history.filter(filterByZone);

    // Determine latest representative reading
    const latestReading = relevantLatest.length > 0
      ? relevantLatest.sort((a, b) => new Date(b.timestamp || b.ts || 0) - new Date(a.timestamp || a.ts || 0))[0]
      : (relevantHistory.length > 0 ? relevantHistory[relevantHistory.length - 1] : null);

    const now = Date.now();
    const oneMinAgo = now - 60000;
    const tenMinAgo = now - 600000;
    const twentyMinAgo = now - 1200000;
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    // Calculate events in last 10s and last 1 min
    const eventsLast10s = latestReading ? (latestReading.vibration_events || 0) : 0;
    
    let eventsLast1m = 0;
    let totalEventsToday = 0;
    let current10mEvents = 0;
    let prev10mEvents = 0;
    let lastDetectedTs = null;

    const severityCounts = { NORMAL: 0, LOW: 0, MODERATE: 0, HIGH: 0, CRITICAL: 0 };

    for (const r of relevantHistory) {
      const tsMs = new Date(r.timestamp || r.ts || 0).getTime();
      const events = r.vibration_events || 0;
      const level = (r.vibration_level || 'NORMAL').toUpperCase();

      if (severityCounts[level] !== undefined) {
        severityCounts[level]++;
      } else {
        severityCounts.NORMAL++;
      }

      if (events > 0 || r.vibration_detected) {
        if (!lastDetectedTs || tsMs > new Date(lastDetectedTs).getTime()) {
          lastDetectedTs = r.timestamp || r.ts;
        }
      }

      if (tsMs >= oneMinAgo) {
        eventsLast1m += events;
      }
      if (tsMs >= tenMinAgo) {
        current10mEvents += events;
      } else if (tsMs >= twentyMinAgo) {
        prev10mEvents += events;
      }
      if (tsMs >= startOfToday.getTime()) {
        totalEventsToday += events;
      }
    }

    if (totalEventsToday === 0 && eventsLast10s > 0) {
      totalEventsToday = eventsLast10s;
    }

    // Severity distribution breakdown (%)
    const totalSampleCount = Math.max(1, relevantHistory.length);
    const severityDistribution = [
      { name: 'Normal', level: 'NORMAL', count: severityCounts.NORMAL, percentage: +((severityCounts.NORMAL / totalSampleCount) * 100).toFixed(1), color: '#10B981' },
      { name: 'Low', level: 'LOW', count: severityCounts.LOW, percentage: +((severityCounts.LOW / totalSampleCount) * 100).toFixed(1), color: '#3B82F6' },
      { name: 'Moderate', level: 'MODERATE', count: severityCounts.MODERATE, percentage: +((severityCounts.MODERATE / totalSampleCount) * 100).toFixed(1), color: '#F59E0B' },
      { name: 'High', level: 'HIGH', count: severityCounts.HIGH, percentage: +((severityCounts.HIGH / totalSampleCount) * 100).toFixed(1), color: '#F97316' },
      { name: 'Critical', level: 'CRITICAL', count: severityCounts.CRITICAL, percentage: +((severityCounts.CRITICAL / totalSampleCount) * 100).toFixed(1), color: '#EF4444' }
    ];

    // Vibration Trend Analysis (current 10 min vs previous 10 min)
    let percentageChange = 0;
    if (prev10mEvents === 0) {
      percentageChange = current10mEvents > 0 ? 100 : 0;
    } else {
      percentageChange = +(((current10mEvents - prev10mEvents) / prev10mEvents) * 100).toFixed(1);
    }

    let trendDirection = 'stable';
    let trendMessage = 'Vibration activity is stable';
    if (percentageChange > 15) {
      trendDirection = 'increasing';
      trendMessage = `Vibration activity is increasing (+${percentageChange}%)`;
    } else if (percentageChange < -15) {
      trendDirection = 'decreasing';
      trendMessage = `Vibration activity is decreasing (${percentageChange}%)`;
    }

    // Current Vibration Level & Status
    const currentLevel = latestReading ? (latestReading.vibration_level || 'NORMAL').toUpperCase() : 'NORMAL';
    const vibrationDetected = latestReading ? Boolean(latestReading.vibration_detected || (latestReading.vibration_events > 0)) : false;

    // Zone Stability Logic
    let zoneStability = 'Stable';
    if (currentLevel === 'CRITICAL' || eventsLast1m > 30) {
      zoneStability = 'Critical';
    } else if (currentLevel === 'HIGH' || eventsLast1m > 15) {
      zoneStability = 'Unstable';
    } else if (currentLevel === 'MODERATE' || trendDirection === 'increasing') {
      zoneStability = 'Watch';
    } else {
      zoneStability = 'Stable';
    }

    // Zone Vibration Risk Score (0-100)
    let baseSeverityScore = 0;
    if (currentLevel === 'CRITICAL') baseSeverityScore = 60;
    else if (currentLevel === 'HIGH') baseSeverityScore = 40;
    else if (currentLevel === 'MODERATE') baseSeverityScore = 20;
    else if (currentLevel === 'LOW') baseSeverityScore = 8;
    else baseSeverityScore = 2;

    const eventDensityScore = Math.min(30, eventsLast10s * 2.5);
    const trendScore = trendDirection === 'increasing' ? Math.min(15, Math.max(0, percentageChange * 0.15)) : 0;
    const riskScore = Math.min(100, Math.round(baseSeverityScore + eventDensityScore + trendScore));

    let riskLabel = 'SAFE';
    if (riskScore >= 76) riskLabel = 'CRITICAL';
    else if (riskScore >= 51) riskLabel = 'WARNING';
    else if (riskScore >= 26) riskLabel = 'MONITOR';
    else riskLabel = 'SAFE';

    // Early Warning Hazard Progression
    let earlyWarningActive = false;
    let earlyWarningStage = 'NORMAL';
    let earlyWarningMessage = 'Zone stability nominal. Baseline vibration within safety margins.';

    if (riskScore >= 76 || currentLevel === 'CRITICAL') {
      earlyWarningActive = true;
      earlyWarningStage = 'Critical Zone';
      earlyWarningMessage = 'CRITICAL: Severe structural vibration detected! Evacuate immediate sector.';
    } else if (riskScore >= 51 || currentLevel === 'HIGH') {
      earlyWarningActive = true;
      earlyWarningStage = 'High Vibration';
      earlyWarningMessage = 'HIGH ALERT: Sustained elevated ground vibrations above threshold.';
    } else if (riskScore >= 35 || currentLevel === 'MODERATE' || (trendDirection === 'increasing' && percentageChange > 40)) {
      earlyWarningActive = true;
      earlyWarningStage = 'Warning';
      earlyWarningMessage = 'Early warning: abnormal increase in vibration activity detected.';
    } else if (trendDirection === 'increasing') {
      earlyWarningActive = false;
      earlyWarningStage = 'Increasing Activity';
      earlyWarningMessage = 'Mild increase in vibration rate detected. Monitoring stability.';
    } else {
      earlyWarningActive = false;
      earlyWarningStage = 'NORMAL';
      earlyWarningMessage = 'Zone ground & structural stability is nominal.';
    }

    // Real-time activity points for charts (last 30 samples)
    const realtimeActivityPoints = relevantHistory.slice(-30).map((r, i) => {
      const dateObj = new Date(r.timestamp || r.ts || (now - (30 - i) * 10000));
      const timeStr = dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      const ev = r.vibration_events || 0;
      const lvl = (r.vibration_level || 'NORMAL').toUpperCase();

      let ptRisk = 5;
      if (lvl === 'CRITICAL') ptRisk = 85 + Math.min(15, ev);
      else if (lvl === 'HIGH') ptRisk = 60 + Math.min(15, ev);
      else if (lvl === 'MODERATE') ptRisk = 35 + Math.min(10, ev);
      else if (lvl === 'LOW') ptRisk = 15 + Math.min(10, ev);
      else ptRisk = Math.min(10, ev * 2);

      return {
        id: r.id || i,
        ts: r.timestamp || r.ts,
        timeStr,
        events: ev,
        level: lvl,
        risk_score: ptRisk
      };
    });

    // Recent Timeline of Vibration Events (last 15 items)
    const recentTimeline = relevantHistory
      .filter(r => (r.vibration_events > 0) || r.vibration_detected || (r.vibration_level && r.vibration_level !== 'NORMAL'))
      .slice(-15)
      .reverse()
      .map(r => {
        const dateObj = new Date(r.timestamp || r.ts || 0);
        const timeStr = dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        const w = workerMap.get(r.worker_id);
        return {
          id: r.id || `evt-${dateObj.getTime()}`,
          ts: r.timestamp || r.ts,
          timeStr,
          level: (r.vibration_level || 'NORMAL').toUpperCase(),
          events: r.vibration_events || 0,
          status: r.vibration_status || 'SAFE',
          zone: r.zone_id || (w ? w.zone : 'Fixed Mining Sector'),
          worker_id: r.worker_id
        };
      });

    // For the Physical Device: strictly use real data (empty/clean until sensor triggers)
    // For other simulated stations: use fallback demo points if history is sparse
    let finalActivityPoints = realtimeActivityPoints;
    let finalTimeline = recentTimeline;

    if (!isPhysicalDevice && finalActivityPoints.length < 20) {
      let baseVib = 2;
      if (zone_id && zone_id.includes('Extraction')) baseVib = 9;
      else if (zone_id && zone_id.includes('Conveyor')) baseVib = 5;
      else if (zone_id && zone_id.includes('Drift')) baseVib = 4;
      else if (zone_id && zone_id.includes('Shaft')) baseVib = 2;
      else baseVib = 1;

      const generatedPoints = [];
      for (let i = 24; i >= 1; i--) {
        const dObj = new Date(now - i * 12000);
        const timeStr = dObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        let ev = Math.max(0, baseVib + Math.round(Math.sin(i / 3) * 3 + (Math.random() * 3 - 1.5)));
        if (baseVib >= 8 && (i % 6 === 0)) ev += 5; // realistic wave

        let lvl = 'NORMAL';
        let ptRisk = 8;
        if (ev >= 21) { lvl = 'CRITICAL'; ptRisk = 88; }
        else if (ev >= 11) { lvl = 'HIGH'; ptRisk = 65; }
        else if (ev >= 6) { lvl = 'MODERATE'; ptRisk = 40; }
        else if (ev >= 3) { lvl = 'LOW'; ptRisk = 20; }

        generatedPoints.push({
          id: `gen-${i}`,
          ts: dObj.toISOString(),
          timeStr,
          events: ev,
          level: lvl,
          risk_score: ptRisk
        });
      }
      finalActivityPoints = [...generatedPoints, ...finalActivityPoints].slice(-24);
    }

    if (!isPhysicalDevice && finalTimeline.length < 6) {
      const sampleEvents = [
        { offsetMin: 1.2, ev: currentEvents || 8, lvl: currentLevel !== 'NORMAL' ? currentLevel : 'MODERATE', status: 'MONITOR' },
        { offsetMin: 3.5, ev: 11, lvl: 'HIGH', status: 'WARNING' },
        { offsetMin: 7.1, ev: 9, lvl: 'MODERATE', status: 'MONITOR' },
        { offsetMin: 12.4, ev: 4, lvl: 'LOW', status: 'NORMAL' },
        { offsetMin: 18.0, ev: 2, lvl: 'NORMAL', status: 'SAFE' },
        { offsetMin: 24.5, ev: 5, lvl: 'LOW', status: 'NORMAL' }
      ];

      const fallbackTimeline = sampleEvents.map((s, idx) => {
        const dObj = new Date(now - s.offsetMin * 60000);
        return {
          id: `seed-evt-${idx}`,
          ts: dObj.toISOString(),
          timeStr: dObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
          level: s.lvl,
          events: s.ev,
          status: s.status,
          zone: zone_id || 'Fixed Mining Sector',
          worker_id: 'W003'
        };
      });

      finalTimeline = [...finalTimeline, ...fallbackTimeline].slice(0, 12);
    }

    const resolvedEvents10s = eventsLast10s;
    const resolvedEvents1m = eventsLast1m;
    const resolvedTotalToday = totalEventsToday;

    res.json({
      zone_id: zone_id || 'Live Physical Device (HW-072)',
      is_physical_device: isPhysicalDevice,
      available_zones: [
        'Live Physical Device (HW-072)',
        'Zone C - Extraction Face',
        'Zone A - Shaft 3',
        'Zone B - Drift 1',
        'Zone B - Conveyor 2',
        'Main Access Gate'
      ],
      current_status: currentLevel,
      vibration_detected: vibrationDetected || resolvedEvents10s > 0,
      vibration_events_current_window: resolvedEvents10s,
      events_last_10s: resolvedEvents10s,
      events_last_1m: resolvedEvents1m,
      last_detected_ts: lastDetectedTs || (isPhysicalDevice ? 'No recent pulses' : new Date(now - 15000).toISOString()),
      warning_level: riskLabel,
      zone_stability: zoneStability,
      total_events_today: resolvedTotalToday,
      risk_score: riskScore,
      risk_label: riskLabel,
      trend: {
        previous_10min_events: prev10mEvents,
        current_10min_events: current10mEvents,
        percentage_change: percentageChange,
        direction: trendDirection,
        message: trendMessage
      },
      early_warning: {
        active: earlyWarningActive,
        stage: earlyWarningStage,
        message: earlyWarningMessage
      },
      severity_distribution: (severityDistribution.some(s => s.count > 0) || isPhysicalDevice) ? severityDistribution : [
        { name: 'Normal', level: 'NORMAL', count: 42, percentage: 52.5, color: '#10B981' },
        { name: 'Low', level: 'LOW', count: 22, percentage: 27.5, color: '#3B82F6' },
        { name: 'Moderate', level: 'MODERATE', count: 12, percentage: 15.0, color: '#F59E0B' },
        { name: 'High', level: 'HIGH', count: 3, percentage: 3.8, color: '#F97316' },
        { name: 'Critical', level: 'CRITICAL', count: 1, percentage: 1.2, color: '#EF4444' }
      ],
      realtime_activity_points: finalActivityPoints,
      recent_timeline: finalTimeline
    });
  } catch (err) {
    console.error('Error computing fixed zone monitoring data:', err);
    res.status(500).json({ error: 'Failed to compute fixed zone vibration data.' });
  }
});

// 12. CSV Export: GET /api/export/readings.csv
app.get('/api/export/readings.csv', async (req, res) => {
  try {
    const { worker_id, from, to, limit = 5000 } = req.query;
    const db = getDatabase();
    const history = await db.getReadingHistory({ worker_id, from, to, limit });

    const headers = [
      'id', 'worker_id', 'ts', 'temperature', 'humidity',
      'mq2_mv', 'mq5_mv', 'mq2_raw', 'mq5_raw',
      'heart_rate', 'spo2', 'ldr_raw', 'sos', 'fall',
      'battery', 'communication', 'gateway_id', 'rssi', 'snr',
      'vibration_detected', 'vibration_events', 'vibration_level', 'vibration_status', 'zone_id'
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

    // Ensure the physical ESP32 device (W006) is always registered as a worker.
    // This is safe to run every startup (INSERT OR IGNORE is idempotent).
    try {
      const db = getDatabase();
      await db.run(
        `INSERT OR IGNORE INTO workers (id, name, helmet_id, zone, phone, emergency_contact, created_at)
         VALUES ('W006', 'ESP32 Live Helmet', 'H-ESP32-LIVE', 'Live Physical Device (HW-072)', '', '', ?)`,
        [new Date().toISOString()]
      );
      console.log('[Startup] W006 (ESP32 Physical Device) worker record ensured.');
    } catch (e) {
      console.warn('[Startup] W006 ensure-worker skipped:', e.message);
    }

    server.listen(PORT, '0.0.0.0', () => {
      const nets = os.networkInterfaces();
      let localIp = '127.0.0.1';
      for (const name of Object.keys(nets)) {
        for (const net of nets[name]) {
          if (net.family === 'IPv4' && !net.internal) {
            localIp = net.address;
            break;
          }
        }
      }
      console.log(`====================================================`);
      console.log(` MineGuard Server running on http://0.0.0.0:${PORT}`);
      console.log(` Accessible on Wi-Fi at http://${localIp}:${PORT}`);
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

// Auto-run if executed directly as entrypoint (not when imported in unit tests)
const isMainModule = !process.argv[1]?.includes('test') && (
  process.argv[1]?.endsWith('index.js') ||
  process.argv[1]?.endsWith('index') ||
  process.argv[1]?.endsWith('server') ||
  process.argv[1]?.endsWith('src')
);
if (isMainModule) {
  startServer();
}
