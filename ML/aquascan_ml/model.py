from __future__ import annotations

import torch
from torch import nn


class AquaScanMultiTaskModel(nn.Module):
    def __init__(self, temporal_features: int, context_features: int):
        super().__init__()
        self.lstm1 = nn.LSTM(temporal_features, 64, batch_first=True)
        self.lstm2 = nn.LSTM(64, 32, batch_first=True)
        self.context = nn.Sequential(
            nn.Linear(context_features, 32),
            nn.ReLU(),
            nn.Linear(32, 16),
            nn.ReLU(),
        )
        self.fusion = nn.Sequential(
            nn.Linear(32 + 16, 64),
            nn.ReLU(),
            nn.Linear(64, 32),
            nn.ReLU(),
        )
        self.oxygen_head = nn.Linear(32, 1)
        self.forecast_head = nn.Linear(32, 3)
        self.bloom_head = nn.Linear(32, 1)
        self.anomaly_head = nn.Linear(32, 1)

    def forward(self, temporal: torch.Tensor, context: torch.Tensor) -> dict[str, torch.Tensor]:
        encoded, _ = self.lstm1(temporal)
        encoded, _ = self.lstm2(encoded)
        temporal_embedding = encoded[:, -1, :]
        context_embedding = self.context(context)
        fused = self.fusion(torch.cat([temporal_embedding, context_embedding], dim=1))
        return {
            "oxygen": self.oxygen_head(fused),
            "forecast": self.forecast_head(fused),
            "bloom": torch.sigmoid(self.bloom_head(fused)),
            "anomaly": torch.sigmoid(self.anomaly_head(fused)),
        }


class AquaScanOnnxWrapper(nn.Module):
    def __init__(self, model: AquaScanMultiTaskModel):
        super().__init__()
        self.model = model

    def forward(self, temporal: torch.Tensor, context: torch.Tensor) -> tuple[torch.Tensor, torch.Tensor, torch.Tensor, torch.Tensor]:
        outputs = self.model(temporal, context)
        return outputs["oxygen"], outputs["forecast"], outputs["bloom"], outputs["anomaly"]
