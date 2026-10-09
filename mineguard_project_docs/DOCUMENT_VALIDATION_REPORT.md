# DOCUMENT VALIDATION REPORT
**MineGuard Smart Helmet Safety & Health Telemetry System**
*Document Validation & Architectural Alignment against Implementation Documents (`mineguard_project_docs/`)*

---

## 1. Repository State

### 1.1 Git Branch & Monorepo Status
- **Current Active Git Branch**: `main` (at commit `42e1658`: *"Initial commit"*).
- **Available Branches in Repository**:
  - `main` (active local branch tracking `origin/main`)
  - `origin/smart-helmet` (remote tracking branch at commit `a16be82`: *"Fix client folder tracking"*)
- **Complete Monorepo Verification**:
  - Remote branch `origin/smart-helmet` **confirmed** to contain the complete, unified monorepo:
    - Root `package.json` with npm workspaces (`"workspaces": ["server", "client"]`)
    - `client/` (React 18, Vite 5, Tailwind CSS dashboard)
    - `server/` (Express 4.19, Socket.IO 4.7, SQLite/Firestore adapters, alert & trend engines)
    - `firmware-samples/` (`esp32_wifi_post.ino`)
    - `sketch_oct2a/` (`sketch_oct2a.ino`)
    - `docs/` (`API.md`, `DB_SCHEMA.md`, `DEPLOY.md`, `LORA_UPGRADE.md`)
    - `server/data/mineguard.db` (Seeded 4.05 MB SQLite database)

### 1.2 Working Tree Alignment
- **Architecture Alignment Status**: **CONTRADICTED / UNALIGNED**.
- **Discrepancy**:
  The active working tree on `main` contains only the detached frontend files at the root of `Smart-Helmet/` (with committed `node_modules/.vite` build artifacts). The backend (`server/`), firmware (`firmware-samples/`, `sketch_oct2a/`), documentation (`docs/`), and embedded database (`server/data/mineguard.db`) do **not exist on disk in the current working directory**.
- **Uncommitted Changes**:
  - Untracked directory: `mineguard_project_docs/` (the implementation documents under review).
  - Working tree is otherwise clean with no staged or modified files.
- **Active Project Directories on Disk**:
  `Smart-Helmet/src/`, `Smart-Helmet/public/`, `Smart-Helmet/dist/`, `Smart-Helmet/node_modules/`, `Smart-Helmet/mineguard_project_docs/`.
- **Architectural Requirement**:
  Before any code, configuration, or model changes can be made, the repository must be checked out to branch `smart-helmet` (or `main` must be merged/fast-forwarded from `origin/smart-helmet`).

---

## 2. Architecture Validation

Comparison of `01_ARCHITECTURE.md` against real codebase implementation:

```
ESP32/firmware ──> HTTP POST /api/readings ──> Express backend ──> validation ──> cache/trend/alerts ──> SQLite/Firestore ──> Socket.IO ──> React dashboard
```

| Pipeline Stage | Codebase Reference | Audit Status | Technical Evidence & Verification |
|---|---|---|---|
| **1. ESP32 / Firmware Acquisition** | `firmware-samples/esp32_wifi_post.ino`, `sketch_oct2a/sketch_oct2a.ino` | **CONFIRMED** | Both firmware versions read DHT11 (temp/hum), MQ-2 (gas mV), MQ-5 (gas mV), optical pulse/heart rate, and SOS button (GPIO 27 ISR). `sketch_oct2a` also reads BMP280. Both include local buzzer failsafe (`checkLocalAlerts` / `checkBuzzer`). |
| **2. HTTP Ingestion (`/api/readings`)** | `firmware-samples/esp32_wifi_post.ino#L264`, `sketch_oct2a/sketch_oct2a.ino#L318` | **CONFIRMED** | Firmware uses `HTTPClient` to send JSON via HTTP POST to `SERVER_URL` with header `x-api-key: mineguard_device_secret_key_2026`. |
| **3. Express Backend Entry & Routing** | `server/src/index.js#L143-L208` | **CONFIRMED** | Node.js Express 4.19.2 defines `app.post('/api/readings', deviceLimiter, verifyDeviceApiKey, ...)`. Rate limiter allows up to 60 req/s globally. |
| **4. Ingestion Validation** | `server/src/index.js#L48-L70` | **CONFIRMED** | Validates incoming payloads using Zod (`sensorReadingSchema.safeParse(req.body)`). Rejects malformed types with HTTP 400. |
| **5. Cache, Trend & Alert Processing** | `server/src/index.js#L162-L172`, `server/src/services/alertEngine.js`, `server/src/services/trendService.js` | **CONFIRMED** | Maintains in-memory `recentReadingsCache` (last 30 readings window per worker). `AlertEngine.evaluate()` executes threshold checks, rapid slope breach detection via `predictTimeToThreshold()`, and cooldown deduplication. |
| **6. Database Persistence** | `server/src/index.js#L174-L188`, `server/src/db/sqliteAdapter.js`, `server/src/db/firebaseAdapter.js` | **PARTIALLY CONFIRMED** | Dual storage adapter pattern (`DB_MODE=sqlite` or `firebase`) with write-budget throttling (persists every 10s or on alert). **Limitation**: `sqliteAdapter.js` drops BMP280 `pressure` during INSERT. |
| **7. Real-Time Broadcast** | `server/src/index.js#L190`, `server/src/services/alertEngine.js#L201` | **CONFIRMED** | Server emits `io.emit('reading', reading)` and `io.emit('alert', alert)` to all connected browser clients. |
| **8. React Dashboard Streaming** | `client/src/context/AppContext.jsx#L81-L120`, `client/src/services/api.js` | **CONFIRMED** | `AppContext` subscribes to Socket.IO events (`reading`, `alert`, `worker_status`), updates `workersLatest` state, sounds Web Audio siren, and launches `FullscreenSosOverlay`. |
| **9. MQTT Protocol Absence** | Entire repository | **CONFIRMED** | `01_ARCHITECTURE.md` correctly states that MQTT is absent. No MQTT broker, client library (`PubSubClient` or `mqtt.js`), or topics exist anywhere in code. |

---

## 3. Data Contract Validation

Comparison of `02_CURRENT_DATA_CONTRACT.md` against firmware payloads, backend Zod schema, database adapters, API routes, Socket.IO broadcasts, and frontend consumers:

| Field | Firmware Payload | Backend Zod Schema | Database Persistence | API & Socket.IO | Frontend Consumer | Unit | Status |
|---|---|---|---|---|---|---|---|
| `mq2_mv` | Emitted (`currentData.mq2_mv`) | `z.number().nullable().optional()` | SQLite: `mq2_mv REAL`<br>Firestore: field `mq2_mv` | `/api/readings/latest`<br>`/api/readings/history`<br>WS: `reading` | `Overview.jsx` (gas meter)<br>`WorkerDetail.jsx` (cards/charts) | mV (0–3300) | **CONFIRMED** (Functional electrical mV index; uncalibrated) |
| `mq5_mv` | Emitted (`currentData.mq5_mv`) | `z.number().nullable().optional()` | SQLite: `mq5_mv REAL`<br>Firestore: field `mq5_mv` | `/api/readings/latest`<br>`/api/readings/history`<br>WS: `reading` | `WorkerDetail.jsx` (cards/charts) | mV (0–3300) | **CONFIRMED** (Functional electrical mV index; uncalibrated) |
| `temperature` | Emitted (`temp` / `temperature`) | `z.number().nullable().optional()` | SQLite: `temperature REAL`<br>Firestore: field `temperature` | `/api/readings/latest`<br>`/api/readings/history`<br>WS: `reading` | `Overview.jsx`, `WorkerDetail.jsx`, `FullscreenSosOverlay.jsx` | °C | **CONFIRMED** (Functional) |
| `humidity` | Emitted (`hum` / `humidity`) | `z.number().nullable().optional()` | SQLite: `humidity REAL`<br>Firestore: field `humidity` | `/api/readings/latest`<br>`/api/readings/history`<br>WS: `reading` | `WorkerDetail.jsx` | % RH | **CONFIRMED** (Functional) |
| `pressure` | Emitted only in `sketch_oct2a.ino` | `z.number().nullable().optional()` | **DROPPED IN SQLITE**<br>Preserved in Firestore | `/api/readings/latest`<br>WS: `reading`<br>*Missing from history* | `Overview.jsx` (live card)<br>`WorkerDetail.jsx` (live gauge) | hPa | **CONTRADICTED / PARTIAL** (Live functional; discarded by SQLite adapter) |
| `heart_rate` | Emitted (HW-827 / MAX30102) | `z.number().nullable().optional()` | SQLite: `heart_rate REAL`<br>Firestore: field `heart_rate` | `/api/readings/latest`<br>`/api/readings/history`<br>WS: `reading` | `Overview.jsx`, `WorkerDetail.jsx`, `FullscreenSosOverlay.jsx` | BPM | **CONFIRMED** (Functional) |
| `spo2` | Emitted (HW-827 nominal / MAX30102) | `z.number().nullable().optional()` | SQLite: `spo2 REAL`<br>Firestore: field `spo2` | `/api/readings/latest`<br>`/api/readings/history`<br>WS: `reading` | `WorkerDetail.jsx`, `FullscreenSosOverlay.jsx` | % | **CONFIRMED** (Functional) |
| `ldr_raw` | Emitted (`analogRead(LDR_PIN)`) | `z.number().nullable().optional()` | SQLite: `ldr_raw REAL`<br>Firestore: field `ldr_raw` | `/api/readings/history`<br>WS: `reading` | `WorkerDetail.jsx` (chartData) | ADC (0–4095) | **CONFIRMED** (Functional) |
| `sos` | Emitted (`digitalRead(SOS_PIN)`) | `z.boolean().optional().default(false)` | SQLite: `sos INTEGER`<br>Firestore: field `sos` | `/api/readings/latest`<br>WS: `reading` & `alert` | `FullscreenSosOverlay.jsx`, siren beep, danger banner | Boolean | **CONFIRMED** (Functional hardware interrupt) |
| `fall` | Hardcoded `false` in firmware | `z.boolean().optional().default(false)` | SQLite: `fall INTEGER`<br>Firestore: field `fall` | Handled by `AlertEngine`<br>WS: `alert` | Alert handlers exist in UI | Boolean | **MOCKED** (Hardcoded `false` in firmware; no sensor) |
| `battery` | Hardcoded `85` / `88` in firmware | `z.number().nullable().optional()` | SQLite: `battery REAL`<br>Firestore: field `battery` | `/api/readings/latest`<br>WS: `reading` | `Overview.jsx`, `WorkerDetail.jsx` | % | **HARDCODED** (Static estimate; no ADC divider) |
| `rssi` | Emitted (`WiFi.RSSI()`) | `z.number().nullable().optional()` | SQLite: `rssi REAL`<br>Firestore: field `rssi` | `/api/readings/latest`<br>WS: `reading` | `Overview.jsx`, `WorkerDetail.jsx` | dBm | **CONFIRMED** (Functional) |
| `snr` | `null` over Wi-Fi | `z.number().nullable().optional()` | SQLite: `snr REAL`<br>Firestore: field `snr` | Database / CSV export | Not rendered directly | dB | **CONFIRMED** (LoRa-ready schema field) |

---

## 4. ML Requirements Validation

Assessment of `03_ML_REQUIREMENTS.md` against real codebase capabilities:

### 4.1 Live Gas Measurement Representation
- **Codebase Reality**: Live telemetry transmits `mq2_mv` and `mq5_mv` (millivolts, `0–3300 mV`) alongside raw 12-bit ADC integers (`mq2_raw`, `mq5_raw`, `0–4095`).
- **Physical Sensor Reality**: MQ-2 and MQ-5 are tin dioxide ($SnO_2$) metal oxide semiconductor (MOS) sensors. Their output voltage varies inversely with surface electrical resistance ($R_s$) in the presence of deoxidizing combustible gases.
- **Scientific Reality**: The firmware executes **zero physical sensor calibration**. There is no baseline fresh-air resistance measurement ($R_0$), no temperature/humidity polynomial compensation, and no curve-fit equation mapping sensor resistance ratio ($R_s/R_0$) to volumetric concentration (% CH4) or PPM.

### 4.2 Sampling Interval & Historical Data Retention
- **Firmware Transmission Cadence**:
  - `esp32_wifi_post.ino#L59`: `POST_INTERVAL_MS = 10000` (10 seconds normal cadence).
  - `sketch_oct2a.ino#L49`: `POST_INTERVAL_MS = 10000` (10 seconds normal cadence).
  - `simulator/simulate.js#L7`: `INTERVAL_MS = 4000` (4 seconds synthetic cadence).
- **Backend Persistence Cadence**:
  - `server/src/index.js#L26`: `HISTORY_INTERVAL_SEC = 10` (10 seconds write budget).
- **Public Training Dataset Cadence**:
  - `methane_data/methane_data.csv`: Continuous **1.0-second observations** (1.0 Hz) from stationary telemetric monitoring stations.
- **Temporal Frequency Mismatch**: The public training data has a $10\times$ higher sampling rate than physical helmet packets. The training pipeline must downsample/resample the dataset to 10-second intervals to prevent massive temporal distortion.

### 4.3 Feature Calculation Feasibility
- **Feasible Candidate Features**:
  - Rolling moving averages (5-point, 10-point windows) of `mq2_mv` / `mq5_mv`.
  - Linear regression slopes ($\Delta \text{mV} / \Delta t$) over sliding windows (already prototyped in `trendService.js`).
  - Standardized anomaly z-scores: $(x_t - \mu_{\text{window}}) / \sigma_{\text{window}}$.
  - Ambient climate features: `temperature`, `humidity`.
- **Infeasible / Dropped Features**:
  - `pressure`: Currently dropped by the SQLite adapter. It cannot be used as an ML feature until `sqliteAdapter.js` is corrected.
  - Vitals (`heart_rate`, `spo2`) and light (`ldr_raw`): Completely absent from the coal mine training dataset. `03_ML_REQUIREMENTS.md` correctly forbids their inclusion.

### 4.4 The Critical Scientific Domain Gap
> [!CAUTION]
> **CRITICAL SCIENTIFIC VALIDATION WARNING**:
> - The public training dataset (`methane_data.csv`) records **calibrated physical methane percentages** (`MM263`, `0.0%` to `2.5% CH4`) from certified optical/catalytic mine meters.
> - The live smart helmet emits **uncalibrated electrical voltages** (`mq2_mv`, `1200` to `2500 mV`) from low-cost MOS sensors.
> - **A model trained directly to predict absolute values or thresholds on physical `% CH4` CANNOT ingest raw millivolts.** Doing so would pass inputs orders of magnitude outside the model's training distribution, resulting in completely invalid predictions.
> - **Mandatory Bridge Requirement**: The ML pipeline must either:
>   1. Implement a clean air baseline calibration ($R_0$) in firmware/backend to transform millivolts into estimated PPM and % CH4; OR
>   2. Train the model exclusively on **dimensionless, normalized relative temporal dynamics** (e.g., relative rate of change $\frac{\Delta x}{x_{\text{baseline}}}$, z-scores, normalized acceleration) so that physical sensor surge dynamics match normalized electrical surge dynamics.

---

## 5. ML Data Pipeline Validation

Assessment of `04_ML_DATA_PIPELINE.md` and `05_ML_MODEL_SPEC.md`:

### 5.1 Training Dataset Schema & Metadata Verification
- **Verified Source File**: `methane_data/methane_data.csv` (1,100,913,052 bytes / ~1.10 GB; 2014 telemetric data).
- **Verified Metadata** (`attribute_information.txt`):
  - Target Methane Sensors: `MM263`, `MM264`, `MM256` explicitly tagged as `!target sensor!` (measuring `% CH4`, warning threshold $W = 1.0\%$, alarm threshold $A = 1.5\%$).
  - Atmospheric Telemetry: `TP1721` / `TP1711` (temperature in °C), `RH1722` / `RH1712` (relative humidity in % RH), `BA1723` / `BA1713` (barometric pressure in hPa), `AN311` / `AN422` / `AN423` (anemometers in m/s).
  - Machine Cutting Extraction: `AMP1_IR` to `AMP5_IR` (cutter loader currents in A), `V` (cutter loader speed in m/min).

### 5.2 Training Label & Horizon Creation
- `04_ML_DATA_PIPELINE.md` specifies creating a forward-looking early warning target:
  $$y_t = \mathbb{I}\left(\max_{k \in [t+1, t+H]} (\text{TargetGas}_k) \ge \text{Threshold}\right)$$
- For an early-warning horizon of $H = 5\text{ to }15\text{ minutes}$ (30 to 90 steps at 10-second downsampled cadence), this binary target is mathematically well-defined and can be extracted directly from `MM263`.

### 5.3 Leakage Controls & Imbalance Handling
- Chronological train/validation/test splitting (e.g., Months 1–2 train, Month 3 val, Month 4 test) is strictly required to prevent temporal autocorrelation leakage. Random cross-validation shuffling would cause catastrophic data leakage.
- Class weighting (`class_weight='balanced'`) must be applied inside model training rather than synthetic oversampling (SMOTE) on time-series records.

---

## 6. ML Service Validation

Assessment of `06_ML_INFERENCE_API.md`:

### 6.1 Architectural Decoupling & Node.js Integration
- **Proposed Architecture**: An isolated Python FastAPI microservice running under Uvicorn on internal port `8000`, exposing `POST /predict/gas-trend`.
- **Express Ingestion Hook**:
  In `server/src/index.js` inside `app.post('/api/readings')`:
  ```javascript
  // After saving latest reading and cache update:
  const historyWindow = recentReadingsCache.get(reading.worker_id);
  // Asynchronous non-blocking call with abort controller (timeout: 500ms):
  fetch('http://localhost:8000/predict/gas-trend', { ... })
    .then(res => res.json())
    .then(mlPrediction => io.emit('ml_gas_prediction', mlPrediction))
    .catch(err => console.warn('[ML Service] Inference unavailable:', err.message));
  ```
- **Failure Mode & Graceful Degradation**:
  - Telemetry ingestion HTTP response (`201 Created`) is dispatched independently without awaiting ML completion.
  - Deterministic threshold checks in `AlertEngine` continue to evaluate `mq2_mv` and `mq5_mv` directly.
  - Local hardware buzzer alarms on ESP32 continue to operate independently of network and ML availability.
- **Architectural Verdict**: **CONFIRMED & VALIDATED**. This represents the minimum safe architectural modification to the existing system.

---

## 7. Dashboard Validation

Assessment of `07_DASHBOARD_ML_INTEGRATION.md` against React frontend code:

| Component | Documented Requirement | Codebase Reality | Status |
|---|---|---|---|
| **Overview Header & Status** | Live sector status, KPI counters | Fully functional, driven by `workersLatest`, `activeAlerts`, and `summaryStats` in `AppContext.jsx`. | **IMPLEMENTED** |
| **Overview Miner Cards** | Live worker cards with metrics | Fully functional, dynamically re-rendered via `socket.on('reading')`. | **IMPLEMENTED** |
| **Overview Gas Dynamics Chart** | Real-time multi-worker gas trends | `AreaChart` in `Overview.jsx` (lines 560–569) is fed with an **inline hardcoded mock array**. It does not reflect live backend data. | **HARDCODED / MOCKED** |
| **Overview Mine Spatial Map** | Visual zone layout | SVG map in `Overview.jsx` (lines 448–503) contains **hardcoded static coordinates** for miners W1–W5. | **HARDCODED** |
| **Worker Detail Gauges** | Live gas, vitals, climate cards | Functional; displays live readings from Context and triggers audio siren. | **IMPLEMENTED** |
| **Worker Detail Historical Charts** | 1h/24h historical trends | Functional; calls `api.getReadingHistory()` to plot genuine SQLite/Firestore history points. | **IMPLEMENTED** |
| **Worker Detail Predictive Badge** | Gas trend insight | Functional; calls `api.getTrends()` to render linear regression slope and time-to-breach calculated by `trendService.js`. | **IMPLEMENTED (Statistical)** |
| **Analytics View (Heatmap/Scatter)**| Environmental trend analysis | Heatmap matrix, scatter plot, and risk leaderboard in `AnalyticsView.jsx` (lines 17–48) are **100% hardcoded mock constants** with zero API calls. | **MOCKED** |
| **Emergency SOS Overlay** | Fullscreen modal on incident | Functional; pops up immediately upon receiving SOS or critical alert over WebSocket. | **IMPLEMENTED** |

---

## 8. Vibration Validation

Assessment of `08_VIBRATION_MONITORING.md`:

- **Repository Code Search Results**:
  Exhaustive text searches across all branches, commits, and files for keywords (`MPU6050`, `accelerometer`, `vibration`, `ADXL`, `seismic`, `RMS`, `FFT`) yielded:
  1. A single commented line in `firmware-samples/esp32_wifi_post.ino#L192`:  
     `currentData.fall = false; // Add MPU6050 accelerometer impact evaluation here if equipped`
  2. A stubbed boolean in `sketch_oct2a/sketch_oct2a.ino#L197`:  
     `sensor.fall = false;`
- **Audit Finding**:
  - No physical vibration sensor model exists.
  - No firmware acquisition code exists.
  - No backend schema field exists.
  - No database storage column exists.
  - No dashboard UI component exists.
- **Validation Verdict**:
  `08_VIBRATION_MONITORING.md` is **100% ACCURATE**. Software implementation cannot proceed without deciding whether physical vibration hardware will be connected to fixed mine nodes.

---

## 9. Implementation Plan Validation

Assessment of each phase in `09_IMPLEMENTATION_PLAN.md`:

| Step / Phase | Planned Action | Current Status | Architectural Evaluation |
|---|---|---|---|
| **Phase 0.1** | Align working tree on branch `smart-helmet` | **READY** | Monorepo is verified on `origin/smart-helmet`. Simply requires git branch checkout. |
| **Phase 0.2** | Verify working tree before modifications | **READY** | Standard verification step. |
| **Phase 0.3** | Identify physical firmware version | **BLOCKED** | Unknown whether physical hardware runs `esp32_wifi_post.ino` (HW-827) or `sketch_oct2a.ino` (MAX30102 + BMP280). |
| **Phase 0.4** | Verify deployment target & storage mode | **NEEDS REVISION** | Must explicitly declare whether target is edge gateway (SQLite) or cloud (Firestore) to prioritize schema fixes. |
| **Phase 1.1** | Fix SQLite pressure persistence | **SAFE TO IMPLEMENT** | Straightforward fix: add `pressure REAL` to `CREATE TABLE` and SQL INSERT in `sqliteAdapter.js`. |
| **Phase 1.2** | Normalize firmware field naming | **READY** | Both firmwares already emit JSON key `"temperature"`; struct internal naming can remain internal. |
| **Phase 1.3** | Confirm MQ-5/MQ-2 calibration status | **BLOCKED** | No baseline fresh-air resistance ($R_0$) or physical calibration curves exist in repository. |
| **Phase 1.4** | Define live gas representation for ML | **NEEDS REVISION** | Must formally mandate a normalized relative dynamic feature contract to bridge raw mV to ML. |
| **Phase 2.1–2.6**| ML Dataset Pipeline & Training | **READY** | `methane_data.csv` is present, verified, and ready for chronological downsampling and training. |
| **Phase 3.1–3.5**| Python FastAPI Inference Service | **READY** | Cleanly decoupled architecture; standard FastAPI + Uvicorn service under `ml_service/`. |
| **Phase 4.1–4.4**| Express Async Ingestion Hook | **READY / SAFE** | Low-risk modification inside `server/src/index.js` using non-blocking fetch with short timeout. |
| **Phase 5.1–5.4**| Dashboard UI Integration | **READY** | Replace hardcoded mock data in `Overview.jsx` and `AnalyticsView.jsx` with real Socket.IO/REST endpoints. |
| **Phase 6.1–6.4**| Security Hardening | **READY** | Attach `verifyJwtAuth` to routes and remove hardcoded fallback secrets. |
| **Phase 7.1** | End-to-End Validation Testing | **READY** | Automated verification of ingestion, ML inference, and dashboard streaming. |

---

## 10. Test Plan Validation

Assessment of `10_TEST_AND_VALIDATION.md`:

- **Unit Tests**:
  - *Feasibility*: **READY**. Node.js native test runner (`node --test tests/**/*.test.js`) is already functional in `server/`. Python unit tests (`pytest`) can test feature generation and model inference.
- **Integration Tests**:
  - *Feasibility*: **READY**. Can test HTTP POST `/api/readings` triggering asynchronous FastAPI request and Socket.IO event dispatching.
- **Live Telemetry & Simulator Tests**:
  - *Feasibility*: **READY**. `server/src/simulator/simulate.js` generates multi-miner synthetic telemetry every 4 seconds.
- **Hardware Validation**:
  - *Feasibility*: **PARTIALLY BLOCKED**. Physical testing of gas surge response, optical SpO2, and BMP280 pressure requires physical ESP32 hardware. Physical testing of vibration and fall detection is **completely blocked** due to absent hardware.

---

## 11. Contradictions Identified

The following explicit contradictions exist between documentation, audit findings, codebase, firmware variants, and database schemas:

1. **Repository Branch Contradiction**:
   `01_ARCHITECTURE.md` and `README.md` describe a monorepo containing `server/`, `client/`, and firmware, but the local working tree is on branch `main` where only client files exist at root.
2. **Firmware Sensor & Payload Contradiction**:
   `firmware-samples/esp32_wifi_post.ino` uses the HW-827 pulse sensor and lacks BMP280, while `sketch_oct2a/sketch_oct2a.ino` uses MAX30102 and BMP280. They transmit different JSON payloads (pressure is present in one, absent in the other).
3. **Database Pressure Persistence Contradiction**:
   `02_CURRENT_DATA_CONTRACT.md` describes pressure as a live telemetry field, but `server/src/db/sqliteAdapter.js` drops `pressure` from the SQL insert statement and lacks a database column.
4. **Gas Telemetry Physical Domain Contradiction**:
   The public dataset (`methane_data.csv`) records calibrated volumetric concentration (`% CH4`), whereas live helmet telemetry emits raw, uncalibrated electrical millivolts (`mq2_mv`, `mq5_mv`).
5. **Sampling Frequency Contradiction**:
   The public training dataset is sampled at **1.0 Hz** (1 second), whereas physical helmet firmware transmits at **0.1 Hz** (10 seconds).
6. **Vibration / Seismic Claim Contradiction**:
   Project requirements document fixed-zone vibration monitoring, but zero implementation or hardware interfacing exists anywhere in the repository.
7. **Fall Detection Claim Contradiction**:
   Backend alert engines and UI components support man-down `FALL` incidents, but firmware hardcodes `fall = false`.
8. **Overview Chart Dynamic Appearance Contradiction**:
   `Overview.jsx` renders a multi-miner gas dynamics chart that appears dynamic to users but is fed by static hardcoded mock numbers.
9. **Analytics View Implementation Contradiction**:
   `AnalyticsView.jsx` displays full heatmaps, correlation plots, and hazard leaderboards, but 100% of the underlying data is hardcoded mock constants with zero API connectivity.
10. **API Security Specification Contradiction**:
    `docs/API.md` states administrative routes are protected by Bearer JWT tokens, but `server/src/index.js` leaves all worker, threshold, and alert routes completely unauthenticated.

---

## 12. Implementation Blockers

The following issues **must be resolved** before beginning implementation:

### Blocker 1: Repository Branch Alignment
- **Why it matters**: Development cannot occur on branch `main` because the backend, firmware, and database files do not exist in the working tree.
- **What decision is required**: Switch working branch to `smart-helmet` (e.g. `git checkout smart-helmet`).
- **Who/What can resolve it**: Developer / User approval to switch branches.

### Blocker 2: Live Gas Telemetry vs. Training Dataset Domain Mismatch
- **Why it matters**: An ML model trained on physical `% CH4` cannot evaluate raw electrical millivolts (`mq2_mv`) without causing extreme prediction errors.
- **What decision is required**: Formally decide the mathematical bridging strategy:
  - *Option A*: Obtain physical $R_0$ clean-air calibration constants for the physical hardware to convert mV to estimated PPM and % CH4; OR
  - *Option B*: Formally mandate that the ML pipeline uses **dimensionless, normalized relative temporal features** ($\Delta x / x$, relative slope, z-scores) so the model predicts relative gas surge dynamics rather than absolute concentrations.
- **Who/What can resolve it**: Project Architect and Hardware Engineering Team.

### Blocker 3: Authoritative Firmware Variant Selection
- **Why it matters**: `firmware-samples/esp32_wifi_post.ino` and `sketch_oct2a/sketch_oct2a.ino` use different sensors and schemas.
- **What decision is required**: Declare whether `sketch_oct2a.ino` (v2.2 with MAX30102 and BMP280) is the official authoritative firmware for physical deployment.
- **Who/What can resolve it**: Hardware Team / Project Lead.

### Blocker 4: Vibration Sensor Hardware Scope
- **Why it matters**: Software cannot be written for a sensor that has no hardware specification or electrical interface.
- **What decision is required**: Formally declare whether physical vibration hardware will be connected, or formally mark vibration monitoring as deferred / out-of-scope for the current implementation phase.
- **Who/What can resolve it**: Project Lead / Client Stakeholder.

### Blocker 5: Target Database Engine & SQLite Pressure Fix
- **Why it matters**: If SQLite edge deployment is selected, BMP280 pressure cannot be used as an ML feature until `sqliteAdapter.js` schema is updated.
- **What decision is required**: Authorize adding `pressure REAL` to `sqliteAdapter.js` table creation and SQL insert statements.
- **Who/What can resolve it**: Implementation Architect.

---

## 13. Required Document Corrections

The implementation documents in `mineguard_project_docs/` require the following specific adjustments:

1. **In `02_CURRENT_DATA_CONTRACT.md`**:
   - Explicitly document that BMP280 `pressure` is currently omitted from `firmware-samples/esp32_wifi_post.ino` and only exists in `sketch_oct2a/sketch_oct2a.ino`.
   - Update the ML bridge strategy section to formally adopt **Option B (Normalized Relative Dynamic Features)** as the primary engineering solution, recognizing that physical hardware clean-air calibration ($R_0$) is not available.
2. **In `03_ML_REQUIREMENTS.md` & `05_ML_MODEL_SPEC.md`**:
   - Clarify the prediction target: The model will predict a **binary gas surge early warning** (probability of significant relative gas escalation within the next 5–15 minutes) based on normalized sequence features, rather than absolute physical concentration.
3. **In `08_VIBRATION_MONITORING.md`**:
   - Add an explicit status note: *"Vibration monitoring is deferred to Phase 2 due to absence of physical sensor hardware. No software stubs or mock charts will be introduced in the current phase."*
4. **In `09_IMPLEMENTATION_PLAN.md`**:
   - Add Step 0.0: Execute `git checkout smart-helmet` to align the physical working directory before modifying any files.
   - Update Phase 1.1: Detail the exact SQL schema change required in `sqliteAdapter.js` (`ALTER TABLE readings ADD COLUMN pressure REAL`).

---

## 14. Final Validation Result

### **C. BLOCKED BY HARDWARE/DATA DECISIONS**

### Architectural Decision Rationale:
1. **The Software Architecture is Solid**: The Node.js Express backend, dual storage adapters, Socket.IO streaming, and proposed FastAPI Python microservice design are thoroughly decoupled, modular, and ready for integration.
2. **The Hardware/Data Bridge is Blocked**: Implementation of the ML training pipeline cannot begin until the stakeholder formally ratifies the **mathematical bridging strategy** between the 1.1 GB physical `% CH4` coal mine dataset and the helmet's raw electrical millivolt telemetry (`mq2_mv`). Specifically, the team must confirm that the ML model will learn **relative normalized dynamic surge patterns** rather than absolute concentration thresholds.
3. **Firmware & Repository Realignment is Required**: The authoritative firmware variant (`sketch_oct2a.ino` vs `esp32_wifi_post.ino`) must be confirmed, and the local git working tree must be switched to branch `smart-helmet` before modifying any files.

*Upon stakeholder confirmation of the normalized relative feature approach and checkout of branch `smart-helmet`, this project immediately transitions to **READY FOR IMPLEMENTATION**.*

---
*Report generated and validated by Implementation Architect. No application source code, firmware, package files, or database schemas were modified.*
