from __future__ import annotations

import json
from pathlib import Path

import matplotlib.pyplot as plt
import numpy as np
from matplotlib import patheffects
from matplotlib.patches import Circle, FancyArrowPatch, FancyBboxPatch, Polygon, Rectangle


ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "deliverables" / "maris-visuals"
METRICS = json.loads((ROOT / "ML" / "artifacts" / "metrics.json").read_text(encoding="utf-8"))

BG = "#06141c"
PANEL = "#0b2530"
PANEL_2 = "#103641"
WHITE = "#f2fbfb"
MUTED = "#a7c8ca"
TEAL = "#20c7c9"
CYAN = "#69e4ee"
BLUE = "#208ee8"
GREEN = "#42d392"
YELLOW = "#f6c945"
ORANGE = "#ff8a3d"
RED = "#ef5b5b"
GRID = "#174552"


def setup_fig(title: str, subtitle: str):
    fig = plt.figure(figsize=(16, 9), dpi=180, facecolor=BG)
    ax = fig.add_axes([0, 0, 1, 1])
    ax.set_xlim(0, 16)
    ax.set_ylim(0, 9)
    ax.axis("off")
    return fig, ax


def panel(ax, x, y, w, h, title=None, edge=GRID, face=PANEL, radius=0.14, alpha=1.0):
    patch = FancyBboxPatch(
        (x, y), w, h,
        boxstyle=f"round,pad=0.02,rounding_size={radius}",
        facecolor=face, edgecolor=edge, linewidth=1.0, alpha=alpha,
    )
    ax.add_patch(patch)
    if title:
        ax.text(x + 0.22, y + h - 0.28, title, color=WHITE, fontsize=10, fontweight="bold", va="center")
    return patch


def arrow(ax, a, b, color=TEAL, lw=1.5, curve=0.0, alpha=0.9):
    ax.add_patch(FancyArrowPatch(
        a, b, arrowstyle="-|>", mutation_scale=12, lw=lw, color=color,
        connectionstyle=f"arc3,rad={curve}", alpha=alpha,
    ))


def label(ax, x, y, text, color=WHITE, size=8, ha="left", va="center", weight="normal"):
    ax.text(x, y, text, color=color, fontsize=size, ha=ha, va=va, fontweight=weight)


def chip(ax, x, y, text, color=TEAL, width=None):
    width = width or max(0.72, 0.085 * len(text) + 0.35)
    panel(ax, x, y, width, 0.34, face=color, edge=color, radius=0.14, alpha=0.18)
    label(ax, x + width / 2, y + 0.17, text, color=color, size=6.8, ha="center", weight="bold")


def neuron_block(ax, x, y, w, h, title, detail, color, nodes=5):
    panel(ax, x, y, w, h, edge=color, face=PANEL_2)
    label(ax, x + w / 2, y + h - 0.28, title, color=WHITE, size=9.3, ha="center", weight="bold")
    label(ax, x + w / 2, y + 0.28, detail, color=MUTED, size=6.5, ha="center")
    xs = np.linspace(x + 0.32, x + w - 0.32, nodes)
    for i, xx in enumerate(xs):
        yy = y + h * 0.52 + 0.12 * np.sin(i * 1.7)
        ax.add_patch(Circle((xx, yy), 0.065, facecolor=color, edgecolor=WHITE, lw=0.5, alpha=0.9))
        if i:
            ax.plot([xs[i - 1] + 0.06, xx - 0.06], [y + h * 0.52 + 0.12 * np.sin((i - 1) * 1.7), yy],
                    color=color, lw=0.9, alpha=0.5)


def save(fig, name):
    OUT.mkdir(parents=True, exist_ok=True)
    path = OUT / name
    fig.savefig(path, facecolor=fig.get_facecolor(), dpi=180, bbox_inches=None)
    plt.close(fig)
    return path


def architecture():
    fig, ax = setup_fig(
        "MARIS MULTI-TASK MODEL ARCHITECTURE",
        "Two coordinated input paths transform recent measurements and mission context into four research outputs.",
    )

    panel(ax, 0.5, 0.75, 2.7, 7.50, "01  MODEL-READY INPUTS")
    panel(ax, 3.55, 4.85, 8.0, 3.40, "02  TEMPORAL SEQUENCE PATH")
    panel(ax, 3.55, 0.75, 8.0, 3.40, "03  CONTEXT PATH")
    panel(ax, 11.9, 0.75, 3.6, 7.50, "04  MULTI-TASK OUTPUTS")

    # Temporal tensor
    label(ax, 0.78, 7.45, "60-minute mission window", size=9, weight="bold")
    label(ax, 0.78, 7.15, "13 time steps × 27 features", color=CYAN, size=8)
    x0, y0 = 0.83, 5.35
    rows, cols = 9, 7
    rng = np.random.default_rng(12)
    vals = rng.uniform(0, 1, (rows, cols))
    for r in range(rows):
        for c in range(cols):
            col = plt.cm.viridis(vals[r, c] * 0.8 + 0.1)
            ax.add_patch(Rectangle((x0 + c * 0.25, y0 + r * 0.18), 0.22, 0.15, facecolor=col, edgecolor=BG, lw=0.2))
    label(ax, 0.82, 5.10, "normalized sequence tensor", color=MUTED, size=6.5)
    for i, t in enumerate(["water sensors", "weather context", "rolling values", "deltas + gradients", "time encodings"]):
        chip(ax, 0.76, 4.45 - i * 0.48, t, [TEAL, BLUE, GREEN, YELLOW, ORANGE][i], width=2.12)

    label(ax, 0.78, 1.40, "Separate context vector", size=8.5, weight="bold")
    label(ax, 0.78, 1.12, "14 location / depth / time / weather features", color=MUTED, size=6.6)

    # Architecture
    neuron_block(ax, 3.92, 5.85, 1.65, 1.42, "LSTM 1", "27 → 64", BLUE, nodes=6)
    neuron_block(ax, 6.05, 5.85, 1.65, 1.42, "LSTM 2", "64 → 32", CYAN, nodes=5)
    neuron_block(ax, 8.18, 5.85, 1.65, 1.42, "LAST STEP", "32-value embedding", GREEN, nodes=4)
    arrow(ax, (5.58, 6.56), (6.02, 6.56), BLUE)
    arrow(ax, (7.71, 6.56), (8.15, 6.56), CYAN)

    neuron_block(ax, 3.92, 1.65, 1.65, 1.42, "DENSE", "14 → 32 + ReLU", ORANGE, nodes=5)
    neuron_block(ax, 6.05, 1.65, 1.65, 1.42, "DENSE", "32 → 16 + ReLU", YELLOW, nodes=4)
    neuron_block(ax, 8.18, 1.65, 1.65, 1.42, "CONTEXT", "16-value embedding", GREEN, nodes=4)
    arrow(ax, (5.58, 2.36), (6.02, 2.36), ORANGE)
    arrow(ax, (7.71, 2.36), (8.15, 2.36), YELLOW)

    panel(ax, 9.98, 3.65, 1.25, 1.65, edge=TEAL, face="#123f49")
    label(ax, 10.605, 4.94, "FUSION", color=TEAL, size=9.5, ha="center", weight="bold")
    label(ax, 10.605, 4.52, "48 → 64", size=7, ha="center")
    label(ax, 10.605, 4.20, "64 → 32", size=7, ha="center")
    label(ax, 10.605, 3.90, "shared latent state", color=MUTED, size=5.8, ha="center")
    arrow(ax, (9.83, 6.30), (10.20, 5.32), GREEN, curve=0.1)
    arrow(ax, (9.83, 2.60), (10.20, 3.63), GREEN, curve=-0.1)

    outputs = [
        ("CURRENT OXYGEN", "1 regression value", BLUE),
        ("OXYGEN FORECAST", "t+30 / t+60 / t+120", CYAN),
        ("BLOOM RISK", "probability 0–1", GREEN),
        ("ANOMALY RISK", "probability 0–1", ORANGE),
    ]
    for i, (t, d, c) in enumerate(outputs):
        yy = 6.75 - i * 1.55
        panel(ax, 12.25, yy, 2.9, 0.92, edge=c, face=PANEL_2)
        ax.add_patch(Circle((12.55, yy + 0.46), 0.15, facecolor=c, edgecolor=WHITE, lw=0.6))
        label(ax, 12.82, yy + 0.58, t, size=8, weight="bold")
        label(ax, 12.82, yy + 0.30, d, color=MUTED, size=6.4)
        arrow(ax, (11.23, 4.47), (12.22, yy + 0.46), c, curve=(i - 1.5) * 0.10, lw=1.1)

    label(ax, 8.0, 0.32, "Architecture shown from the implemented PyTorch model • experimental research direction • not a final environmental authority",
          color=MUTED, size=6.7, ha="center")
    return save(fig, "maris-model-architecture.png")


def pipeline():
    fig, ax = setup_fig(
        "HOW MARIS TURNS MISSIONS INTO RESEARCH SIGNALS",
        "A traceable pipeline from field records to portable outputs, with validation gates at every major transformation.",
    )

    stages = [
        ("MISSION RECORDS", "CSV + JSON\nreal + synthetic missions", TEAL),
        ("RESAMPLE", "5-minute grid\nordered observations", BLUE),
        ("FEATURE ENGINEERING", "27 temporal + 14 context\nrolling / delta / spatial", CYAN),
        ("NORMALIZE + WINDOW", "z-score scaling\n13-step sequences", GREEN),
        ("TRAIN + EVALUATE", "multi-task optimization\nheld-out internal windows", YELLOW),
        ("EXPORT + COMPARE", "PyTorch → ONNX\nnumerical parity check", ORANGE),
    ]
    xs = [0.55, 3.12, 5.69, 8.26, 10.83, 13.40]
    for i, ((title, detail, color), x) in enumerate(zip(stages, xs)):
        panel(ax, x, 6.75, 2.05, 1.65, edge=color, face=PANEL_2)
        ax.add_patch(Circle((x + 0.28, 8.10), 0.13, facecolor=color, edgecolor=WHITE, lw=0.5))
        label(ax, x + 0.50, 8.10, f"{i + 1:02d}", color=color, size=7.5, weight="bold")
        label(ax, x + 0.20, 7.67, title, size=7.6, weight="bold")
        label(ax, x + 0.20, 7.13, detail, color=MUTED, size=6.25, va="center")
        if i < len(stages) - 1:
            arrow(ax, (x + 2.08, 7.57), (xs[i + 1] - 0.05, 7.57), color, lw=1.2)

    panel(ax, 0.55, 0.65, 6.0, 5.50, "MISSION WINDOW CONSTRUCTION")
    t = np.arange(13)
    features = ["DO", "Temp", "Turbidity", "Depth", "Solar", "ΔDO"]
    data = np.array([
        8.1 - 0.08 * t + 0.18 * np.sin(t / 2),
        19.0 + 0.28 * t + 0.4 * np.sin(t / 3),
        3.2 + 0.15 * t + 0.4 * np.sin(t),
        1.0 + 0.18 * t,
        220 + 42 * t + 35 * np.sin(t / 2),
        -0.04 - 0.08 * np.maximum(0, t - 7),
    ])
    norm = (data - data.min(axis=1, keepdims=True)) / (np.ptp(data, axis=1, keepdims=True) + 1e-6)
    for r, name in enumerate(features):
        label(ax, 0.88, 4.25 - r * 0.48, name, color=MUTED, size=6.5)
        for c in range(13):
            color = plt.cm.viridis(norm[r, c] * 0.78 + 0.12)
            ax.add_patch(Rectangle((1.65 + c * 0.32, 4.10 - r * 0.48), 0.28, 0.27, facecolor=color, edgecolor=BG, lw=0.2))
    label(ax, 1.65, 1.14, "t−60", color=MUTED, size=6)
    label(ax, 5.50, 1.14, "current", color=MUTED, size=6, ha="right")
    arrow(ax, (1.67, 0.98), (5.47, 0.98), TEAL, lw=1.1)
    label(ax, 3.57, 0.80, "recent measurements become one structured tensor", color=CYAN, size=6.4, ha="center")

    panel(ax, 6.90, 0.65, 4.1, 5.50, "TRAINING SIGNALS + LOSS")
    center = (8.95, 3.30)
    ax.add_patch(Circle(center, 0.48, facecolor="#124854", edgecolor=TEAL, lw=1.3))
    label(ax, center[0], center[1] + 0.09, "SHARED", color=WHITE, size=8, ha="center", weight="bold")
    label(ax, center[0], center[1] - 0.13, "representation", color=MUTED, size=5.8, ha="center")
    targets = [
        ((7.55, 4.25), "oxygen\nMSE", BLUE),
        ((10.35, 4.25), "forecast\nMSE", CYAN),
        ((7.55, 2.15), "bloom\nbinary loss", GREEN),
        ((10.35, 2.15), "anomaly\nbinary loss", ORANGE),
    ]
    for pos, txt, color in targets:
        ax.add_patch(Circle(pos, 0.43, facecolor=PANEL_2, edgecolor=color, lw=1.2))
        label(ax, pos[0], pos[1], txt, size=6.5, ha="center", weight="bold")
        arrow(ax, center, pos, color, curve=0.08 if pos[0] > center[0] else -0.08, lw=1.0)
    label(ax, 8.95, 1.20, "joint objective = oxygen + forecast + bloom + anomaly", color=MUTED, size=6.2, ha="center")

    panel(ax, 11.35, 0.65, 4.1, 5.50, "PORTABILITY + RESPONSIBLE USE")
    panel(ax, 11.72, 3.78, 1.26, 0.72, edge=BLUE, face=PANEL_2)
    panel(ax, 13.80, 3.78, 1.26, 0.72, edge=ORANGE, face=PANEL_2)
    label(ax, 12.35, 4.13, "PyTorch", size=7.4, ha="center", weight="bold")
    label(ax, 14.43, 4.13, "ONNX", size=7.4, ha="center", weight="bold")
    arrow(ax, (13.00, 4.13), (13.77, 4.13), TEAL, lw=1.4)
    label(ax, 13.39, 4.45, "export", color=MUTED, size=5.8, ha="center")
    chip(ax, 11.75, 3.14, "max difference ≈ 0.00000095", GREEN, width=3.25)
    for i, (txt, col) in enumerate([
        ("portable calculation format", CYAN),
        ("follow-up sampling support", TEAL),
        ("requires independent field validation", YELLOW),
        ("not a final decision authority", ORANGE),
    ]):
        ax.add_patch(Circle((11.82, 2.60 - i * 0.47), 0.06, facecolor=col, edgecolor=col))
        label(ax, 12.03, 2.60 - i * 0.47, txt, color=WHITE if i < 2 else MUTED, size=6.6)

    return save(fig, "maris-end-to-end-pipeline.png")


def mission_interpretation():
    fig, ax = setup_fig(
        "FROM ISOLATED READINGS TO A MISSION-LEVEL INTERPRETATION",
        "Illustrative example: temporal trends, mission context, forecast horizons, risk estimates, and targeted follow-up sampling.",
    )

    # Plot area
    panel(ax, 0.55, 4.20, 9.65, 4.20, "DISSOLVED-OXYGEN TRAJECTORY + FORECAST HORIZONS")
    chart = fig.add_axes([0.073, 0.515, 0.535, 0.335], facecolor=PANEL)
    past_t = np.arange(-60, 1, 5)
    past = 8.25 - 0.015 * (past_t + 60) - 0.18 * np.sin((past_t + 60) / 12)
    future_t = np.array([0, 30, 60, 120])
    future = np.array([past[-1], 6.95, 6.35, 5.25])
    chart.plot(past_t, past, color=CYAN, marker="o", markersize=3, lw=2, label="observed mission window")
    chart.plot(future_t, future, color=ORANGE, marker="o", markersize=5, lw=2.3, label="MARIS forecast")
    band = np.array([0.0, 0.35, 0.55, 0.95])
    chart.fill_between(future_t, future - band, future + band, color=ORANGE, alpha=0.16, label="illustrative uncertainty")
    chart.axvline(0, color=WHITE, lw=1, ls="--", alpha=0.55)
    chart.axhspan(0, 4, color=RED, alpha=0.10)
    chart.text(62, 3.65, "low-oxygen concern region", color=RED, fontsize=7, ha="center")
    chart.set_xlim(-63, 125)
    chart.set_ylim(2.5, 9.2)
    chart.grid(color=GRID, lw=0.6, alpha=0.7)
    chart.tick_params(colors=MUTED, labelsize=7)
    for spine in chart.spines.values():
        spine.set_color(GRID)
    chart.set_xlabel("minutes relative to current sample", color=MUTED, fontsize=7)
    chart.set_ylabel("dissolved oxygen (mg/L)", color=MUTED, fontsize=7)
    chart.legend(loc="lower left", frameon=False, fontsize=6.5, labelcolor=WHITE, ncol=2)

    # Risk gauges
    panel(ax, 10.55, 4.20, 4.9, 4.20, "MULTI-TASK RESEARCH OUTPUT")
    gauge_data = [("BLOOM RISK", 0.64, GREEN), ("ANOMALY RISK", 0.78, ORANGE)]
    for i, (title, value, color) in enumerate(gauge_data):
        cx, cy = 11.85 + i * 2.30, 5.47
        theta = np.linspace(np.pi, 0, 100)
        ax.plot(cx + 0.78 * np.cos(theta), cy + 0.78 * np.sin(theta), color=GRID, lw=12, solid_capstyle="round")
        theta2 = np.linspace(np.pi, np.pi * (1 - value), 100)
        ax.plot(cx + 0.78 * np.cos(theta2), cy + 0.78 * np.sin(theta2), color=color, lw=12, solid_capstyle="round")
        label(ax, cx, cy + 0.05, f"{value:.0%}", color=color, size=16, ha="center", weight="bold")
        label(ax, cx, cy - 0.32, title, size=6.6, ha="center", weight="bold")
    label(ax, 13.0, 4.22, "Outputs prioritize investigation; they do not establish a scientific conclusion.",
          color=MUTED, size=6.2, ha="center")

    # Spatial matrix
    panel(ax, 0.55, 0.55, 7.25, 3.10, "FOLLOW-UP SAMPLING PRIORITY MAP")
    sx0, sy0, sw, sh = 0.95, 0.88, 4.75, 1.75
    xx, yy = np.meshgrid(np.linspace(-2, 2, 34), np.linspace(-1.2, 1.2, 14))
    z = 0.25 + 0.62 * np.exp(-((xx - 0.75) ** 2 / 0.5 + (yy + 0.25) ** 2 / 0.32))
    z += 0.22 * np.exp(-((xx + 1.0) ** 2 / 0.8 + (yy - 0.55) ** 2 / 0.24))
    cell_w, cell_h = sw / z.shape[1], sh / z.shape[0]
    for row in range(z.shape[0]):
        for col in range(z.shape[1]):
            color = plt.cm.viridis(min(1.0, z[row, col]))
            ax.add_patch(Rectangle(
                (sx0 + col * cell_w, sy0 + row * cell_h), cell_w + 0.006, cell_h + 0.006,
                facecolor=color, edgecolor=color, lw=0, alpha=0.72,
            ))
    label(ax, sx0 + 0.10, sy0 + sh - 0.13, "lower priority", color=WHITE, size=5.5)
    label(ax, sx0 + sw - 0.10, sy0 + sh - 0.13, "higher priority", color=WHITE, size=5.5, ha="right")
    route_x = np.linspace(sx0 + 0.15, sx0 + sw - 0.15, 10)
    route_y = sy0 + 0.35 + 0.48 * np.sin(np.linspace(0, 2.2 * np.pi, 10)) + np.linspace(0, 0.45, 10)
    ax.plot(route_x, route_y, color=WHITE, lw=1.2, ls="--", alpha=0.9)
    ax.scatter(route_x, route_y, s=18, facecolor=TEAL, edgecolor=WHITE, lw=0.5, zorder=5)
    ax.scatter([sx0 + 3.55], [sy0 + 0.72], s=150, facecolor="none", edgecolor=ORANGE, lw=2.2, zorder=6)
    arrow(ax, (6.10, 1.72), (4.72, 1.60), ORANGE, curve=-0.08)
    label(ax, 6.22, 1.84, "return here", color=ORANGE, size=7.3, weight="bold")
    label(ax, 6.22, 1.51, "collect reference\nmeasurement", color=MUTED, size=6.1)

    panel(ax, 8.15, 0.55, 7.30, 3.10, "WHY THIS LOCATION IS PRIORITIZED")
    reasons = [
        ("TEMPORAL", "oxygen trend continues downward", BLUE),
        ("SPATIAL", "neighboring samples show a local gradient", CYAN),
        ("CONTEXT", "depth + solar + turbidity align", GREEN),
        ("CAUTION", "independent measurement still required", ORANGE),
    ]
    for i, (kind, detail, color) in enumerate(reasons):
        yy = 2.62 - i * 0.50
        chip(ax, 8.50, yy - 0.16, kind, color, width=1.10)
        label(ax, 9.82, yy, detail, color=WHITE if i < 3 else MUTED, size=6.8)

    return save(fig, "maris-mission-interpretation.png")


def validation():
    fig, ax = setup_fig(
        "MARIS VALIDATION MAP: WHAT HAS BEEN SHOWN VS. WHAT REMAINS",
        "The system demonstrates a complete development pipeline while keeping computational verification separate from environmental validity.",
    )

    panel(ax, 0.55, 4.55, 9.0, 3.85, "CURRENT DEVELOPMENT EVIDENCE")
    cards = [
        ("3", "real missions", TEAL),
        ("12", "synthetic missions", BLUE),
        ("1,158", "structured windows", CYAN),
        ("232", "evaluation windows", GREEN),
        ("0.00000095", "maximum ONNX difference", YELLOW),
    ]
    for i, (value, detail, color) in enumerate(cards):
        x = 0.88 + i * 1.70
        panel(ax, x, 5.12, 1.45, 1.35, edge=color, face=PANEL_2)
        label(ax, x + 0.725, 5.90, value, color=color, size=12 if i != 4 else 8.5, ha="center", weight="bold")
        label(ax, x + 0.725, 5.45, detail, color=MUTED, size=5.7, ha="center")
    label(ax, 0.88, 4.58, "Automated checks cover loading, feature construction, normalization, training execution, finite outputs, artifacts, and export parity.",
          color=MUTED, size=6.5)

    panel(ax, 9.90, 4.55, 5.55, 3.85, "INTERNAL METRICS — PRELIMINARY")
    metric_items = [
        ("oxygen RMSE", METRICS["oxygen_rmse"], 3.0, BLUE),
        ("forecast RMSE", METRICS["forecast_rmse"], 3.0, CYAN),
        ("bloom accuracy", METRICS["bloom_accuracy"], 1.0, GREEN),
        ("anomaly accuracy", METRICS["anomaly_accuracy"], 1.0, ORANGE),
    ]
    for i, (name, val, maxv, color) in enumerate(metric_items):
        y = 6.50 - i * 0.58
        label(ax, 10.20, y, name, color=MUTED, size=6.4)
        ax.plot([11.60, 14.55], [y, y], color=GRID, lw=7, solid_capstyle="round")
        ax.plot([11.60, 11.60 + 2.95 * min(1, val / maxv)], [y, y], color=color, lw=7, solid_capstyle="round")
        shown = f"{val:.2f}" if "RMSE" in name else f"{val:.1%}"
        label(ax, 14.95, y, shown, color=color, size=7.2, ha="right", weight="bold")
    label(ax, 12.68, 4.50, "Internal evaluation is evidence that the pipeline runs,\nnot proof of dependable field forecasting.",
          color=MUTED, size=6.2, ha="center")

    panel(ax, 0.55, 0.55, 14.90, 3.55, "VALIDATION LADDER")
    ladder = [
        ("IMPLEMENTED", "data → model → artifacts", GREEN, True),
        ("COMPUTATIONALLY VERIFIED", "PyTorch and ONNX outputs match", TEAL, True),
        ("INTERNALLY EVALUATED", "held-out development windows", BLUE, True),
        ("INDEPENDENTLY FIELD-TESTED", "held-out water bodies + instruments", YELLOW, False),
        ("DEPLOYMENT-READY", "uncertainty + monitoring + live runtime", ORANGE, False),
    ]
    x_positions = np.linspace(1.45, 14.55, len(ladder))
    for i, ((title, detail, color, done), x) in enumerate(zip(ladder, x_positions)):
        if i < len(ladder) - 1:
            ax.plot([x + 0.45, x_positions[i + 1] - 0.45], [2.20, 2.20], color=GRID, lw=4, solid_capstyle="round")
        ax.add_patch(Circle((x, 2.20), 0.38, facecolor=color if done else PANEL_2, edgecolor=color, lw=2.0))
        if done:
            label(ax, x, 2.20, "✓", color=BG, size=12, ha="center", weight="bold")
        else:
            label(ax, x, 2.20, "NEXT", color=color, size=5.4, ha="center", weight="bold")
        label(ax, x, 1.48, title, color=color, size=6.4, ha="center", weight="bold")
        label(ax, x, 1.05, detail, color=MUTED, size=5.4, ha="center")
    label(ax, 8.0, 0.72, "Required next evidence: larger independent datasets • held-out water bodies • reference instruments • uncertainty measurement • simpler baselines",
          color=MUTED, size=6.2, ha="center")

    return save(fig, "maris-validation-map.png")


def contact_sheet(paths):
    fig = plt.figure(figsize=(16, 9), dpi=180, facecolor="#dcebed")
    for i, path in enumerate(paths):
        ax = fig.add_axes([0.015 + (i % 2) * 0.50, 0.505 - (i // 2) * 0.49, 0.47, 0.47])
        ax.imshow(plt.imread(path))
        ax.axis("off")
    out = OUT / "maris-visuals-contact-sheet.png"
    fig.savefig(out, facecolor=fig.get_facecolor(), dpi=180)
    plt.close(fig)
    return out


def main():
    paths = [architecture(), pipeline(), mission_interpretation(), validation()]
    paths.append(contact_sheet(paths))
    print("\n".join(str(path) for path in paths))


if __name__ == "__main__":
    main()
