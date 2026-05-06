from __future__ import annotations

import argparse
import csv
import math
from datetime import datetime
from pathlib import Path

import matplotlib.pyplot as plt
import matplotlib.cm as cm
import matplotlib.colors as mcolors
import numpy as np


SENSORS = {
    "temperature": ("Temperature", "deg C", "turbo"),
    "ph": ("pH", "pH", "viridis"),
    "do": ("Dissolved Oxygen", "mg/L", "Greens"),
    "salinity": ("Salinity", "ppt", "Blues"),
    "tds": ("Total Dissolved Solids", "ppm", "plasma"),
    "conductivity": ("Conductivity", "uS/cm", "inferno"),
    "turbidity": ("Turbidity", "NTU", "YlOrBr"),
    "light": ("Light", "lux", "cividis"),
    "uv": ("Ultraviolet", "index", "magma"),
    "depth": ("Probe Depth", "m", "winter_r"),
    "battery": ("Battery", "%", "RdYlGn"),
    "speed": ("Vessel Speed", "m/s", "cool"),
}

AREA_SENSORS = [
    "temperature",
    "ph",
    "do",
    "salinity",
    "tds",
    "conductivity",
    "turbidity",
    "light",
    "uv",
    "depth",
]

OPERATIONS_SENSORS = ["battery", "speed"]


def parse_timestamp(value: str) -> datetime:
    value = value.strip()
    if value.endswith("Z"):
        value = value[:-1] + "+00:00"
    return datetime.fromisoformat(value)


def read_rows(csv_path: Path) -> list[dict[str, float | str]]:
    with csv_path.open(newline="", encoding="utf-8-sig") as handle:
        rows: list[dict[str, float | str]] = []
        for row in csv.DictReader(handle):
            parsed: dict[str, float | str] = {}
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
            if "latitude" in parsed and "longitude" in parsed:
                rows.append(parsed)
        return rows


def add_local_xy(rows: list[dict[str, float | str]]) -> None:
    origin_lat = float(rows[0]["latitude"])
    origin_lon = float(rows[0]["longitude"])
    meters_per_deg_lat = 111_320.0
    meters_per_deg_lon = meters_per_deg_lat * math.cos(math.radians(origin_lat))

    for row in rows:
        row["x_m"] = (float(row["longitude"]) - origin_lon) * meters_per_deg_lon
        row["y_m"] = (float(row["latitude"]) - origin_lat) * meters_per_deg_lat


def add_elapsed_axis(rows: list[dict[str, float | str]]) -> None:
    start_time = rows[0].get("timestamp") if rows else None
    for index, row in enumerate(rows, start=1):
        row["sample_index"] = float(index)
        if isinstance(start_time, datetime) and isinstance(row.get("timestamp"), datetime):
            row["elapsed_s"] = (row["timestamp"] - start_time).total_seconds()


def sensor_keys(rows: list[dict[str, float | str]], allowed_keys: list[str]) -> list[str]:
    available = set()
    for row in rows:
        available.update(key for key, value in row.items() if isinstance(value, float))
    return [key for key in allowed_keys if key in available]


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

    grouped: dict[float, list[int]] = {}
    for index, value in enumerate(x_values):
        grouped.setdefault(round(value, 6), []).append(index)

    adjusted = x_values[:]
    offset_step = max(typical_step(x_values) * 0.035, 1e-4)
    for indices in grouped.values():
        if len(indices) < 2:
            continue
        midpoint = (len(indices) - 1) / 2.0
        for order, row_index in enumerate(indices):
            adjusted[row_index] += (order - midpoint) * offset_step
    return adjusted


def spread_duplicate_xy_points(xs: list[float], ys: list[float]) -> tuple[list[float], list[float]]:
    if len(xs) < 2:
        return xs[:], ys[:]

    grouped: dict[tuple[float, float], list[int]] = {}
    for index, (x_value, y_value) in enumerate(zip(xs, ys)):
        grouped.setdefault((round(x_value, 6), round(y_value, 6)), []).append(index)

    adjusted_xs = xs[:]
    adjusted_ys = ys[:]
    radial_step = max(min(typical_step(xs), typical_step(ys)) * 0.08, 0.04)
    for indices in grouped.values():
        if len(indices) < 2:
            continue
        for order, row_index in enumerate(indices):
            angle = (2.0 * math.pi * order) / len(indices)
            adjusted_xs[row_index] += math.cos(angle) * radial_step
            adjusted_ys[row_index] += math.sin(angle) * radial_step
    return adjusted_xs, adjusted_ys


def style_area_axis(ax, title: str) -> None:
    ax.set_title(title, loc="left", fontsize=15, fontweight="bold", color="#0f172a")
    ax.set_xlabel("East from start (m)", color="#334155")
    ax.set_ylabel("North from start (m)", color="#334155")
    ax.set_facecolor("#f5f1e8")
    ax.grid(True, color="#64748b", alpha=0.22, linewidth=0.7)
    ax.tick_params(colors="#334155", labelsize=9)
    ax.set_aspect("equal", adjustable="box")
    for spine in ax.spines.values():
        spine.set_color("#94a3b8")


def style_linear_axis(ax, title: str, xlabel: str, ylabel: str) -> None:
    ax.set_title(title, loc="left", fontsize=15, fontweight="bold", color="#e5f5f4")
    ax.set_xlabel(xlabel, color="#b7c9c8")
    ax.set_ylabel(ylabel, color="#b7c9c8")
    ax.set_facecolor("#091113")
    ax.grid(True, color="#334155", alpha=0.35, linewidth=0.8)
    ax.tick_params(colors="#cbd5d6", labelsize=9)
    for spine in ax.spines.values():
        spine.set_color("#284047")


def build_idw_surface(
    xs: list[float],
    ys: list[float],
    values: list[float],
    grid_size: int = 180,
) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    x_array = np.asarray(xs, dtype=float)
    y_array = np.asarray(ys, dtype=float)
    value_array = np.asarray(values, dtype=float)

    x_span = max(float(x_array.max() - x_array.min()), 1.0)
    y_span = max(float(y_array.max() - y_array.min()), 1.0)
    padding = max(min(x_span, y_span) * 0.16, 6.0)

    grid_x = np.linspace(float(x_array.min() - padding), float(x_array.max() + padding), grid_size)
    grid_y = np.linspace(float(y_array.min() - padding), float(y_array.max() + padding), grid_size)
    mesh_x, mesh_y = np.meshgrid(grid_x, grid_y)

    dx = mesh_x[..., None] - x_array[None, None, :]
    dy = mesh_y[..., None] - y_array[None, None, :]
    distances = np.hypot(dx, dy)
    weights = 1.0 / np.maximum(distances, 0.75) ** 2.15
    surface = np.sum(weights * value_array[None, None, :], axis=2) / np.sum(weights, axis=2)

    path_distances = []
    for start_index in range(len(x_array) - 1):
        x0 = x_array[start_index]
        y0 = y_array[start_index]
        x1 = x_array[start_index + 1]
        y1 = y_array[start_index + 1]
        seg_dx = x1 - x0
        seg_dy = y1 - y0
        seg_length_sq = max(seg_dx * seg_dx + seg_dy * seg_dy, 1e-6)
        projection = ((mesh_x - x0) * seg_dx + (mesh_y - y0) * seg_dy) / seg_length_sq
        projection = np.clip(projection, 0.0, 1.0)
        nearest_x = x0 + projection * seg_dx
        nearest_y = y0 + projection * seg_dy
        path_distances.append(np.hypot(mesh_x - nearest_x, mesh_y - nearest_y))

    min_path_distance = np.min(np.stack(path_distances, axis=0), axis=0)
    min_sample_distance = np.min(distances, axis=2)
    corridor_width = max(min(x_span, y_span) * 0.28, 8.0)
    fade_width = max(corridor_width * 0.72, 6.0)

    edge_distance = np.maximum(min_path_distance - corridor_width, min_sample_distance - corridor_width * 0.78)
    blend = np.clip(edge_distance / fade_width, 0.0, 1.0)
    low_value = float(value_array.min())
    softened_surface = surface * (1.0 - blend) + low_value * blend
    return mesh_x, mesh_y, softened_surface


def contour_levels(values: list[float]) -> np.ndarray:
    value_min = min(values)
    value_max = max(values)
    if math.isclose(value_min, value_max):
        value_max = value_min + 1.0
    return np.linspace(value_min, value_max, 10)


def low_end_fill_color(cmap_name: str) -> tuple[float, float, float, float]:
    cmap = cm.get_cmap(cmap_name).copy()
    return mcolors.to_rgba(cmap(0.02))


def save_sensor_area(rows: list[dict[str, float | str]], sensor_key: str, out_dir: Path) -> None:
    label, unit, cmap = SENSORS[sensor_key]
    points = [(float(row["x_m"]), float(row["y_m"]), float(row[sensor_key])) for row in rows if sensor_key in row]
    if len(points) < 2:
        return

    xs = [p[0] for p in points]
    ys = [p[1] for p in points]
    values = [p[2] for p in points]
    plot_xs, plot_ys = spread_duplicate_xy_points(xs, ys)
    mesh_x, mesh_y, surface = build_idw_surface(plot_xs, plot_ys, values)
    levels = contour_levels(values)

    fig, ax = plt.subplots(figsize=(7.3, 6.2), dpi=180)
    fig.patch.set_facecolor("#f4efe4")
    style_area_axis(ax, f"{label.upper()} ({unit.upper()}) MAP")
    ax.set_facecolor(low_end_fill_color(cmap))

    filled = ax.contourf(mesh_x, mesh_y, surface, levels=levels, cmap=cmap, extend="both")
    ax.contour(mesh_x, mesh_y, surface, levels=levels, colors="white", linewidths=0.45, alpha=0.42)
    ax.plot(plot_xs, plot_ys, color="#0f172a", linewidth=1.0, alpha=0.35, zorder=3)
    ax.scatter(plot_xs, plot_ys, c=values, cmap=cmap, s=18, edgecolors="#0f172a", linewidths=0.25, zorder=4)
    ax.scatter(plot_xs[0], plot_ys[0], marker="s", s=36, c="#14532d", edgecolors="white", linewidths=0.5, zorder=5)
    ax.scatter(plot_xs[-1], plot_ys[-1], marker="X", s=42, c="#991b1b", edgecolors="white", linewidths=0.5, zorder=5)
    ax.margins(0.08)

    cbar = fig.colorbar(filled, ax=ax, fraction=0.046, pad=0.03)
    cbar.set_label(unit.upper(), color="#334155", fontsize=9, fontweight="bold")
    cbar.ax.tick_params(colors="#334155", labelsize=8)
    cbar.ax.text(1.9, 1.01, "High", transform=cbar.ax.transAxes, color="#334155", fontsize=8, ha="left", va="bottom")
    cbar.ax.text(1.9, -0.02, "Low", transform=cbar.ax.transAxes, color="#334155", fontsize=8, ha="left", va="top")
    fig.tight_layout(pad=1.1)
    fig.savefig(out_dir / f"area_{sensor_key}.png", facecolor=fig.get_facecolor())
    plt.close(fig)


def save_overview(rows: list[dict[str, float | str]], keys: list[str], out_dir: Path) -> None:
    selected = [key for key in ["temperature", "ph", "do", "turbidity", "tds", "conductivity", "light", "uv", "depth"] if key in keys]
    if not selected:
        return

    cols = 2
    rows_count = (len(selected) + cols - 1) // cols
    fig, axes = plt.subplots(rows_count, cols, figsize=(13, max(6, rows_count * 3.0)), dpi=180)
    fig.patch.set_facecolor("#f4efe4")
    axes_list = axes.flatten() if hasattr(axes, "flatten") else [axes]

    xs = [float(row["x_m"]) for row in rows]
    ys = [float(row["y_m"]) for row in rows]
    plot_xs, plot_ys = spread_duplicate_xy_points(xs, ys)

    for ax, sensor_key in zip(axes_list, selected):
        label, unit, cmap = SENSORS[sensor_key]
        values = [float(row[sensor_key]) for row in rows if sensor_key in row]
        mesh_x, mesh_y, surface = build_idw_surface(plot_xs, plot_ys, values, grid_size=140)
        levels = contour_levels(values)
        style_area_axis(ax, label)
        ax.set_facecolor(low_end_fill_color(cmap))
        filled = ax.contourf(mesh_x, mesh_y, surface, levels=levels, cmap=cmap, extend="both")
        ax.contour(mesh_x, mesh_y, surface, levels=levels, colors="white", linewidths=0.3, alpha=0.35)
        ax.plot(plot_xs, plot_ys, color="#0f172a", linewidth=0.85, alpha=0.3, zorder=3)
        ax.scatter(plot_xs, plot_ys, c=values, cmap=cmap, s=12, edgecolors="none", zorder=4)
        cbar = fig.colorbar(filled, ax=ax, fraction=0.045, pad=0.02)
        cbar.set_label(unit, color="#334155")
        cbar.ax.tick_params(colors="#334155", labelsize=8)

    for ax in axes_list[len(selected):]:
        ax.axis("off")
        ax.set_facecolor("#f4efe4")

    fig.suptitle("AquaScan Pond Sensor Maps", fontsize=20, fontweight="bold", color="#0f172a", x=0.035, ha="left")
    fig.tight_layout(rect=(0, 0, 1, 0.965), pad=1.15)
    fig.savefig(out_dir / "area_overview.png", facecolor=fig.get_facecolor())
    plt.close(fig)


def save_operational_graph(rows: list[dict[str, float | str]], sensor_key: str, out_dir: Path) -> None:
    label, unit, _ = SENSORS[sensor_key]
    x_key = "elapsed_s" if any("elapsed_s" in row for row in rows) else "sample_index"
    x_label = "Elapsed Time (s)" if x_key == "elapsed_s" else "Sample Index"
    points = [(float(row[x_key]), float(row[sensor_key])) for row in rows if x_key in row and sensor_key in row]
    if len(points) < 2:
        return

    xs = [point[0] for point in points]
    ys = [point[1] for point in points]
    plot_xs = spread_duplicate_x_values(xs)

    fig, ax = plt.subplots(figsize=(8, 4.8), dpi=180)
    fig.patch.set_facecolor("#05090a")
    style_linear_axis(ax, label, x_label, f"{label} ({unit})")
    ax.plot(plot_xs, ys, color="#38bdf8" if sensor_key == "speed" else "#84cc16", linewidth=2.4)
    ax.scatter(plot_xs, ys, s=32, color="#ecfeff", edgecolors="none", zorder=3)
    fig.tight_layout(pad=1.25)
    fig.savefig(out_dir / f"ops_{sensor_key}.png", facecolor=fig.get_facecolor())
    plt.close(fig)


def save_operations_overview(rows: list[dict[str, float | str]], keys: list[str], out_dir: Path) -> None:
    if not keys:
        return

    x_key = "elapsed_s" if any("elapsed_s" in row for row in rows) else "sample_index"
    x_label = "Elapsed Time (s)" if x_key == "elapsed_s" else "Sample Index"
    fig, axes = plt.subplots(len(keys), 1, figsize=(10, max(4.5, len(keys) * 3.6)), dpi=180)
    fig.patch.set_facecolor("#05090a")
    axes_list = axes if isinstance(axes, (list, tuple)) else [axes] if not hasattr(axes, "flatten") else list(axes.flatten())

    for ax, sensor_key in zip(axes_list, keys):
        label, unit, _ = SENSORS[sensor_key]
        points = [(float(row[x_key]), float(row[sensor_key])) for row in rows if x_key in row and sensor_key in row]
        xs = [point[0] for point in points]
        ys = [point[1] for point in points]
        plot_xs = spread_duplicate_x_values(xs)
        style_linear_axis(ax, label, x_label, f"{label} ({unit})")
        ax.plot(plot_xs, ys, color="#38bdf8" if sensor_key == "speed" else "#84cc16", linewidth=2.3)
        ax.scatter(plot_xs, ys, s=28, color="#ecfeff", edgecolors="none", zorder=3)

    fig.suptitle("AquaScan Pond Vehicle Operations Over Time", fontsize=20, fontweight="bold", color="#f1f5f9", x=0.035, ha="left")
    fig.tight_layout(rect=(0, 0, 1, 0.965), pad=1.1)
    fig.savefig(out_dir / "operations_overview.png", facecolor=fig.get_facecolor())
    plt.close(fig)


def main() -> None:
    parser = argparse.ArgumentParser(description="Generate pond area sensor-change graphs from mission CSV data.")
    parser.add_argument("--csv", default="Assets/StreamingAssets/demo-mission.csv", type=Path)
    parser.add_argument("--out", default="PortfolioAreaGraphs", type=Path)
    args = parser.parse_args()

    rows = read_rows(args.csv)
    if len(rows) < 2:
        raise SystemExit(f"Need at least two GPS sample rows in {args.csv}")

    add_local_xy(rows)
    add_elapsed_axis(rows)
    args.out.mkdir(parents=True, exist_ok=True)
    for old_graph in args.out.glob("*.png"):
        old_graph.unlink()

    area_keys = sensor_keys(rows, AREA_SENSORS)
    for key in area_keys:
        save_sensor_area(rows, key, args.out)
    save_overview(rows, area_keys, args.out)

    operational_keys = sensor_keys(rows, OPERATIONS_SENSORS)
    for key in operational_keys:
        save_operational_graph(rows, key, args.out)
    save_operations_overview(rows, operational_keys, args.out)

    print(f"Generated {len(list(args.out.glob('*.png')))} area graph images in {args.out.resolve()}")


if __name__ == "__main__":
    main()
