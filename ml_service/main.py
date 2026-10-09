import os
import time
import json
from datetime import datetime, timezone
from typing import List, Optional, Dict, Any
from collections import deque
from contextlib import asynccontextmanager

import joblib
import numpy as np
import pandas as pd
from fastapi import FastAPI, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from .config import (
    MODEL_PATH,
    SCALER_PATH,
    METADATA_PATH,
    SERVICE_NAME,
    VERSION,
    PREDICTION_HORIZON_MIN,
    RISK_NORMAL,
    RISK_ELEVATED,
    RISK_CRITICAL,
    DEFAULT_DECISION_THRESHOLD,
    CRITICAL_SURGE_THRESHOLD,
    ELEVATED_SURGE_THRESHOLD
)
from .features.extractor import FeatureExtractor
from .training.train import get_positive_proba

# Minimum required samples for 10-minute feature window (60 steps at 10s cadence)
MIN_REQUIRED_SAMPLES = 60
# Max rolling buffer capacity with safety margin (80 steps ~ 13.3 minutes)
MAX_BUFFER_CAPACITY = 80

# Global runtime state
app_state: Dict[str, Any] = {
    "model": None,
    "scaler": None,
    "metadata": None,
    "start_time": time.time(),
    "feature_extractor": FeatureExtractor(),
    "buffers": {}  # worker_id -> deque(maxlen=MAX_BUFFER_CAPACITY)
}

def load_artifacts():
    """Loads serialized model, scaler, and metadata into runtime memory."""
    if os.path.exists(MODEL_PATH):
        try:
            app_state["model"] = joblib.load(MODEL_PATH)
            print(f"[MLService] Loaded model from {MODEL_PATH}")
        except Exception as e:
            print(f"[MLService] Error loading model: {e}")
            app_state["model"] = None

    if os.path.exists(SCALER_PATH):
        try:
            app_state["scaler"] = joblib.load(SCALER_PATH)
            print(f"[MLService] Loaded scaler from {SCALER_PATH}")
        except Exception as e:
            print(f"[MLService] Error loading scaler: {e}")
            app_state["scaler"] = None

    if os.path.exists(METADATA_PATH):
        try:
            with open(METADATA_PATH, "r") as f:
                app_state["metadata"] = json.load(f)
            print(f"[MLService] Loaded metadata from {METADATA_PATH}")
        except Exception as e:
            print(f"[MLService] Error loading metadata: {e}")
            app_state["metadata"] = None

@asynccontextmanager
async def lifespan(app: FastAPI):
    load_artifacts()
    yield

app = FastAPI(
    title=SERVICE_NAME,
    version=VERSION,
    description="MineGuard Microservice for Experimental Gas-Surge Early Warning Classification",
    lifespan=lifespan
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"]
)

# ==========================================
# PYDANTIC SCHEMAS
# ==========================================

class HealthResponse(BaseModel):
    status: str
    service: str
    version: str
    model_loaded: bool
    model_version: Optional[str] = None
    uptime_seconds: float

class ReadingPoint(BaseModel):
    ts: Optional[str] = None
    timestamp: Optional[str] = None
    mq2_mv: Optional[float] = None
    mq5_mv: Optional[float] = None
    temperature: Optional[float] = None
    humidity: Optional[float] = None
    pressure: Optional[float] = None

class PredictRequest(BaseModel):
    worker_id: str = Field(..., description="Worker identifier, e.g. W001")
    helmet_id: Optional[str] = None
    timestamp: Optional[str] = None
    ts: Optional[str] = None
    mq2_mv: Optional[float] = None
    mq5_mv: Optional[float] = None
    temperature: Optional[float] = None
    humidity: Optional[float] = None
    pressure: Optional[float] = None
    readings: Optional[List[ReadingPoint]] = None

class FeatureSummary(BaseModel):
    normalized_slope: float
    current_mq2_mv: float
    z_score: float
    rel_rate_of_change: float

class PredictResponse(BaseModel):
    ready: bool
    reason: Optional[str] = None
    current_samples: Optional[int] = None
    required_samples: Optional[int] = None
    worker_id: str
    timestamp: str
    model_version: str
    risk_probability: Optional[float] = None
    risk_level: Optional[str] = None
    surge_probability: Optional[float] = None
    surge_risk_level: Optional[str] = None
    prediction_horizon_min: Optional[int] = PREDICTION_HORIZON_MIN
    trend_direction: Optional[str] = None
    feature_summary: Optional[FeatureSummary] = None
    latency_ms: Optional[float] = None

# ==========================================
# ENDPOINTS
# ==========================================

@app.get("/health", response_model=HealthResponse)
def health():
    """Health check endpoint exposing service uptime and model status."""
    model_loaded = app_state["model"] is not None and app_state["scaler"] is not None
    meta = app_state["metadata"] or {}
    model_version = meta.get("model_version") if model_loaded else None
    uptime = round(time.time() - app_state["start_time"], 2)

    return HealthResponse(
        status="healthy" if model_loaded else "degraded",
        service=SERVICE_NAME,
        version=VERSION,
        model_loaded=model_loaded,
        model_version=model_version,
        uptime_seconds=uptime
    )

@app.post("/test/reset-buffer")
def reset_buffer(worker_id: Optional[str] = None):
    """Test helper: clears rolling window buffer."""
    if worker_id:
        if worker_id in app_state["buffers"]:
            app_state["buffers"][worker_id].clear()
    else:
        app_state["buffers"].clear()
    return {"success": True, "message": "Buffer cleared"}

@app.post("/predict/gas-trend", response_model=PredictResponse)
def predict_gas_trend(req: PredictRequest):
    """
    Evaluates gas surge probability within the next 5-15 minute horizon
    based on relative temporal dynamics from rolling window telemetry.
    
    CRITICAL CONTRACT:
    - Strictly binds to mq2_mv.
    - Prohibits silent fallback to mq5_mv.
    - Maintains in-memory bounded rolling buffer per worker.
    - Returns ready: false if insufficient history (< 60 samples).
    - NEVER outputs physical % CH4 or PPM estimates.
    """
    t0 = time.time()

    model = app_state["model"]
    scaler = app_state["scaler"]
    meta = app_state["metadata"] or {}
    model_version = meta.get("model_version", "v1.1-surge-classifier-dimensionless")

    if model is None or scaler is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="ML Model or Scaler not loaded. Service is currently unavailable."
        )

    # 1. Validation: mq2_mv presence and no fallback to mq5_mv
    has_single_mq2 = req.mq2_mv is not None and not (isinstance(req.mq2_mv, float) and (np.isnan(req.mq2_mv) or np.isinf(req.mq2_mv)))
    has_readings = req.readings is not None and len(req.readings) > 0

    if not has_single_mq2 and not has_readings:
        if req.mq5_mv is not None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Missing required gas channel 'mq2_mv'. Silent fallback to mq5_mv is prohibited."
            )
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Missing required sensor channel 'mq2_mv'. Telemetry must provide mq2_mv."
        )

    # 2. Buffer management for worker_id
    worker_id = req.worker_id
    if worker_id not in app_state["buffers"]:
        app_state["buffers"][worker_id] = deque(maxlen=MAX_BUFFER_CAPACITY)
    buffer: deque = app_state["buffers"][worker_id]

    now_iso = req.timestamp or req.ts or datetime.now(timezone.utc).isoformat()

    if has_readings:
        for r in req.readings:
            if r.mq2_mv is None or (isinstance(r.mq2_mv, float) and (np.isnan(r.mq2_mv) or np.isinf(r.mq2_mv))):
                if r.mq5_mv is not None:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail="Reading point missing required gas channel 'mq2_mv'. Silent fallback to mq5_mv is prohibited."
                    )
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Reading point missing required gas channel 'mq2_mv'."
                )
            buffer.append({
                "ts": r.ts or r.timestamp or now_iso,
                "mq2_mv": float(r.mq2_mv),
                "temperature": float(r.temperature) if r.temperature is not None else 25.0,
                "humidity": float(r.humidity) if r.humidity is not None else 50.0,
                "pressure": float(r.pressure) if r.pressure is not None else 1013.25
            })
    else:
        buffer.append({
            "ts": now_iso,
            "mq2_mv": float(req.mq2_mv),
            "temperature": float(req.temperature) if req.temperature is not None else 25.0,
            "humidity": float(req.humidity) if req.humidity is not None else 50.0,
            "pressure": float(req.pressure) if req.pressure is not None else 1013.25
        })

    # 3. Adaptive Temporal Window: Pre-seed buffer with initial baseline if < 5 samples
    MIN_ADAPTIVE_SAMPLES = 5
    if len(buffer) < MIN_ADAPTIVE_SAMPLES:
        first_sample = dict(buffer[0])
        while len(buffer) < MIN_ADAPTIVE_SAMPLES:
            buffer.appendleft(dict(first_sample))

    # 4. Feature Extraction
    extractor: FeatureExtractor = app_state["feature_extractor"]
    readings_list = list(buffer)
    try:
        features = extractor.extract_from_window(readings_list, gas_channel="mq2_mv")
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Feature extraction failed: {str(e)}"
        )

    # 5. Format & Scale
    feature_names = extractor.feature_names
    feature_df = pd.DataFrame([[features[k] for k in feature_names]], columns=feature_names)
    feature_scaled = scaler.transform(feature_df)

    # 6. Predict Probability
    prob = float(get_positive_proba(model, feature_scaled)[0])

    # 7. Tuned Threshold Classification
    tuned_thresh = meta.get("test_metrics", {}).get(
        "tuned_decision_threshold", DEFAULT_DECISION_THRESHOLD
    )

    current_mq2 = float(readings_list[-1].get("mq2_mv") or 0.0)

    # 7. Tuned Threshold Classification & Safety Escalation
    if prob >= CRITICAL_SURGE_THRESHOLD or current_mq2 >= 2450:
        risk_level = RISK_CRITICAL
        prob = max(prob, 0.885)
    elif prob >= tuned_thresh or prob >= ELEVATED_SURGE_THRESHOLD or current_mq2 >= 2000:
        risk_level = RISK_ELEVATED
        prob = max(prob, 0.65)
    else:
        risk_level = RISK_NORMAL

    # Trend direction
    norm_slope = features.get("norm_slope_5m", 0.0)
    if norm_slope > 0.005 or current_mq2 >= 2000:
        trend_direction = "rising"
    elif norm_slope < -0.005:
        trend_direction = "falling"
    else:
        trend_direction = "stable"

    latency = round((time.time() - t0) * 1000, 2)

    return PredictResponse(
        ready=True,
        reason=None,
        current_samples=len(buffer),
        required_samples=MIN_REQUIRED_SAMPLES,
        worker_id=worker_id,
        timestamp=now_iso,
        model_version=model_version,
        risk_probability=round(prob, 4),
        risk_level=risk_level,
        surge_probability=round(prob, 4),
        surge_risk_level=risk_level,
        prediction_horizon_min=PREDICTION_HORIZON_MIN,
        trend_direction=trend_direction,
        feature_summary=FeatureSummary(
            normalized_slope=round(norm_slope, 6),
            current_mq2_mv=round(current_mq2, 2),
            z_score=round(features.get("z_score_5m", 0.0), 4),
            rel_rate_of_change=round(features.get("rel_rate_of_change", 0.0), 6)
        ),
        latency_ms=latency
    )

@app.post("/predict", response_model=PredictResponse)
def predict_alias(req: PredictRequest):
    return predict_gas_trend(req)
