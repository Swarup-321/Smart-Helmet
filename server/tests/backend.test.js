import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateMovingAverage,
  calculateLinearRegression,
  detectZScoreAnomalies,
  predictTimeToThreshold
} from '../src/services/trendService.js';
import { AlertEngine } from '../src/services/alertEngine.js';

test('Trend Analysis - Moving Average', () => {
  const data = [10, 20, 30, 40, 50];
  const ma = calculateMovingAverage(data, 3);
  assert.equal(ma.length, 5);
  // for [10, 20, 30] -> avg is 20
  assert.equal(ma[2], 20);
  // for [20, 30, 40] -> avg is 30
  assert.equal(ma[3], 30);
});

test('Trend Analysis - Linear Regression', () => {
  const points = [
    { x: 1, y: 100 },
    { x: 2, y: 150 },
    { x: 3, y: 200 },
    { x: 4, y: 250 }
  ];
  const { slope, direction, r } = calculateLinearRegression(points);
  assert.equal(slope, 50);
  assert.equal(direction, 'rising');
  assert.equal(r, 1);
});

test('Trend Analysis - Anomaly Detection', () => {
  const normalReadings = [
    { mq2_mv: 1000 },
    { mq2_mv: 1010 },
    { mq2_mv: 990 },
    { mq2_mv: 1005 },
    { mq2_mv: 995 },
    { mq2_mv: 1000 },
    { mq2_mv: 2500 } // Extreme spike!
  ];
  const anomalies = detectZScoreAnomalies(normalReadings, 'mq2_mv', 2.0);
  assert.equal(anomalies.length, 1);
  assert.equal(anomalies[0].value, 2500);
  assert.equal(anomalies[0].type, 'SPIKE_HIGH');
});

test('Trend Analysis - Time To Threshold Prediction', () => {
  const now = Date.now();
  const readings = [
    { ts: new Date(now - 120000).toISOString(), mq2_mv: 1500 },
    { ts: new Date(now - 60000).toISOString(), mq2_mv: 1600 },
    { ts: new Date(now).toISOString(), mq2_mv: 1700 }
  ];
  // Rising 100 mV per minute, target 2000 -> remaining 300 mV -> ~3 mins
  const pred = predictTimeToThreshold(readings, 'mq2_mv', 2000);
  assert.equal(pred.willBreach, true);
  assert.ok(pred.predictedMinutes >= 2.5 && pred.predictedMinutes <= 3.5);
});

test('Alert Engine - Triggers SOS, Fall, and Gas Alerts', async () => {
  const mockAlerts = [];
  const mockDb = {
    getThresholds: async () => [
      { key: 'gas_index', warning: 2000, critical: 2500, enabled: true },
      { key: 'heart_rate_high', warning: 110, critical: 120, enabled: true }
    ],
    getRecentUnresolvedAlert: async () => null,
    createAlert: async (alert) => {
      mockAlerts.push(alert);
      return { id: 'TEST-1', ...alert };
    },
    resolveAlertsByType: async () => {}
  };

  const alertEngine = new AlertEngine(mockDb, null);

  // Test Critical Gas & SOS
  const alerts = await alertEngine.evaluate({
    worker_id: 'W001',
    sos: true,
    fall: false,
    mq2_mv: 2700,
    heart_rate: 80
  });

  assert.equal(alerts.length, 2);
  const types = alerts.map(a => a.type);
  assert.ok(types.includes('SOS'));
  assert.ok(types.includes('GAS'));
});
