from __future__ import annotations

import argparse
import csv
import json
import math
from pathlib import Path

import numpy as np
import torch
from torch import nn
from torch.utils.data import DataLoader, TensorDataset

from .baselines import anomaly_baseline_scores
from .data import discover_mission_files, load_missions
from .features import CONTEXT_FEATURES, TEMPORAL_FEATURES, Dataset, build_dataset, normalize_dataset
from .model import AquaScanMultiTaskModel, AquaScanOnnxWrapper
from .synthetic import generate_synthetic_missions


def main() -> None:
    parser = argparse.ArgumentParser(description="Train the AQUAScan multi-task water-quality model.")
    parser.add_argument("--mission-dir", default="../Assets/StreamingAssets")
    parser.add_argument("--artifacts-dir", default="artifacts")
    parser.add_argument("--epochs", type=int, default=8)
    parser.add_argument("--batch-size", type=int, default=64)
    parser.add_argument("--synthetic-missions", type=int, default=24)
    parser.add_argument("--seed", type=int, default=7)
    parser.add_argument("--skip-onnx", action="store_true")
    args = parser.parse_args()

    report = run_training(
        mission_dir=args.mission_dir,
        artifacts_dir=args.artifacts_dir,
        epochs=args.epochs,
        batch_size=args.batch_size,
        synthetic_missions=args.synthetic_missions,
        seed=args.seed,
        export_onnx=not args.skip_onnx,
    )
    print(json.dumps(report, indent=2))


def run_training(
    mission_dir: str | Path,
    artifacts_dir: str | Path,
    epochs: int = 8,
    batch_size: int = 64,
    synthetic_missions: int = 24,
    seed: int = 7,
    export_onnx: bool = True,
) -> dict[str, object]:
    np.random.seed(seed)
    torch.manual_seed(seed)
    artifacts = Path(artifacts_dir)
    artifacts.mkdir(parents=True, exist_ok=True)

    mission_files = discover_mission_files(mission_dir)
    real_missions = load_missions(mission_files)
    synthetic = generate_synthetic_missions(synthetic_missions, seed=seed)
    missions = real_missions + synthetic
    raw_dataset = build_dataset(missions)
    dataset, stats = normalize_dataset(raw_dataset)
    stats.to_json(artifacts / "normalization.json")

    train_indices, eval_indices = split_indices(len(dataset.oxygen), seed)
    train_set = slice_dataset(dataset, train_indices)
    eval_set = slice_dataset(dataset, eval_indices)

    model = AquaScanMultiTaskModel(len(TEMPORAL_FEATURES), len(CONTEXT_FEATURES))
    train_model(model, train_set, epochs=epochs, batch_size=batch_size)
    metrics = evaluate_model(model, eval_set)

    baseline_name, baseline_scores = anomaly_baseline_scores(eval_set.temporal)
    metrics["anomaly_baseline"] = {
        "name": baseline_name,
        "mean_score": float(np.mean(baseline_scores)),
        "max_score": float(np.max(baseline_scores)),
    }

    checkpoint_path = artifacts / "aquascan_multitask.pt"
    torch.save(
        {
            "model_state": model.state_dict(),
            "temporal_features": TEMPORAL_FEATURES,
            "context_features": CONTEXT_FEATURES,
            "metrics": metrics,
        },
        checkpoint_path,
    )

    write_prediction_sample(model, eval_set, artifacts / "prediction_sample.csv")
    onnx_report = {"exported": False, "validated": False}
    if export_onnx:
        onnx_report = export_and_validate_onnx(model, eval_set, artifacts / "aquascan_multitask.onnx")
    metrics["onnx"] = onnx_report
    metrics["data"] = {
        "real_missions": len(real_missions),
        "synthetic_missions": len(synthetic),
        "windows": int(len(dataset.oxygen)),
        "eval_windows": int(len(eval_set.oxygen)),
    }

    (artifacts / "metrics.json").write_text(json.dumps(metrics, indent=2), encoding="utf-8")
    return metrics


def train_model(model: AquaScanMultiTaskModel, dataset: Dataset, epochs: int, batch_size: int) -> None:
    tensors = TensorDataset(
        torch.from_numpy(dataset.temporal),
        torch.from_numpy(dataset.context),
        torch.from_numpy(dataset.oxygen),
        torch.from_numpy(dataset.forecast),
        torch.from_numpy(dataset.bloom),
        torch.from_numpy(dataset.anomaly),
    )
    loader = DataLoader(tensors, batch_size=batch_size, shuffle=True)
    optimizer = torch.optim.Adam(model.parameters(), lr=1e-3)
    mse = nn.MSELoss()
    bce = nn.BCELoss()
    model.train()
    for _ in range(epochs):
        for temporal, context, oxygen, forecast, bloom, anomaly in loader:
            optimizer.zero_grad()
            outputs = model(temporal, context)
            loss = (
                mse(outputs["oxygen"], oxygen)
                + mse(outputs["forecast"], forecast)
                + bce(outputs["bloom"], bloom)
                + bce(outputs["anomaly"], anomaly)
            )
            loss.backward()
            optimizer.step()


def evaluate_model(model: AquaScanMultiTaskModel, dataset: Dataset) -> dict[str, object]:
    model.eval()
    with torch.no_grad():
        outputs = model(torch.from_numpy(dataset.temporal), torch.from_numpy(dataset.context))
    oxygen = outputs["oxygen"].numpy()
    forecast = outputs["forecast"].numpy()
    bloom = outputs["bloom"].numpy()
    anomaly = outputs["anomaly"].numpy()
    assert np.isfinite(oxygen).all()
    assert np.isfinite(forecast).all()
    assert np.isfinite(bloom).all()
    assert np.isfinite(anomaly).all()
    return {
        "oxygen_rmse": rmse(oxygen, dataset.oxygen),
        "forecast_rmse": rmse(forecast, dataset.forecast),
        "bloom_accuracy": binary_accuracy(bloom, dataset.bloom),
        "anomaly_accuracy": binary_accuracy(anomaly, dataset.anomaly),
    }


def export_and_validate_onnx(model: AquaScanMultiTaskModel, dataset: Dataset, output_path: Path) -> dict[str, object]:
    wrapper = AquaScanOnnxWrapper(model).eval()
    temporal = torch.from_numpy(dataset.temporal[: min(8, len(dataset.oxygen))])
    context = torch.from_numpy(dataset.context[: min(8, len(dataset.oxygen))])
    try:
        torch.onnx.export(
            wrapper,
            (temporal, context),
            output_path,
            input_names=["temporal", "context"],
            output_names=["oxygen", "forecast", "bloom", "anomaly"],
            dynamic_axes={
                "temporal": {0: "batch"},
                "context": {0: "batch"},
                "oxygen": {0: "batch"},
                "forecast": {0: "batch"},
                "bloom": {0: "batch"},
                "anomaly": {0: "batch"},
            },
            opset_version=17,
            dynamo=False,
        )
    except Exception as exc:
        return {"exported": False, "validated": False, "error": str(exc)}

    try:
        import onnxruntime as ort

        with torch.no_grad():
            torch_outputs = wrapper(temporal, context)
        session = ort.InferenceSession(str(output_path), providers=["CPUExecutionProvider"])
        ort_outputs = session.run(None, {"temporal": temporal.numpy(), "context": context.numpy()})
        max_diff = max(float(np.max(np.abs(a.numpy() - b))) for a, b in zip(torch_outputs, ort_outputs))
        return {"exported": True, "validated": max_diff < 1e-4, "max_abs_diff": max_diff}
    except Exception as exc:
        return {"exported": True, "validated": False, "error": str(exc)}


def write_prediction_sample(model: AquaScanMultiTaskModel, dataset: Dataset, path: Path) -> None:
    model.eval()
    count = min(24, len(dataset.oxygen))
    with torch.no_grad():
        outputs = model(torch.from_numpy(dataset.temporal[:count]), torch.from_numpy(dataset.context[:count]))
    with path.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.writer(handle)
        writer.writerow(["actual_do", "predicted_do", "forecast_30", "forecast_60", "forecast_120", "bloom_risk", "anomaly_probability"])
        for index in range(count):
            writer.writerow(
                [
                    float(dataset.oxygen[index, 0]),
                    float(outputs["oxygen"][index, 0]),
                    float(outputs["forecast"][index, 0]),
                    float(outputs["forecast"][index, 1]),
                    float(outputs["forecast"][index, 2]),
                    float(outputs["bloom"][index, 0]),
                    float(outputs["anomaly"][index, 0]),
                ]
            )


def split_indices(length: int, seed: int) -> tuple[np.ndarray, np.ndarray]:
    rng = np.random.default_rng(seed)
    indices = np.arange(length)
    rng.shuffle(indices)
    split = max(1, int(length * 0.8))
    if split >= length:
        split = length - 1
    return indices[:split], indices[split:]


def slice_dataset(dataset: Dataset, indices: np.ndarray) -> Dataset:
    return Dataset(
        temporal=dataset.temporal[indices],
        context=dataset.context[indices],
        oxygen=dataset.oxygen[indices],
        forecast=dataset.forecast[indices],
        bloom=dataset.bloom[indices],
        anomaly=dataset.anomaly[indices],
    )


def rmse(predicted: np.ndarray, actual: np.ndarray) -> float:
    return float(math.sqrt(np.mean((predicted - actual) ** 2)))


def binary_accuracy(predicted: np.ndarray, actual: np.ndarray) -> float:
    labels = (predicted >= 0.5).astype(np.float32)
    return float(np.mean(labels == actual))


if __name__ == "__main__":
    main()
