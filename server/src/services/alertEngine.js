import { predictTimeToThreshold, calculateLinearRegression } from './trendService.js';

/**
 * Alert Engine
 * Evaluates live sensor readings against configurable thresholds, SOS, falls, and rapid gas trends.
 * Supports cooldown to prevent alert storms and auto-resolves when parameters return to normal.
 */
export class AlertEngine {
  constructor(db, io) {
    this.db = db;
    this.io = io;
    this.cooldownSec = 300; // 5-min cooldown per worker per alert type to prevent alert storms
  }

  async evaluate(reading, recentReadings = []) {
    const alertsGenerated = [];
    const thresholds = await this.loadThresholdMap();
    const workerId = reading.worker_id;

    // 1. SOS Button Check
    if (reading.sos) {
      const alert = await this.triggerAlert({
        worker_id: workerId,
        type: 'SOS',
        severity: 'CRITICAL',
        message: `EMERGENCY SOS button triggered by Worker ${workerId}!`,
        value: 1
      });
      if (alert) alertsGenerated.push(alert);
    }

    // 2. Fall / Impact Check
    if (reading.fall) {
      const alert = await this.triggerAlert({
        worker_id: workerId,
        type: 'FALL',
        severity: 'CRITICAL',
        message: `Man Down / Sudden Fall impact detected on Helmet for Worker ${workerId}!`,
        value: 1
      });
      if (alert) alertsGenerated.push(alert);
    }

    // 3. Gas Level Checks (MQ-2 & MQ-5 mV)
    const gasThreshold = thresholds['gas_index'];
    if (gasThreshold && gasThreshold.enabled) {
      const maxGasMv = Math.max(reading.mq2_mv || 0, reading.mq5_mv || 0);
      if (maxGasMv > 0) {
        if (maxGasMv >= gasThreshold.critical) {
          const alert = await this.triggerAlert({
            worker_id: workerId,
            type: 'GAS',
            severity: 'CRITICAL',
            message: `CRITICAL Toxic/Combustible Gas Level (${maxGasMv} mV) exceeds critical limit (${gasThreshold.critical} mV)!`,
            value: maxGasMv
          });
          if (alert) alertsGenerated.push(alert);
        } else if (maxGasMv >= gasThreshold.warning) {
          const alert = await this.triggerAlert({
            worker_id: workerId,
            type: 'GAS',
            severity: 'WARNING',
            message: `Elevated Gas Level (${maxGasMv} mV) exceeds warning threshold (${gasThreshold.warning} mV).`,
            value: maxGasMv
          });
          if (alert) alertsGenerated.push(alert);
        } else {
          // Normal gas level -> auto resolve any active gas alerts if clear
          if (this.db.resolveAlertsByType) {
            await this.db.resolveAlertsByType(workerId, 'GAS');
          }
        }
      }
    }

    // 4. Heart Rate Check
    const hrLow = thresholds['heart_rate_low'];
    const hrHigh = thresholds['heart_rate_high'];
    if (typeof reading.heart_rate === 'number') {
      const hr = reading.heart_rate;
      if (hrLow && hrLow.enabled && hr <= hrLow.critical) {
        const alert = await this.triggerAlert({
          worker_id: workerId,
          type: 'HEALTH',
          severity: 'CRITICAL',
          message: `Severe Bradycardia: Heart rate critically low (${hr} BPM)!`,
          value: hr
        });
        if (alert) alertsGenerated.push(alert);
      } else if (hrHigh && hrHigh.enabled && hr >= hrHigh.critical) {
        const alert = await this.triggerAlert({
          worker_id: workerId,
          type: 'HEALTH',
          severity: 'CRITICAL',
          message: `Severe Tachycardia: Heart rate critically high (${hr} BPM)!`,
          value: hr
        });
        if (alert) alertsGenerated.push(alert);
      } else if (hrHigh && hrHigh.enabled && hr >= hrHigh.warning) {
        const alert = await this.triggerAlert({
          worker_id: workerId,
          type: 'HEALTH',
          severity: 'WARNING',
          message: `Elevated Heart Rate (${hr} BPM) above normal work threshold.`,
          value: hr
        });
        if (alert) alertsGenerated.push(alert);
      }
    }

    // 5. SpO2 Oxygen Saturation Check
    const spo2Thresh = thresholds['spo2'];
    if (spo2Thresh && spo2Thresh.enabled && typeof reading.spo2 === 'number') {
      const spo2 = reading.spo2;
      if (spo2 <= spo2Thresh.critical) {
        const alert = await this.triggerAlert({
          worker_id: workerId,
          type: 'HEALTH',
          severity: 'CRITICAL',
          message: `Hypoxia Warning: SpO2 oxygen saturation dangerously low (${spo2}%)!`,
          value: spo2
        });
        if (alert) alertsGenerated.push(alert);
      } else if (spo2 <= spo2Thresh.warning) {
        const alert = await this.triggerAlert({
          worker_id: workerId,
          type: 'HEALTH',
          severity: 'WARNING',
          message: `Sub-optimal blood oxygen level (${spo2}%).`,
          value: spo2
        });
        if (alert) alertsGenerated.push(alert);
      }
    }

    // 6. Ambient Temperature Check
    const tempThresh = thresholds['temperature'];
    if (tempThresh && tempThresh.enabled && typeof reading.temperature === 'number') {
      const temp = reading.temperature;
      if (temp >= tempThresh.critical) {
        const alert = await this.triggerAlert({
          worker_id: workerId,
          type: 'HEALTH',
          severity: 'CRITICAL',
          message: `Extreme heat condition: Ambient temperature ${temp}°C in mine shaft!`,
          value: temp
        });
        if (alert) alertsGenerated.push(alert);
      } else if (temp >= tempThresh.warning) {
        const alert = await this.triggerAlert({
          worker_id: workerId,
          type: 'HEALTH',
          severity: 'WARNING',
          message: `High ambient temperature (${temp}°C) in current zone.`,
          value: temp
        });
        if (alert) alertsGenerated.push(alert);
      }
    }

    // 7. Battery Level Check
    const battThresh = thresholds['battery'];
    if (battThresh && battThresh.enabled && typeof reading.battery === 'number') {
      const batt = reading.battery;
      if (batt <= battThresh.critical) {
        const alert = await this.triggerAlert({
          worker_id: workerId,
          type: 'BATTERY',
          severity: 'WARNING',
          message: `Helmet battery critically low (${batt}%). Recharge required soon.`,
          value: batt
        });
        if (alert) alertsGenerated.push(alert);
      }
    }

    // 8. Ground / Structural Vibration Alert (HW-072)
    if (reading.vibration_level === 'CRITICAL') {
      const alert = await this.triggerAlert({
        worker_id: workerId,
        type: 'VIBRATION',
        severity: 'CRITICAL',
        message: `CRITICAL VIBRATION: Severe ground/structural vibration spike (${reading.vibration_events || 0} events/10s) detected! Immediate zone inspection required.`,
        value: reading.vibration_events || 0
      });
      if (alert) alertsGenerated.push(alert);
    } else if (reading.vibration_level === 'HIGH') {
      const alert = await this.triggerAlert({
        worker_id: workerId,
        type: 'VIBRATION',
        severity: 'WARNING',
        message: `ELEVATED VIBRATION: Structural/Ground vibration elevated (${reading.vibration_events || 0} events/10s) in ${workerId} zone.`,
        value: reading.vibration_events || 0
      });
      if (alert) alertsGenerated.push(alert);
    }

    // 9. Predictive Gas Trend Alert
    if (recentReadings && recentReadings.length >= 5) {
      const gasWarning = gasThreshold?.warning || 2000;
      const prediction = predictTimeToThreshold(recentReadings, 'mq2_mv', gasWarning);
      if (prediction.willBreach && prediction.predictedMinutes !== null && prediction.predictedMinutes <= 10) {
        const alert = await this.triggerAlert({
          worker_id: workerId,
          type: 'TREND',
          severity: 'WARNING',
          message: `PREDICTIVE TREND: Gas index rising rapidly (+${prediction.slopePerMin} mV/min). Estimated breach in ~${prediction.predictedMinutes} minutes!`,
          value: prediction.slopePerMin
        });
        if (alert) alertsGenerated.push(alert);
      }
    }

    return alertsGenerated;
  }

  async triggerAlert(alertData) {
    // SOS and FALL: 60s short cooldown so each new incident is recorded, but not every button press tick
    const cooldown = (alertData.type === 'SOS' || alertData.type === 'FALL') ? 60 : this.cooldownSec;
    const existing = await this.db.getRecentUnresolvedAlert(
      alertData.worker_id,
      alertData.type,
      cooldown
    );

    // If there's an active alert within cooldown window and same severity, skip duplicate
    if (existing && existing.severity === alertData.severity) {
      return null;
    }

    const created = await this.db.createAlert(alertData);
    if (this.io) {
      this.io.emit('alert', created);
    }
    return created;
  }

  async loadThresholdMap() {
    const list = await this.db.getThresholds();
    const map = {};
    for (const item of list) {
      map[item.key] = item;
    }
    return map;
  }
}
