import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import { SQLiteAdapter } from '../src/db/sqliteAdapter.js';

test('SQLite Adapter - Pressure Persistence and History Retrieval', async (t) => {
  const testDbDir = path.resolve('data/test');
  const testDbPath = path.join(testDbDir, `test_pressure_${Date.now()}.db`);

  const adapter = new SQLiteAdapter(testDbPath);
  await adapter.init();

  t.after(async () => {
    if (adapter.db) {
      await new Promise(res => adapter.db.close(res));
    }
    if (fs.existsSync(testDbPath)) {
      try {
        fs.unlinkSync(testDbPath);
      } catch (e) {}
    }
  });

  // Verify column exists
  const columns = await adapter.all('PRAGMA table_info(readings)');
  const columnNames = columns.map(c => c.name);
  assert.ok(columnNames.includes('pressure'), 'readings table must include pressure column');

  // Test single reading save with pressure
  const testReading = {
    worker_id: 'W001',
    timestamp: new Date().toISOString(),
    temperature: 28.5,
    humidity: 65.2,
    pressure: 1013.25,
    mq2_mv: 1150.0,
    mq5_mv: 850.0,
    heart_rate: 75,
    spo2: 98,
    sos: false,
    fall: false
  };

  const saved = await adapter.saveReadingHistory(testReading);
  assert.ok(saved.id, 'Reading should have an auto-generated id');
  assert.equal(saved.pressure, 1013.25, 'Saved reading returns pressure');

  // Test history retrieval
  const history = await adapter.getReadingHistory({ worker_id: 'W001', limit: 10 });
  assert.ok(history.length >= 1, 'History should return saved reading');
  const retrieved = history.find(r => r.worker_id === 'W001');
  assert.ok(retrieved, 'Should find W001 record in history');
  assert.equal(retrieved.pressure, 1013.25, 'Retrieved record must contain accurate pressure');
  assert.equal(retrieved.temperature, 28.5, 'Retrieved record must contain accurate temperature');
  assert.equal(retrieved.mq2_mv, 1150.0, 'Retrieved record must contain accurate mq2_mv');

  // Test batch reading save with pressure
  const batch = [
    {
      worker_id: 'W001',
      timestamp: new Date(Date.now() + 1000).toISOString(),
      temperature: 28.7,
      humidity: 64.9,
      pressure: 1012.80,
      mq2_mv: 1180.0
    },
    {
      worker_id: 'W002',
      timestamp: new Date(Date.now() + 2000).toISOString(),
      temperature: 29.1,
      humidity: 66.0,
      pressure: 1011.50,
      mq2_mv: 1220.0
    }
  ];

  await adapter.saveReadingHistoryBatch(batch);
  const w1History = await adapter.getReadingHistory({ worker_id: 'W001', limit: 5 });
  const w1Latest = w1History[w1History.length - 1];
  assert.equal(w1Latest.pressure, 1012.80, 'Batch insert preserves pressure for W001');

  const w2History = await adapter.getReadingHistory({ worker_id: 'W002', limit: 5 });
  assert.equal(w2History[0].pressure, 1011.50, 'Batch insert preserves pressure for W002');

  // Test reading with null pressure (backward compatibility)
  const nullPressureReading = {
    worker_id: 'W003',
    timestamp: new Date().toISOString(),
    temperature: 27.0,
    humidity: 70.0,
    pressure: null,
    mq2_mv: 900.0
  };
  await adapter.saveReadingHistory(nullPressureReading);
  const w3History = await adapter.getReadingHistory({ worker_id: 'W003', limit: 1 });
  assert.equal(w3History[0].pressure, null, 'Null pressure is handled safely');
});

test('SQLite Adapter - Migration idempotency on existing database', async (t) => {
  const testDbDir = path.resolve('data/test');
  const testDbPath = path.join(testDbDir, `test_migration_${Date.now()}.db`);

  // Create an adapter and init
  const adapter1 = new SQLiteAdapter(testDbPath);
  await adapter1.init();

  // Run init again on same database to ensure migrateSchema is idempotent
  const adapter2 = new SQLiteAdapter(testDbPath);
  await adapter2.init();

  const columns = await adapter2.all('PRAGMA table_info(readings)');
  const pressureCols = columns.filter(c => c.name === 'pressure');
  assert.equal(pressureCols.length, 1, 'Pressure column should exist exactly once');

  await new Promise(res => adapter1.db.close(res));
  await new Promise(res => adapter2.db.close(res));
  if (fs.existsSync(testDbPath)) {
    try {
      fs.unlinkSync(testDbPath);
    } catch (e) {}
  }
});
