# 00 — MineGuard Architectural Decisions

This document records the official architectural decisions ratified following the complete codebase audit and document validation. These decisions form the binding technical contract for the MineGuard Smart Helmet implementation.

---

### 1. Repository Branch
- **DECISION**: Work exclusively from the local branch `smart-helmet` tracking remote branch `origin/smart-helmet`. Branch `main` is retired from active development.
- **RATIONALE**: Remote branch `origin/smart-helmet` contains the complete monorepo (`client/`, `server/`, `firmware-samples/`, `sketch_oct2a/`, `docs/`, `server/data/mineguard.db`). Branch `main` contained only an unorganized frontend extraction and was incomplete.
- **IMPACT**: The local working tree now possesses full backend, firmware, database, and client source code under npm workspaces. All future modifications are committed to `smart-helmet`.

---

### 2. Authoritative Firmware
- **DECISION**: Preferred candidate authoritative firmware is `sketch_oct2a/sketch_oct2a.ino` (v2.2 with MAX30102 heart rate/SpO2 and BMP280 atmospheric pressure). Status is formally recorded as:  
  **"AUTHORITATIVE FIRMWARE REQUIRES PHYSICAL HARDWARE CONFIRMATION"**.
- **RATIONALE**: `sketch_oct2a.ino` incorporates advanced digital I2C sensors (MAX30102 and BMP280) alongside analog gas sensors. However, the repository alone cannot physically verify whether the laboratory prototype helmet is wired for MAX30102/BMP280 or the simpler HW-827 pulse sensor in `firmware-samples/esp32_wifi_post.ino`.
- **IMPACT**: Architecture, schemas, and tests support the full sensor set (`pressure`, `heart_rate`, `spo2`), but physical bench confirmation is required before final device flashing.

---

### 3. Live Gas Representation
- **DECISION**: Live helmet gas telemetry consists of uncalibrated electrical millivolts (`mq2_mv`, `mq5_mv`, 0–3300 mV) and raw ADC integers (`mq2_raw`, `mq5_raw`, 0–4095). It is strictly treated as an electrical index.
- **RATIONALE**: The MQ-2 and MQ-5 sensors are metal oxide semiconductors without clean-air baseline calibration ($R_0$) or physical transfer curves stored in firmware.
- **IMPACT**: System and dashboard must not treat mV as physical % CH4 or PPM. The dashboard displays raw readings with clear units (`mV`), and alert rules evaluate millivolt thresholds (warning: 2000 mV, critical: 2500 mV).

---

### 4. ML Objective
- **DECISION**: The ML task is defined as **BINARY GAS-SURGE EARLY WARNING**.  
  *Definition*: Given a sliding window of recent normalized temporal gas behavior, predict whether a significant gas escalation event is likely within the next 5–15 minutes ($H = 30\text{ to }90$ downsampled steps).
- **RATIONALE**: Attempting to predict absolute methane concentration (% CH4) from uncalibrated millivolts is scientifically invalid. Predicting relative escalation risk matches the available physical signal.
- **IMPACT**: ML output represents surge risk probability $[0.0, 1.0]$ and status categories (`NORMAL`, `ELEVATED_SURGE_RISK`, `CRITICAL_SURGE_RISK`). It does not predict gas volume.

---

### 5. ML Feature Bridge
- **DECISION**: Adopt normalized relative temporal feature extraction as the primary engineering bridge between the public coal mine dataset and live helmet telemetry.
- **RATIONALE**: The public dataset (`methane_data.csv`) records calibrated physical % CH4 at 1 Hz from stationary mine stations; the helmet records electrical mV at 0.1 Hz from wearable sensors. Dimensionless relative dynamics ($\Delta x / x_{\text{baseline}}$, rolling mean, rolling standard deviation, normalized slope, z-scores) allow the model to recognize surge patterns without relying on absolute sensor voltages.
- **IMPACT**: Both the training pipeline and live inference engine extract dimensionless temporal escalation features. The ML system is formally documented as an experimental predictive bridge.

---

### 6. ML Output Semantics
- **DECISION**: ML output represents "gas escalation risk / surge probability". It must **NEVER** be presented as:
  - Measured % CH4
  - Measured PPM
  - Calibrated methane concentration
  - Proof that a regulatory methane limit has been breached
- **RATIONALE**: Presenting model output as physical gas concentration would be scientifically false and could mislead safety supervisors.
- **IMPACT**: Dashboard displays ML results in a dedicated "Predictive Surge Risk" panel, visually distinguished from physical sensor cards.

---

### 7. Deterministic Safety Alerts vs ML Alerts
- **DECISION**: Deterministic safety rules (local hardware buzzer, Node.js threshold rules, SOS button, man-down alerts) remain strictly independent, primary, and unbypassed by ML.
- **RATIONALE**: Life safety in hazardous coal mines cannot depend on an asynchronous experimental microservice. Local buzzer alarms on ESP32 (>= 2500 mV) operate even without Wi-Fi.
- **IMPACT**: ML inference failure, network timeout, or service downtime will never block or delay deterministic alerts.

---

### 8. Vibration Scope
- **DECISION**: Vibration / seismic monitoring is **DEFERRED TO PHASE 2**.
- **RATIONALE**: No physical vibration sensor hardware, firmware interface, backend schema field, database column, or UI widget exists in the codebase.
- **IMPACT**: Zero vibration software stubs, mock values, or fictional charts will be created in Phase 1. The documentation in `08_VIBRATION_MONITORING.md` is preserved as a future specification.

---

### 9. Primary Database for Implementation
- **DECISION**: Embedded SQLite (`server/data/mineguard.db`) is the primary database for local development, ML historical data extraction, and automated testing. Google Cloud Firestore adapter compatibility is preserved intact.
- **RATIONALE**: SQLite allows fully autonomous, zero-config offline execution without external cloud credentials.
- **IMPACT**: SQLite `readings` table schema will be updated to include `pressure REAL` to prevent data loss from BMP280 sensors.

---

### 10. Known Limitations
- **DECISION**: Formally document all known system limitations in project contracts:
  1. Uncalibrated MOS gas sensors (raw mV index only).
  2. No dedicated Carbon Monoxide (CO) sensor in hardware or software.
  3. Fall detection is stubbed (`fall: false` in firmware).
  4. Overview Gas Dynamics and Analytics View contain mock data that must be replaced with real endpoints.
  5. Sampling frequency mismatch ($1\text{ Hz}$ dataset vs $0.1\text{ Hz}$ helmet) requires pipeline downsampling.
- **RATIONALE**: Prevents future developers or auditors from assuming unverified capabilities.
- **IMPACT**: Total transparency regarding system capabilities.

---

### 11. Remaining Hardware Confirmation
- **DECISION**: The following workbench items remain flagged as requiring physical confirmation by the hardware team:
  1. Confirmation of physically flashed firmware (`sketch_oct2a.ino` vs `esp32_wifi_post.ino`).
  2. Physical presence and wiring of BMP280 and MAX30102 on prototype helmets.
  3. Clean air baseline resistance ($R_0$) calibration if physical PPM conversion is ever pursued.
- **RATIONALE**: Distinguishes verified software engineering deliverables from unverified hardware bench facts.
- **IMPACT**: Software development proceeds safely under ratified modular contracts without making false hardware assumptions.
