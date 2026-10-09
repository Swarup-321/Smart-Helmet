# 04 — ML Dataset and Training Pipeline

## 1. Source Dataset Verification
- **Verified Source File**: `methane_data/methane_data.csv` (1,100,913,052 bytes / ~1.10 GB; 2014 telemetric underground coal mine data).
- **Accompanying Documentation**: `attribute_information.txt` and `plots.pdf`.
- **Target Methane Sensors**: `MM263`, `MM264`, `MM256` explicitly tagged as `!target sensor!` (measuring % CH4 at longwall coal face; warning limit $W = 1.0\%$, alarm limit $A = 1.5\%$).
- **Environmental Telemetry**: Temperature (`TP1721`), relative humidity (`RH1722`), barometric pressure (`BA1723`).

---

## 2. Mandatory Cadence Resampling (1.0 Hz -> 0.1 Hz)
- The public dataset records second-by-second observations (**1.0 second / 1.0 Hz**).
- Physical smart helmet firmware transmits every **10 seconds / 0.1 Hz** (`POST_INTERVAL_MS = 10000`).
- **Pipeline Requirement**: The data pipeline must downsample/resample the dataset into **10-second time steps** (using mean or median aggregation). Training on un-resampled 1-second data would introduce a $10\times$ temporal frequency mismatch during live helmet inference.

---

## 3. Ratified Feature Generation Strategy
To bridge the domain gap between calibrated % CH4 mine telemetry and raw helmet millivolts (`mq2_mv`, `mq5_mv`), the feature pipeline extracts strictly **dimensionless, scale-invariant relative temporal dynamics**:
1. **Normalized Change**: Relative delta over sliding windows:
   $$\Delta x_{\text{rel}} = \frac{x_t - x_{t-k}}{\mu_{\text{rolling}}}$$
2. **Relative Rate of Change**: $\frac{x_t - x_{t-6}}{\mu_{5m}}$ (1-minute velocity relative to 5m mean).
3. **Normalized Dispersion & Volatility**: Coefficient of variation ($CV = \frac{\sigma}{\mu}$) over 5m and 10m windows, and short-to-long volatility ratio ($\frac{\sigma_{5m}}{\sigma_{10m}}$) (strictly banning raw scale-dependent rolling means and stds).
4. **Standardized Anomaly Score (Z-Score)**:
   $$z_t = \frac{x_t - \mu_{\text{rolling}}}{\max(\sigma_{\text{rolling}}, \epsilon)}$$
5. **Normalized Trend Slope**: Slope calculated via linear regression over the recent window divided by rolling mean ($\frac{\text{slope}}{\mu}$).
6. **Ambient Environmental Differentials**: Relative pressure change ($\frac{\Delta P}{P}$), temperature differential ($\Delta T$), and humidity differential ($\Delta RH$), ensuring invariance to absolute mine shaft elevation.

*Live helmet inference computes identical normalized relative temporal features from sliding windows of `mq2_mv` and `mq5_mv` stored in backend memory.*

---

## 4. Target Label & Prediction Horizon
- **Early-Warning Horizon**: $H = 5\text{ to }15\text{ minutes}$ (30 to 90 steps at 10-second cadence).
- **Binary Target Formulation**:
  $$y_t = \mathbb{I}\left(\max_{k \in [t+1, t+H]} (\text{TargetGas}_k) \ge \text{Threshold}\right)$$
  where Threshold corresponds to significant gas escalation (e.g. warning threshold $W = 1.0\% \text{ CH}_4$ on `MM263`).
- $y_t = 1$ indicates that an escalation event occurs within the next 5–15 minutes; $y_t = 0$ represents normal operational bounds.

---

## 5. Chronological Splitting & Leakage Controls
- **Chronological Split Only**: Split by timestamp into continuous blocks (e.g., Months 1–2 Training, Month 3 Validation, Month 4 Test).
- **Strict Leakage Prevention**:
  - Never compute features using future data points ($t + k$).
  - Never randomly shuffle time-series records across splits.
  - Fit scalers, imputers, and normalization parameters **exclusively on the training split**, then transform validation and test sets.
  - Never use test-set observations during decision threshold tuning.

---

## 6. Class Imbalance Handling
- Elevated gas surge events in coal mines represent a minority class.
- Handle imbalance strictly on the training partition:
  - Utilize cost-sensitive learning (`class_weight='balanced'`) during model fitting.
  - Tune the decision threshold (e.g. optimizing F1 or PR-AUC) on the validation set.
  - Synthetic oversampling (SMOTE) across time-series records is prohibited to avoid destroying temporal trajectory autocorrelation.

---

## 7. Deliverables & Artifact Versioning
The training pipeline must export reproducible artifacts to `ml_service/models/`:
- `gas_trend_model.joblib`: Serialized trained classifier artifact.
- `scaler_pipeline.joblib`: Fitted normalization and feature transformer.
- `model_metadata.json`: Complete audit record containing model version, feature list, sampling window parameters, train/val/test periods, decision threshold, and evaluation metrics (Precision, Recall, F1, PR-AUC, ROC-AUC).

---

## 8. Sensor-Domain Validation & Transferability Limits (Phase 2.2 Ratification)
- **Firmware Characteristics (`sketch_oct2a.ino`)**:
  - Telemetry transmits instantaneous single-sample ADC measurements on GPIO 34 (`mq2_mv`) and GPIO 35 (`mq5_mv`) every 10 seconds.
  - No digital filtering (oversampling, median filter, moving average) is applied on the ESP32 before transmission.
  - Zero sensor-specific baseline calibration ($R_0$) or clean-air normalization is executed in firmware.
  - Zero ambient temperature/humidity compensation is applied to MOS raw readings.
- **Dataset Divergence**:
  - Training dataset sensor (`MM263`) is an industrial stationary methanometer (`MM-2PWk`) calibrated linearly for % CH4 ($0-5\% \text{ CH}_4$).
  - Target helmet sensors are broad-spectrum tin-dioxide ($\text{SnO}_2$) chemiresistors exhibiting power-law response ($R_s/R_0 = A \cdot C^B$) and cross-sensitivity to LPG, propane, hydrogen, alcohol, and carbon monoxide.
- **Scale Invariance vs Physical Equivalence**:
  - While Phase 2.1 scale-invariant relative features ($CV$, relative rate of change, normalized regression slope, relative deltas) resolve mathematical scale mismatch, they cannot compensate for the non-linear transfer function, thermal drift, or single-sample ADC noise spikes of uncalibrated breadboard sensors.
- **Channel Binding**:
  - Training pipeline and inference feature extraction are strictly bound to `mq2_mv`. Silent fallback to `mq5_mv` is prohibited due to differing sensor chemistries and electrical sensitivities.

