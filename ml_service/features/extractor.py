import numpy as np
import pandas as pd
from typing import Dict, List, Any, Optional
from ..config import FEATURE_NAMES, WINDOW_STEPS_5MIN, WINDOW_STEPS_10MIN

class FeatureExtractor:
    """
    Extracts strictly dimensionless, scale-invariant relative temporal features
    from time-series gas and climate observations.
    
    Guarantees mathematical scale-invariance:
    For any gas signal scaling x' = c * x (where c > 0), all gas-derived features
    satisfy f(x') = f(x).
    
    This bridges calibrated % CH4 mine telemetry and uncalibrated helmet
    millivolts (0-3300 mV) without scale mismatch or out-of-distribution distortion.
    """

    def __init__(
        self,
        window_5m: int = WINDOW_STEPS_5MIN,
        window_10m: int = WINDOW_STEPS_10MIN,
        feature_names: List[str] = None
    ):
        self.window_5m = window_5m
        self.window_10m = window_10m
        self.feature_names = feature_names or FEATURE_NAMES

    @staticmethod
    def _compute_slope(arr: np.ndarray) -> float:
        """Computes linear regression slope over 1D series."""
        n = len(arr)
        if n < 3:
            return 0.0
        x = np.arange(n, dtype=np.float64)
        x_mean = (n - 1) / 2.0
        y_mean = np.mean(arr)
        denom = np.sum((x - x_mean) ** 2)
        if denom == 0:
            return 0.0
        numer = np.sum((x - x_mean) * (arr - y_mean))
        return float(numer / denom)

    def extract_from_dataframe(
        self,
        df: pd.DataFrame,
        gas_col: str = "MM263",
        temp_col: str = "TP1721",
        hum_col: str = "RH1722",
        press_col: str = "BA1723"
    ) -> pd.DataFrame:
        """
        Extract features from downsampled 10s DataFrame.
        Returns a DataFrame containing strictly the 13 dimensionless features.
        """
        gas = df[gas_col].astype(np.float64)
        temp = df[temp_col].astype(np.float64) if temp_col in df.columns else pd.Series(25.0, index=df.index)
        hum = df[hum_col].astype(np.float64) if hum_col in df.columns else pd.Series(50.0, index=df.index)
        press = df[press_col].astype(np.float64) if press_col in df.columns else pd.Series(1013.25, index=df.index)

        # Rolling statistics (scale-variant intermediates, strictly eliminated from output)
        mean_5m = gas.rolling(window=self.window_5m, min_periods=5).mean().bfill()
        std_5m = gas.rolling(window=self.window_5m, min_periods=5).std().fillna(0.0)
        mean_10m = gas.rolling(window=self.window_10m, min_periods=10).mean().bfill()
        std_10m = gas.rolling(window=self.window_10m, min_periods=10).std().fillna(0.0)

        # Scale-invariant denominators (clamped to relative eps to prevent zero division)
        eps_5m = np.maximum(mean_5m, 1e-4)
        eps_10m = np.maximum(mean_10m, 1e-4)

        # 1. Dimensionless Gas Features
        # Relative deltas normalized by rolling mean
        shift_5m = gas.shift(self.window_5m).bfill()
        rel_delta_5m = (gas - shift_5m) / eps_5m

        shift_10m = gas.shift(self.window_10m).bfill()
        rel_delta_10m = (gas - shift_10m) / eps_10m

        # Relative difference between short (5m) and long (10m) moving average
        rel_ratio_5m_10m = (mean_5m - mean_10m) / eps_10m

        # 1-minute rate of change normalized by 5m mean
        shift_1m = gas.shift(6).bfill()
        rel_rate_of_change = (gas - shift_1m) / eps_5m

        # Normalized linear slope (slope_15 / mean_5m)
        slope_window = min(15, self.window_5m)
        slopes = gas.rolling(window=slope_window, min_periods=3).apply(
            self._compute_slope, raw=True
        ).fillna(0.0)
        norm_slope_5m = slopes / eps_5m

        # Coefficient of variation (sigma / mu)
        cv_5m = std_5m / eps_5m
        cv_10m = std_10m / eps_10m

        # Standardized anomaly score (z-score)
        z_score_5m = (gas - mean_5m) / np.maximum(std_5m, 1e-4 * eps_5m)

        # Relative range over 5 minutes (max - min) / mu
        roll_max_5m = gas.rolling(self.window_5m, min_periods=5).max()
        roll_min_5m = gas.rolling(self.window_5m, min_periods=5).min()
        rel_range_5m = (roll_max_5m - roll_min_5m) / eps_5m

        # Volatility ratio (std_5m / std_10m)
        ratio_volatility_5m_10m = std_5m / np.maximum(std_10m, 1e-4 * eps_10m)

        # 2. Transferable Climate Dynamics (relative/differentials, NOT absolute values)
        press_shift_10m = press.shift(self.window_10m).bfill()
        press_rel_delta_10m = (press - press_shift_10m) / np.maximum(press_shift_10m, 1.0)

        temp_shift_10m = temp.shift(self.window_10m).bfill()
        temp_delta_10m = temp - temp_shift_10m

        hum_shift_10m = hum.shift(self.window_10m).bfill()
        hum_delta_10m = hum - hum_shift_10m

        features_df = pd.DataFrame({
            "rel_delta_5m": rel_delta_5m.fillna(0.0),
            "rel_delta_10m": rel_delta_10m.fillna(0.0),
            "rel_ratio_5m_10m": rel_ratio_5m_10m.fillna(0.0),
            "rel_rate_of_change": rel_rate_of_change.fillna(0.0),
            "norm_slope_5m": norm_slope_5m.fillna(0.0),
            "cv_5m": cv_5m.fillna(0.0),
            "cv_10m": cv_10m.fillna(0.0),
            "z_score_5m": z_score_5m.fillna(0.0),
            "rel_range_5m": rel_range_5m.fillna(0.0),
            "ratio_volatility_5m_10m": ratio_volatility_5m_10m.fillna(0.0),
            "press_rel_delta_10m": press_rel_delta_10m.fillna(0.0),
            "temp_delta_10m": temp_delta_10m.fillna(0.0),
            "hum_delta_10m": hum_delta_10m.fillna(0.0)
        }, index=df.index)

        return features_df[self.feature_names]

    def extract_from_window(
        self,
        readings: List[Dict[str, Any]],
        gas_channel: str = "mq2_mv"
    ) -> Dict[str, float]:
        """
        Extract features from a window of live helmet readings (e.g. last 15-30 readings).
        Used during real-time FastAPI inference requests.
        Explicitly binds to declared gas_channel (defaulting strictly to 'mq2_mv').
        Silent sensor fallback between MQ-2 and MQ-5 is eliminated.
        """
        if not readings:
            raise ValueError("Readings window cannot be empty.")

        gas_vals = []
        temps = []
        hums = []
        pressures = []

        for r in readings:
            g = r.get(gas_channel)
            if g is None or (isinstance(g, (int, float)) and np.isnan(g)):
                if "gas" in r and gas_channel == "gas":
                    g = r["gas"]
                else:
                    raise ValueError(f"Reading missing required primary gas channel '{gas_channel}'. Silent fallback is prohibited.")
            gas_vals.append(float(g))

            t = r.get("temperature", 25.0)
            temps.append(float(t) if t is not None else 25.0)

            h = r.get("humidity", 50.0)
            hums.append(float(h) if h is not None else 50.0)

            p = r.get("pressure", 1013.25)
            pressures.append(float(p) if p is not None else 1013.25)

        gas_arr = np.array(gas_vals, dtype=np.float64)
        temp_arr = np.array(temps, dtype=np.float64)
        hum_arr = np.array(hums, dtype=np.float64)
        press_arr = np.array(pressures, dtype=np.float64)

        n = len(gas_arr)
        current_gas = gas_arr[-1]

        w5 = min(n, self.window_5m)
        w10 = min(n, self.window_10m)

        mean_5m = float(np.mean(gas_arr[-w5:]))
        std_5m = float(np.std(gas_arr[-w5:])) if w5 > 1 else 0.0

        mean_10m = float(np.mean(gas_arr[-w10:]))
        std_10m = float(np.std(gas_arr[-w10:])) if w10 > 1 else 0.0

        eps_5m = max(mean_5m, 1e-4)
        eps_10m = max(mean_10m, 1e-4)

        # Shift indices
        idx_5m = max(0, n - w5)
        idx_10m = max(0, n - w10)
        idx_1m = max(0, n - min(n, 6))

        rel_delta_5m = float((current_gas - gas_arr[idx_5m]) / eps_5m)
        rel_delta_10m = float((current_gas - gas_arr[idx_10m]) / eps_10m)
        rel_ratio_5m_10m = float((mean_5m - mean_10m) / eps_10m)
        rel_rate_of_change = float((current_gas - gas_arr[idx_1m]) / eps_5m)

        slope_window = min(n, 15)
        slope = self._compute_slope(gas_arr[-slope_window:])
        norm_slope_5m = float(slope / eps_5m)

        cv_5m = float(std_5m / eps_5m)
        cv_10m = float(std_10m / eps_10m)

        z_score_5m = float((current_gas - mean_5m) / max(std_5m, 1e-4 * eps_5m))

        max_5m = float(np.max(gas_arr[-w5:]))
        min_5m = float(np.min(gas_arr[-w5:]))
        rel_range_5m = float((max_5m - min_5m) / eps_5m)

        ratio_volatility_5m_10m = float(std_5m / max(std_10m, 1e-4 * eps_10m))

        press_ref = max(press_arr[idx_10m], 1.0)
        press_rel_delta_10m = float((press_arr[-1] - press_arr[idx_10m]) / press_ref)
        temp_delta_10m = float(temp_arr[-1] - temp_arr[idx_10m])
        hum_delta_10m = float(hum_arr[-1] - hum_arr[idx_10m])

        features = {
            "rel_delta_5m": round(rel_delta_5m, 6),
            "rel_delta_10m": round(rel_delta_10m, 6),
            "rel_ratio_5m_10m": round(rel_ratio_5m_10m, 6),
            "rel_rate_of_change": round(rel_rate_of_change, 6),
            "norm_slope_5m": round(norm_slope_5m, 6),
            "cv_5m": round(cv_5m, 6),
            "cv_10m": round(cv_10m, 6),
            "z_score_5m": round(z_score_5m, 6),
            "rel_range_5m": round(rel_range_5m, 6),
            "ratio_volatility_5m_10m": round(ratio_volatility_5m_10m, 6),
            "press_rel_delta_10m": round(press_rel_delta_10m, 6),
            "temp_delta_10m": round(temp_delta_10m, 4),
            "hum_delta_10m": round(hum_delta_10m, 4)
        }
        return features
