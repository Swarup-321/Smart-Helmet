# 03 — ML Requirements

## 1. Primary Task: Binary Gas-Surge Early Warning
- The ML task is strictly defined as **BINARY GAS-SURGE EARLY WARNING**.
- **Definition**: Given a sliding window of recent normalized temporal gas sensor dynamics (last 15–30 readings, corresponding to 2.5–5 minutes of telemetry), predict whether a significant gas escalation event will occur within the next **5 to 15 minutes** ($H = 30\text{ to }90$ downsampled steps at 10-second cadence).
- The goal is predictive situational awareness of gas surge risk, providing miners and safety supervisors early advance notice before physical danger thresholds are reached.

---

## 2. Explicit Prohibition of Absolute Concentration Prediction
- The ML system must **NOT** attempt to predict:
  - Absolute methane percentage (% CH4)
  - Calibrated gas concentration in PPM
  - Regulatory threshold breach proofs from raw electrical millivolts
- **Rationale**: MQ-2 and MQ-5 sensors on the helmet output uncalibrated electrical millivolts. Predicting absolute physical concentrations without sensor-specific clean-air baseline resistance ($R_0$) calibration curves is scientifically invalid.

---

## 3. Separation of ML Warning from Deterministic Safety Alerts
- **Safety Boundary**: The ML engine is strictly an advisory, early-warning analytical layer.
- **Independence of Deterministic Rules**:
  - The local hardware buzzer on the ESP32 (triggered when $V \ge 2500\text{ mV}$ or SOS is active) remains primary and operates even in total network isolation.
  - Node.js `AlertEngine` threshold rules (gas index warning: 2000 mV, critical: 2500 mV; heart rate limits; SpO2 hypoxia limits) run deterministically on every incoming telemetry packet.
  - An ML service timeout, failure, or offline state must never suppress, delay, or modify deterministic safety alarms.

---

## 4. Input Features
The ML pipeline must consume only consistently persisted, physically relevant features:
- Normalized relative temporal gas dynamics extracted from `mq2_mv` and `mq5_mv`
- Ambient `temperature` and `humidity`
- Atmospheric `pressure` (after SQLite persistence correction)
- Derived temporal indicators (slopes, moving averages, standard deviation, z-scores)
- **Excluded**: Biometric vitals (`heart_rate`, `spo2`), light (`ldr_raw`), and communication metadata are excluded because they are absent from the underground mine training dataset.

---

## 5. Model Selection & Explainability
- Implement explainable, tabular time-series models (e.g., Logistic Regression with regularization, Random Forest, or LightGBM/XGBoost).
- Compare the ML classifier directly against the existing pure-JavaScript linear regression slope baseline (`trendService.js`).
- The final production model must be selected based on empirical validation performance on unseen chronological test data.

---

## 6. Evaluation Framework
- **Chronological Split**: Enforce strict chronological separation into training, validation, and holdout test periods. Time-series observations must never be randomly shuffled across splits.
- **Metrics**: Accuracy is misleading due to class imbalance. Mandatory evaluation metrics:
  - Precision, Recall, and F1-score for the positive surge class
  - Precision-Recall AUC (PR-AUC)
  - Receiver Operating Characteristic AUC (ROC-AUC)
  - Confusion Matrix

---

## 7. Class Imbalance Handling
- Elevated gas surge events in coal mines are naturally rare.
- Class weighting (`class_weight='balanced'`) must be evaluated on the training set. Synthetic oversampling must never leak into validation or test segments.

---

## 8. Output Integrity
- The ML output represents **gas escalation risk / surge probability** $[0.0, 1.0]$ and status categories (`NORMAL`, `ELEVATED_SURGE_RISK`, `CRITICAL_SURGE_RISK`).
- Never fabricate probability, lead time, or confidence numbers. Values displayed on the dashboard must originate strictly from verified model inference outputs.
