import os
from pathlib import Path

# Paths
BASE_DIR = Path(__file__).resolve().parent
MODELS_DIR = BASE_DIR / "models"
MODELS_DIR.mkdir(parents=True, exist_ok=True)

MODEL_PATH = MODELS_DIR / "gas_trend_model.joblib"
SCALER_PATH = MODELS_DIR / "scaler_pipeline.joblib"
METADATA_PATH = MODELS_DIR / "model_metadata.json"

# Service Configuration
HOST = os.getenv("ML_SERVICE_HOST", "0.0.0.0")
PORT = int(os.getenv("ML_SERVICE_PORT", "8000"))
SERVICE_NAME = "mineguard-ml-service"
VERSION = "1.0.0"

# Time Series & Sampling Configuration
SAMPLING_CADENCE_SEC = 10  # Resampled from 1Hz dataset to 10s to match helmet telemetry
WINDOW_STEPS_5MIN = 30     # 5 minutes at 10-second cadence
WINDOW_STEPS_10MIN = 60    # 10 minutes at 10-second cadence
WINDOW_STEPS_15MIN = 90    # 15 minutes at 10-second cadence

# Prediction Horizon (5 to 15 minutes ahead)
HORIZON_STEPS_MIN = 30     # 5 minutes ahead
HORIZON_STEPS_MAX = 90     # 15 minutes ahead
PREDICTION_HORIZON_MIN = 10

# Dataset Target Sensor & Thresholds (from attribute_information.txt)
TARGET_SENSOR = "MM263"                  # Longwall coal face target methane sensor
WARNING_THRESHOLD_CH4 = 1.0              # Threshold W = 1.0% CH4 (warning limit)
ALARM_THRESHOLD_CH4 = 1.5                # Threshold A = 1.5% CH4 (alarm limit)

# Dimensionless, Scale-Invariant Feature Set (Defensible Cross-Domain Contract)
FEATURE_NAMES = [
    "rel_delta_5m",           # (x_t - x_{t-30}) / mu_5m
    "rel_delta_10m",          # (x_t - x_{t-60}) / mu_10m
    "rel_ratio_5m_10m",       # (mu_5m - mu_10m) / mu_10m
    "rel_rate_of_change",     # (x_t - x_{t-6}) / mu_5m
    "norm_slope_5m",          # slope_15 / mu_5m
    "cv_5m",                  # sigma_5m / mu_5m (Coefficient of variation 5m)
    "cv_10m",                 # sigma_10m / mu_10m (Coefficient of variation 10m)
    "z_score_5m",             # (x_t - mu_5m) / max(sigma_5m, eps)
    "rel_range_5m",           # (max_5m - min_5m) / mu_5m
    "ratio_volatility_5m_10m",# sigma_5m / max(sigma_10m, eps)
    "press_rel_delta_10m",    # (P_t - P_{t-60}) / P_{t-60}
    "temp_delta_10m",         # T_t - T_{t-60}
    "hum_delta_10m"           # RH_t - RH_{t-60}
]

# Risk Thresholds
DEFAULT_DECISION_THRESHOLD = 0.50
ELEVATED_SURGE_THRESHOLD = 0.50
CRITICAL_SURGE_THRESHOLD = 0.75

# Risk Levels
RISK_NORMAL = "NORMAL"
RISK_ELEVATED = "ELEVATED_SURGE_RISK"
RISK_CRITICAL = "CRITICAL_SURGE_RISK"
