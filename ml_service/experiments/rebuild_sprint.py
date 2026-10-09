"""
Model Rebuild Sprint: Root-Cause Fix & Systematic Benchmarking
Executes comprehensive experiments across Targets A and B, Feature Tracks A and B/B+,
multiple algorithm families, strict chronological embargoes, and event-level metrics.
"""

import os
import sys
import time
import json
import numpy as np
import pandas as pd
import joblib

from sklearn.preprocessing import StandardScaler
from sklearn.linear_model import LogisticRegression
from sklearn.ensemble import RandomForestClassifier, ExtraTreesClassifier, HistGradientBoostingClassifier
from sklearn.metrics import (
    roc_auc_score,
    average_precision_score,
    precision_score,
    recall_score,
    f1_score,
    confusion_matrix
)

# Set random seed for reproducibility
np.random.seed(42)

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..")))
from ml_service.training.data_pipeline import load_and_preprocess_dataset
from ml_service.features.extractor import FeatureExtractor

# ==============================================================================
# 1. DATA PREPARATION & CHRONOLOGICAL PARTITIONS WITH EMBARGO
# ==============================================================================
print("[Sprint] 1. Loading and resampling dataset to 10s cadence...")
csv_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "..", "methane_data", "methane_data.csv"))
df_10s = load_and_preprocess_dataset(csv_path)

gas = df_10s["MM263"].astype(np.float64).values
temp = df_10s["TP1721"].astype(np.float64).values if "TP1721" in df_10s.columns else np.full(len(gas), 25.0)
hum = df_10s["RH1722"].astype(np.float64).values if "RH1722" in df_10s.columns else np.full(len(gas), 50.0)
press = df_10s["BA1723"].astype(np.float64).values if "BA1723" in df_10s.columns else np.full(len(gas), 1013.25)

n_total = len(df_10s)
HORIZON_STEPS_MAX = 90  # 15 minutes
EMBARGO_STEPS = 90      # 15-minute embargo between splits to prevent horizon leakage

valid_len = n_total - HORIZON_STEPS_MAX
split_train_raw = int(valid_len * 0.70)
split_val_raw = int(valid_len * 0.15)

# Partition indices with strict embargo:
idx_train = np.arange(0, split_train_raw - EMBARGO_STEPS)
idx_val = np.arange(split_train_raw, split_train_raw + split_val_raw - EMBARGO_STEPS)
idx_test = np.arange(split_train_raw + split_val_raw, valid_len)

print(f"[Sprint] Total points: {n_total:,}, Valid steps: {valid_len:,}")
print(f"[Sprint] Chronological Splits (with 15m Embargo):")
print(f"         Train: {len(idx_train):,} steps (indices 0 .. {idx_train[-1]})")
print(f"         Val:   {len(idx_val):,} steps (indices {idx_val[0]} .. {idx_val[-1]})")
print(f"         Test:  {len(idx_test):,} steps (indices {idx_test[0]} .. {idx_test[-1]})")

# ==============================================================================
# 2. TARGET DEFINITIONS
# ==============================================================================
print("[Sprint] 2. Generating Target Labels...")
# Future maximum gas in [t+30, t+90] (5 to 15 min forward window)
w_len = 61  # 30 to 90 steps inclusive = 61 steps
future_max = (
    pd.Series(gas)
    .iloc[::-1]
    .rolling(window=w_len, min_periods=1)
    .max()
    .iloc[::-1]
    .shift(-30)
    .values
)

# Target A: Existing definition (future max >= 1.0%)
target_A = (future_max >= 1.0).astype(int)

# Target B: Pre-Surge Event Forecasting (current gas < 1.0% AND future max >= 1.0%)
# Cleanly separates pre-surge warning from ongoing elevated gas conditions
target_B = ((future_max >= 1.0) & (gas < 1.0)).astype(int)

# Identify ground-truth physical episodes in Test set
def find_episodes(series, max_gap=6):
    indices = np.where(series == 1)[0]
    if len(indices) == 0:
        return []
    episodes = []
    start = indices[0]
    prev = indices[0]
    for idx in indices[1:]:
        if idx - prev <= max_gap:
            prev = idx
        else:
            episodes.append((start, prev))
            start = idx
            prev = idx
    episodes.append((start, prev))
    return episodes

gt_test_episodes = find_episodes((gas[idx_test] >= 1.0).astype(int), max_gap=6)
print(f"[Sprint] Independent ground-truth surge episodes in Test split: {len(gt_test_episodes)}")

# ==============================================================================
# 3. FEATURE EXTRACTION
# ==============================================================================
print("[Sprint] 3. Extracting Feature Tracks...")

# --- TRACK A: Calibrated Public-Dataset Benchmark (Using absolute % CH4) ---
def extract_track_A(df):
    g = df["MM263"].astype(np.float64)
    p = df["BA1723"].astype(np.float64) if "BA1723" in df.columns else pd.Series(1013.25, index=df.index)
    t = df["TP1721"].astype(np.float64) if "TP1721" in df.columns else pd.Series(25.0, index=df.index)
    h = df["RH1722"].astype(np.float64) if "RH1722" in df.columns else pd.Series(50.0, index=df.index)
    
    m5 = g.rolling(30, min_periods=5).mean().bfill()
    s5 = g.rolling(30, min_periods=5).std().fillna(0.0)
    m10 = g.rolling(60, min_periods=10).mean().bfill()
    s10 = g.rolling(60, min_periods=10).std().fillna(0.0)
    
    # Linear slope
    def get_slope(arr):
        n = len(arr)
        if n < 3: return 0.0
        x = np.arange(n)
        return float(np.polyfit(x, arr, 1)[0])
    
    slope15 = g.rolling(15, min_periods=3).apply(get_slope, raw=True).fillna(0.0)
    
    feats = pd.DataFrame({
        "current_gas": g,
        "dist_to_threshold": 1.0 - g,
        "mean_5m": m5,
        "std_5m": s5,
        "mean_10m": m10,
        "std_10m": s10,
        "abs_delta_5m": g - g.shift(30).bfill(),
        "abs_delta_10m": g - g.shift(60).bfill(),
        "abs_slope_5m": slope15,
        "mean_diff_5m_10m": m5 - m10,
        "rel_rate_of_change": (g - g.shift(6).bfill()) / np.maximum(m5, 0.01),
        "cv_5m": s5 / np.maximum(m5, 0.01),
        "press_delta_10m": p - p.shift(60).bfill(),
        "temp_delta_10m": t - t.shift(60).bfill(),
        "hum_delta_10m": h - h.shift(60).bfill()
    }, index=df.index)
    return feats

# --- TRACK B: Dimensionless Scale-Invariant Candidate ---
ext_B = FeatureExtractor()

# --- TRACK B+: Dimensionless with 30s Noise Filter & Local Baseline Subtraction ---
def extract_track_B_plus(df):
    # Pre-filter gas with 3-step (30s) median filter to suppress single-sample ADC spikes
    filtered_df = df.copy()
    filtered_df["MM263"] = df["MM263"].rolling(3, min_periods=1, center=True).median()
    # Baseline-subtracted dynamics
    g = filtered_df["MM263"].astype(np.float64)
    local_min_10m = g.rolling(60, min_periods=10).min().bfill()
    g_elevated = g - local_min_10m
    
    # Standard scale-invariant features on filtered series
    base_feats = ext_B.extract_from_dataframe(filtered_df)
    
    # Add local baseline elevation relative to rolling range
    range_10m = (g.rolling(60, min_periods=10).max() - local_min_10m).bfill()
    base_feats["norm_elevation_10m"] = (g_elevated / np.maximum(range_10m, 0.05)).fillna(0.0)
    base_feats["baseline_drift_10m"] = (local_min_10m - local_min_10m.shift(60).bfill()) / np.maximum(local_min_10m, 0.05)
    return base_feats

print("[Sprint] Extracting Track A features...")
X_A = extract_track_A(df_10s)
print("[Sprint] Extracting Track B features...")
X_B = ext_B.extract_from_dataframe(df_10s)
print("[Sprint] Extracting Track B+ features...")
X_B_plus = extract_track_B_plus(df_10s)

# ==============================================================================
# 4. SYSTEMATIC MODEL COMPARISON ENGINE
# ==============================================================================
def run_model_experiment(name, X_full, target_series, model_type="rf", **model_kwargs):
    """
    Fits preprocessor strictly on train set, fits model, tunes threshold on val set,
    evaluates once on held-out test set, and calculates episodic metrics.
    """
    X_tr = X_full.iloc[idx_train]
    y_tr = target_series[idx_train]
    
    X_va = X_full.iloc[idx_val]
    y_va = target_series[idx_val]
    
    X_te = X_full.iloc[idx_test]
    y_te = target_series[idx_test]
    
    # Preprocessing: StandardScaler fitted ON TRAIN ONLY
    scaler = StandardScaler()
    X_tr_s = scaler.fit_transform(X_tr)
    X_va_s = scaler.transform(X_va)
    X_te_s = scaler.transform(X_te)
    
    # Model instantiation
    if model_type == "lr":
        model = LogisticRegression(class_weight="balanced", max_iter=1000, random_state=42)
    elif model_type == "rf":
        model = RandomForestClassifier(
            n_estimators=model_kwargs.get("n_estimators", 100),
            max_depth=model_kwargs.get("max_depth", 10),
            class_weight="balanced",
            max_samples=0.5,
            random_state=42,
            n_jobs=-1
        )
    elif model_type == "et":
        model = ExtraTreesClassifier(
            n_estimators=model_kwargs.get("n_estimators", 100),
            max_depth=model_kwargs.get("max_depth", 10),
            class_weight="balanced",
            max_samples=0.5,
            random_state=42,
            n_jobs=-1
        )
    elif model_type == "hgb":
        model = HistGradientBoostingClassifier(
            class_weight="balanced",
            max_iter=model_kwargs.get("max_iter", 100),
            max_depth=model_kwargs.get("max_depth", 8),
            random_state=42
        )
    elif model_type == "baseline_rule":
        # Rule baseline: slope > 0.005 or rate_of_change > 0.05
        class RuleModel:
            def predict_proba(self, X):
                # mock proba from slope
                slopes = X[:, 4] if X.shape[1] > 4 else X[:, 0]
                p = 1.0 / (1.0 + np.exp(-slopes * 10))
                return np.column_stack([1 - p, p])
        model = RuleModel()
    
    if model_type != "baseline_rule":
        model.fit(X_tr_s, y_tr)
    
    # Predict validation probabilities
    if hasattr(model, "predict_proba"):
        val_probs = model.predict_proba(X_va_s)[:, 1]
        test_probs = model.predict_proba(X_te_s)[:, 1]
    else:
        val_probs = model.predict(X_va_s)
        test_probs = model.predict(X_te_s)
    
    # Validation Metrics
    val_roc = roc_auc_score(y_va, val_probs) if len(np.unique(y_va)) > 1 else 0.5
    val_pr = average_precision_score(y_va, val_probs)
    
    # Tune threshold on Validation split (search grid 0.10 to 0.90)
    best_th = 0.50
    best_val_f1 = 0.0
    for th in np.arange(0.10, 0.90, 0.02):
        f = f1_score(y_va, (val_probs >= th).astype(int), zero_division=0)
        if f > best_val_f1:
            best_val_f1 = f
            best_th = round(float(th), 2)
            
    # Final evaluation ON TEST SET (once)
    test_roc = roc_auc_score(y_te, test_probs) if len(np.unique(y_te)) > 1 else 0.5
    test_pr = average_precision_score(y_te, test_probs)
    ref_pr = float(np.mean(y_te))  # Prevalence-only reference PR-AUC
    
    preds_te = (test_probs >= best_th).astype(int)
    prec = precision_score(y_te, preds_te, zero_division=0)
    rec = recall_score(y_te, preds_te, zero_division=0)
    f1 = f1_score(y_te, preds_te, zero_division=0)
    cm = confusion_matrix(y_te, preds_te, labels=[0, 1])
    tn, fp, fn, tp = [int(v) for v in cm.ravel()]
    fpr = fp / (fp + tn) if (fp + tn) > 0 else 0.0
    pos_preds = int(tp + fp)
    
    # Episodic / Event-Level Analysis on Test Set
    pred_episodes = find_episodes(preds_te, max_gap=6)
    
    detected_episodes = 0
    lead_times = []
    for (st, en) in gt_test_episodes:
        # Search window [st - 90, en]
        search_st = max(0, st - 90)
        alarms = np.where(preds_te[search_st : en + 1] == 1)[0]
        if len(alarms) > 0:
            detected_episodes += 1
            first_alarm = search_st + alarms[0]
            lead_times.append((st - first_alarm) * 10)
            
    false_alarm_episodes = 0
    for (p_st, p_en) in pred_episodes:
        overlaps = False
        for (g_st, g_en) in gt_test_episodes:
            if not (p_en < max(0, g_st - 90) or p_st > g_en):
                overlaps = True
                break
        if not overlaps:
            false_alarm_episodes += 1
            
    test_duration_days = (len(idx_test) * 10) / (3600 * 24)
    fa_per_day = false_alarm_episodes / test_duration_days if test_duration_days > 0 else 0.0
    mean_lead_min = (np.mean(lead_times) / 60.0) if lead_times else 0.0
    event_recall = (detected_episodes / len(gt_test_episodes)) if len(gt_test_episodes) > 0 else 0.0
    
    result = {
        "experiment_name": name,
        "model_type": model_type,
        "best_threshold": best_th,
        "val_f1": round(best_val_f1, 4),
        "test_roc_auc": round(test_roc, 4),
        "test_pr_auc": round(test_pr, 4),
        "ref_pr_auc": round(ref_pr, 4),
        "test_precision": round(prec, 4),
        "test_recall": round(rec, 4),
        "test_f1": round(f1, 4),
        "test_fpr": round(fpr, 4),
        "tp_steps": tp,
        "fp_steps": fp,
        "fn_steps": fn,
        "tn_steps": tn,
        "pos_predictions": pos_preds,
        "event_recall": round(event_recall, 4),
        "detected_events": f"{detected_episodes}/{len(gt_test_episodes)}",
        "avg_lead_min": round(mean_lead_min, 1),
        "false_alarm_episodes": false_alarm_episodes,
        "fa_episodes_per_day": round(fa_per_day, 1),
        "model_artifact": model,
        "scaler_artifact": scaler
    }
    
    print(f"[Result] {name:40s} | ROC: {test_roc:.4f} | PR: {test_pr:.4f} (ref: {ref_pr:.4f}) | Prec: {prec*100:5.2f}% | Rec: {rec*100:5.2f}% | EvRec: {event_recall*100:5.1f}% | FA/Day: {fa_per_day:5.1f}")
    return result

# ==============================================================================
# 5. RUN COMPREHENSIVE EXPERIMENT MATRIX
# ==============================================================================
print("\n" + "="*110)
print("RUNNING SYSTEMATIC EXPERIMENT MATRIX")
print("="*110)

experiments = []

# Target A Experiments (Existing Target)
experiments.append(run_model_experiment("Track A - Benchmark (RF) [Target A]", X_A, target_A, model_type="rf", n_estimators=100, max_depth=12))
experiments.append(run_model_experiment("Track A - Benchmark (HGB) [Target A]", X_A, target_A, model_type="hgb", max_depth=8))
experiments.append(run_model_experiment("Track B - Dimensionless (RF) [Target A]", X_B, target_A, model_type="rf", n_estimators=100, max_depth=12))
experiments.append(run_model_experiment("Track B - Dimensionless (HGB) [Target A]", X_B, target_A, model_type="hgb", max_depth=8))
experiments.append(run_model_experiment("Track B - Dimensionless (LR) [Target A]", X_B, target_A, model_type="lr"))
experiments.append(run_model_experiment("Track B+ - Filtered/Norm (RF) [Target A]", X_B_plus, target_A, model_type="rf", n_estimators=100, max_depth=12))
experiments.append(run_model_experiment("Track B+ - Filtered/Norm (HGB) [Target A]", X_B_plus, target_A, model_type="hgb", max_depth=8))

# Target B Experiments (Pre-Surge Event Forecasting)
experiments.append(run_model_experiment("Track A - Benchmark (RF) [Target B]", X_A, target_B, model_type="rf", n_estimators=100, max_depth=12))
experiments.append(run_model_experiment("Track A - Benchmark (HGB) [Target B]", X_A, target_B, model_type="hgb", max_depth=8))
experiments.append(run_model_experiment("Track B - Dimensionless (RF) [Target B]", X_B, target_B, model_type="rf", n_estimators=100, max_depth=12))
experiments.append(run_model_experiment("Track B - Dimensionless (HGB) [Target B]", X_B, target_B, model_type="hgb", max_depth=8))
experiments.append(run_model_experiment("Track B+ - Filtered/Norm (RF) [Target B]", X_B_plus, target_B, model_type="rf", n_estimators=100, max_depth=12))
experiments.append(run_model_experiment("Track B+ - Filtered/Norm (HGB) [Target B]", X_B_plus, target_B, model_type="hgb", max_depth=8))

# ==============================================================================
# 6. SERIALIZE RESULTS
# ==============================================================================
out_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "rebuild_results.json"))

# Convert results to clean JSON dict (excluding raw model objects)
serializable_results = []
for res in experiments:
    r_copy = {k: v for k, v in res.items() if k not in ["model_artifact", "scaler_artifact"]}
    serializable_results.append(r_copy)

with open(out_path, "w") as f:
    json.dump(serializable_results, f, indent=2)

print("\n[Sprint] Experiments finished. Results saved to:", out_path)
