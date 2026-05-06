from pathlib import Path

import numpy as np
import torch

from aquascan_ml.train import run_training


ROOT = Path(__file__).resolve().parents[2]


def test_smoke_training_outputs_are_finite(tmp_path):
    report = run_training(
        mission_dir=ROOT / "Assets" / "StreamingAssets",
        artifacts_dir=tmp_path,
        epochs=1,
        batch_size=32,
        synthetic_missions=3,
        seed=21,
        export_onnx=False,
    )
    assert np.isfinite(report["oxygen_rmse"])
    assert np.isfinite(report["forecast_rmse"])
    checkpoint = tmp_path / "aquascan_multitask.pt"
    assert checkpoint.exists()
    loaded = torch.load(checkpoint, map_location="cpu")
    assert "model_state" in loaded
    assert (tmp_path / "normalization.json").exists()
    assert (tmp_path / "prediction_sample.csv").exists()
