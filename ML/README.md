# AQUAScan ML Pipeline

This folder contains the first-pass multi-task water-quality ML pipeline for AQUAScan.
It trains from AQUAScan mission CSV/JSON files plus generated synthetic missions, then
exports artifacts for future laptop/Unity inference.

## Quick Start

From the repository root:

```powershell
cd ML
python -m aquascan_ml.train --epochs 3 --synthetic-missions 12 --mission-dir ..\Assets\StreamingAssets
```

Artifacts are written to `ML/artifacts/`:

- `aquascan_multitask.pt`: PyTorch checkpoint
- `aquascan_multitask.onnx`: ONNX export when the `onnx` package is installed
- `normalization.json`: feature normalization stats
- `metrics.json`: evaluation and export report
- `prediction_sample.csv`: sample predictions for inspection

## Inputs

The loader accepts the existing AQUAScan mission schema:

- Required: `timestamp`, `latitude`, `longitude`
- Water metrics: `temperature`, `do`, `ph`, `salinity`, `tds`, `conductivity`, `turbidity`, `light`, `uv`, `depth`
- Optional weather/context: `air_temp`, `wind_speed`, `pressure`, `precipitation`, `solar_radiation`

Unknown numeric CSV columns are preserved as metrics. JSON mission `metrics` values are flattened into each sample.

## Outputs

The exported model has two inputs:

- `temporal`: `(batch, time_steps, temporal_features)`
- `context`: `(batch, context_features)`

It returns four heads:

- `oxygen`: current dissolved oxygen regression
- `forecast`: oxygen forecasts at `t+30`, `t+60`, `t+120` minutes
- `bloom`: algae bloom risk probability
- `anomaly`: anomaly probability

