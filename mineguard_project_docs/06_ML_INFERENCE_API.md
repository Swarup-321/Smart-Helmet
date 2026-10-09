# 06 — ML Inference API

## 1. Microservice Framework & Architecture
- **Framework**: Python FastAPI running under Uvicorn.
- **Port**: Local internal network interface on port `8000` (`http://localhost:8000`).
- **Startup Lifecycle**: Loads the serialized model artifact (`gas_trend_model.joblib`) and preprocessor once at process initialization.
- **Health Endpoint**: `GET /health` returning service status, model version, and uptime.

---

## 2. Inference Endpoint: `POST /predict/gas-trend`
- **Request Validation**: Validates the incoming sliding window against Pydantic request models. Returns HTTP 422 for malformed features and HTTP 400 for windows smaller than required (e.g. $< 10$ points).
- **Channel Binding Constraint**: Feature extraction is strictly bound to `mq2_mv`. The microservice must **never** silently fall back to `mq5_mv` if `mq2_mv` is missing or null, because the two sensors have divergent chemical selectivity curves.
- **Semantics**: Evaluates the normalized relative temporal surge profile.
- **Output Terminology**:
  - `surge_probability`: Numeric value $[0.0, 1.0]$.
  - `surge_risk_level`: Enumeration (`NORMAL`, `ELEVATED_SURGE_RISK`, `CRITICAL_SURGE_RISK`).
  - `prediction_horizon_min`: Future window (e.g., `10` minutes).
  - `trend_direction`: Directional slope (`"rising"`, `"stable"`, `"falling"`).
- **Strict Prohibition**: The API must **never** output estimated physical methane percentage (`% CH4`) or PPM. It must not expose fabricated concentration metrics.
- **Operational Status**: Classified as **Advisory Only**. Predictions are strictly non-authoritative; they must never trigger physical evacuation alarms or override hardware thresholds.
- **Recommended Downstream Filter**: To mitigate single-sample ADC noise spikes, consumers should require $\ge 3$ consecutive cycles (30 seconds) of elevated risk before raising advisory alerts on the dashboard.

---

## 3. Express Integration & Graceful Degradation
- **Execution Hook**: In `server/src/index.js` inside `app.post('/api/readings')` after local memory cache update.
- **Non-Blocking Architecture**: Express executes the HTTP request to the Python microservice asynchronously using an `AbortController` timeout (e.g., 500 ms).
- **Ingestion Independence**: The main ingestion response (`HTTP 201 Created`) is dispatched to the ESP32 smart helmet immediately, without waiting for ML completion.
- **Resilience on ML Failure**:
  - If the Python microservice is offline, times out, or returns HTTP 500:
    1. Sensor readings continue to be saved and broadcast normally.
    2. Deterministic safety alerts (`AlertEngine` checking millivolt thresholds, heart rate, SpO2, and SOS) continue to execute with zero interruption.
    3. Express logs a warning: `[ML Service] Inference call failed / timed out`.
    4. The dashboard displays an explicit "ML Unavailable / Stale" indicator.
    5. Express **never** fabricates substitute ML prediction values.

---

## 4. Socket.IO Event Specification
- Once a valid surge prediction is returned from the Python service, Express broadcasts it over Socket.IO:
  - Event Name: `ml_gas_prediction`
  - Payload:
    ```json
    {
      "worker_id": "W001",
      "timestamp": "2026-10-09T01:30:00.000Z",
      "surge_probability": 0.82,
      "surge_risk_level": "CRITICAL_SURGE_RISK",
      "prediction_horizon_min": 10,
      "trend_direction": "rising",
      "feature_summary": {
        "normalized_slope": 0.024,
        "current_mq2_mv": 1580
      }
    }
    ```
- The existing Socket.IO transport in Express carries this event directly without requiring any transport layer rework.
