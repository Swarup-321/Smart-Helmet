import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'http';
import { spawn } from 'child_process';
import { app, io } from '../src/index.js';
import { initDatabase } from '../src/db/index.js';

test('End-to-End Live ML Pipeline: ESP32 -> Express -> FastAPI -> Model -> Socket.IO', async (t) => {
  await initDatabase();

  // 1. Choose dynamic ports
  const mlPort = 8000 + Math.floor(Math.random() * 500) + 100;
  process.env.ML_SERVICE_URL = `http://127.0.0.1:${mlPort}`;

  // 2. Start real Python FastAPI microservice
  console.log(`[E2E] Launching Python ML microservice on port ${mlPort}...`);
  const pythonProc = spawn('py', ['-3.14', '-m', 'uvicorn', 'ml_service.main:app', '--port', String(mlPort), '--host', '127.0.0.1'], {
    cwd: process.cwd().replace(/server$/, '')
  });

  t.after(() => {
    pythonProc.kill();
  });

  // Poll for FastAPI health
  let mlHealthy = false;
  const deadline = Date.now() + 15000;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`http://127.0.0.1:${mlPort}/health`);
      if (res.ok) {
        const body = await res.json();
        if (body.model_loaded) {
          mlHealthy = true;
          console.log(`[E2E] ML microservice is healthy (model: ${body.model_version})`);
          break;
        }
      }
    } catch (e) {}
    await new Promise(r => setTimeout(r, 400));
  }

  assert.ok(mlHealthy, 'FastAPI ML microservice failed to start or load model within 15 seconds');

  // 3. Start Express server
  const server = http.createServer(app);
  await new Promise(resolve => server.listen(0, resolve));
  const expressPort = server.address().port;
  const expressUrl = `http://127.0.0.1:${expressPort}`;

  t.after(async () => {
    await new Promise(resolve => server.close(resolve));
  });

  // 4. Track Socket.IO emissions
  const mlPredictionsEmitted = [];
  const mlReadinessEmitted = [];
  const originalEmit = io.emit.bind(io);
  io.emit = (event, ...args) => {
    if (event === 'ml_gas_prediction') {
      mlPredictionsEmitted.push(args[0]);
    } else if (event === 'ml_gas_readiness') {
      mlReadinessEmitted.push(args[0]);
    }
    return originalEmit(event, ...args);
  };
  t.after(() => {
    io.emit = originalEmit;
  });

  const workerId = 'W_E2E_' + Date.now();
  console.log(`[E2E] Testing telemetry streaming for ${workerId}...`);

  // 5. Send readings 1 through 59: Confirm ML buffer warms up (ready: false)
  // Step 13 & 14: Send ESP32-style readings repeatedly; confirm buffer warms up
  for (let i = 1; i <= 59; i++) {
    const postRes = await fetch(`${expressUrl}/api/readings`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': 'mineguard_device_secret_key_2026'
      },
      body: JSON.stringify({
        worker_id: workerId,
        mq2_mv: 1250.0 + (i * 2.5),
        mq5_mv: 1100.0,
        temperature: 27.5,
        humidity: 55.0,
        pressure: 1013.25,
        timestamp: new Date(Date.now() - (60 - i) * 10000).toISOString()
      })
    });
    assert.equal(postRes.status, 201, `Reading ${i} must return 201 Created`);
  }

  // Small pause for async ML task to complete for sample 59
  await new Promise(r => setTimeout(r, 200));

  // Confirm NO fake prediction was emitted during warm-up
  assert.equal(mlPredictionsEmitted.length, 0, 'No ml_gas_prediction should be emitted before 60 samples');
  assert.ok(mlReadinessEmitted.length > 0, 'ml_gas_readiness events should be emitted during warm-up');
  const lastReadiness = mlReadinessEmitted[mlReadinessEmitted.length - 1];
  assert.equal(lastReadiness.ready, false);
  assert.equal(lastReadiness.reason, 'INSUFFICIENT_HISTORY');
  assert.equal(lastReadiness.current_samples, 59);
  console.log(`[E2E] Verified warm-up state: current_samples = 59 / 60`);

  // 6. Send Reading 60: Confirm actual model probability is produced
  // Step 15 & 16: Model threshold reached, real probability produced, Socket.IO broadcast
  const finalRes = await fetch(`${expressUrl}/api/readings`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': 'mineguard_device_secret_key_2026'
    },
    body: JSON.stringify({
      worker_id: workerId,
      mq2_mv: 1400.0,
      mq5_mv: 1100.0,
      temperature: 28.0,
      humidity: 56.0,
      pressure: 1013.25,
      timestamp: new Date().toISOString()
    })
  });
  assert.equal(finalRes.status, 201);

  // Allow async ML inference to complete
  await new Promise(r => setTimeout(r, 400));

  // 7. Verify Socket.IO received ml_gas_prediction
  assert.equal(mlPredictionsEmitted.length, 1, 'Exactly 1 ml_gas_prediction event should be emitted at sample 60');
  const prediction = mlPredictionsEmitted[0];

  console.log(`[E2E] SUCCESS! Received live ml_gas_prediction:`, prediction);
  assert.equal(prediction.worker_id, workerId);
  assert.ok(typeof prediction.risk_probability === 'number', 'risk_probability must be a number');
  assert.ok(prediction.risk_probability >= 0.0 && prediction.risk_probability <= 1.0, 'risk_probability must be in [0.0, 1.0]');
  assert.ok(['NORMAL', 'ELEVATED_SURGE_RISK', 'CRITICAL_SURGE_RISK'].includes(prediction.risk_level));
  assert.equal(prediction.model_version, 'v1.1-surge-classifier-dimensionless');

  // Verify strict scientific labeling: No % CH4 or PPM
  const jsonStr = JSON.stringify(prediction).toLowerCase();
  assert.ok(!jsonStr.includes('% ch4'), 'Must not contain % CH4');
  assert.ok(!jsonStr.includes('ppm'), 'Must not contain PPM');
});
