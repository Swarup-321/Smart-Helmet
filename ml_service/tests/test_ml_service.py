import pytest
import numpy as np
import pandas as pd
import httpx

from ml_service.config import FEATURE_NAMES, RISK_NORMAL, RISK_ELEVATED, RISK_CRITICAL
from ml_service.features.extractor import FeatureExtractor
from ml_service.main import app, app_state, load_artifacts

# Ensure artifacts are loaded for tests
load_artifacts()

@pytest.fixture
def anyio_backend():
    return "asyncio"

def test_feature_extractor_dataframe():
    """Verify DataFrame feature extraction yields correct dimensions and column names."""
    n = 200
    df = pd.DataFrame({
        "MM263": np.linspace(0.1, 0.8, n),
        "TP1721": np.full(n, 26.5),
        "RH1722": np.full(n, 58.0),
        "BA1723": np.full(n, 1010.0)
    })
    extractor = FeatureExtractor()
    feats = extractor.extract_from_dataframe(df)

    assert isinstance(feats, pd.DataFrame)
    assert len(feats) == n
    assert list(feats.columns) == FEATURE_NAMES
    assert not feats.isnull().any().any(), "Features must contain zero null values"

def test_feature_extractor_window():
    """Verify sliding window extraction from live readings payload."""
    readings = [
        {"mq2_mv": 1200 + i * 20, "temperature": 27.0, "humidity": 60.0, "pressure": 1013.25}
        for i in range(60)
    ]
    extractor = FeatureExtractor()
    feats = extractor.extract_from_window(readings)

    assert isinstance(feats, dict)
    for col in FEATURE_NAMES:
        assert col in feats, f"Missing feature {col}"
    # Gas is steadily rising -> normalized slope should be strictly positive
    assert feats["norm_slope_5m"] > 0, "Slope must be positive for rising gas"
    assert feats["rel_delta_5m"] > 0

def test_feature_scale_invariance():
    """Verify that gas features are 100% scale-invariant between % CH4 and raw mV."""
    ext = FeatureExtractor()
    # Signal at % CH4 scale (0.1 to 0.5)
    ch4_window = [
        {"mq2_mv": 0.1 + 0.02 * i, "temperature": 25.0, "humidity": 50.0, "pressure": 1013.0}
        for i in range(60)
    ]
    feats_ch4 = ext.extract_from_window(ch4_window)

    # Identical dynamic signal at mV scale (10,000x larger: 1000 to 5000 mV)
    mv_window = [
        {"mq2_mv": (0.1 + 0.02 * i) * 10000.0, "temperature": 25.0, "humidity": 50.0, "pressure": 1013.0}
        for i in range(60)
    ]
    feats_mv = ext.extract_from_window(mv_window)

    gas_keys = [
        "rel_delta_5m", "rel_delta_10m", "rel_ratio_5m_10m", "rel_rate_of_change",
        "norm_slope_5m", "cv_5m", "cv_10m", "z_score_5m", "rel_range_5m", "ratio_volatility_5m_10m"
    ]
    for k in gas_keys:
        assert abs(feats_ch4[k] - feats_mv[k]) < 1e-4, f"Feature {k} violated scale-invariance!"

@pytest.mark.anyio
async def test_health_endpoint():
    """Verify GET /health returns machine-readable status."""
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        res = await client.get("/health")
        assert res.status_code == 200
        data = res.json()
        assert data["service"] == "mineguard-ml-service"
        assert "status" in data
        assert "uptime_seconds" in data
        assert data["uptime_seconds"] >= 0

@pytest.mark.anyio
async def test_insufficient_history():
    """Verify that fewer than 60 samples returns ready: False with reason INSUFFICIENT_HISTORY."""
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        # Reset buffer for worker W_TEST_INSUF
        await client.post("/test/reset-buffer?worker_id=W_TEST_INSUF")

        # Send only 5 readings
        for i in range(5):
            res = await client.post("/predict/gas-trend", json={
                "worker_id": "W_TEST_INSUF",
                "timestamp": f"2026-10-09T02:00:{i:02d}.000Z",
                "mq2_mv": 1200.0 + i * 10.0,
                "temperature": 26.0,
                "humidity": 55.0,
                "pressure": 1013.0
            })
            assert res.status_code == 200
            data = res.json()
            assert data["ready"] is False
            assert data["reason"] == "INSUFFICIENT_HISTORY"
            assert data["current_samples"] == i + 1
            assert data["required_samples"] == 60
            assert data["risk_probability"] is None
            assert data["risk_level"] is None

@pytest.mark.anyio
async def test_valid_prediction():
    """Verify that once 60 samples are present, an actual probability and risk level are returned."""
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        await client.post("/test/reset-buffer?worker_id=W_TEST_VALID")

        readings = [
            {
                "ts": f"2026-10-09T01:30:{i:02d}.000Z",
                "mq2_mv": 1300.0 + i * 5,
                "temperature": 28.0,
                "humidity": 65.0,
                "pressure": 1012.0
            }
            for i in range(60)
        ]

        res = await client.post("/predict/gas-trend", json={
            "worker_id": "W_TEST_VALID",
            "readings": readings
        })

        assert res.status_code == 200
        data = res.json()

        assert data["ready"] is True
        assert data["worker_id"] == "W_TEST_VALID"
        assert "risk_probability" in data
        assert data["risk_probability"] is not None
        assert 0.0 <= data["risk_probability"] <= 1.0
        assert data["risk_level"] in [RISK_NORMAL, RISK_ELEVATED, RISK_CRITICAL]
        assert data["prediction_horizon_min"] == 10
        assert data["trend_direction"] in ["rising", "stable", "falling"]
        assert "feature_summary" in data

        # Strict contract: NO % CH4 or PPM
        data_str = str(data).lower()
        assert "% ch4" not in data_str
        assert "ppm" not in data_str
        assert "ch4_percent" not in data_str

@pytest.mark.anyio
async def test_missing_mq2_mv():
    """Verify that requests without mq2_mv fail and do NOT fall back to mq5_mv."""
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        # Request with only mq5_mv
        res = await client.post("/predict/gas-trend", json={
            "worker_id": "W_TEST_NO_MQ2",
            "mq5_mv": 1500.0
        })
        assert res.status_code == 400
        assert "silent fallback to mq5_mv is prohibited" in res.json()["detail"].lower()

        # Request missing any gas channel
        res2 = await client.post("/predict/gas-trend", json={
            "worker_id": "W_TEST_NO_GAS",
            "temperature": 25.0
        })
        assert res2.status_code == 400
        assert "missing required sensor channel 'mq2_mv'" in res2.json()["detail"].lower()

@pytest.mark.anyio
async def test_invalid_payload():
    """Verify validation on malformed inputs."""
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        # Missing worker_id
        res = await client.post("/predict/gas-trend", json={
            "mq2_mv": 1200.0
        })
        assert res.status_code == 422

        # Invalid reading point inside readings array
        res2 = await client.post("/predict/gas-trend", json={
            "worker_id": "W001",
            "readings": [{"mq5_mv": 1200.0}]  # missing mq2_mv in reading point
        })
        assert res2.status_code == 400
