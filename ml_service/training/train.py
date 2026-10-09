import json
import time
from datetime import datetime, timezone
import numpy as np
import pandas as pd
import joblib
from sklearn.preprocessing import StandardScaler
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import (
    precision_score,
    recall_score,
    f1_score,
    average_precision_score,
    roc_auc_score,
    confusion_matrix
)

from ..config import (
    MODEL_PATH,
    SCALER_PATH,
    METADATA_PATH,
    FEATURE_NAMES,
    HORIZON_STEPS_MAX,
    PREDICTION_HORIZON_MIN,
    TARGET_SENSOR,
    WARNING_THRESHOLD_CH4,
    DEFAULT_DECISION_THRESHOLD
)
from ..features.extractor import FeatureExtractor
from .data_pipeline import (
    load_and_preprocess_dataset,
    create_surge_labels,
    chronological_split
)

def get_positive_proba(model, X_scaled: np.ndarray) -> np.ndarray:
    """Safely extracts probabilities for the positive surge class (class 1)."""
    if len(model.classes_) == 1:
        if model.classes_[0] == 1:
            return np.ones(len(X_scaled), dtype=np.float64)
        else:
            return np.zeros(len(X_scaled), dtype=np.float64)
    if 1 in model.classes_:
        idx = list(model.classes_).index(1)
        return model.predict_proba(X_scaled)[:, idx]
    return np.zeros(len(X_scaled), dtype=np.float64)

def evaluate_baseline_rule(
    X_test: pd.DataFrame,
    y_test: pd.Series
) -> dict:
    """
    Computes a non-ML rule-based early-warning baseline:
    Predicts surge if relative slope is positive or relative rate of change is elevated.
    """
    rule_pred = (
        (X_test["norm_slope_5m"] > 0.005) | 
        (X_test["rel_rate_of_change"] > 0.05)
    ).astype(int)

    prec = float(precision_score(y_test, rule_pred, zero_division=0))
    rec = float(recall_score(y_test, rule_pred, zero_division=0))
    f1 = float(f1_score(y_test, rule_pred, zero_division=0))

    return {
        "rule_description": "Heuristic norm_slope_5m > 0.005 OR rel_rate_of_change > 0.05",
        "precision": round(prec, 4),
        "recall": round(rec, 4),
        "f1": round(f1, 4)
    }

def train_pipeline(
    csv_path: str,
    max_raw_rows: int = None,
    n_estimators: int = 100,
    max_depth: int = 12
) -> dict:
    """
    Executes the full end-to-end training pipeline:
    1. Loads and downsamples raw 1Hz telemetric CSV to 10s cadence.
    2. Generates normalized temporal features.
    3. Creates binary surge target labels (5-15 min horizon).
    4. Slices chronologically into Train (70%), Val (15%), Test (15%).
    5. Fits StandardScaler on Train split only.
    6. Benchmarks against a non-ML rule baseline.
    7. Trains cost-sensitive RandomForestClassifier with class_weight='balanced'.
    8. Tunes decision threshold on validation split.
    9. Evaluates final performance on unseen chronological test split.
    10. Exports model, scaler, and metadata audit JSON.
    """
    t0 = time.time()
    print("[TrainPipeline] Starting training pipeline...")

    # 1. Load and resample dataset
    df_10s = load_and_preprocess_dataset(csv_path, max_raw_rows=max_raw_rows)

    # 2. Extract features
    print("[TrainPipeline] Extracting normalized dynamic features...")
    extractor = FeatureExtractor()
    X = extractor.extract_from_dataframe(df_10s)

    # 3. Create target labels
    print("[TrainPipeline] Generating surge target labels (5-15 min horizon)...")
    y = create_surge_labels(df_10s)

    # Exclude trailing rows where future horizon extends past dataset end
    valid_len = len(df_10s) - HORIZON_STEPS_MAX
    X = X.iloc[:valid_len].copy()
    y = y.iloc[:valid_len].copy()

    print(f"[TrainPipeline] Usable time steps: {len(X):,}. Total positive prediction instances: {y.sum():,} ({y.mean()*100:.3f}%).")

    # 4. Chronological Split (70% Train, 15% Val, 15% Test)
    X_train, y_train, X_val, y_val, X_test, y_test = chronological_split(X, y, 0.70, 0.15)
    print(f"[TrainPipeline] Splits: Train={len(X_train):,} ({y_train.sum()} positive instances), "
          f"Val={len(X_val):,} ({y_val.sum()} positive instances), "
          f"Test={len(X_test):,} ({y_test.sum()} positive instances)")

    # 5. Fit Preprocessor (StandardScaler) strictly on Train split
    print("[TrainPipeline] Fitting StandardScaler on training set...")
    scaler = StandardScaler()
    X_train_scaled = scaler.fit_transform(X_train)
    X_val_scaled = scaler.transform(X_val)
    X_test_scaled = scaler.transform(X_test)

    # 6. Non-ML Baseline Evaluation on Test Set
    baseline_metrics = evaluate_baseline_rule(X_test, y_test)
    print(f"[TrainPipeline] Non-ML Baseline: Prec={baseline_metrics['precision']:.3f}, "
          f"Rec={baseline_metrics['recall']:.3f}, F1={baseline_metrics['f1']:.3f}")

    # 7. Model Training (Balanced Class Weight)
    print(f"[TrainPipeline] Training RandomForestClassifier (n_estimators={n_estimators}, max_depth={max_depth})...")
    model = RandomForestClassifier(
        n_estimators=n_estimators,
        max_depth=max_depth,
        class_weight="balanced",
        max_samples=0.5,  # subsample for training speed & generalization
        random_state=42,
        n_jobs=-1
    )
    model.fit(X_train_scaled, y_train)

    # 8. Validation Tuning (Find Optimal Decision Threshold)
    print("[TrainPipeline] Tuning decision threshold on validation set...")
    val_probs = get_positive_proba(model, X_val_scaled)

    best_thresh = DEFAULT_DECISION_THRESHOLD
    best_val_f1 = 0.0

    # Search threshold grid
    for th in np.arange(0.15, 0.85, 0.02):
        th_val_pred = (val_probs >= th).astype(int)
        th_f1 = f1_score(y_val, th_val_pred, zero_division=0)
        if th_f1 > best_val_f1:
            best_val_f1 = th_f1
            best_thresh = round(float(th), 2)

    print(f"[TrainPipeline] Optimal validation threshold: {best_thresh:.2f} (Val F1: {best_val_f1:.4f})")

    # 9. Final Test Evaluation (on strictly unseen chronological partition)
    print("[TrainPipeline] Evaluating on chronological test set...")
    test_probs = get_positive_proba(model, X_test_scaled)
    test_preds = (test_probs >= best_thresh).astype(int)

    precision = float(precision_score(y_test, test_preds, zero_division=0))
    recall = float(recall_score(y_test, test_preds, zero_division=0))
    f1 = float(f1_score(y_test, test_preds, zero_division=0))
    try:
        pr_auc = float(average_precision_score(y_test, test_probs))
        if np.isnan(pr_auc):
            pr_auc = 0.0
    except Exception:
        pr_auc = 0.0
    try:
        roc_auc = float(roc_auc_score(y_test, test_probs))
        if np.isnan(roc_auc):
            roc_auc = 0.5
    except Exception:
        roc_auc = 0.5
    cm = confusion_matrix(y_test, test_preds, labels=[0, 1])
    tn, fp, fn, tp = [int(v) for v in cm.ravel()]

    test_metrics = {
        "precision": round(precision, 4),
        "recall": round(recall, 4),
        "f1": round(f1, 4),
        "pr_auc": round(pr_auc, 4),
        "roc_auc": round(roc_auc, 4),
        "confusion_matrix": {
            "tn": tn,
            "fp": fp,
            "fn": fn,
            "tp": tp
        },
        "tuned_decision_threshold": best_thresh,
        "val_f1_score": round(float(best_val_f1), 4)
    }

    print("==================================================")
    print("TEST EVALUATION RESULTS (Chronological Holdout):")
    print(f"  Precision: {test_metrics['precision']:.4f}")
    print(f"  Recall:    {test_metrics['recall']:.4f}")
    print(f"  F1 Score:  {test_metrics['f1']:.4f}")
    print(f"  PR-AUC:    {test_metrics['pr_auc']:.4f}")
    print(f"  ROC-AUC:   {test_metrics['roc_auc']:.4f}")
    print(f"  Confusion Matrix: TP={tp}, FP={fp}, TN={tn}, FN={fn}")
    print("==================================================")

    # Feature Importance
    feature_importances = dict(zip(
        FEATURE_NAMES,
        [round(float(v), 4) for v in model.feature_importances_]
    ))

    # 10. Export Artifacts
    print(f"[TrainPipeline] Saving model artifact to {MODEL_PATH}...")
    joblib.dump(model, MODEL_PATH)

    print(f"[TrainPipeline] Saving scaler artifact to {SCALER_PATH}...")
    joblib.dump(scaler, SCALER_PATH)

    metadata = {
        "model_version": "v1.1-surge-classifier-dimensionless",
        "architecture": "RandomForestClassifier",
        "hyperparameters": {
            "n_estimators": n_estimators,
            "max_depth": max_depth,
            "class_weight": "balanced",
            "max_samples": 0.5,
            "random_state": 42
        },
        "dataset_info": {
            "source_file": "methane_data.csv",
            "target_sensor": TARGET_SENSOR,
            "warning_threshold_ch4": WARNING_THRESHOLD_CH4,
            "cadence_resampled_sec": 10,
            "horizon_minutes": PREDICTION_HORIZON_MIN,
            "total_time_steps": len(X),
            "train_size": len(X_train),
            "val_size": len(X_val),
            "test_size": len(X_test)
        },
        "feature_list": FEATURE_NAMES,
        "feature_importances": feature_importances,
        "baseline_comparison": baseline_metrics,
        "test_metrics": test_metrics,
        "trained_at_utc": datetime.now(timezone.utc).isoformat(),
        "elapsed_seconds": round(time.time() - t0, 1)
    }

    print(f"[TrainPipeline] Saving model metadata to {METADATA_PATH}...")
    with open(METADATA_PATH, "w") as f:
        json.dump(metadata, f, indent=2)

    print(f"[TrainPipeline] Training pipeline complete in {metadata['elapsed_seconds']}s.")
    return metadata

if __name__ == "__main__":
    import sys
    csv = r"c:\Users\abuna\Desktop\clg\IOT\methane_data\methane_data.csv"
    train_pipeline(csv)
