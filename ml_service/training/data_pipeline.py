import os
import time
import numpy as np
import pandas as pd
from typing import Tuple, Optional
from ..config import (
    SAMPLING_CADENCE_SEC,
    HORIZON_STEPS_MIN,
    HORIZON_STEPS_MAX,
    TARGET_SENSOR,
    WARNING_THRESHOLD_CH4
)
from ..features.extractor import FeatureExtractor

def load_and_preprocess_dataset(
    csv_path: str,
    chunk_size: int = 500000,
    max_raw_rows: Optional[int] = None
) -> pd.DataFrame:
    """
    Memory-safe chunked loader for high-frequency mine telemetric data.
    Downsamples raw 1.0 Hz observations to 0.1 Hz (10-second cadence).
    """
    cols = [
        "year", "month", "day", "hour", "minute", "second",
        TARGET_SENSOR, "TP1721", "RH1722", "BA1723"
    ]

    if not os.path.exists(csv_path):
        raise FileNotFoundError(f"Dataset not found at {csv_path}")

    downsampled_chunks = []
    total_raw_rows = 0
    t0 = time.time()

    for chunk in pd.read_csv(csv_path, usecols=cols, chunksize=chunk_size):
        if max_raw_rows and total_raw_rows >= max_raw_rows:
            break

        if max_raw_rows and (total_raw_rows + len(chunk)) > max_raw_rows:
            chunk = chunk.iloc[:(max_raw_rows - total_raw_rows)]

        total_raw_rows += len(chunk)
        n_buckets = len(chunk) // SAMPLING_CADENCE_SEC
        if n_buckets == 0:
            continue

        # Aggregation: mean over 10 consecutive 1s readings -> 10s cadence
        agg_chunk = chunk.iloc[:n_buckets * SAMPLING_CADENCE_SEC].groupby(
            np.arange(n_buckets * SAMPLING_CADENCE_SEC) // SAMPLING_CADENCE_SEC
        ).mean()

        downsampled_chunks.append(agg_chunk)

    df_10s = pd.concat(downsampled_chunks, ignore_index=True)
    elapsed = time.time() - t0
    print(f"[DataPipeline] Loaded {total_raw_rows:,} raw rows -> {len(df_10s):,} resampled (10s) points in {elapsed:.1f}s.")
    return df_10s

def create_surge_labels(
    df_10s: pd.DataFrame,
    gas_col: str = TARGET_SENSOR,
    horizon_min_steps: int = HORIZON_STEPS_MIN,
    horizon_max_steps: int = HORIZON_STEPS_MAX,
    threshold: float = WARNING_THRESHOLD_CH4
) -> pd.Series:
    """
    Computes binary surge target label y_t in {0, 1}:
    y_t = 1 if max future gas in [t + horizon_min, t + horizon_max] >= threshold.
    """
    gas = df_10s[gas_col].astype(np.float64)
    window_length = horizon_max_steps - horizon_min_steps + 1

    # Rolling forward maximum computed via reverse series rolling max
    future_max = (
        gas.iloc[::-1]
        .rolling(window=window_length, min_periods=1)
        .max()
        .iloc[::-1]
        .shift(-horizon_min_steps)
    )

    y = (future_max >= threshold).astype(int)
    return y

def chronological_split(
    X: pd.DataFrame,
    y: pd.Series,
    train_ratio: float = 0.70,
    val_ratio: float = 0.15
) -> Tuple[pd.DataFrame, pd.Series, pd.DataFrame, pd.Series, pd.DataFrame, pd.Series]:
    """
    Strictly chronological partition into Train, Validation, and Test sets.
    Preserves temporal autocorrelation without data leakage.
    """
    n = len(X)
    n_train = int(n * train_ratio)
    n_val = int(n * val_ratio)

    X_train = X.iloc[:n_train].copy()
    y_train = y.iloc[:n_train].copy()

    X_val = X.iloc[n_train:n_train + n_val].copy()
    y_val = y.iloc[n_train:n_train + n_val].copy()

    X_test = X.iloc[n_train + n_val:].copy()
    y_test = y.iloc[n_train + n_val:].copy()

    return X_train, y_train, X_val, y_val, X_test, y_test
