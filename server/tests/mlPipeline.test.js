import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'http';
import { app, io, evaluateMlGasTrend } from '../src/index.js';
import { initDatabase, getDatabase } from '../src/db/index.js';

test('Express + ML Integration Test Suite', async (suite) => {
  await initDatabase();

  // Create Express test server
  const server = http.createServer(app);
  await new Promise(resolve => server.listen(0, resolve));
  const port = server.address().port;
  const baseUrl = `http://127.0.0.1:${port}`;

  suite.after(async () => {
    await new Promise(resolve => server.close(resolve));
  });

  // Track Socket.IO emissions
  const emittedEvents = [];
  const originalEmit = io.emit.bind(io);
  io.emit = (event, ...args) => {
    emittedEvents.push({ event, args });
    return originalEmit(event, ...args);
  };

  // ----------------------------------------------------
  // TEST 6: ML request succeeds
  // ----------------------------------------------------
  await suite.test('6. ML request succeeds: parses response and returns prediction', async () => {
    const mockMlServer = http.createServer((req, res) => {
      let body = '';
      req.on('data', chunk => body += chunk);
      req.on('end', () => {
        const parsed = JSON.parse(body);
        assert.equal(parsed.worker_id, 'W_ML_SUCCESS');
        assert.ok(parsed.mq2_mv != null);
        assert.equal(parsed.mq5_mv, undefined, 'mq5_mv must not be forwarded to ML service');

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          ready: true,
          risk_probability: 0.185,
          risk_level: 'NORMAL',
          timestamp: parsed.timestamp,
          worker_id: parsed.worker_id,
          model_version: 'v1.1-surge-classifier-dimensionless'
        }));
      });
    });

    await new Promise(resolve => mockMlServer.listen(0, resolve));
    const mockPort = mockMlServer.address().port;
    process.env.ML_SERVICE_URL = `http://127.0.0.1:${mockPort}`;

    const reading = {
      worker_id: 'W_ML_SUCCESS',
      mq2_mv: 1450.0,
      mq5_mv: 1200.0,
      temperature: 28.0,
      humidity: 50.0,
      pressure: 1012.0,
      timestamp: new Date().toISOString()
    };

    const result = await evaluateMlGasTrend(reading, [], io);

    await new Promise(resolve => mockMlServer.close(resolve));

    assert.ok(result, 'Result should not be null');
    assert.equal(result.risk_probability, 0.185);
    assert.equal(result.risk_level, 'NORMAL');
    assert.equal(result.worker_id, 'W_ML_SUCCESS');
  });

  // ----------------------------------------------------
  // TEST 7: ML timeout handled gracefully via AbortController
  // ----------------------------------------------------
  await suite.test('7. ML timeout: AbortController cancels fetch after 500ms without throwing', async () => {
    const slowMlServer = http.createServer((req, res) => {
      // Intentionally delay longer than 500ms timeout
      setTimeout(() => {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ready: true, risk_probability: 0.1, risk_level: 'NORMAL' }));
      }, 700);
    });

    await new Promise(resolve => slowMlServer.listen(0, resolve));
    const slowPort = slowMlServer.address().port;
    process.env.ML_SERVICE_URL = `http://127.0.0.1:${slowPort}`;

    const reading = {
      worker_id: 'W_ML_TIMEOUT',
      mq2_mv: 1400.0,
      timestamp: new Date().toISOString()
    };

    const start = Date.now();
    const result = await evaluateMlGasTrend(reading, [], io);
    const duration = Date.now() - start;

    await new Promise(resolve => slowMlServer.close(resolve));

    assert.equal(result, null, 'Timed out request must return null');
    assert.ok(duration >= 480 && duration <= 800, `Duration ${duration}ms should be around 500ms timeout`);
  });

  // ----------------------------------------------------
  // TEST 8: ML unavailable handled gracefully
  // ----------------------------------------------------
  await suite.test('8. ML unavailable: Closed port returns null without throwing', async () => {
    // Point to non-existent port
    process.env.ML_SERVICE_URL = 'http://127.0.0.1:59999';

    const reading = {
      worker_id: 'W_ML_UNAVAIL',
      mq2_mv: 1300.0,
      timestamp: new Date().toISOString()
    };

    const result = await evaluateMlGasTrend(reading, [], io);
    assert.equal(result, null, 'Unavailable ML service must safely return null');
  });

  // ----------------------------------------------------
  // TEST 9: Ingestion still succeeds when ML fails
  // ----------------------------------------------------
  await suite.test('9. Ingestion succeeds when ML is offline', async () => {
    process.env.ML_SERVICE_URL = 'http://127.0.0.1:59999';

    const res = await fetch(`${baseUrl}/api/readings`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': 'mineguard_device_secret_key_2026'
      },
      body: JSON.stringify({
        worker_id: 'W_INGEST_TEST',
        mq2_mv: 1350.0,
        temperature: 27.5,
        humidity: 60.0,
        pressure: 1013.25,
        timestamp: new Date().toISOString()
      })
    });

    assert.equal(res.status, 201, 'Ingestion must return 201 Created even if ML is offline');
    const data = await res.json();
    assert.equal(data.success, true);
  });

  // ----------------------------------------------------
  // TEST 10: Deterministic alerts still work when ML fails
  // ----------------------------------------------------
  await suite.test('10. Deterministic alerts still trigger when ML fails', async () => {
    process.env.ML_SERVICE_URL = 'http://127.0.0.1:59999';

    const alertWorkerId = 'W_ALERT_' + Date.now();
    const res = await fetch(`${baseUrl}/api/readings`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': 'mineguard_device_secret_key_2026'
      },
      body: JSON.stringify({
        worker_id: alertWorkerId,
        mq2_mv: 2600.0, // Exceeds critical gas threshold (2500 mV)
        temperature: 28.0,
        humidity: 50.0,
        timestamp: new Date().toISOString()
      })
    });

    assert.equal(res.status, 201);
    const data = await res.json();
    assert.ok(data.alerts_count > 0, 'Deterministic alert must be generated');
  });

  // ----------------------------------------------------
  // TEST 11: Successful ML prediction broadcast over Socket.IO
  // ----------------------------------------------------
  await suite.test('11. Successful ML prediction broadcast over Socket.IO', async () => {
    emittedEvents.length = 0; // Clear events

    const mockMlServer = http.createServer((req, res) => {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        ready: true,
        risk_probability: 0.725,
        risk_level: 'ELEVATED_SURGE_RISK',
        timestamp: new Date().toISOString(),
        worker_id: 'W_SOCKET_TEST',
        model_version: 'v1.1-surge-classifier-dimensionless'
      }));
    });

    await new Promise(resolve => mockMlServer.listen(0, resolve));
    const port = mockMlServer.address().port;
    process.env.ML_SERVICE_URL = `http://127.0.0.1:${port}`;

    const reading = {
      worker_id: 'W_SOCKET_TEST',
      mq2_mv: 1550.0,
      timestamp: new Date().toISOString()
    };

    await evaluateMlGasTrend(reading, [], io);

    await new Promise(resolve => mockMlServer.close(resolve));

    const mlEvents = emittedEvents.filter(e => e.event === 'ml_gas_prediction');
    assert.equal(mlEvents.length, 1, 'Exactly one ml_gas_prediction event should be emitted');
    const payload = mlEvents[0].args[0];
    assert.equal(payload.worker_id, 'W_SOCKET_TEST');
    assert.equal(payload.risk_probability, 0.725);
    assert.equal(payload.risk_level, 'ELEVATED_SURGE_RISK');
    assert.equal(payload.model_version, 'v1.1-surge-classifier-dimensionless');
  });

  // ----------------------------------------------------
  // TEST 12: No fake prediction when ML unavailable
  // ----------------------------------------------------
  await suite.test('12. No fake prediction when ML is unavailable', async () => {
    emittedEvents.length = 0; // Clear events
    process.env.ML_SERVICE_URL = 'http://127.0.0.1:59999';

    const reading = {
      worker_id: 'W_NO_FAKE',
      mq2_mv: 1550.0,
      timestamp: new Date().toISOString()
    };

    await evaluateMlGasTrend(reading, [], io);

    const mlEvents = emittedEvents.filter(e => e.event === 'ml_gas_prediction');
    assert.equal(mlEvents.length, 0, 'Must NOT emit fake ml_gas_prediction when ML is offline');
  });

  // Restore io.emit
  io.emit = originalEmit;
});
