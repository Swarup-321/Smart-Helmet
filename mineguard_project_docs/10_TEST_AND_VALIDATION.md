# 10 — Test and Validation Contract

This document defines the automated test requirements and acceptance criteria for the MineGuard Smart Helmet implementation.

---

## 1. ML Data Pipeline & Training Validation
- **Source Dataset Schema**: Automated check confirming `methane_data.csv` loads with expected columns and timestamp ordering.
- **Cadence Resampling**: Automated test verifying the dataset is downsampled from 1-second to 10-second intervals without temporal leakage.
- **Leakage Prevention**: Verify that scalers, transformers, and imputers are fit **strictly on the training partition** and only evaluated on validation/test sets.
- **Chronological Separation**: Test verifying zero overlap between Train, Validation, and Test time windows.
- **Reproducibility**: Pipeline script must execute end-to-end and generate `gas_trend_model.joblib` and `model_metadata.json` reproducibly.

---

## 2. ML Semantics & Risk-Output Validation
- **No Physical % CH4 Output**: Automated test verifying that the model output schema contains:
  - `surge_probability` (float between $0.0$ and $1.0$)
  - `surge_risk_level` (`NORMAL`, `ELEVATED_SURGE_RISK`, `CRITICAL_SURGE_RISK`)
  - **Explicit Negative Test**: Assert that the output does **not** contain fields named `measured_ch4`, `ch4_percentage`, `ppm`, or absolute concentration estimates.
- **Predictive Horizon**: Assert that the model evaluates early warning across the ratified $5\text{ to }15\text{ minute}$ window.

---

## 3. Python ML Inference API Validation (`POST /predict/gas-trend`)
- **Valid Inference Test**: Providing a valid 15-reading window returns HTTP 200 with complete surge probability and risk level.
- **Short Window Rejection**: Providing $< 10$ readings returns HTTP 400 with descriptive validation message.
- **Latency Benchmark**: Assert inference execution completes within $< 50\text{ ms}$ on standard CPU.
- **Health Check**: `GET /health` returns HTTP 200 with model version and operational status.

---

## 4. Backend Resilience & Graceful Degradation Tests
- **ML Timeout / Down Test**:
  - Simulate the Python ML service being completely offline (or timing out $> 500\text{ ms}$).
  - Send telemetry packet to `POST /api/readings`.
  - **Assertions**:
    1. HTTP POST `/api/readings` immediately responds with `201 Created`.
    2. Telemetry packet is successfully persisted to SQLite.
    3. Normal `reading` event is broadcast across Socket.IO.
    4. Deterministic threshold alerts (`GAS`, `HEALTH`, `SOS`) trigger normally.
    5. No unhandled promise rejection or crash occurs in Node.js.
- **Deterministic Alert Priority**:
  - Post packet with `mq2_mv: 2600` (above critical 2500 mV threshold) while ML service returns `surge_probability: 0.1` (low).
  - **Assertion**: Express immediately dispatches a `CRITICAL` gas alert regardless of ML output. ML never suppresses deterministic alarms.

---

## 5. Storage Schema & Pressure Persistence Validation
- **SQLite Pressure Test**:
  - Insert reading payload with `pressure: 1013.2`.
  - Query `readings` table from SQLite.
  - **Assertion**: Returned record contains `pressure: 1013.2` (verifying SQLite no longer drops pressure).
- **Dual Adapter Integrity**: Both SQLite and Firestore adapters pass all CRUD operations.

---

## 6. Dashboard Acceptance Validation
- **Elimination of Mock Gas Chart**: Verify that `Overview.jsx` gas dynamics chart is connected to live API/Socket.IO data and no longer contains the hardcoded inline mock array.
- **Visual Separation**: Verify that ML early warning predictions are displayed in a separate advisory panel and visually distinct from physical sensor cards.
- **Unit Integrity**: Verify that live MQ-2/MQ-5 values are labeled strictly with units of `mV`.
- **Stale State Handling**: When no ML prediction is received within 30 seconds, the dashboard explicitly displays "ML Advisory: Stale / Offline".
- **Emergency SOS Retained**: Verify that the fullscreen SOS overlay, audio siren beep, and emergency contacts remain 100% operational.

---

## 7. System Regression Verification
- Automated test confirming existing worker provisioning CRUD (`/api/workers`).
- Automated test confirming alert acknowledgment and resolution workflows (`/api/alerts`).
- Automated test confirming threshold modification (`/api/thresholds`).
- Simulator script (`npm run simulate`) executes continuously without errors.
