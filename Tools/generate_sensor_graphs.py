from __future__ import annotations

import argparse
import csv
import math
from datetime import datetime
from pathlib import Path

import matplotlib.pyplot as plt
from matplotlib.collections import LineCollection
from matplotlib.colors import Normalize


SENSORS = {
    "temperature": ("Temperature", "deg C", "#ff8a3d"),
    "ph": ("pH", "pH", "#7dd3fc"),
    "do": ("Dissolved Oxygen", "mg/L", "#22c55e"),
    "salinity": ("Salinity", "ppt", "#38bdf8"),
    "tds": ("Total Dissolved Solids", "ppm", "#facc15"),
    "conductivity": ("Conductivity", "uS/cm", "#f97316"),
    "turbidity": ("Turbidity", "NTU", "#a3e635"),
    "light": ("Light", "lux", "#fde047"),
    "uv": ("Ultraviolet", "index", "#c084fc"),
    "depth": ("Probe Depth", "m", "#06b6d4"),
    "heading": ("Heading", "deg", "#94a3b8"),
    "speed": ("Vessel Speed", "m/s", "#2dd4bf"),
    "battery": ("Battery", "%", "#84cc16"),
    "spool_cable_length": ("Spool Cable Payout", "m", "#14b8a6"),
}

PROFILE_SENSORS = [
    "temperature",
    "ph",
    "do",
    "salinity",
    "tds",
    "conductivity",
    "turbidity",
    "light",
    "uv",
]

OPERATIONS_SENSORS = ["battery", "speed"]


def parse_timestamp(value: str) -> datetime:
    value = value.strip()
    if value.endswith("Z"):
        value = value[:-1] + "+00:00"
    return datetime.fromisoformat(value)


def read_rows(csv_path: Path) -> list[dict[str, object]]:
    with csv_path.open(newline="", encoding="utf-8-sig") as handle:
        reader = csv.DictReader(handle)
        rows: list[dict[str, object]] = []
        for row in reader:
            parsed: dict[str, object] = {}
            for key, value in row.items():
                if key is None:
                    continue
                key = key.strip().lower()
                value = (value or "").strip()
                if not value:
                    continue
                if key == "timestamp":
                    parsed[key] = parse_timestamp(value)
                else:
                    try:
                        parsed[key] = float(value)
                    except ValueError:
                        parsed[key] = value
            if "timestamp" in parsed:
                rows.append(parsed)
        return rows


def add_derived_axes(rows: list[dict[str, object]]) -> None:
    start_time = rows[0].get("timestamp") if rows else None
    for index, row in enumerate(rows, start=1):
        row["sample_index"] = float(index)
        if isinstance(start_time, datetime) and isinstance(row.get("timestamp"), datetime):
            row["elapsed_s"] = (row["timestamp"] - start_time).total_seconds()


Y_LIMITS = {
    "light": (0, 1200),
    "uv": (0, 3.0),
}


def available_sensor_keys(rows: list[dict[str, object]], x_key: str) -> list[str]:
    keys = set()
    for row in rows:
        keys.update(key for key, value in row.items() if isinstance(value, float))
    return [key for key in SENSORS if key in keys and key != x_key]


def axis_label_for(x_key: str) -> str:
    if x_key == "depth":
        return "Probe Depth (m)"
    if x_key == "elapsed_s":
        return "Elapsed Time (s)"
    if x_key == "sample_index":
        return "Sample Index"
    return SENSORS.get(x_key, (x_key.replace("_", " ").title(), "", ""))[0]


def typical_step(values: list[float]) -> float:
    unique_values = sorted(set(values))
    if len(unique_values) < 2:
        return 1.0
    steps = [b - a for a, b in zip(unique_values, unique_values[1:]) if (b - a) > 0]
    if not steps:
        return 1.0
    return steps[len(steps) // 2]


def spread_duplicate_x_values(x_values: list[float]) -> list[float]:
    if len(x_values) < 2:
        return x_values[:]

    rounded_groups: dict[float, list[int]] = {}
    for index, value in enumerate(x_values):
        rounded_groups.setdefault(round(value, 6), []).append(index)

    adjusted = x_values[:]
    base_step = typical_step(x_values)
    offset_step = max(base_step * 0.035, 1e-4)
    for indices in rounded_groups.values():
        if len(indices) < 2:
            continue
        midpoint = (len(indices) - 1) / 2.0
        for order, row_index in enumerate(indices):
            adjusted[row_index] += (order - midpoint) * offset_step
    return adjusted


def prepare_linear_points(points: list[tuple[float, float]]) -> list[tuple[float, float]]:
    if len(points) < 2:
        return points[:]

    sorted_points = sorted(points, key=lambda point: (point[0], point[1]))
    x_values = [point[0] for point in sorted_points]
    tolerance = max(typical_step(x_values) * 0.01, 1e-6)

    collapsed: list[tuple[float, float]] = []
    group_x = sorted_points[0][0]
    group_y_values = [sorted_points[0][1]]

    for x_value, y_value in sorted_points[1:]:
        if abs(x_value - group_x) <= tolerance:
            group_y_values.append(y_value)
            continue
        collapsed.append((group_x, sum(group_y_values) / len(group_y_values)))
        group_x = x_value
        group_y_values = [y_value]

    collapsed.append((group_x, sum(group_y_values) / len(group_y_values)))
    return collapsed


def style_axis(ax, title: str, xlabel: str, ylabel: str) -> None:
    ax.set_title(title, loc="left", fontsize=14, fontweight="bold", color="#e5f5f4")
    ax.set_xlabel(xlabel, color="#b7c9c8")
    ax.set_ylabel(ylabel, color="#b7c9c8")
    ax.grid(True, color="#334155", alpha=0.35, linewidth=0.8)
    ax.set_facecolor("#091113")
    ax.tick_params(colors="#cbd5d6", labelsize=9)
    for spine in ax.spines.values():
        spine.set_color("#284047")


def save_sensor_graph(rows: list[dict[str, object]], sensor_key: str, out_dir: Path, x_key: str, x_label: str, filename: str | None = None) -> None:
    label, unit, color = SENSORS[sensor_key]
    points = [(row[x_key], row[sensor_key]) for row in rows if x_key in row and sensor_key in row]
    points = prepare_linear_points(points)
    if len(points) < 2:
        return

    x_values = [point[0] for point in points]
    values = [point[1] for point in points]
    plot_x_values = spread_duplicate_x_values(x_values)

    fig, ax = plt.subplots(figsize=(9.5, 4.8), dpi=180)
    fig.patch.set_facecolor("#05090a")
    style_axis(ax, label, x_label, f"{label} ({unit})")
    ax.plot(plot_x_values, values, color=color, linewidth=2.4)
    ax.scatter(plot_x_values, values, s=26, color=color, edgecolors="#ecfeff", linewidths=0.7, zorder=3)
    ax.fill_between(plot_x_values, values, min(values), color=color, alpha=0.12)
    if sensor_key in Y_LIMITS:
        ax.set_ylim(*Y_LIMITS[sensor_key])
    fig.tight_layout(pad=1.4)
    fig.savefig(out_dir / (filename or f"{sensor_key}.png"), facecolor=fig.get_facecolor())
    plt.close(fig)


def save_overview(
    rows: list[dict[str, object]],
    sensor_keys: list[str],
    out_dir: Path,
    x_key: str,
    x_label: str,
    title: str,
    output_name: str,
) -> None:
    preferred = ["temperature", "ph", "do", "turbidity", "tds", "conductivity", "light", "uv", "battery", "speed", "heading"]
    selected = [key for key in preferred if key in sensor_keys]
    if not selected:
        return

    cols = 2
    rows_count = (len(selected) + cols - 1) // cols
    fig, axes = plt.subplots(rows_count, cols, figsize=(13, max(6, rows_count * 2.7)), dpi=180)
    fig.patch.set_facecolor("#05090a")
    axes_list = axes.flatten() if hasattr(axes, "flatten") else [axes]

    for ax, sensor_key in zip(axes_list, selected):
        label, unit, color = SENSORS[sensor_key]
        points = [(row[x_key], row[sensor_key]) for row in rows if x_key in row and sensor_key in row]
        points = prepare_linear_points(points)
        x_values = [point[0] for point in points]
        values = [point[1] for point in points]
        plot_x_values = spread_duplicate_x_values(x_values)
        style_axis(ax, label, x_label, unit)
        ax.plot(plot_x_values, values, color=color, linewidth=2)
        ax.scatter(plot_x_values, values, s=14, color=color, edgecolors="none", zorder=3)
        if sensor_key in Y_LIMITS:
            ax.set_ylim(*Y_LIMITS[sensor_key])

    for ax in axes_list[len(selected):]:
        ax.axis("off")
        ax.set_facecolor("#05090a")

    fig.suptitle(title, fontsize=20, fontweight="bold", color="#f1f5f9", x=0.035, ha="left")
    fig.tight_layout(rect=(0, 0, 1, 0.965), pad=1.3)
    fig.savefig(out_dir / output_name, facecolor=fig.get_facecolor())
    plt.close(fig)


def save_gps_path(rows: list[dict[str, object]], out_dir: Path, color_key: str = "temperature") -> None:
    points = [
        (row["longitude"], row["latitude"], row[color_key])
        for row in rows
        if "latitude" in row and "longitude" in row and color_key in row
    ]
    if len(points) < 2:
        return

    xs = [point[0] for point in points]
    ys = [point[1] for point in points]
    values = [point[2] for point in points]
    meters_per_deg_lat = 111_320.0
    meters_per_deg_lon = meters_per_deg_lat * math.cos(math.radians(sum(ys) / len(ys)))
    span_x_m = (max(xs) - min(xs)) * meters_per_deg_lon
    span_y_m = (max(ys) - min(ys)) * meters_per_deg_lat
    if math.hypot(span_x_m, span_y_m) < 5.0:
        return

    segments = [[(xs[i], ys[i]), (xs[i + 1], ys[i + 1])] for i in range(len(points) - 1)]

    label, unit, _ = SENSORS[color_key]
    fig, ax = plt.subplots(figsize=(8, 7), dpi=180)
    fig.patch.set_facecolor("#05090a")
    ax.set_facecolor("#091113")
    collection = LineCollection(segments, cmap="turbo", norm=Normalize(min(values), max(values)))
    collection.set_array(values[:-1])
    collection.set_linewidth(4)
    ax.add_collection(collection)
    ax.scatter(xs, ys, c=values, cmap="turbo", s=28, edgecolors="#ecfeff", linewidths=0.7, zorder=3)
    ax.autoscale()
    ax.margins(0.15)
    ax.set_title(f"GPS Track Colored by {label}", loc="left", fontsize=14, fontweight="bold", color="#e5f5f4")
    ax.set_xlabel("Longitude", color="#b7c9c8")
    ax.set_ylabel("Latitude", color="#b7c9c8")
    ax.grid(True, color="#334155", alpha=0.35, linewidth=0.8)
    ax.tick_params(colors="#cbd5d6", labelsize=9)
    for spine in ax.spines.values():
        spine.set_color("#284047")
    cbar = fig.colorbar(collection, ax=ax)
    cbar.set_label(f"{label} ({unit})", color="#cbd5d6")
    cbar.ax.tick_params(colors="#cbd5d6")
    fig.tight_layout(pad=1.3)
    fig.savefig(out_dir / f"gps_track_by_{color_key}.png", facecolor=fig.get_facecolor())
    plt.close(fig)


def main() -> None:
    parser = argparse.ArgumentParser(description="Generate AquaScan sensor graphs from mission CSV data.")
    parser.add_argument("--csv", default="Assets/StreamingAssets/demo-mission.csv", type=Path)
    parser.add_argument("--out", default="PortfolioGraphs", type=Path)
    parser.add_argument("--x", default="depth", help="Numeric CSV column to use as the graph x-axis.")
    args = parser.parse_args()

    rows = read_rows(args.csv)
    if not rows:
        raise SystemExit(f"No sample rows found in {args.csv}")
    add_derived_axes(rows)

    args.out.mkdir(parents=True, exist_ok=True)
    for old_graph in args.out.glob("*.png"):
        old_graph.unlink()

    x_key = args.x.strip().lower()
    if not any(x_key in row for row in rows):
        raise SystemExit(f"X-axis column '{x_key}' was not found in {args.csv}")

    x_label = axis_label_for(x_key)
    sensor_keys = available_sensor_keys(rows, x_key)

    if x_key == "depth":
        profile_keys = [key for key in PROFILE_SENSORS if key in sensor_keys]
        for sensor_key in profile_keys:
            save_sensor_graph(rows, sensor_key, args.out, x_key, x_label)

        save_overview(
            rows,
            profile_keys,
            args.out,
            x_key,
            x_label,
            "AquaScan Water Quality by Probe Depth",
            "sensor_overview.png",
        )

        ops_x_key = "elapsed_s" if any("elapsed_s" in row for row in rows) else "sample_index"
        ops_x_label = axis_label_for(ops_x_key)
        ops_keys = [key for key in OPERATIONS_SENSORS if key in sensor_keys]
        for sensor_key in ops_keys:
            save_sensor_graph(rows, sensor_key, args.out, ops_x_key, ops_x_label, filename=f"ops_{sensor_key}.png")

        if ops_keys:
            save_overview(
                rows,
                ops_keys,
                args.out,
                ops_x_key,
                ops_x_label,
                "AquaScan Vehicle Operations Over Time",
                "operations_overview.png",
            )
    else:
        for sensor_key in sensor_keys:
            save_sensor_graph(rows, sensor_key, args.out, x_key, x_label)

        save_overview(
            rows,
            sensor_keys,
            args.out,
            x_key,
            x_label,
            f"AquaScan Sensor Data by {x_label}",
            "sensor_overview.png",
        )

    gps_metric = "temperature" if "temperature" in sensor_keys else sensor_keys[0]
    save_gps_path(rows, args.out, gps_metric)

    print(f"Generated {len(list(args.out.glob('*.png')))} graph images in {args.out.resolve()}")


if __name__ == "__main__":
    main()
