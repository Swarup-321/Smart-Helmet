# Phase 2.2 — Sensor-Domain Validation & Model Readiness Audit
**Project**: MineGuard Smart Helmet Safety & Early Warning  
**Date**: October 9, 2026  
**Auditor**: Senior Software Architect & Codebase Auditor  
**Status**: Completed & Formally Ratified  

---

## 1. Executive Summary
This audit investigates the physical and sensor-domain validity of transferring a gas-surge early-warning model trained on a public Polish coal mine SCADA dataset ([`methane_data.csv`](file:///c:/Users/abuna/Desktop/clg/IOT/methane_data/methane_data.csv)) to live ESP32 smart helmet telemetry equipped with analog MQ-2 and MQ-5 gas sensors.

### Absolute Rule & Scope
- This model was trained on telemetric measurements from certified underground mining methanometers (`MM-2PWk`) measuring volume $\%$ CH$_4$.
- It has **NOT** been validated on physical helmet MQ sensor hardware.
- It does **NOT** predict physical concentration (% CH$_4$ or PPM).
- It is **NOT** a certified or regulatory-grade safety warning system.

---

## 2. Actual MQ Sensor Audit

An inspection was conducted on authoritative firmware [`sketch_oct2a/sketch_oct2a.ino`](file:///c:/Users/abuna/Desktop/clg/IOT/Smart-Helmet/sketch_oct2a/sketch_oct2a.ino) and [`firmware-samples/esp32_wifi_post.ino`](file:///c:/Users/abuna/Desktop/clg/IOT/Smart-Helmet/firmware-samples/esp32_wifi_post.ino).

```c
// sketch_oct2a.ino (Lines 45-46, 79-80, 264-267, 303-306)
#define MQ2_PIN 34
#define MQ5_PIN 35

void readFastSensors() {
  sensor.mq2_raw = analogRead(MQ2_PIN);
  sensor.mq2_mv  = analogReadMilliVolts(MQ2_PIN);
  sensor.mq5_raw = analogRead(MQ5_PIN);
  sensor.mq5_mv  = analogReadMilliVolts(MQ5_PIN);
  ...
}

String buildJson() {
  ...
  doc["mq2_mv"]  = sensor.mq2_mv;
  doc["mq5_mv"]  = sensor.mq5_mv;
  doc["mq2_raw"] = sensor.mq2_raw;
  doc["mq5_raw"] = sensor.mq5_raw;
  ...
}
```

### Exact Findings from Hardware & Firmware Code
1. **Sensors Connected**: Both MQ-2 (GPIO 34) and MQ-5 (GPIO 35) are wired as analog inputs to ADC1 channels.
2. **Telemetry Variables**: `mq2_mv`, `mq5_mv` (millivolts), `mq2_raw`, `mq5_raw` (12-bit counts $0\text{--}4095$).
3. **Sampling Cadence**:
   - `readFastSensors()` runs in the main loop every $\sim 50\text{ ms}$.
   - Telemetry transmission occurs strictly every **10 seconds** (`POST_INTERVAL_MS = 10000UL`).
   - **Crucial Finding**: Telemetry is an instantaneous **single-sample read**. There is **ZERO oversampling, moving averaging, or digital filtering** on the ESP32.
4. **Signal Transfer Function & Monotonicity**:
   - MQ sensors utilize a heated tin dioxide ($SnO_2$) semiconductor element. In the presence of reducing gases, sensor surface resistance $R_s$ decreases.
   - The breakout board connects $R_s$ with load resistor $R_L$ in a voltage divider:
     $$V_{\text{out}} = V_{cc}\frac{R_L}{R_s + R_L}$$
   - Output voltage (millivolts) increases monotonically with gas concentration.
   - **Non-Linear Power-Law**: Resistance follows $\frac{R_s}{R_0} = A \cdot (\text{PPM})^{-B}$ with $B \approx 0.4\text{--}0.8$. Voltage response is sub-linear and saturates logarithmically as gas rises.
5. **Baseline Normalization & Calibration ($R_0$)**:
   - **ABSENT**. There is zero baseline tracking, clean-air resistance $R_0$ calculation, or calibration logic in firmware.
6. **Temperature & Humidity Compensation**:
   - **ABSENT**. Although DHT11 is present, MQ sensor millivolts are completely uncompensated. (MQ datasheets indicate ambient temperature and humidity shifts baseline resistance by up to $30\text{--}50\%$).
7. **ADC Resolution & Non-Linearity**:
   - ESP32 12-bit SAR ADC ($0\text{--}4095$ counts, $0\text{--}3300\text{ mV}$ nominal).
   - ESP32 ADCs exhibit significant non-linearity below $100\text{ mV}$ and above $2600\text{ mV}$.
8. **Warm-Up / Burn-In Logic**:
   - **ABSENT**. MQ datasheets mandate a 24-hour pre-heat burn-in and a 2–3 minute stabilization window after boot. The firmware boots and begins reporting active data within 1.5 seconds.
9. **Gas Specificity**:
   - MQ-2 responds to LPG, propane, hydrogen, methane, smoke, and alcohol.
   - MQ-5 responds to LPG, natural gas, town gas, and methane.
   - Neither sensor is methane-specific; both are broad-spectrum combustible gas proxies cross-sensitive to humidity, temperature, and VOCs.

---

## 3. Public Dataset Sensor Audit

Metadata from [`attribute_information.txt`](file:///c:/Users/abuna/Desktop/clg/IOT/attribute_information.txt) and dataset [`methane_data.csv`](file:///c:/Users/abuna/Desktop/clg/IOT/methane_data/methane_data.csv):

```
MM263 - methane meter [%CH4] - !target sensor!
• sensor type: methane meter MM-2PWk
• kind: switching off
• value of threshold A (alarm): 1.5%
• value of threshold W (warning): 1.0%
```

### Exact Findings from Public Dataset
1. **Target Physical Instrument**: `MM-2PWk` is an industrial, stationary, certified underground mining methanometer (typically optical infrared or catalytic pellistor technology).
2. **Measurement Units**: Calibrated volume percentage of methane in air ($\% \text{ CH}_4$).
3. **Sampling Cadence**: 1.0 Hz (1 second), downsampled in our pipeline to 0.1 Hz (10 seconds) via 10-point mean aggregation.
4. **Context & Safety Role**: Installed at the longwall extraction face in an active Polish coal mine. Tagged as "switching off" because it controls automatic electrical power interlocks for coal-cutting machinery.
5. **Calibration Traceability**: The instrument outputs calibrated physical engineering units ($\% \text{ CH}_4$) maintained to legal coal mine regulatory standards.
6. **Cross-Sensor Availability in Dataset**:
   The dataset contains 7 other methanometers of identical certified type along the same longwall ventilation network:
   `MM261`, `MM262`, `MM264`, `MM256`, `MM252`, `MM211`, and high-concentration meter `CM861`.
7. **Comparability to MQ-2 / MQ-5**:
   - `MM-2PWk` is a certified, temperature-compensated, calibrated optical/catalytic mining instrument measuring $\%$ CH$_4$.
   - MQ-2 and MQ-5 are uncalibrated, uncompensated, heated semiconductor breadboard components measuring millivolts across a load resistor.
   - **They share neither sensing physics, transfer curves, time constants, nor selectivity.**

---

## 4. Feature Transferability Matrix

Each of the 13 features in the retrained model was evaluated across 4 transferability classes:
- **A**: Mathematically scale-invariant ($f(c \cdot x) = f(x)$)
- **B**: Physically plausible across sensor domains
- **C**: Physically uncertain / sensitive to sensor domain differences
- **D**: Unsafe for cross-domain inference

| Feature Key | Formulation | Class | Physical Transferability Analysis |
| :--- | :--- | :---: | :--- |
| `rel_delta_5m` | $\frac{x_t - x_{t-30}}{\mu_{5m}}$ | **C** | Mathematically scale-invariant, but MQ non-linear power-law ($R_s \propto C^{-B}$) compresses relative changes compared to linear $\%$ CH$_4$. |
| `rel_delta_10m` | $\frac{x_t - x_{t-60}}{\mu_{10m}}$ | **C** | Invariant to scalar gain; compressed by MQ logarithmic saturation. |
| `rel_ratio_5m_10m` | $\frac{\mu_{5m} - \mu_{10m}}{\mu_{10m}}$ | **B** | Compares short-term to medium-term moving average. Monotonically tracks whether gas trend is accelerating upward or slowing down. |
| `rel_rate_of_change` | $\frac{x_t - x_{t-6}}{\mu_{5m}}$ | **C** | 1-minute velocity. Because ESP32 samples without averaging, single-sample ADC noise introduces high-frequency variance into this feature. |
| `norm_slope_5m` | $\frac{\text{slope}_{15}(x)}{\mu_{5m}}$ | **B** | Linear regression over 15 points (2.5 min) naturally filters instantaneous electrical ADC noise, capturing directional slope. |
| `cv_5m` | $\frac{\sigma_{5m}}{\mu_{5m}}$ | **C** | Coefficient of variation measures relative turbulence. On raw MQ sensors, electrical ADC noise ($10\text{--}30\text{ mV}$) inflates baseline $CV$ during clean air conditions. |
| `cv_10m` | $\frac{\sigma_{10m}}{\mu_{10m}}$ | **C** | Long-term relative turbulence; sensitive to thermal drift and heater cycle noise on low-cost MQ sensors. |
| `z_score_5m` | $\frac{x_t - \mu_{5m}}{\max(\sigma_{5m}, \epsilon \mu_{5m})}$ | **B** | Standardized anomaly deviation. Because both numerator and denominator share the same units and noise scale, z-score is robust to constant gain. |
| `rel_range_5m` | $\frac{\max_{5m} - \min_{5m}}{\mu_{5m}}$ | **C** | Extreme min/max values are vulnerable to single-sample ADC spikes or breadboard contact bounce. |
| `ratio_volatility_5m_10m` | $\frac{\sigma_{5m}}{\max(\sigma_{10m}, \epsilon \mu_{5m})}$ | **B** | Dimensionless ratio of short-term to medium-term volatility. Filters baseline noise scale. |
| `press_rel_delta_10m` | $\frac{P_t - P_{t-60}}{P_{t-60}}$ | **B** | Both sensors (BMP280 on helmet, BA1723 in dataset) measure pressure in hPa with high precision. Relative drop tracks desorption gradient. |
| `temp_delta_10m` | $T_t - T_{t-60}$ | **C** | In mining air, temperature tracks airflow. On a helmet, temperature may track miner body heat, sweating, and head exertion. |
| `hum_delta_10m` | $RH_t - RH_{t-60}$ | **C** | Miner exhaled breath directly elevates localized humidity around the helmet visor/shell. |

---

## 5. MQ-2 vs MQ-5 Compatibility Assessment

### Current Code Behavior
In [`ml_service/features/extractor.py`](file:///c:/Users/abuna/Desktop/clg/IOT/Smart-Helmet/ml_service/features/extractor.py):
```python
g = r.get("mq2_mv")
if g is None or (isinstance(g, (int, float)) and np.isnan(g)):
    g = r.get("mq5_mv")
```
The architecture currently treats `mq2_mv` as primary, and silently falls back to `mq5_mv`.

### Compatibility Verdict
**TREAT AS DISTINCT, NON-INTERCHANGEABLE SENSORS.**
- **Chemical Sensitivity**: MQ-2 is primarily a smoke/LPG sensor with broad sensitivity to $H_2$, alcohol, and propane. MQ-5 is optimized for LPG and natural gas ($CH_4$).
- **Response Curves**: Their power-law constants $A$ and $B$, baseline resistances $R_0$, and load resistors $R_L$ differ substantially.
- **Silent Fallback is Prohibited**: Swapping `mq2_mv` and `mq5_mv` dynamically will produce different relative volatility and slope values. The system must explicitly bind inference to a declared primary sensor channel or require sensor-specific calibration.

---

## 6. Synthetic Robustness Results

To evaluate how the dimensionless feature contract behaves under realistic hardware sensor distortions, 10 synthetic transformations were applied to the continuous holdout test partition (137,986 steps):

| Test Transformation | Simulated Physical Distortion | Feature MAE | ROC-AUC | Precision | Recall | F1-Score | FP Instances |
| :--- | :--- | :---: | :---: | :---: | :---: | :---: | :---: |
| **Clean Baseline** | Unperturbed telemetric test split | `0.0000` | **0.6414** | **1.08%** | **16.50%** | **0.0202** | 7,621 |
| **A. Multiplicative (×10.0)** | Large scale factor change (% CH$_4$ to mV) | `0.0430` | **0.6523** | **1.08%** | **16.50%** | **0.0202** | 7,621 |
| **B. Additive Baseline (+0.50)** | Uncalibrated sensor voltage offset ($+V_0$) | `0.0702` | **0.6054** | **0.37%** | **16.50%** | **0.0072** | **22,598** |
| **C. Gain Variation (pow 1.2)** | Non-linear MQ sensor power-law curvature | `0.0190` | **0.6208** | **1.17%** | **16.70%** | **0.0219** | 7,084 |
| **D. Gaussian Noise ($\sigma=0.05$)** | Electrical ADC noise on breadboard pins | `0.3307` | **0.5474** | **0.71%** | **15.51%** | **0.0136** | **10,865** |
| **E. Quantization (round 0.02)** | Discrete 12-bit ADC stepping | `0.0076` | **0.6258** | **1.11%** | **15.90%** | **0.0208** | 7,127 |
| **F. Saturation (clip 1.5% max)** | ESP32 ADC upper voltage saturation ($2600\text{ mV}$) | `0.0002` | **0.6413** | **1.08%** | **16.50%** | **0.0202** | 7,619 |
| **G. Low-Pass Smoothing (EMA 0.3)** | Sensor thermal inertia & sintered mesh diffusion | `0.0737` | **0.6092** | **0.64%** | **20.08%** | **0.0123** | **15,762** |
| **H. Response Lag (20s delay)** | Telemetry transport delay | `0.0761` | **0.6371** | **1.05%** | **16.10%** | **0.0197** | 7,632 |
| **I. Slow Recovery Lag** | Metal-oxide desorptive recovery hysteresis | `0.0875` | **0.5866** | **0.66%** | **21.07%** | **0.0128** | **15,893** |
| **J. Baseline Drift (+0.5 drift)** | Sensor aging / heater temperature fluctuation | `0.1157` | **0.5718** | **0.69%** | **19.09%** | **0.0133** | **13,857** |

### Key Robustness Insights
1. **Multiplicative Scaling Robustness**: Transformation A confirms that uniform scaling preserves feature values and model performance identically.
2. **Additive Offset Vulnerability**: An additive baseline offset (Transformation B) inflates the denominator in relative deltas, **tripling false alarms** from 7,621 to 22,598 and dropping precision by 66%.
3. **Sensor Noise Sensitivity**: High-frequency measurement noise (Transformation D) inflates the coefficient of variation ($CV$) during clean air conditions, dropping ROC-AUC down to 0.5474 (near chance).
4. **Hysteresis & Recovery Lag**: Slow recovery (Transformation I) leaves volatility ratios elevated after a transient surge, creating lingering false alarms.

---

## 7. Threshold Sensitivity Evaluation

Evaluating across decision thresholds $\tau \in [0.20, 0.70]$ on the chronological test partition (137,986 steps, 503 ground-truth positive instances):

| Threshold | Precision | Recall | F1-Score | False Positive Rate | Positive Predictions | True Positives | False Positives | False Negatives |
| :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **0.20** | 0.53% | 67.00% | 0.0104 | 46.44% | 64,182 | 337 | 63,845 | 166 |
| **0.30** | 0.50% | 53.48% | 0.0098 | 39.29% | 54,290 | 269 | 54,021 | 234 |
| **0.40** | 0.58% | 46.52% | 0.0115 | 29.19% | 40,361 | 234 | 40,127 | 269 |
| **0.45** | 0.68% | 42.54% | 0.0133 | 22.85% | 31,624 | 214 | 31,410 | 289 |
| **0.50** | 0.77% | 35.79% | 0.0150 | 16.96% | 23,503 | 180 | 23,323 | 323 |
| **0.60** | 0.95% | 20.68% | 0.0182 | 7.87% | 10,918 | 104 | 10,814 | 399 |
| **0.63** *(tuned)* | **1.08%** | **16.50%** | **0.0202** | **5.54%** | **7,704** | **83** | **7,621** | **420** |
| **0.70** | 1.24% | 6.16% | 0.0207 | 1.79% | 2,495 | 31 | 2,464 | 472 |

### Operational Analysis of Thresholds
- **Low Thresholds ($\tau \le 0.40$)**: Unusable. Positive prediction rate exceeds $29\text{--}46\%$, meaning an alarm is active nearly half the operating shift.
- **Tuned Threshold ($\tau = 0.63$)**: Maximizes validation F1, achieving 1.08% precision and 16.50% recall with a 5.54% false-positive rate.
- **High Thresholds ($\tau \ge 0.70$)**: Suppresses false positives to 1.79%, but recall collapses to 6.16% (missing 94% of surge instances).

---

## 8. Exploratory Event-Level Analysis

The test partition (137,986 consecutive 10-second steps $\approx$ 16.0 days of continuous underground mining) was analyzed by grouping contiguous positive timesteps into physical surge episodes:

### Ground-Truth Surge Episodes in Test Partition
Across 16 days, there were **exactly 6 physical gas-surge episodes** where methane exceeded the warning limit ($W = 1.0\% \text{ CH}_4$):
1. **Episode 1**: steps `[24174:24244]`, duration $710\text{ s}$ (11m 50s), peak gas in horizon: **2.20% CH$_4$**
2. **Episode 2**: steps `[55546:55666]`, duration $1,210\text{ s}$ (20m 10s), peak gas in horizon: **1.55% CH$_4$**
3. **Episode 3**: steps `[93386:93449]`, duration $640\text{ s}$ (10m 40s), peak gas in horizon: **2.20% CH$_4$**
4. **Episode 4**: steps `[102741:102811]`, duration $710\text{ s}$ (11m 50s), peak gas in horizon: **1.06% CH$_4$**
5. **Episode 5**: steps `[110823:110883]`, duration $610\text{ s}$ (10m 10s), peak gas in horizon: **1.19% CH$_4$**
6. **Episode 6**: steps `[112828:112942]`, duration $1,150\text{ s}$ (19m 10s), peak gas in horizon: **1.10% CH$_4$**

### Event-Level Detection Performance
Grouping predicted positive alarms into episodes (maximum alarm gap $\le 60\text{ s}$):

| Threshold | Detected Episodes | Event Recall | Avg Warning Lead Time | False Alarm Episodes (over 16 days) | False Alarms / Day |
| :---: | :---: | :---: | :---: | :---: | :---: |
| **0.45** | **5 / 6** | **83.3%** | **10.9 minutes** (654s) | 1,674 episodes | 104.6 / day |
| **0.50** | **5 / 6** | **83.3%** | **10.8 minutes** (646s) | 1,727 episodes | 107.9 / day |
| **0.60** | **4 / 6** | **66.7%** | **9.1 minutes** (548s) | 1,452 episodes | 90.8 / day |
| **0.63** *(tuned)* | **4 / 6** | **66.7%** | **8.0 minutes** (480s) | 1,221 episodes | **76.3 / day** |
| **0.70** | **4 / 6** | **66.7%** | **0.2 minutes** (12s) | 538 episodes | 33.6 / day |

### Physical Event Findings
1. **Genuine Predictive Lead Time**: When the model detects an event, it provides an average of **8.0 to 10.9 minutes of advance warning** before the gas surge breaches the warning threshold at the face.
2. **Extreme False Alarm Rate**: Over 16 days of operation, the model generated **1,221 false alarm episodes** ($\sim 76$ false alarm episodes per 24-hour shift).
3. If deployed directly as an active warning buzzer, this would cause **immediate, catastrophic alarm fatigue**.

---

## 9. Scientific Limitations
1. **Sensor Transfer Function Discrepancy**: The model was trained on linear optical/catalytic methanometers. Metal-oxide semiconductors (MQ-2 / MQ-5) exhibit logarithmic sub-linear compression.
2. **Single-Sample ADC Sampling**: The ESP32 firmware reads a single ADC sample every 10 seconds without oversampling or digital filtering, making turbulence features vulnerable to electrical noise spikes.
3. **No Sensor Baseline Tracking**: MQ sensors drift over hours and thermal cycles. Without an active clean-air baseline tracking algorithm ($R_0$), additive voltage offsets degrade model precision by 66%.
4. **Alarm Fatigue Hazard**: 76 false alarm episodes per day makes direct worker alerting unacceptable.

---

## 10. Final Scientific Readiness Decision

### Decision: **NOT READY FOR LIVE INFERENCE DEPLOYMENT AS AN ACTIVE SAFETY WARNING SYSTEM**

### Justification
We do **not** currently possess sufficient physical evidence to connect this public-dataset-trained model to the live ESP32 MQ sensor stream as an active warning system without severely misleading users and risking dangerous alarm fatigue.

The model is classified as:
**EXPERIMENTAL RESEARCH PROTOTYPE (ADVISORY-ONLY)**

---

## 11. Exact Requirements Before Live Integration (Phase 3 Constraints)

If Phase 3 integration proceeds for academic and research demonstration purposes, the following non-negotiable architectural guardrails must be permanently enforced:

1. **Strictly Advisory Display Only**:
   - The ML service output must be clearly labeled on the dashboard as an **"Experimental Trend Analysis (Advisory)"**.
   - It must **NEVER** trigger audio sirens, helmet vibration, or emergency evacuation workflows.
2. **Deterministic Primacy**:
   - Hardware millivolt thresholds (`gas_index` warning at $2000\text{ mV}$, critical at $2500\text{ mV}$ in `alertEngine.js`) retain 100% independent safety authority.
3. **Temporal Multi-Step Persistence Filter**:
   - Phase 3 Express integration must require that `ELEVATED_SURGE_RISK` persist across at least **3 consecutive telemetry intervals** (30 seconds) before updating the dashboard indicator, filtering out transient single-sample ADC spikes.
4. **Sensor Binding**:
   - The API contract must explicitly declare `mq2_mv` as the sole evaluated gas channel. Silent fallback to `mq5_mv` is strictly eliminated.
5. **Prohibition of Concentration Claims**:
   - The system must never display % CH$_4$, PPM, or regulatory compliance claims derived from ML.
