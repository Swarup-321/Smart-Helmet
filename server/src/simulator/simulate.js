import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config();
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const API_URL = process.env.API_URL || 'http://localhost:5000/api/readings';
const DEVICE_API_KEY = process.env.DEVICE_API_KEY || 'mineguard_device_secret_key_2026';
const INTERVAL_MS = 4000; // Emit every 4s to provide realistic streaming telemetry

// 4 Demo Worker Profiles (W006 / Physical Smart Helmet is excluded so physical hardware has dedicated slot)
const workersState = [
  {
    worker_id: 'W001',
    helmet_id: 'DEMO-H001',
    name: 'Demo Helmet #1',
    zone: 'Zone A - Shaft 3',
    temp: 28.2,
    hum: 64.0,
    gasMv: 1450,
    hr: 76,
    spo2: 98,
    battery: 92,
    comm: 'wifi',
    rssi: -62,
    baseVibEvents: 1,
    gasRamp: false,
    offline: false
  },
  {
    worker_id: 'W002',
    helmet_id: 'DEMO-H002',
    name: 'Demo Helmet #2',
    zone: 'Zone B - Drift 1',
    temp: 28.5,
    hum: 65.0,
    gasMv: 1350,
    hr: 78,
    spo2: 98,
    battery: 88,
    comm: 'wifi',
    rssi: -65,
    baseVibEvents: 3,
    gasRamp: false,
    offline: false
  },
  {
    worker_id: 'W003',
    helmet_id: 'DEMO-H003',
    name: 'Demo Helmet #3',
    zone: 'Zone C - Extraction Face',
    temp: 30.0,
    hum: 68.0,
    gasMv: 1650,
    hr: 82,
    spo2: 97,
    battery: 78,
    comm: 'wifi',
    rssi: -74,
    baseVibEvents: 9, // Extraction face has higher machinery/ground vibration waves
    gasRamp: false,
    offline: false
  },
  {
    worker_id: 'W004',
    helmet_id: 'DEMO-H004',
    name: 'Demo Helmet #4',
    zone: 'Zone B - Conveyor 2',
    temp: 27.8,
    hum: 62.0,
    gasMv: 1390,
    hr: 74,
    spo2: 99,
    battery: 65,
    comm: 'wifi',
    rssi: -58,
    baseVibEvents: 4, // Conveyor mechanical baseline
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

    // HW-072 Vibration Simulation
    let vibEvents = worker.baseVibEvents + Math.round(Math.random() * 4 - 2);
    // Add realistic occasional extraction pulse for W003 in Extraction Face
    if (worker.worker_id === 'W003' && (tickCount % 8 === 0)) {
      vibEvents = Math.min(18, vibEvents + Math.round(Math.random() * 6 + 3));
    }
    vibEvents = Math.max(0, vibEvents);

    let vibLevel = 'NORMAL';
    let vibStatus = 'SAFE';
    if (vibEvents >= 21) {
      vibLevel = 'CRITICAL';
      vibStatus = 'CRITICAL';
    } else if (vibEvents >= 11) {
      vibLevel = 'HIGH';
      vibStatus = 'WARNING';
    } else if (vibEvents >= 6) {
      vibLevel = 'MODERATE';
      vibStatus = 'MONITOR';
    } else if (vibEvents >= 3) {
      vibLevel = 'LOW';
      vibStatus = 'NORMAL';
    } else {
      vibLevel = 'NORMAL';
      vibStatus = 'SAFE';
    }

    const payload = {
      worker_id: worker.worker_id,
      helmet_id: worker.helmet_id,
      zone_id: worker.zone,
      temperature: worker.temp,
      humidity: worker.hum,
      mq2_mv: worker.gasMv,
      mq5_mv: mq5Mv,
      mq2_raw: mq2Raw,
      mq5_raw: mq5Raw,
      heart_rate: worker.hr,
      spo2: worker.spo2,
      ldr_raw: ldrRaw,
      sos: false,
      fall: false,
      battery: worker.battery,
      communication: 'wifi',
      gateway_id: 'direct',
      rssi: worker.rssi + Math.round(Math.random() * 4 - 2),
      snr: null,
      // HW-072 Vibration Telemetry
      vibration_detected: vibEvents > 0,
      vibration_events: vibEvents,
      vibration_level: vibLevel,
      vibration_status: vibStatus,
      timestamp: new Date(time).toISOString()
    };

    sendTelemetry(payload);
  });
}

console.log('====================================================');
console.log(' Starting MineGuard IoT Demo Simulator v3.0');
console.log(` Target API: ${API_URL}`);
console.log(` Active Fleet: Demo Helmet #1 - #4 (W001 - W004)`);
console.log(` Physical Helmet: W006 (H-ESP32-LIVE) preserved for hardware`);
console.log(` Telemetry: HW-072 Vibration, DHT11, MQ-2, MQ-5, HW-827`);
console.log(` Transmitting telemetry packets every ${INTERVAL_MS / 1000}s`);
console.log('====================================================');

// Start simulator loop
setInterval(simulateStep, INTERVAL_MS);
simulateStep();
