# 01 — Current Architecture and Target Integration

## Current runtime flow
ESP32 sensors → HTTP POST `/api/readings` → Express validation/cache/alerts/trend logic → SQLite or Firestore persistence + Socket.IO broadcast → React dashboard.

The audit explicitly found no MQTT broker, topics, or MQTT client library. Do not introduce MQTT merely because older project descriptions mentioned it.

## Current components
### Firmware
Sensors identified by audit:
- MQ-2: combustible gas, GPIO 34
- MQ-5: methane/LPG, GPIO 35
- DHT11: temperature/humidity, GPIO 4
- MAX30102: heart rate and SpO2, I2C
- BMP280: pressure, I2C
- SOS button: GPIO 27

### Backend
- Node.js / Express
- Zod payload validation
- Socket.IO
- StorageAdapter abstraction
- SQLite adapter
- Firestore adapter
- Alert engine
- JavaScript statistical trend service
- Write-budget throttling

### Frontend
- React 18 + Vite
- Tailwind CSS
- Recharts
- React Context (`AppContext.jsx`)
- API singleton + socket.io-client

## Target ML architecture
Keep the existing Express/Socket.IO architecture. Add an isolated Python ML service beside Express.

ESP32 → Express `/api/readings` → asynchronous ML request → Python inference → Express → Socket.IO ML event → React dashboard.

The audit recommends a FastAPI/Uvicorn service. This is an implementation recommendation, not an already-existing component.

## Design constraint
ML inference must not block telemetry ingestion. Failures in the ML service must degrade gracefully without taking down normal telemetry, alerts, or the dashboard.
