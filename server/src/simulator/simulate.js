import dotenv from 'dotenv';
dotenv.config();

const API_URL = process.env.API_URL || 'http://localhost:5000/api/readings';
const DEVICE_API_KEY = process.env.DEVICE_API_KEY || 'mineguard_device_secret_key_2026';
const INTERVAL_MS = 4000; // Emit every 4s to prevent network/browser alert spam

// 5 Realistic Worker Profiles
const workersState = [
  {
    worker_id: 'W001',
    helmet_id: 'H001',
    name: 'Rajesh Kumar',
    zone: 'Zone A - Shaft 3',
    temp: 28.2,
    hum: 64.0,
    gasMv: 1450,
    hr: 76,
    spo2: 98,
    pressure: 1012.5,
    battery: 92,
    comm: 'wifi',
    rssi: -62,
    gasRamp: false,
    offline: false
  },
  {
    worker_id: 'W002',
    helmet_id: 'H002',
    name: 'Vikram Singh',
    zone: 'Zone B - Drift 1',
    temp: 28.5,
    hum: 65.0,
    gasMv: 1350,
    hr: 78,
    spo2: 98,
    pressure: 1008.3,
    battery: 88,
    comm: 'wifi',
    rssi: -65,
    gasRamp: false,
    offline: false
  },
  {
    worker_id: 'W003',
    helmet_id: 'H003',
    name: 'Amit Patel',
    zone: 'Zone C - Extraction Face',
    temp: 30.0,
    hum: 68.0,
    gasMv: 1650,
    hr: 82,
    spo2: 97,
    pressure: 1001.7,
    battery: 78,
    comm: 'wifi',
    rssi: -74,
    gasRamp: false, // gentle baseline
    offline: false
  },
  {
    worker_id: 'W004',
    helmet_id: 'H004',
    name: 'Suresh Raina',
    zone: 'Zone B - Conveyor 2',
    temp: 27.8,
    hum: 62.0,
    gasMv: 1390,
    hr: 74,
    spo2: 99,
    pressure: 1015.2,
    battery: 65,
    comm: 'wifi',
    rssi: -58,
    gasRamp: false,
    offline: false
  },
  {
    worker_id: 'W005',
    helmet_id: 'H005',
    name: 'Dinesh Karthik',
    zone: 'Main Access Gate',
    temp: 26.5,
    hum: 58.0,
    gasMv: 1250,
    hr: 70,
    spo2: 98,
    pressure: 1018.9,
    battery: 95,
    comm: 'wifi',
    rssi: -52,
    gasRamp: false,
    offline: false
  }
];

let tickCount = 0;

async function sendTelemetry(payload) {
  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': DEVICE_API_KEY
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error(`[Simulator] Error ${response.status} sending for ${payload.worker_id}:`, errText);
    }
  } catch (err) {
    console.error(`[Simulator] Failed to reach server at ${API_URL}:`, err.message);
  }
}

function simulateStep() {
  tickCount++;
  const time = Date.now();

  workersState.forEach((worker) => {
    // Gentle natural drift within safe operational margins
    worker.temp += (Math.random() * 0.2 - 0.1);
    worker.temp = Math.max(24, Math.min(32, +worker.temp.toFixed(1)));

    worker.hum += (Math.random() * 0.4 - 0.2);
    worker.hum = Math.max(50, Math.min(75, +worker.hum.toFixed(1)));

    // Stable heart rate 68-88 BPM
    worker.hr += Math.round(Math.random() * 2 - 1);
    worker.hr = Math.max(68, Math.min(88, worker.hr));

    // Stable SpO2 96-99%
    worker.spo2 = Math.min(99, Math.max(96, Math.round(worker.spo2 + (Math.random() * 0.4 - 0.2))));

    // Atmospheric pressure: slow realistic drift ±0.3 hPa per tick
    worker.pressure = +(worker.pressure + (Math.random() * 0.6 - 0.3)).toFixed(1);
    worker.pressure = Math.max(980, Math.min(1025, worker.pressure));

    // Stable Gas index 1200 - 1650 mV (well below 2000 warning)
    worker.gasMv += Math.round(Math.random() * 20 - 10);
    worker.gasMv = Math.max(1150, Math.min(1650, worker.gasMv));

    // Slow normal battery discharge
    worker.battery = Math.max(20, +(worker.battery - 0.002).toFixed(1));

    // Calculate raw sensor equivalents (0-4095 ADC)
    const mq2Raw = Math.round((worker.gasMv / 3300) * 4095);
    const mq5Mv = Math.round(worker.gasMv * 0.94);
    const mq5Raw = Math.round((mq5Mv / 3300) * 4095);
    const ldrRaw = Math.round(2000 + Math.sin(tickCount / 10) * 300);

    // No constant random SOS/falls for dummy workers so they do not spam or hang dashboard
    const triggerSos = false;
    const triggerFall = false;

    const payload = {
      worker_id: worker.worker_id,
      helmet_id: worker.helmet_id,
      temperature: worker.temp,
      humidity: worker.hum,
      mq2_mv: worker.gasMv,
      mq5_mv: mq5Mv,
      mq2_raw: mq2Raw,
      mq5_raw: mq5Raw,
      heart_rate: worker.hr,
      spo2: worker.spo2,
      ldr_raw: ldrRaw,
      sos: triggerSos,
      fall: triggerFall,
      battery: worker.battery,
      communication: 'wifi',
      gateway_id: 'direct',
      rssi: worker.rssi + Math.round(Math.random() * 4 - 2),
      snr: null,
      pressure: worker.pressure,
      timestamp: new Date(time).toISOString()
    };

    sendTelemetry(payload);
  });
}

console.log('====================================================');
console.log(' Starting MineGuard IoT Demo Simulator');
console.log(` Target API: ${API_URL}`);
console.log(` Workers: 5 miners (W001 - W005)`);
console.log(` Transmitting telemetry packets every ${INTERVAL_MS / 1000}s`);
console.log('====================================================');

// Start simulator loop
setInterval(simulateStep, INTERVAL_MS);
simulateStep();
