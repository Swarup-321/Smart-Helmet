# FINAL IMPLEMENTATION CONTRACT
**MineGuard Smart Helmet Safety & Telemetry System**
*Master Technical Specification & Execution Contract for Future Implementation Agent*

---

## 1. WHAT WE ARE BUILDING
We are building an **ML-based Gas-Surge Early Warning System** seamlessly integrated into the existing MineGuard Smart Helmet IoT architecture.

The implementation consists of:
1. An offline Python training pipeline that downsamples the 1.1 GB coal mine dataset (`methane_data/methane_data.csv`) to a 10-second cadence and trains a binary gas-surge classifier on normalized relative dynamic features.
2. A lightweight, asynchronous Python FastAPI microservice running on `http://localhost:8000` serving real-time predictions via `POST /predict/gas-trend`.
3. An asynchronous Express hook that passes sliding telemetry windows to the ML service without blocking main ingestion, broadcasting results via a dedicated `ml_gas_prediction` Socket.IO event.
4. A first-class dashboard integration in React that replaces hardcoded mock charts with live multi-worker telemetry and presents a clear, advisory **ML Gas-Surge Early Warning Panel**.

---

## 2. WHAT ALREADY EXISTS (DO NOT RE-INVENT)
The implementation agent must build upon the following verified components:
- **Repository**: Complete monorepo on branch `smart-helmet` with npm workspaces (`server`, `client`).
- **ESP32 Firmware**: Dual functional firmware samples (`sketch_oct2a/sketch_oct2a.ino` with MAX30102 + BMP280, and `firmware-samples/esp32_wifi_post.ino` with HW-827 pulse).
- **Backend Ingestion**: Node.js Express 4.19 server (`server/src/index.js`) receiving telemetry at `POST /api/readings` with Zod validation and `x-api-key` verification.
- **Dual Storage Adapters**: Pluggable storage architecture (`server/src/db/adapter.js`) supporting embedded SQLite (`server/data/mineguard.db`) and Google Cloud Firestore.
- **Write-Budget Throttler**: Ingestion pipeline writing to long-term database history every 10 seconds or immediately on alert/SOS.
- **Real-Time Streaming**: Socket.IO 4.7 server emitting live `reading` and `alert` events to browser clients.
- **Supervisor Dashboard**: React 18 + Vite 5 + Tailwind CSS SPA (`Overview.jsx`, `WorkerDetail.jsx`, `AlertsView.jsx`, `SettingsView.jsx`, `FullscreenSosOverlay.jsx`).
- **Deterministic Alert Engine**: `server/src/services/alertEngine.js` evaluating gas thresholds (2000/2500 mV), vitals, and SOS with cooldown deduplication.
- **Statistical Trend Baseline**: `server/src/services/trendService.js` computing linear regression slope and moving averages in pure JavaScript.
- **Telemetry Simulator**: `server/src/simulator/simulate.js` generating live multi-miner packets every 4 seconds.

---

## 3. WHAT MUST CHANGE
Only the following targeted changes are authorized:
1. **`server/src/db/sqliteAdapter.js`**:
   - Add `pressure REAL` to `CREATE TABLE IF NOT EXISTS readings`.
   - Update `saveReadingHistory` and `saveReadingHistoryBatch` to insert `reading.pressure ?? null`.
2. **`ml_service/` (New Microservice Directory)**:
   - Create dataset pipeline script to downsample `methane_data.csv` ($1\text{s} \to 10\text{s}$), extract strictly dimensionless, scale-invariant relative dynamic features ($CV$, relative deltas, normalized slope, and environmental differentials; banning absolute gas concentrations and raw rolling statistics), train binary classifier, and save artifacts.
   - Create FastAPI microservice (`main.py`) exposing `POST /predict/gas-trend` and `GET /health`.
   - Export serialized models: `gas_trend_model.joblib`, `scaler_pipeline.joblib`, `model_metadata.json`.
3. **`server/src/index.js`**:
   - In `app.post('/api/readings')`, add an asynchronous non-blocking fetch to `http://localhost:8000/predict/gas-trend` with a 500 ms timeout.
   - Emit `ml_gas_prediction` over Socket.IO upon receiving prediction results.
4. **`client/src/components/Overview.jsx`**:
   - Replace the hardcoded inline mock array in the gas dynamics chart (lines 560–569) with dynamic multi-miner trend data.
   - Add a dedicated **ML Gas-Surge Early Warning Panel** displaying surge risk level, surge probability, and stale state.
5. **`client/src/components/WorkerDetail.jsx`**:
   - Add ML surge prediction metrics to the predictive card alongside existing historical charts.
6. **`client/src/components/AnalyticsView.jsx`**:
   - Clean up unbacked hardcoded mock constants; display only backend-supported metrics.

---

## 4. WHAT MUST NOT CHANGE
- **DO NOT** introduce MQTT. Telemetry ingestion is strictly HTTP POST; frontend streaming is strictly Socket.IO.
- **DO NOT** replace Express with Python for core telemetry ingestion. Node.js remains the primary gateway.
- **DO NOT** remove or redesign the Google Cloud Firestore adapter.
- **DO NOT** bypass, delay, or modify deterministic safety rules (local hardware buzzer, millivolt thresholds, SOS button).
- **DO NOT** touch the emergency SOS modal workflow or audio alarm siren.
- **DO NOT** change core port assignments: Backend (`5000`), Client (`5173`), ML Service (`8000`).

---

## 5. ML OBJECTIVE
- **Task**: **BINARY GAS-SURGE EARLY WARNING**.
- **Definition**: Given recent normalized temporal gas sensor dynamics, predict whether a significant gas escalation event will occur within the next **5 to 15 minutes** ($H = 30\text{ to }90$ downsampled steps).
- **Output**: `surge_probability` $[0.0, 1.0]$ and `surge_risk_level` (`NORMAL`, `ELEVATED_SURGE_RISK`, `CRITICAL_SURGE_RISK`).
- **PROHIBITION**: Never output physical concentration estimates (% CH4 or PPM) from uncalibrated millivolts.

---

## 6. DATA CONTRACT & BRIDGING STRATEGY (PHASE 2.1 & 2.2 RATIFIED)
- **Live Inputs**: `mq2_mv` strictly bound (uncalibrated electrical potential, 0–3300 mV). Silent fallback to `mq5_mv` is strictly prohibited.
- **Bridge Strategy**: Dimensionless relative temporal dynamic features (Phase 2.1 scale-invariance ratification):
  - Relative deltas: $\frac{x_t - x_{t-k}}{\mu_{\text{rolling}}}$ (5m, 10m)
  - Relative ratio: $\frac{\mu_{5m}}{\mu_{10m}} - 1.0$
  - Relative rate of change: $\frac{x_t - x_{t-6}}{\mu_{5m}}$
  - Normalized regression slope: $\frac{\text{slope}_{5m}}{\mu_{5m}}$
  - Coefficient of variation: $CV = \frac{\sigma}{\mu}$ (5m, 10m)
  - Standardized anomaly score: $z_t = \frac{x_t - \mu_{5m}}{\max(\sigma_{5m}, \epsilon)}$
  - Relative range: $\frac{\max - \min}{\mu_{5m}}$
  - Volatility ratio: $\frac{\sigma_{5m}}{\sigma_{10m}}$
  - Ambient climate differentials: $\frac{\Delta P}{P_{10m}}$, $\Delta T_{10m}$, $\Delta RH_{10m}$
  - *Prohibition*: Scale-dependent absolute rolling statistics ($\mu_{5m}$, $\sigma_{5m}$, etc.) are strictly excluded.
- **Cadence**: 10 seconds. Training data downsampled from 1s to 10s.

---

## 7. VIBRATION SCOPE
- **Status**: **DEFERRED TO PHASE 2**.
- **Rule**: Do **not** create fake vibration readings, mock charts, or software stubs in Phase 1. Vibration hardware does not currently exist.

---

## 8. IMPLEMENTATION STATUS & ORDER
- **Phase 1 (Completed)**: SQLite `pressure REAL` schema updated in `sqliteAdapter.js`. Ingestion & adapter test suites passing.
- **Phase 2 (Completed)**: Python training pipeline implemented, dataset resampled ($1\text{s} \to 10\text{s}$), model trained on chronological split.
- **Phase 2.1 (Completed)**: ML mathematical scale-invariance audit resolved feature domain mismatch; pipeline and microservice refactored to 13 dimensionless relative features.
- **Phase 2.2 (Completed)**: Sensor-domain validation and readiness audit completed. Model classified as **EXPERIMENTAL RESEARCH PROTOTYPE (ADVISORY-ONLY)**; **NOT READY** for autonomous life-safety alerting.
- **Phase 3 (Next - Subject to Approval)**: Implement Express integration with strict Phase 2.2 guardrails:
  1. Non-authoritative advisory status: Predictions must never trigger hardware buzzers, sirens, or evacuation routines.
  2. Deterministic primacy: Hardware millivolt thresholds ($2000/2500\text{ mV}$) retain 100% independent authority.
  3. Strict single-channel binding: Bind to `mq2_mv` only.
  4. Multi-step persistence filter: Require $\ge 3$ consecutive cycles of elevated risk before raising advisory alerts.
  5. Non-blocking asynchronous Express hook with graceful degradation on ML timeout/failure.
- **Phase 4**: Connect React dashboard (advisory-only surge trend badge, eliminate mock arrays).
- **Phase 5**: Pre-production security hardening and full regression testing.

---

## 9. KNOWN LIMITATIONS & SCIENTIFIC FINDINGS (DO NOT CONCEAL)
1. **Sensor Domain Transfer Gap (Phase 2.2 Finding)**:
   - Training sensor (`MM263`) is an industrial stationary methanometer (`MM-2PWk`) calibrated linearly for % CH4 ($0-5\%$).
   - Live helmet sensor (`MQ-2`) is a broad-spectrum tin-dioxide chemiresistor exhibiting power-law response ($R_s/R_0 = A \cdot C^B$) and cross-sensitivity to multiple combustible gases.
   - Scale-invariant features resolve mathematical unit scale differences, but cannot eliminate physical semiconductor non-linearities, thermal drift, or ambient interference.
2. **Operational False Alarm Burden (Phase 2.2 Finding)**:
   - Holdout test evaluation demonstrates that while the model detects 66.7% of physical surge episodes with 8.0 minutes of advance lead time, continuous scoring produces ~76.3 false alarm episodes per 24 hours (Precision: 1.08%).
   - Direct integration as an active safety warning would cause severe alarm fatigue. The model is strictly an **Advisory Research Prototype**.
3. **Firmware ADC Sampling**:
   - ESP32 telemetry transmits single-sample instantaneous ADC readings without hardware/software digital oversampling or filtering, making raw readings vulnerable to noise spikes ($\sigma = 0.05$ noise drops ROC-AUC to 0.547).
4. **Uncalibrated MOS Sensors**: MQ-2 and MQ-5 output raw millivolts; physical PPM / % CH4 conversion is not supported without sensor-specific $R_0$ clean air calibration.
5. **CO Sensor Absent**: No dedicated Carbon Monoxide sensor exists.
6. **Fall Detection Stubbed**: Firmware hardcodes `fall: false` (accelerometer not connected).
7. **Authoritative Firmware Note**: `sketch_oct2a.ino` is preferred, but requires physical workbench confirmation before flashing.

---

## 10. VALIDATION REQUIREMENTS
Every phase must satisfy the acceptance criteria in `10_TEST_AND_VALIDATION.md`:
- Model outputs must represent predictive surge risk, not measured % CH4.
- Ingestion must degrade gracefully (zero dropped readings, zero alert delays) if the ML service times out or is offline.
- SQLite must successfully persist and return BMP280 atmospheric pressure.
- Dashboard must visibly distinguish advisory ML risk from deterministic threshold alerts.

---
*Contract ratified and finalized. The implementation agent must adhere strictly to these specifications without unapproved deviations.*
