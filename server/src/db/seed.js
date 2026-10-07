import { initDatabase, getDatabase } from './index.js';

async function seedHistoryData() {
  console.log('[Seed] Seeding 24 hours of realistic telemetry for MineGuard demo...');
  await initDatabase();
  const db = getDatabase();

  const workers = await db.getWorkers();
  if (workers.length === 0) {
    console.log('[Seed] No workers found. Initializing defaults...');
    return;
  }

  const now = Date.now();
  const ONE_DAY_MS = 24 * 60 * 60 * 1000;
  const startTime = now - ONE_DAY_MS;
  const stepMs = 30 * 1000; // 30-sec interval = 2880 readings per worker

  const allReadings = [];

  for (const worker of workers) {
    console.log(`[Seed] Generating history points for ${worker.name} (${worker.id})...`);
    let currentGas = 1200 + Math.random() * 200;
    let currentHr = 72 + Math.random() * 10;
    let currentTemp = 27.5;
    let currentHum = 60.0;
    let battery = 98;

    for (let t = startTime; t <= now; t += stepMs) {
      const dateObj = new Date(t);
      const hour = dateObj.getHours();

      // Ambient temperature sinusoidal variation over 24 hours (peak around 2 PM)
      const tempVariation = Math.sin(((hour - 8) / 24) * 2 * Math.PI) * 4;
      const temp = +(currentTemp + tempVariation + (Math.random() * 0.4 - 0.2)).toFixed(1);

      // Humidity inversely correlated with temperature
      const humidity = +(currentHum - tempVariation * 1.5 + (Math.random() * 0.8 - 0.4)).toFixed(1);

      // Heart rate baseline + subtle drifts
      const hrDrift = (Math.random() - 0.5) * 4;
      const hr = Math.round(Math.min(130, Math.max(58, currentHr + hrDrift)));

      // Battery slow drain
      battery = Math.max(15, +(battery - 0.025).toFixed(1));

      // Occasional localized gas spikes for Worker W003 in Extraction Face
      let mq2Mv = +(currentGas + (Math.random() * 40 - 20)).toFixed(0);
      if (worker.id === 'W003' && hour >= 14 && hour <= 16) {
        mq2Mv = Math.min(2650, mq2Mv + 850); // Warning/Critical level gas spike in the afternoon
      }
      const mq5Mv = Math.round(mq2Mv * 0.92);
      const mq2Raw = Math.round((mq2Mv / 3300) * 4095);
      const mq5Raw = Math.round((mq5Mv / 3300) * 4095);

      const spo2 = Math.min(99, Math.max(93, Math.round(98 + (Math.random() * 2 - 1))));
      const ldrRaw = Math.round(1800 + Math.random() * 600);

      allReadings.push({
        worker_id: worker.id,
        ts: dateObj.toISOString(),
        temperature: temp,
        humidity,
        mq2_mv: mq2Mv,
        mq5_mv: mq5Mv,
        mq2_raw: mq2Raw,
        mq5_raw: mq5Raw,
        heart_rate: hr,
        spo2,
        ldr_raw: ldrRaw,
        sos: 0,
        fall: 0,
        battery,
        communication: 'wifi',
        gateway_id: 'direct',
        rssi: -60 - Math.round(Math.random() * 15),
        snr: null
      });

      // Keep latest state updated
      if (t >= now - stepMs) {
        await db.saveLatestReading(worker.id, {
          worker_id: worker.id,
          helmet_id: worker.helmet_id,
          temperature: temp,
          humidity,
          mq2_mv: mq2Mv,
          mq5_mv: mq5Mv,
          mq2_raw: mq2Raw,
          mq5_raw: mq5Raw,
          heart_rate: hr,
          spo2,
          ldr_raw: ldrRaw,
          sos: false,
          fall: false,
          battery,
          communication: 'wifi',
          gateway_id: 'direct',
          rssi: -65,
          snr: null,
          timestamp: dateObj.toISOString()
        });
      }
    }
  }

  console.log(`[Seed] Inserting ${allReadings.length} history records into database...`);
  await db.saveReadingHistoryBatch(allReadings);
  console.log('[Seed] Seeding completed successfully! 24h history ready.');
}

if (process.argv[1]?.endsWith('seed.js')) {
  seedHistoryData()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('[Seed] Error seeding database:', err);
      process.exit(1);
    });
}

export { seedHistoryData };
