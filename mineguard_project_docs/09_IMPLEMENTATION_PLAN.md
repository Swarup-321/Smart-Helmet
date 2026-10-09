# 09 — Implementation Plan

This implementation plan defines the exact sequencing of changes for the MineGuard Smart Helmet project. Changes must proceed strictly phase-by-phase without implementing future phases prematurely.

---

## Phase 0 — Repository & Architectural Ratification (COMPLETED)
1. **Repository Alignment**: Create and switch to local branch `smart-helmet` tracking `origin/smart-helmet`. Verify monorepo tree (`client/`, `server/`, `firmware-samples/`, `sketch_oct2a/`, `docs/`).
2. **Ratify Architectural Decisions**: Formalize binding contracts in `00_ARCHITECTURAL_DECISIONS.md`.
3. **Firmware Status**: Document preferred status of `sketch_oct2a/sketch_oct2a.ino` with explicit note: *"Authoritative firmware requires physical hardware confirmation."*
4. **Vibration Scope**: Formally defer vibration monitoring to Phase 2; prohibit mock stubs.
5. **Primary Database**: Designate embedded SQLite as the primary implementation and testing engine.

---

## Phase 1 — Data Correctness & SQLite Pressure Schema
1. **Fix SQLite Pressure Persistence**:
   - Update `server/src/db/sqliteAdapter.js` table creation: include `pressure REAL` in `CREATE TABLE IF NOT EXISTS readings`.
   - Update `saveReadingHistory` and `saveReadingHistoryBatch` to insert `reading.pressure ?? null`.
   - Update index/query mappings so historical queries return `pressure`.
2. **Confirm Live Gas Telemetry Contract**:
   - Maintain `mq2_mv` and `mq5_mv` as electrical millivolt indices (`0–3300 mV`).
   - Standardize wire key as `"temperature"` across firmware documentation.
3. **Verify Local Telemetry Baseline**:
   - Run existing test suite (`npm run test --workspace=server`) to ensure baseline data integrity.

---

## Phase 2 — ML Dataset Pipeline & Model Training
*(Sequenced after the data-domain bridging decision is ratified)*
1. **Resample Training Telemetry**:
   - Process `methane_data/methane_data.csv` (1.1 GB).
   - Resample from 1-second continuous telemetry to **10-second intervals** (aggregating by median/mean).
2. **Build Normalized Relative Feature Extractor**:
   - Extract dimensionless temporal dynamic features ($\Delta x / x_{\text{baseline}}$, rolling mean, rolling std, normalized slope, z-scores) from target sensor `MM263`.
   - Include ambient `temperature`, `humidity`, and `pressure`.
3. **Label Construction**:
   - Construct binary target $y_t \in \{0, 1\}$ for early warning horizon $H = 5\text{ to }15\text{ minutes}$ (30 to 90 downsampled steps).
4. **Chronological Splitting & Model Training**:
   - Split chronologically (Train / Val / Test). Fit scalers on Train partition only.
   - Train explainable tabular classifiers (Logistic Regression baseline, Random Forest / Gradient Boosting).
   - Apply class weighting (`class_weight='balanced'`) to address rare surge events.
5. **Evaluation & Artifact Export**:
   - Evaluate against held-out chronological test partition (PR-AUC, ROC-AUC, F1, Precision, Recall).
   - Compare directly against existing statistical slope baseline (`trendService.js`).
   - Export `gas_trend_model.joblib`, `scaler_pipeline.joblib`, and `model_metadata.json` to `ml_service/models/`.

---

## Phase 3 — Python ML Inference Service (`ml_service/`)
1. **Service Setup**:
   - Create `ml_service/` with `requirements.txt` (`fastapi`, `uvicorn`, `scikit-learn`, `numpy`, `pandas`).
   - Implement `main.py` loading model and preprocessor once at startup.
2. **Inference Endpoint (`POST /predict/gas-trend`)**:
   - Validate input window using Pydantic schema.
   - Calculate normalized relative dynamic features matching the training pipeline.
   - Return structured JSON: `surge_probability`, `surge_risk_level`, `prediction_horizon_min`, `trend_direction`.
3. **Automated Testing**:
   - Implement unit tests (`pytest`) verifying valid inference payloads, handling of edge cases, and graceful rejection of short windows.

---

## Phase 4 — Express Backend Integration
1. **Asynchronous Non-Blocking ML Hook**:
   - In `server/src/index.js` inside `app.post('/api/readings')`, add asynchronous HTTP call to `http://localhost:8000/predict/gas-trend`.
   - Enforce short timeout (500 ms) via `AbortController`.
   - Ensure the primary sensor ingestion path returns `201 Created` to ESP32 immediately without waiting for ML.
2. **Resilience & Graceful Degradation**:
   - If ML service is offline or times out, log warning, skip ML broadcast, and ensure deterministic alerts continue with zero interruption.
3. **Socket.IO Event Emission**:
   - Emit `ml_gas_prediction` on successful inference.

---

## Phase 5 — React Dashboard Integration
1. **Overview View Integration**:
   - Replace hardcoded static mock array in `Overview.jsx` (lines 560–569) with real multi-worker gas trends.
   - Add a dedicated **ML Gas-Surge Early Warning Panel** displaying live surge probability, risk level, and stale indicator.
2. **Worker Detail View Integration**:
   - Augment `WorkerDetail.jsx` with ML surge risk metrics alongside existing historical charts.
   - Keep deterministic alerts and emergency SOS banners visually separate from ML advisory risk.
3. **Analytics View Cleanup**:
   - Replace mock data only where genuine backend telemetry endpoints exist; remove unbacked mock arrays.

---

## Phase 6 — Security Hardening (Pre-Production)
1. Attach `verifyJwtAuth` middleware to all administrative mutation routes (`/api/workers`, `/api/thresholds`, `/api/alerts/*`, `/api/config/system`).
2. Remove hardcoded admin fallback in `AppContext.jsx`.
3. Add authentication handshake to Socket.IO connections.
4. Move hardcoded API keys and JWT secrets strictly to `.env`.

---

## Phase 7 — End-to-End Validation
Execute test suite validating normal telemetry ingestion, ML success, ML service timeout/offline fallback, deterministic alert priority, and dashboard reconnects.
