from __future__ import annotations

import numpy as np


def anomaly_baseline_scores(features: np.ndarray) -> tuple[str, np.ndarray]:
    flat = features.reshape(features.shape[0], -1)
    try:
        from sklearn.ensemble import IsolationForest

        model = IsolationForest(contamination=0.08, random_state=7)
        model.fit(flat)
        raw = -model.decision_function(flat)
        return "IsolationForest", normalize_scores(raw)
    except Exception:
        z = np.abs((flat - flat.mean(axis=0)) / np.maximum(flat.std(axis=0), 1e-6))
        raw = z.max(axis=1)
        return "ZScoreFallback", normalize_scores(raw)


def normalize_scores(values: np.ndarray) -> np.ndarray:
    minimum = values.min()
    maximum = values.max()
    if maximum - minimum < 1e-9:
        return np.zeros_like(values)
    return (values - minimum) / (maximum - minimum)
