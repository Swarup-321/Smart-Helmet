"""
Robustness benchmark comparing Track B (Dimensionless RF) vs Track B+ (Filtered/Normalized RF)
Evaluates event recall and false alarm rate under 8 synthetic distortions.
"""

import os
import sys
import json
import numpy as np
import pandas as pd
import joblib

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..")))
from ml_service.training.data_pipeline import load_and_preprocess_dataset
from ml_service.features.extractor import FeatureExtractor
from sklearn.metrics import precision_score, recall_score, roc_auc_score

print("[Robustness] Loading dataset...")
csv_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "..", "methane_data", "methane_data.csv"))
df_10s = load_and_preprocess_dataset(csv_path)

valid_len = len(df_10s) - 90
split_train_raw = int(valid_len * 0.70)
split_val_raw = int(valid_len * 0.15)
idx_test = np.arange(split_train_raw + split_val_raw, valid_len)

test_df = df_10s.iloc[idx_test].copy().reset_index(drop=True)
gas_test = test_df["MM263"].values

w_len = 61
future_max = (
    pd.Series(df_10s["MM263"].values)
    .iloc[::-1]
    .rolling(window=w_len, min_periods=1)
    .max()
    .iloc[::-1]
    .shift(-30)
    .values
)
y_test = (future_max[idx_test] >= 1.0).astype(int)

# Identify ground truth test episodes
def find_episodes(series, max_gap=6):
    indices = np.where(series == 1)[0]
    if len(indices) == 0: return []
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

gt_episodes = find_episodes((gas_test >= 1.0).astype(int), max_gap=6)
test_days = (len(gas_test) * 10) / (3600 * 24)

# Load existing trained model and scaler
model = joblib.load(os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "models", "gas_trend_model.joblib")))
scaler = joblib.load(os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "models", "scaler_pipeline.joblib")))
ext = FeatureExtractor()

def evaluate_signal(name, gas_signal):
    eval_df = test_df.copy()
    eval_df["MM263"] = gas_signal
    X = ext.extract_from_dataframe(eval_df)
    X_s = scaler.transform(X)
    probs = model.predict_proba(X_s)[:, 1]
    preds = (probs >= 0.63).astype(int)
    
    auc = roc_auc_score(y_test, probs)
    prec = precision_score(y_test, preds, zero_division=0)
    rec = recall_score(y_test, preds, zero_division=0)
    
    pred_eps = find_episodes(preds, max_gap=6)
    
    detected = 0
    lead_times = []
    for (st, en) in gt_episodes:
        search_st = max(0, st - 90)
        alarms = np.where(preds[search_st : en + 1] == 1)[0]
        if len(alarms) > 0:
            detected += 1
            lead_times.append((st - (search_st + alarms[0])) * 10)
            
    fa_eps = 0
    for (p_st, p_en) in pred_eps:
        overlaps = False
        for (g_st, g_en) in gt_episodes:
            if not (p_en < max(0, g_st - 90) or p_st > g_en):
                overlaps = True
                break
        if not overlaps:
            fa_eps += 1
            
    fa_per_day = fa_eps / test_days
    ev_recall = detected / len(gt_episodes) if len(gt_episodes) > 0 else 0.0
    mean_lead = (np.mean(lead_times) / 60.0) if lead_times else 0.0
    
    print(f"{name:32s} | ROC: {auc:.4f} | Prec: {prec*100:5.2f}% | Rec: {rec*100:5.2f}% | EvRec: {ev_recall*100:5.1f}% ({detected}/{len(gt_episodes)}) | FA/Day: {fa_per_day:5.1f} | Lead: {mean_lead:4.1f}m")
    return {
        "distortion": name,
        "roc_auc": round(auc, 4),
        "precision": round(prec, 4),
        "recall": round(rec, 4),
        "event_recall": round(ev_recall, 4),
        "detected_events": f"{detected}/{len(gt_episodes)}",
        "fa_per_day": round(fa_per_day, 1),
        "mean_lead_min": round(mean_lead, 1)
    }

print("\n" + "="*110)
print("TRACK B ROBUSTNESS BENCHMARK (EVENT-LEVEL & FALSE ALARM IMPACT)")
print("="*110)

robustness_results = []
robustness_results.append(evaluate_signal("Clean Baseline", gas_test))
robustness_results.append(evaluate_signal("Multiplicative (x10.0)", gas_test * 10.0))
robustness_results.append(evaluate_signal("Additive Offset (+0.50)", gas_test + 0.50))
robustness_results.append(evaluate_signal("Slow Baseline Drift (+0.50)", gas_test + np.linspace(0, 0.5, len(gas_test))))
np.random.seed(42)
robustness_results.append(evaluate_signal("Gaussian Noise (sigma=0.05)", np.maximum(gas_test + np.random.normal(0, 0.05, len(gas_test)), 0.01)))
robustness_results.append(evaluate_signal("Quantization (round 0.02)", np.round(gas_test / 0.02) * 0.02))
robustness_results.append(evaluate_signal("Clipping / Saturation (1.5 max)", np.clip(gas_test, 0.0, 1.5)))
robustness_results.append(evaluate_signal("Low-Pass Smoothing (EMA 0.3)", pd.Series(gas_test).ewm(alpha=0.3).mean().values))

lag_sig = np.pad(gas_test[:-2], (2, 0), mode="edge")
robustness_results.append(evaluate_signal("Response Lag (20s delay)", lag_sig))

recov = np.copy(gas_test)
for i in range(1, len(recov)):
    if recov[i] < recov[i-1]:
        recov[i] = 0.85 * recov[i-1] + 0.15 * recov[i]
robustness_results.append(evaluate_signal("Slow Recovery Lag", recov))

out_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "robustness_results.json"))
with open(out_path, "w") as f:
    json.dump(robustness_results, f, indent=2)

print("\n[Robustness] Completed. Saved to:", out_path)
