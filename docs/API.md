# MineGuard REST & WebSocket API Reference

The MineGuard backend exposes a comprehensive RESTful API and WebSocket event stream for real-time telemetry ingestion, alert dispatch, trend analytics, and administrative management.

Base URL (Local): `http://localhost:5000`  
Base URL (Production Target): `https://mineguard-server.onrender.com`

---

## 1. Authentication
- **Device Ingestion**: Protected via HTTP Header `x-api-key: <DEVICE_API_KEY>`
- **Dashboard / API Endpoints**: Bearer JWT token in `Authorization: Bearer <JWT_TOKEN>`

### POST `/api/auth/login`
Authenticates a safety supervisor or admin.
- **Request Body**:
  ```json
  {
    "email": "admin@mineguard.local",
    "password": "Admin@123"
  }
  ```
- **Response `200 OK`**:
  ```json
  {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6...",
    "user": {
      "id": "USR-ADMIN-1",
      "email": "admin@mineguard.local",
      "role": "admin"
    }
  }
  ```

---

## 2. Sensor Telemetry Ingestion

### POST `/api/readings`
Ingests telemetry packet from ESP32 smart helmet or LoRa gateway.
- **Headers**:
  - `Content-Type: application/json`
  - `x-api-key: mineguard_device_secret_key_2026`
- **Request Body**:
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
- **Response `201 Created`**:
  ```json
  {
    "success": true,
    "persisted": true,
    "alerts_count": 0,
    "timestamp": "2026-10-02T15:45:00.000Z"
  }
  ```

---

## 3. Worker & Helmet Readings

### GET `/api/readings/latest`
Returns current live state for all registered miners including online/offline calculation.

### GET `/api/readings/history`
Query parameters:
- `worker_id`: Worker ID (e.g. `W001`)
- `from`: ISO timestamp start range
- `to`: ISO timestamp end range
- `limit`: Maximum records (default `500`)

---

## 4. Trend Analysis & Predictive Anomaly Engine

### GET `/api/trends`
Calculates linear regression slopes, moving averages, z-score anomalies, and predicted time-to-threshold.
- **Parameters**: `worker_id=W001&metric=mq2_mv&window=50`
- **Response `200 OK`**:
  ```json
  {
    "worker_id": "W001",
    "metric": "mq2_mv",
    "direction": "rising",
    "slope": 2.45,
    "correlation_r": 0.82,
    "moving_averages": [1420, 1435, 1450, 1480],
    "anomalies": [],
    "time_to_warning_min": 14.2,
    "will_breach_soon": true,
    "insight": "Gas index rising (+2.45 mV/min) – estimated 14.2 mins to warning threshold!"
  }
  ```

---

## 5. Alerts & Incidents

### GET `/api/alerts`
- Parameters: `status=[active|acknowledged|resolved|unresolved]&severity=[CRITICAL|WARNING|INFO]&worker_id=W001`

### PATCH `/api/alerts/:id/acknowledge`
- Body: `{ "acknowledged_by": "Safety Officer" }`

### POST `/api/alerts/bulk-acknowledge`
- Body: `{ "ids": ["ALT-1", "ALT-2"], "acknowledged_by": "Safety Officer" }`

### PATCH `/api/alerts/:id/resolve`

---

## 6. Workers CRUD
- `GET /api/workers`
- `POST /api/workers`
- `PUT /api/workers/:id`
- `DELETE /api/workers/:id`

---

## 7. CSV Telemetry Export
### GET `/api/export/readings.csv?worker_id=W001`
Returns direct downloadable CSV file of all recorded sensor history points.

---

## 8. WebSocket Event Specifications (Socket.IO)

| Event Name | Direction | Payload |
|---|---|---|
| `reading` | Server -> Client | Full sensor telemetry object |
| `alert` | Server -> Client | Alert notification object |
| `worker_status` | Server -> Client | Worker registration changes |
| `thresholds_updated` | Server -> Client | Updated threshold configurations |
