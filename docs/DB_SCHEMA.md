# MineGuard Database Schema & Persistence Architecture

MineGuard supports dual storage engines via a clean abstraction layer (`StorageAdapter`):
1. **SQLite (`DB_MODE=sqlite`)**: Zero-config, single-file embedded database for local development and edge gateways.
2. **Google Cloud Firestore (`DB_MODE=firebase`)**: Serverless document database with atomic batches for production cloud deployments.

---

## 1. Table Definitions (SQLite & Firestore Equivalent)

### `workers`
Stores registered miners, helmet identifiers, and zone assignments.
- `id` (TEXT, PK): Worker unique identifier (e.g. `W001`)
- `name` (TEXT): Full name of the miner
- `helmet_id` (TEXT): Paired smart helmet serial (e.g. `H001`)
- `zone` (TEXT): Mining section (e.g. `Zone A - Shaft 3`)
- `phone` (TEXT): Mobile number
- `emergency_contact` (TEXT): Relative contact details
- `created_at` (TEXT): ISO 8601 registration timestamp

### `workers_latest`
Maintains latest telemetry state in memory & DB to minimize read latency.
- `worker_id` (TEXT, PK): Foreign Key to `workers.id`
- `ts` (TEXT): Telemetry packet timestamp
- `data_json` (TEXT): Full JSON string of latest packet
- `updated_at` (TEXT): Ingestion timestamp

### `readings`
Historical timeseries sensor records. Indexed on `(worker_id, ts)` for fast telemetry chart querying.
- `id` (INTEGER, PK AUTOINCREMENT)
- `worker_id` (TEXT, FK)
- `ts` (TEXT): Timestamp
- `temperature` (REAL): Ambient temperature in °C
- `humidity` (REAL): Relative humidity %
- `mq2_mv` (REAL): MQ-2 gas index in mV
- `mq5_mv` (REAL): MQ-5 gas index in mV
- `mq2_raw` (REAL): 12-bit ADC raw value (0-4095)
- `mq5_raw` (REAL): 12-bit ADC raw value (0-4095)
- `heart_rate` (REAL): Heart rate in BPM
- `spo2` (REAL): Oxygen saturation in %
- `ldr_raw` (REAL): Ambient light sensor value
- `sos` (INTEGER / BOOLEAN): 1 if emergency button pressed
- `fall` (INTEGER / BOOLEAN): 1 if man-down / fall impact detected
- `battery` (REAL): Helmet battery level %
- `communication` (TEXT): `wifi` or `lora`
- `gateway_id` (TEXT): `direct` or gateway node identifier
- `rssi` (REAL): Received Signal Strength Indicator in dBm
- `snr` (REAL): Signal-to-Noise Ratio (for LoRa)

### `alerts`
Incidents, alarms, and trend anomaly records.
- `id` (TEXT, PK): Unique incident identifier (`ALT-...`)
- `worker_id` (TEXT, FK)
- `ts` (TEXT): Trigger timestamp
- `type` (TEXT): `GAS` | `HEALTH` | `SOS` | `FALL` | `OFFLINE` | `BATTERY` | `TREND`
- `severity` (TEXT): `INFO` | `WARNING` | `CRITICAL`
- `message` (TEXT): Human-readable event description
- `value` (REAL): Numeric value that triggered alarm
- `acknowledged` (INTEGER / BOOLEAN): 1 if acknowledged by safety officer
- `acknowledged_by` (TEXT): Name of user who acknowledged
- `acknowledged_at` (TEXT): Timestamp of acknowledgment
- `resolved_at` (TEXT): Timestamp when condition returned to normal

### `thresholds`
Operational limits editable directly from dashboard.
- `key` (TEXT, PK): `gas_index`, `heart_rate_high`, `heart_rate_low`, `spo2`, `temperature`, `humidity`, `battery`, `offline_timeout`
- `warning` (REAL): Warning threshold level
- `critical` (REAL): Emergency critical limit
- `enabled` (INTEGER / BOOLEAN): 1 if actively evaluated

---

## 2. Write Budget & Quota Optimization Strategy
To operate cost-effectively on Google Cloud Firestore free-tier quotas (50,000 writes/day):
- Real-time readings are pushed instantly over Socket.IO on every tick (2s).
- Telemetry is only persisted to long-term `readings` history every `HISTORY_INTERVAL_SEC` (default 10s) per worker.
- **Immediate Write Override**: If a packet contains an alert, SOS button press, or fall impact, it bypasses the interval check and writes immediately.
