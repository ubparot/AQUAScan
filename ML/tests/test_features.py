from pathlib import Path

import numpy as np

from aquascan_ml.data import load_csv_mission
from aquascan_ml.features import CONTEXT_FEATURES, TEMPORAL_FEATURES, build_dataset, normalize_dataset, resample_mission
from aquascan_ml.synthetic import generate_synthetic_missions


ROOT = Path(__file__).resolve().parents[2]
STREAMING = ROOT / "Assets" / "StreamingAssets"


def test_feature_engineering_defaults_and_shapes():
    missions = [load_csv_mission(STREAMING / "demo-mission.csv")] + generate_synthetic_missions(2, seed=11)
    dataset = build_dataset(missions)
    assert dataset.temporal.shape[1:] == (13, len(TEMPORAL_FEATURES))
    assert dataset.context.shape[1] == len(CONTEXT_FEATURES)
    assert dataset.forecast.shape[1] == 3
    assert np.isfinite(dataset.temporal).all()
    assert np.isfinite(dataset.context).all()


def test_resample_includes_engineered_fields():
    mission = load_csv_mission(STREAMING / "demo-mission.csv")
    rows = resample_mission(mission, step_minutes=5)
    assert rows
    row = rows[0]
    assert "do_roll" in row
    assert "temperature_delta" in row
    assert "stratification_index" in row
    assert "air_temp" in row


def test_normalization_keeps_finite_values():
    dataset = build_dataset(generate_synthetic_missions(2, seed=13))
    normalized, stats = normalize_dataset(dataset)
    assert len(stats.temporal_mean) == len(TEMPORAL_FEATURES)
    assert np.isfinite(normalized.temporal).all()
    assert np.isfinite(normalized.context).all()
