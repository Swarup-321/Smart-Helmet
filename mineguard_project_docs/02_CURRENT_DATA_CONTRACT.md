# 02 — Current Sensor and Telemetry Data Contract

## 1. Authoritative Firmware Status
- **Preferred Candidate**: `sketch_oct2a/sketch_oct2a.ino` (v2.2 with MAX30102 pulse oximetry and BMP280 atmospheric pressure).
- **Binding Contract Status**: **"AUTHORITATIVE FIRMWARE REQUIRES PHYSICAL HARDWARE CONFIRMATION"**.
- **Firmware Variants in Repository**:
  1. `sketch_oct2a/sketch_oct2a.ino`: Dual digital I2C sensors (MAX30102 on address 0x57, BMP280 on 0x76/0x77), MQ-2 (GPIO 34), MQ-5 (GPIO 35), DHT11 (GPIO 4), LDR (GPIO 32), SOS button (GPIO 27). Emits `pressure`.
  2. `firmware-samples/esp32_wifi_post.ino`: Analog pulse sensor (HW-827 on GPIO 33), MQ-2, MQ-5, DHT11, LDR, SOS button. Does **not** include BMP280 and does not emit `pressure`.
  - Both firmware variants format JSON payloads using ArduinoJson and transmit via HTTP POST to `/api/readings` with header `x-api-key: mineguard_device_secret_key_2026`.

---

## 2. Sensor Fields & Data Dictionary
| Sensor | Telemetry Field(s) | Electrical / Physical Unit | Status in Implementation |
|---|---|---|---|
| **MQ-2 Combustible Gas** | `mq2_mv`, `mq2_raw` | Millivolts (0–3300 mV), ADC (0–4095) | Functional; uncalibrated electrical index |
| **MQ-5 Methane / LPG** | `mq5_mv`, `mq5_raw` | Millivolts (0–3300 mV), ADC (0–4095) | Functional; uncalibrated electrical index |
| **DHT11 Temperature** | `temperature` | Degrees Celsius (°C) | Functional |
| **DHT11 Humidity** | `humidity` | Relative Humidity (% RH) | Functional |
| **BMP280 Pressure** | `pressure` | Hectopascals (hPa) | Live functional in `sketch_oct2a.ino`; dropped in SQLite persistence |
| **MAX30102 / Pulse HR** | `heart_rate` | Beats Per Minute (BPM) | Functional |
| **MAX30102 SpO2** | `spo2` | Oxygen Saturation (%) | Functional |
| **LDR Light Intensity** | `ldr_raw` | Raw ADC (0–4095) | Functional |
| **SOS Pushbutton** | `sos` | Boolean | Functional (Instantaneous GPIO 27 ISR) |
| **Fall / Man-Down** | `fall` | Boolean | Mocked; hardcoded `false` in firmware |
| **Battery Level** | `battery` | Percentage (%) | Hardcoded static estimate (85/88%) in firmware |
| **Wi-Fi / LoRa RSSI** | `rssi` | Signal Strength (dBm) | Functional |
| **LoRa SNR** | `snr` | Signal-to-Noise Ratio (dB) | Schema-ready; `null` over Wi-Fi |

---

## 3. Raw MQ Electrical Readings vs. Calibrated Methane
- Live telemetry from MQ-2 and MQ-5 consists of **raw electrical potential in millivolts (`mq2_mv`, `mq5_mv`)**.
- The sensors are uncalibrated MOS devices lacking clean-air resistance baseline calibration ($R_0$) and physical transfer curves.
- Readings must **NOT** be represented as:
  - Measured physical percentage (% CH4)
  - Measured Parts-Per-Million (PPM)
  - Proof of crossing regulatory mine safety thresholds
- The dashboard displays them as an electrical index in millivolts (`mV`). Deterministic alarm rules evaluate millivolt thresholds directly (warning: 2000 mV, critical: 2500 mV).

---

## 4. Ratified ML Feature Bridge
- The public coal mine dataset (`methane_data.csv`) records calibrated physical % CH4 from stationary monitoring stations, whereas the helmet emits electrical millivolts from a wearable unit.
- **Ratified Engineering Strategy**: Adopt a **dimensionless, normalized relative temporal feature contract**.
- Live helmet inputs for ML:
  - `mq2_mv`
  - `mq5_mv`
- Extracted dynamic features:
  - Relative rate of change: $\frac{\Delta x}{x_{\text{baseline}}}$
  - Rolling mean and rolling standard deviation over sliding windows (5–15 points)
  - Normalized slope ($\Delta \text{mV} / \Delta t$)
  - Standardized anomaly z-scores
- The ML system is formally documented as an **experimental predictive bridge** mapping normalized dynamic gas surge signatures to early warning risk. It does not predict absolute gas concentrations.

---

## 5. Storage Persistence Issue (SQLite Pressure)
- `server/src/db/sqliteAdapter.js` currently omits `pressure` from the SQL `CREATE TABLE readings` schema and INSERT statements.
- **Ratified Fix**: Add `pressure REAL` to `sqliteAdapter.js` during Phase 1 to preserve BMP280 readings in SQLite history alongside Firestore.

---

## 6. Sampling Cadence Mismatch
- Physical helmet telemetry transmits every **10 seconds** (`POST_INTERVAL_MS = 10000`).
- Public dataset observations are recorded at **1.0 second** intervals.
- The training pipeline must explicitly downsample/resample the dataset to a 10-second cadence to align temporal horizons.
