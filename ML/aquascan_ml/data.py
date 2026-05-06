from __future__ import annotations

import csv
import json
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Iterable


@dataclass
class MissionSample:
    timestamp: datetime
    latitude: float
    longitude: float
    metrics: dict[str, float] = field(default_factory=dict)


@dataclass
class Mission:
    name: str
    source: str
    samples: list[MissionSample]


def load_missions(paths: Iterable[str | Path]) -> list[Mission]:
    missions: list[Mission] = []
    for path in paths:
        loaded = load_mission(path)
        if loaded.samples:
            missions.append(loaded)
    return missions


def discover_mission_files(mission_dir: str | Path) -> list[Path]:
    root = Path(mission_dir)
    if not root.exists():
        return []
    return sorted([*root.glob("*.csv"), *root.glob("*.json")])


def load_mission(path: str | Path) -> Mission:
    path = Path(path)
    suffix = path.suffix.lower()
    if suffix == ".csv":
        return load_csv_mission(path)
    if suffix == ".json":
        return load_json_mission(path)
    raise ValueError(f"Unsupported mission file type: {path}")


def load_csv_mission(path: str | Path) -> Mission:
    path = Path(path)
    samples: list[MissionSample] = []
    with path.open("r", encoding="utf-8-sig", newline="") as handle:
        reader = csv.DictReader(handle)
        if not reader.fieldnames:
            raise ValueError(f"CSV mission has no header: {path}")
        required = {"timestamp", "latitude", "longitude"}
        columns = {name.strip().lower() for name in reader.fieldnames}
        missing = required - columns
        if missing:
            raise ValueError(f"CSV mission {path} missing required columns: {sorted(missing)}")

        for row in reader:
            normalized = {str(k).strip().lower(): v for k, v in row.items() if k is not None}
            timestamp = parse_timestamp(normalized.get("timestamp", ""))
            latitude = parse_float(normalized.get("latitude"))
            longitude = parse_float(normalized.get("longitude"))
            if timestamp is None or latitude is None or longitude is None:
                continue

            metrics: dict[str, float] = {}
            for key, raw_value in normalized.items():
                if key in {"timestamp", "latitude", "longitude", "altitude", "heading"}:
                    continue
                value = parse_float(raw_value)
                if value is None:
                    continue
                metric_id = "do" if key == "dissolved_oxygen" else key
                metrics[metric_id] = value

            samples.append(MissionSample(timestamp, latitude, longitude, metrics))

    return Mission(path.stem, str(path), sorted(samples, key=lambda item: item.timestamp))


def load_json_mission(path: str | Path) -> Mission:
    path = Path(path)
    with path.open("r", encoding="utf-8-sig") as handle:
        root = json.load(handle)

    mission_name = str(root.get("missionName") or path.stem)
    raw_samples = root.get("samples")
    if not isinstance(raw_samples, list):
        raise ValueError(f"JSON mission missing samples array: {path}")

    samples: list[MissionSample] = []
    for item in raw_samples:
        if not isinstance(item, dict):
            continue
        timestamp = parse_timestamp(item.get("timestamp"))
        latitude = parse_float(item.get("latitude"))
        longitude = parse_float(item.get("longitude"))
        if timestamp is None or latitude is None or longitude is None:
            continue

        metrics: dict[str, float] = {}
        for key, value in item.items():
            if key in {"timestamp", "latitude", "longitude", "altitude", "heading", "metrics"}:
                continue
            parsed = parse_float(value)
            if parsed is not None:
                metrics[key.lower()] = parsed

        nested_metrics = item.get("metrics")
        if isinstance(nested_metrics, dict):
            for key, value in nested_metrics.items():
                parsed = parse_float(value)
                if parsed is None:
                    continue
                metric_id = "do" if str(key).lower() == "dissolved_oxygen" else str(key).lower()
                metrics[metric_id] = parsed

        samples.append(MissionSample(timestamp, latitude, longitude, metrics))

    return Mission(mission_name, str(path), sorted(samples, key=lambda item: item.timestamp))


def parse_timestamp(value: Any) -> datetime | None:
    if value is None:
        return None
    text = str(value).strip()
    if not text:
        return None
    if text.endswith("Z"):
        text = text[:-1] + "+00:00"
    try:
        parsed = datetime.fromisoformat(text)
    except ValueError:
        return None
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=timezone.utc)
    return parsed.astimezone(timezone.utc).replace(tzinfo=None)


def parse_float(value: Any) -> float | None:
    if value is None:
        return None
    try:
        return float(str(value).strip())
    except (TypeError, ValueError):
        return None
