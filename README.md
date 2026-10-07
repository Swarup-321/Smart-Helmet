# MineGuard – Smart Helmet Safety & Health Monitoring Dashboard

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![Node.js](https://img.shields.io/badge/Node.js-18%2B%20%7C%2020%2B-green.svg)](https://nodejs.org)
[![React](https://img.shields.io/badge/React-18-blue.svg)](https://react.dev)
[![Tailwind CSS](https://img.shields.io/badge/TailwindCSS-3.4-38bdf8.svg)](https://tailwindcss.com)

**MineGuard** is a real-time IoT smart helmet telemetry and safety dashboard built for underground coal mining operations. Each miner's helmet contains an ESP32 microcontroller reading atmospheric gas sensors (MQ-2, MQ-5), biometric vitals (heart rate, SpO2), thermal climate conditions, and impact/SOS emergency buttons. 

The backend processes incoming telemetry packets, manages write budgets for serverless databases, triggers real-time emergency siren alerts, computes predictive gas trend slopes, and pushes live updates over Socket.IO to a supervisor dashboard.

---

## 🏗️ Architecture & Features

- **Frontend**: React 18, Vite, Tailwind CSS, Recharts, Lucide Icons, Framer Motion. Light-themed SaaS design with glassmorphic cards, sparklines, spatial zone maps, and interactive trend charts. Installable as a Progressive Web App (PWA).
- **Backend**: Node.js, Express, Socket.IO, Zod validation, Rate limiting, Pure Node.js statistical trend engine (Linear regression, Moving averages, Z-score anomaly detection, Time-to-threshold prediction).
- **Storage Layer**: Dual-adapter architecture:
  - `DB_MODE=sqlite` (default for local development & edge nodes)
  - `DB_MODE=firebase` (Google Cloud Firestore for serverless cloud deployments)
- **ESP32 Firmware**: Arduino C++ sample with local failsafe buzzer alarms and non-blocking Wi-Fi HTTP client (`x-api-key` protected).
- **LoRa Subsurface Ready**: Modular payload architecture ready for SX1278 (433 MHz) underground RF forwarding.

---

## 🚀 Quick Start (Local Development)

### 1. Prerequisites
- Node.js 18+ or 20+
- npm 9+

### 2. Install Dependencies
From the repository root:
```bash
npm install --workspace=server
npm install --workspace=client
```

### 3. Seed 24-Hour Demo Telemetry Data
Populate 24 hours of realistic miner vitals and gas readings into SQLite:
```bash
npm run seed
```

### 4. Start Server & Client
Launch both backend (`http://localhost:5000`) and frontend (`http://localhost:5173`):
```bash
npm run dev --workspace=server
# In another terminal:
npm run dev --workspace=client
```

### 5. Launch Real-time Telemetry Simulator
Generate live telemetry packets for 5 miners every 2 seconds:
```bash
npm run simulate
```

Visit **`http://localhost:5173`** in your browser!

---

## 🔑 Demo Credentials

- **Admin / Safety Officer**: `admin@mineguard.local`
- **Password**: `Admin@123`
- **Device Ingestion Key**: `mineguard_device_secret_key_2026` (included in header `x-api-key`)

---

## 🧪 Running Automated Tests

Run backend unit tests for trend calculations and alert engine rules:
```bash
npm test
```

---

## 📡 Sensor Payload Schema (`POST /api/readings`)

```json
{
  "worker_id": "W001",
  "helmet_id": "H001",
  "temperature": 28.4,
  "humidity": 64.0,
  "mq2_mv": 1490,
  "mq5_mv": 1380,
  "mq2_raw": 1850,
  "mq5_raw": 1720,
  "heart_rate": 78,
  "spo2": 98,
  "ldr_raw": 2100,
  "sos": false,
  "fall": false,
  "battery": 87,
  "communication": "wifi",
  "gateway_id": "direct",
  "rssi": -61,
  "snr": null,
  "timestamp": "2026-10-02T15:45:00.000Z"
}
```
*Note: Only `worker_id` is mandatory. Missing sensors display "Not connected" gracefully.*

---

## 📚 Documentation Index

- [REST & WebSocket API Reference](file:///docs/API.md)
- [Database Schema & Write Budget Details](file:///docs/DB_SCHEMA.md)
- [Production Cloud Deployment Guide (Firebase + Render + Vercel)](file:///docs/DEPLOY.md)
- [LoRa Subsurface Upgrade Architecture](file:///docs/LORA_UPGRADE.md)
- [ESP32 Firmware Code](file:///firmware-samples/esp32_wifi_post.ino)

---

## 🛡️ License
Released under the [MIT License](LICENSE).
*Footnote: Prototype system – not certified safety equipment for hazardous underground mining environments.*
