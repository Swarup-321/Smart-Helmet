import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'http';
import { app } from '../src/index.js';
import { initDatabase, getDatabase } from '../src/db/index.js';

test('End-to-End Ingestion: Pressure survives ingestion -> SQLite -> history query', async (t) => {
  // Ensure DB initialized
  await initDatabase();
  const db = getDatabase();

  const server = http.createServer(app);
  await new Promise(resolve => server.listen(0, resolve));
  const port = server.address().port;
  const baseUrl = `http://127.0.0.1:${port}`;

  t.after(async () => {
    await new Promise(resolve => server.close(resolve));
  });

  const workerId = 'W001';
  const testPressure = 1014.75;
  const timestamp = new Date().toISOString();

  // 1. Post sensor reading with pressure (and critical flag to guarantee persistence)
  const postRes = await fetch(`${baseUrl}/api/readings`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': 'mineguard_device_secret_key_2026'
    },
    body: JSON.stringify({
      worker_id: workerId,
      timestamp,
      temperature: 27.8,
      humidity: 55.4,
      pressure: testPressure,
      mq2_mv: 1020.0,
      mq5_mv: 780.0,
      heart_rate: 76,
      spo2: 98,
      sos: true, // triggers immediate persistence via write-budget rule
      fall: false
    })
  });

  assert.equal(postRes.status, 201, 'POST /api/readings should return 201 Created');
  const postBody = await postRes.json();
  assert.equal(postBody.success, true);
  assert.equal(postBody.persisted, true, 'Reading should be persisted immediately');

  // 2. Query history via GET /api/readings/history
  const historyRes = await fetch(`${baseUrl}/api/readings/history?worker_id=${workerId}&limit=10`);
  assert.equal(historyRes.status, 200, 'GET /api/readings/history should return 200 OK');
  const history = await historyRes.json();

  assert.ok(Array.isArray(history), 'History should be an array');
  assert.ok(history.length > 0, 'History should contain at least one reading');

  // Find the reading matching timestamp
  const matched = history.find(r => r.ts === timestamp);
  assert.ok(matched, 'Ingested reading should be present in history');
  assert.equal(matched.pressure, testPressure, 'Pressure in history must match ingested value');
  assert.equal(matched.worker_id, workerId);
  assert.equal(matched.temperature, 27.8);
  assert.equal(matched.humidity, 55.4);
});
