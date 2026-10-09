# 05 — ML Model Specification

## 1. Model Role & Objective
- The model functions as a **Binary Gas-Surge Early Warning Classifier**.
- **Role**: Given a recent normalized temporal sliding window of helmet gas sensor readings (`mq2_mv`, `mq5_mv`) and climate context, it estimates the probability that a significant gas escalation event will occur within the next 5–15 minutes.
- **Output Definition**: Probability score $[0.0, 1.0]$ representing short-term gas escalation risk.
- **Safety Rule**: The model does **not** predict absolute % CH4, PPM, or regulatory compliance.

---

## 2. Input Contract (Inference Request)
The inference request payload passed from the Express gateway to the ML service represents a structured time-series window:
```json
{
  "worker_id": "W001",
  "helmet_id": "H001",
  "timestamp": "2026-10-09T01:30:00.000Z",
  "window_size": 15,
  "cadence_sec": 10,
  "readings": [
    {
      "ts": "2026-10-09T01:27:30.000Z",
      "mq2_mv": 1420,
      "mq5_mv": 1340,
      "temperature": 28.2,
      "humidity": 64.0,
      "pressure": 1012.5
    }
  ],
  "features": {
    "rel_delta_5m": 0.125,
    "rel_delta_10m": 0.240,
    "rel_ratio_5m_10m": 0.082,
    "rel_rate_of_change": 0.045,
    "norm_slope_5m": 0.021,
    "cv_5m": 0.145,
    "cv_10m": 0.182,
    "z_score_5m": 1.42,
    "rel_range_5m": 0.310,
    "ratio_volatility_5m_10m": 0.85,
    "press_rel_delta_10m": -0.0012,
    "temp_delta_10m": 0.2,
    "hum_delta_10m": -1.5
  }
}
```

---

## 3. Output Contract (Inference Response)
The inference response returned by the ML service:
```json
{
  "worker_id": "W001",
  "timestamp": "2026-10-09T01:30:00.000Z",
  "model_version": "v1.1-surge-classifier-dimensionless",
  "surge_probability": 0.78,
  "surge_risk_level": "ELEVATED_SURGE_RISK",
  "prediction_horizon_min": 10,
  "trend_direction": "rising",
  "feature_summary": {
    "normalized_slope": 0.021,
    "current_mq2_mv": 1490
  },
  "is_stale": false,
  "latency_ms": 12.4
}
```
*Note: Fields represent validated classification risk outputs. Absolute gas concentration (% CH4) is never included.*

---

## 4. Evaluation Metrics
The model performance will be determined by training on the coal mine dataset. No synthetic or invented accuracy numbers are permitted in this contract. Required evaluation metrics on the unseen chronological test partition:
- **Precision (Positive Surge Class)**: $\frac{TP}{TP + FP}$ (Minimizing false evacuations).
- **Recall (Positive Surge Class)**: $\frac{TP}{TP + FN}$ (Detecting all real gas surges).
- **F1-Score**: Harmonic mean of Precision and Recall.
- **PR-AUC**: Area Under Precision-Recall Curve (the primary metric for rare event detection).
- **ROC-AUC**: Area Under Receiver Operating Characteristic Curve.
- **Confusion Matrix**: Full breakdown of $TP, FP, TN, FN$.

---

## 5. Artifact Storage & Metadata
Serialized artifacts must be placed in `ml_service/models/`:
- `gas_trend_model.joblib`: Trained estimator.
- `scaler_pipeline.joblib`: Preprocessing pipeline.
- `model_metadata.json`: Audit log containing:
  - Model architecture and hyperparameter settings
  - Training dataset hash and date range
  - Target label definition ($H = 5\text{ to }15\text{ min}$)
  - Feature list and input dimensions
  - Cadence resampling configuration ($10\text{ seconds}$)
  - Validation-tuned decision threshold
  - Empirical test set evaluation metrics
  - Training timestamp and environment versions

---

## 6. Empirical Validation Results & Operational Classification (Phase 2.2)
- **Model Version**: `v1.1-surge-classifier-dimensionless` (HistGradientBoostingClassifier on 13 dimensionless features).
- **Test Set Performance ($\tau = 0.63$, 137,986 test steps / 16 days)**:
  - **Precision**: 1.08%
  - **Recall**: 16.50%
  - **F1-Score**: 0.0202
  - **ROC-AUC**: 0.6974
  - **PR-AUC**: 0.0193
  - **False Positive Rate**: 5.54% (7,621 false positive steps)
- **Event-Level Episodic Metrics**:
  - Total ground-truth surge episodes in test holdout: 6
  - Surge episodes detected ($\ge 1$ alarm in episode window): 4 of 6 (66.7% event recall)
  - Average advance lead time: 8.0 minutes before physical surge threshold crossing
  - False alarm episodes: 1,221 episodes (~76.3 false alarm episodes per 24-hour period)
- **Synthetic Robustness Findings**:
  - Multiplicative scaling ($10\times$): 100% feature and prediction invariance.
  - Additive baseline shift ($+0.5$): Triples false alarm instances (FP 7,621 $\to$ 22,598).
  - Unfiltered Gaussian noise ($\sigma = 0.05$): Degrades ROC-AUC from 0.697 to 0.547 (near chance).
- **Formal System Classification**:
  - Classified as **EXPERIMENTAL RESEARCH PROTOTYPE (ADVISORY-ONLY)**.
  - **NOT READY** for autonomous life-safety alerting or automated evacuation triggering due to extreme alarm fatigue hazard (~76 false alarm episodes/day).

