import admin from 'firebase-admin';

export class FirebaseAdapter {
  constructor(serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT) {
    this.serviceAccountJson = serviceAccountJson;
    this.db = null;
  }

  async init() {
    if (!admin.apps.length) {
      let credential;
      if (this.serviceAccountJson) {
        try {
          const credObj = typeof this.serviceAccountJson === 'string' 
            ? JSON.parse(this.serviceAccountJson) 
            : this.serviceAccountJson;
          credential = admin.credential.cert(credObj);
        } catch (err) {
          console.error('[FirebaseAdapter] Failed to parse service account JSON:', err.message);
          throw err;
        }
      } else {
        credential = admin.credential.applicationDefault();
      }

      admin.initializeApp({ credential });
    }

    this.db = admin.firestore();
    console.log('[FirebaseAdapter] Connected to Google Cloud Firestore');
    await this.seedDefaults();
  }

  async seedDefaults() {
    // Seed thresholds if empty
    const threshSnap = await this.db.collection('thresholds').limit(1).get();
    if (threshSnap.empty) {
      const defaultThresholds = [
        { key: 'gas_index', warning: 2000, critical: 2500, enabled: true },
        { key: 'heart_rate_low', warning: 55, critical: 50, enabled: true },
        { key: 'heart_rate_high', warning: 110, critical: 120, enabled: true },
        { key: 'spo2', warning: 94, critical: 90, enabled: true },
        { key: 'temperature', warning: 35, critical: 40, enabled: true },
        { key: 'humidity', warning: 80, critical: 85, enabled: true },
        { key: 'battery', warning: 25, critical: 20, enabled: true },
        { key: 'offline_timeout', warning: 30, critical: 60, enabled: true }
      ];
      const batch = this.db.batch();
      for (const t of defaultThresholds) {
        batch.set(this.db.collection('thresholds').doc(t.key), t);
      }
      await batch.commit();
    }
  }

  // --- Workers ---
  async getWorkers() {
    const snap = await this.db.collection('workers').orderBy('id').get();
    return snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  }

  async getWorker(id) {
    const doc = await this.db.collection('workers').doc(id).get();
    return doc.exists ? { id: doc.id, ...doc.data() } : null;
  }

  async createWorker(worker) {
    await this.db.collection('workers').doc(worker.id).set(worker);
    return worker;
  }

  async updateWorker(id, updates) {
    const ref = this.db.collection('workers').doc(id);
    await ref.update(updates);
    const doc = await ref.get();
    return { id: doc.id, ...doc.data() };
  }

  async deleteWorker(id) {
    await this.db.collection('workers').doc(id).delete();
    return true;
  }

  // --- Latest Readings ---
  async getLatestReadings() {
    const snap = await this.db.collection('workers_latest').get();
    return snap.docs.map(doc => doc.data());
  }

  async getLatestReading(worker_id) {
    const doc = await this.db.collection('workers_latest').doc(worker_id).get();
    return doc.exists ? doc.data() : null;
  }

  async saveLatestReading(worker_id, reading) {
    await this.db.collection('workers_latest').doc(worker_id).set(reading, { merge: true });
  }

  // --- Reading History ---
  async saveReadingHistory(reading) {
    const docRef = await this.db.collection('readings').add(reading);
    return { id: docRef.id, ...reading };
  }

  async saveReadingHistoryBatch(readings) {
    const batch = this.db.batch();
    for (const r of readings) {
      const ref = this.db.collection('readings').doc();
      batch.set(ref, r);
    }
    await batch.commit();
  }

  async getReadingHistory({ worker_id, from, to, limit = 500 } = {}) {
    let query = this.db.collection('readings');
    if (worker_id) query = query.where('worker_id', '==', worker_id);
    if (from) query = query.where('ts', '>=', from);
    if (to) query = query.where('ts', '<=', to);
    
    query = query.orderBy('ts', 'desc').limit(Number(limit) || 500);
    const snap = await query.get();
    return snap.docs.map(doc => ({ id: doc.id, ...doc.data() })).reverse();
  }

  // --- Alerts ---
  async createAlert(alert) {
    const id = alert.id || `ALT-${Date.now()}-${Math.random().toString(36).substr(2, 4).toUpperCase()}`;
    const payload = { ...alert, id, acknowledged: alert.acknowledged || false };
    await this.db.collection('alerts').doc(id).set(payload);
    return payload;
  }

  async getAlerts({ status, severity, worker_id, limit = 200 } = {}) {
    let query = this.db.collection('alerts').orderBy('ts', 'desc');
    if (severity) query = query.where('severity', '==', severity.toUpperCase());
    if (worker_id) query = query.where('worker_id', '==', worker_id);

    const snap = await query.limit(Number(limit) || 200).get();
    let results = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    if (status === 'active') {
      results = results.filter(a => !a.resolved_at && !a.acknowledged);
    } else if (status === 'acknowledged') {
      results = results.filter(a => a.acknowledged && !a.resolved_at);
    } else if (status === 'resolved') {
      results = results.filter(a => !!a.resolved_at);
    } else if (status === 'unresolved') {
      results = results.filter(a => !a.resolved_at);
    }

    return results;
  }

  async getAlert(id) {
    const doc = await this.db.collection('alerts').doc(id).get();
    return doc.exists ? { id: doc.id, ...doc.data() } : null;
  }

  async acknowledgeAlert(id, acknowledgedBy = 'Safety Officer') {
    const now = new Date().toISOString();
    await this.db.collection('alerts').doc(id).update({
      acknowledged: true,
      acknowledged_by: acknowledgedBy,
      acknowledged_at: now
    });
    return this.getAlert(id);
  }

  async bulkAcknowledgeAlerts(ids, acknowledgedBy = 'Safety Officer') {
    if (!ids || ids.length === 0) return 0;
    const now = new Date().toISOString();
    const batch = this.db.batch();
    for (const id of ids) {
      batch.update(this.db.collection('alerts').doc(id), {
        acknowledged: true,
        acknowledged_by: acknowledgedBy,
        acknowledged_at: now
      });
    }
    await batch.commit();
    return ids.length;
  }

  async resolveAlert(id) {
    const now = new Date().toISOString();
    await this.db.collection('alerts').doc(id).update({ resolved_at: now });
    return this.getAlert(id);
  }

  async resolveAlertsByType(worker_id, type) {
    const now = new Date().toISOString();
    const snap = await this.db.collection('alerts')
      .where('worker_id', '==', worker_id)
      .where('type', '==', type)
      .where('resolved_at', '==', null)
      .get();

    const batch = this.db.batch();
    snap.docs.forEach(d => batch.update(d.ref, { resolved_at: now }));
    await batch.commit();
  }

  async getRecentUnresolvedAlert(worker_id, type, cooldownSec = 60) {
    const cutoff = new Date(Date.now() - cooldownSec * 1000).toISOString();
    const snap = await this.db.collection('alerts')
      .where('worker_id', '==', worker_id)
      .where('type', '==', type)
      .where('ts', '>=', cutoff)
      .orderBy('ts', 'desc')
      .limit(1)
      .get();

    if (snap.empty) return null;
    return { id: snap.docs[0].id, ...snap.docs[0].data() };
  }

  // --- Thresholds ---
  async getThresholds() {
    const snap = await this.db.collection('thresholds').get();
    return snap.docs.map(doc => ({ key: doc.id, ...doc.data() }));
  }

  async getThreshold(key) {
    const doc = await this.db.collection('thresholds').doc(key).get();
    return doc.exists ? { key: doc.id, ...doc.data() } : null;
  }

  async updateThreshold(key, updates) {
    await this.db.collection('thresholds').doc(key).set(updates, { merge: true });
    return this.getThreshold(key);
  }

  // --- Users ---
  async getUserByEmail(email) {
    const snap = await this.db.collection('users').where('email', '==', email).limit(1).get();
    if (snap.empty) return null;
    return { id: snap.docs[0].id, ...snap.docs[0].data() };
  }

  async getUserById(id) {
    const doc = await this.db.collection('users').doc(id).get();
    return doc.exists ? { id: doc.id, ...doc.data() } : null;
  }

  async createUser(user) {
    await this.db.collection('users').doc(user.id).set(user);
    return user;
  }

  // --- Stats Summary ---
  async getStatsSummary() {
    const workersSnap = await this.db.collection('workers').get();
    const latestSnap = await this.db.collection('workers_latest').get();
    const alertsSnap = await this.db.collection('alerts').where('resolved_at', '==', null).get();

    const totalWorkers = workersSnap.size;
    let criticalAlerts = 0;
    alertsSnap.forEach(d => {
      if (d.data().severity === 'CRITICAL') criticalAlerts++;
    });

    let heartRateSum = 0, heartRateCount = 0;
    let tempSum = 0, tempCount = 0;
    let maxGas = 0;
    let onlineCount = 0;
    const now = Date.now();

    latestSnap.forEach(d => {
      const data = d.data();
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
    });

    return {
      total_workers: totalWorkers,
      online_workers: onlineCount,
      offline_workers: totalWorkers - onlineCount,
      active_alerts: alertsSnap.size,
      critical_alerts: criticalAlerts,
      avg_heart_rate: heartRateCount > 0 ? Math.round(heartRateSum / heartRateCount) : null,
      avg_temperature: tempCount > 0 ? +(tempSum / tempCount).toFixed(1) : null,
      highest_gas_mv: maxGas || null,
      system_uptime_sec: Math.floor(process.uptime())
    };
  }
}
