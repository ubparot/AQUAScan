from pathlib import Path

from aquascan_ml.data import load_csv_mission, load_json_mission


ROOT = Path(__file__).resolve().parents[2]
STREAMING = ROOT / "Assets" / "StreamingAssets"


def test_load_demo_csv():
    mission = load_csv_mission(STREAMING / "demo-mission.csv")
    assert mission.samples
    first = mission.samples[0]
    assert first.latitude != 0
    assert "temperature" in first.metrics
    assert "do" in first.metrics


def test_load_pool_csv():
    mission = load_csv_mission(STREAMING / "pool-demo-mission.csv")
    assert mission.samples
    assert mission.samples[0].metrics["depth"] > 0


def test_load_demo_json():
    mission = load_json_mission(STREAMING / "demo-mission.json")
    assert mission.samples
    assert "temperature" in mission.samples[0].metrics
    assert "do" in mission.samples[0].metrics
