from __future__ import annotations

import json
import math
from dataclasses import dataclass
from datetime import timedelta
from pathlib import Path

import numpy as np

from .data import Mission, MissionSample


WATER_FEATURES = [
    "temperature",
    "do",
    "ph",
    "salinity",
    "tds",
    "conductivity",
    "turbidity",
    "light",
    "uv",
    "depth",
]
WEATHER_FEATURES = ["air_temp", "wind_speed", "pressure", "precipitation", "solar_radiation"]
ENGINEERED_FEATURES = [
    "do_roll",
    "temperature_roll",
    "turbidity_roll",
    "do_delta",
    "temperature_delta",
    "depth_delta",
    "stratification_index",
    "depth_gradient_do",
    "hour_sin",
    "hour_cos",
    "doy_sin",
    "doy_cos",
]
TEMPORAL_FEATURES = WATER_FEATURES + WEATHER_FEATURES + ENGINEERED_FEATURES
CONTEXT_FEATURES = [
    "latitude",
    "longitude",
    "depth",
    "hour_sin",
    "hour_cos",
    "doy_sin",
    "doy_cos",
    "air_temp",
    "wind_speed",
    "pressure",
    "precipitation",
    "solar_radiation",
    "grid_lat",
    "grid_lon",
]
FORECAST_MINUTES = [30, 60, 120]


@dataclass
class Dataset:
    temporal: np.ndarray
    context: np.ndarray
    oxygen: np.ndarray
    forecast: np.ndarray
    bloom: np.ndarray
    anomaly: np.ndarray


@dataclass
class NormalizationStats:
    temporal_mean: list[float]
    temporal_std: list[float]
    context_mean: list[float]
    context_std: list[float]

    def to_json(self, path: str | Path) -> None:
        payload = {
            "temporal_features": TEMPORAL_FEATURES,
            "context_features": CONTEXT_FEATURES,
            "forecast_minutes": FORECAST_MINUTES,
            "temporal_mean": self.temporal_mean,
            "temporal_std": self.temporal_std,
            "context_mean": self.context_mean,
            "context_std": self.context_std,
        }
        Path(path).write_text(json.dumps(payload, indent=2), encoding="utf-8")


def build_dataset(
    missions: list[Mission],
    window_minutes: int = 60,
    step_minutes: int = 5,
) -> Dataset:
    window_steps = max(1, int(window_minutes / step_minutes) + 1)
    temporal_rows: list[np.ndarray] = []
    context_rows: list[np.ndarray] = []
    oxygen_rows: list[float] = []
    forecast_rows: list[list[float]] = []
    bloom_rows: list[float] = []
    anomaly_rows: list[float] = []

    for mission in missions:
        rows = resample_mission(mission, step_minutes)
        if not rows:
            continue
        for index, row in enumerate(rows):
            forecasts = []
            for minutes in FORECAST_MINUTES:
                offset = int(minutes / step_minutes)
                target_index = min(len(rows) - 1, index + offset)
                forecasts.append(rows[target_index]["do"])

            start = max(0, index - window_steps + 1)
            window = rows[start : index + 1]
            padding = window_steps - len(window)
            temporal = np.zeros((window_steps, len(TEMPORAL_FEATURES)), dtype=np.float32)
            if window:
                encoded = np.array([[sample[name] for name in TEMPORAL_FEATURES] for sample in window], dtype=np.float32)
                temporal[padding:] = encoded

            temporal_rows.append(temporal)
            context_rows.append(np.array([row[name] for name in CONTEXT_FEATURES], dtype=np.float32))
            oxygen_rows.append(row["do"])
            forecast_rows.append(forecasts)
            bloom_rows.append(float(label_bloom(row)))
            anomaly_rows.append(float(label_anomaly(row)))

    if not temporal_rows:
        raise ValueError("No usable training windows were produced.")

    return Dataset(
        temporal=np.stack(temporal_rows),
        context=np.stack(context_rows),
        oxygen=np.array(oxygen_rows, dtype=np.float32).reshape(-1, 1),
        forecast=np.array(forecast_rows, dtype=np.float32),
        bloom=np.array(bloom_rows, dtype=np.float32).reshape(-1, 1),
        anomaly=np.array(anomaly_rows, dtype=np.float32).reshape(-1, 1),
    )


def normalize_dataset(dataset: Dataset, stats: NormalizationStats | None = None) -> tuple[Dataset, NormalizationStats]:
    if stats is None:
        temporal_flat = dataset.temporal.reshape(-1, dataset.temporal.shape[-1])
        temporal_mean = temporal_flat.mean(axis=0)
        temporal_std = temporal_flat.std(axis=0)
        context_mean = dataset.context.mean(axis=0)
        context_std = dataset.context.std(axis=0)
        temporal_std[temporal_std < 1e-6] = 1.0
        context_std[context_std < 1e-6] = 1.0
        stats = NormalizationStats(
            temporal_mean=temporal_mean.tolist(),
            temporal_std=temporal_std.tolist(),
            context_mean=context_mean.tolist(),
            context_std=context_std.tolist(),
        )

    temporal_mean_np = np.array(stats.temporal_mean, dtype=np.float32)
    temporal_std_np = np.array(stats.temporal_std, dtype=np.float32)
    context_mean_np = np.array(stats.context_mean, dtype=np.float32)
    context_std_np = np.array(stats.context_std, dtype=np.float32)
    normalized = Dataset(
        temporal=((dataset.temporal - temporal_mean_np) / temporal_std_np).astype(np.float32),
        context=((dataset.context - context_mean_np) / context_std_np).astype(np.float32),
        oxygen=dataset.oxygen,
        forecast=dataset.forecast,
        bloom=dataset.bloom,
        anomaly=dataset.anomaly,
    )
    return normalized, stats


def resample_mission(mission: Mission, step_minutes: int) -> list[dict[str, float]]:
    if not mission.samples:
        return []
    samples = sorted(mission.samples, key=lambda item: item.timestamp)
    start = samples[0].timestamp
    end = samples[-1].timestamp
    step = timedelta(minutes=step_minutes)
    rows: list[dict[str, float]] = []
    cursor = start
    sample_index = 0
    last_row: dict[str, float] | None = None

    while cursor <= end:
        while sample_index + 1 < len(samples) and samples[sample_index + 1].timestamp <= cursor:
            sample_index += 1
        current = samples[sample_index]
        row = encode_sample(current, last_row)
        rows.append(row)
        last_row = row
        cursor += step

    if len(rows) == 1:
        rows.append(encode_sample(samples[-1], rows[-1]))
    return rows


def encode_sample(sample: MissionSample, previous: dict[str, float] | None) -> dict[str, float]:
    row: dict[str, float] = {}
    for name in WATER_FEATURES:
        row[name] = metric(sample, name, previous)
    row["air_temp"] = metric(sample, "air_temp", previous, row["temperature"])
    row["wind_speed"] = metric(sample, "wind_speed", previous, 2.0)
    row["pressure"] = metric(sample, "pressure", previous, 1013.25)
    row["precipitation"] = metric(sample, "precipitation", previous, 0.0)
    row["solar_radiation"] = metric(sample, "solar_radiation", previous, row["light"])

    hour = sample.timestamp.hour + sample.timestamp.minute / 60.0 + sample.timestamp.second / 3600.0
    day = sample.timestamp.timetuple().tm_yday
    row["hour_sin"] = math.sin(2.0 * math.pi * hour / 24.0)
    row["hour_cos"] = math.cos(2.0 * math.pi * hour / 24.0)
    row["doy_sin"] = math.sin(2.0 * math.pi * day / 366.0)
    row["doy_cos"] = math.cos(2.0 * math.pi * day / 366.0)
    row["latitude"] = sample.latitude
    row["longitude"] = sample.longitude
    row["grid_lat"] = round(sample.latitude, 2)
    row["grid_lon"] = round(sample.longitude, 2)

    row["do_roll"] = rolling_value(row["do"], previous, "do_roll")
    row["temperature_roll"] = rolling_value(row["temperature"], previous, "temperature_roll")
    row["turbidity_roll"] = rolling_value(row["turbidity"], previous, "turbidity_roll")
    row["do_delta"] = row["do"] - (previous["do"] if previous else row["do"])
    row["temperature_delta"] = row["temperature"] - (previous["temperature"] if previous else row["temperature"])
    row["depth_delta"] = row["depth"] - (previous["depth"] if previous else row["depth"])
    row["stratification_index"] = max(0.0, row["temperature"] - estimate_bottom_temperature(row))
    row["depth_gradient_do"] = row["do_delta"] / max(0.1, abs(row["depth_delta"]))
    return row


def metric(sample: MissionSample, name: str, previous: dict[str, float] | None, default: float = 0.0) -> float:
    if name in sample.metrics:
        return float(sample.metrics[name])
    if previous and name in previous:
        return float(previous[name])
    return default


def rolling_value(value: float, previous: dict[str, float] | None, key: str) -> float:
    if previous is None:
        return value
    return 0.8 * previous[key] + 0.2 * value


def estimate_bottom_temperature(row: dict[str, float]) -> float:
    return row["temperature"] - 0.22 * max(0.0, row["depth"] - 0.5)


def label_bloom(row: dict[str, float]) -> bool:
    score = 0
    score += row["temperature"] > 21.0
    score += row["solar_radiation"] > 350.0
    score += row["turbidity"] > 6.0
    score += row["tds"] > 380.0
    score += row["ph"] > 7.55
    return score >= 3


def label_anomaly(row: dict[str, float]) -> bool:
    return (
        row["do"] < 4.0
        or row["do_delta"] < -1.0
        or row["turbidity"] > 18.0
        or row["ph"] < 6.4
        or row["ph"] > 9.0
    )
