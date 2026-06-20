import csv
import json
import math
from datetime import datetime, timedelta, timezone
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "outputs" / "do_profile_data.csv"
OUTPUTS = [
    ROOT / "outputs" / "do-extrapolated-mission.csv",
    ROOT / "Assets" / "StreamingAssets" / "do-extrapolated-mission.csv",
    ROOT / "web" / "public" / "missions" / "do-extrapolated-mission.csv",
]
JSON_OUTPUT = ROOT / "outputs" / "do-extrapolated-mission.json"

BASE_LAT = 37.425100
BASE_LON = -122.084100
START_TIME = datetime(2026, 6, 18, 13, 0, 0, tzinfo=timezone.utc)

STATIONS = [
    {"name": "north_shore", "lat_offset": 0.000000, "lon_offset": 0.000000, "do_bias": 0.15, "turbidity_bias": -3.0},
    {"name": "inlet_edge", "lat_offset": 0.000120, "lon_offset": 0.000090, "do_bias": -0.20, "turbidity_bias": 5.0},
    {"name": "center_basin", "lat_offset": 0.000240, "lon_offset": 0.000030, "do_bias": -0.05, "turbidity_bias": 2.0},
    {"name": "south_cove", "lat_offset": 0.000180, "lon_offset": -0.000120, "do_bias": -0.35, "turbidity_bias": 8.0},
    {"name": "return_lane", "lat_offset": 0.000040, "lon_offset": -0.000070, "do_bias": 0.05, "turbidity_bias": 0.0},
]

HEADERS = [
    "timestamp",
    "latitude",
    "longitude",
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
    "heading",
    "speed",
    "battery",
    "do_percent_saturation",
    "secchi_depth_m",
    "station_index",
    "cast_index",
    "oxygen_status_code",
]


def read_profile():
    with SOURCE.open(newline="", encoding="utf-8-sig") as handle:
        return [
            {
                "depth": float(row["depth_m"]),
                "do": float(row["dissolved_oxygen_mg_L"]),
                "sat": float(row["do_percent_saturation"]),
                "temp": float(row["water_temp_C"]),
                "turbidity": float(row["turbidity_NTU"]),
                "secchi": float(row["secchi_depth_m"]),
                "ph": float(row["pH"]),
                "conductivity": float(row["conductivity_uS_cm"]),
            }
            for row in csv.DictReader(handle)
        ]


def clamp(value, low, high):
    return max(low, min(high, value))


def heading_between(a, b):
    lat1 = math.radians(a["lat"])
    lat2 = math.radians(b["lat"])
    dlon = math.radians(b["lon"] - a["lon"])
    y = math.sin(dlon) * math.cos(lat2)
    x = math.cos(lat1) * math.sin(lat2) - math.sin(lat1) * math.cos(lat2) * math.cos(dlon)
    return (math.degrees(math.atan2(y, x)) + 360) % 360


def oxygen_status_code(do_value):
    if do_value < 2.0:
        return 3
    if do_value < 5.0:
        return 2
    return 1


def make_sample(time_utc, lat, lon, depth, profile, station_index, cast_index, heading, speed, battery, station):
    depth_factor = depth / 2.5
    station_factor = station_index / max(1, len(STATIONS) - 1)
    do_value = clamp(profile["do"] + station["do_bias"] - 0.08 * station_factor * depth_factor, 0.0, 14.0)
    conductivity = profile["conductivity"] + station_index * 3.0 + depth_factor * 1.5
    tds = conductivity * 0.5
    light = max(2.0, 760.0 * math.exp(-4.2 * depth) - profile["turbidity"] * 1.6 + station["turbidity_bias"] * -1.5)
    uv = max(0.0, 2.2 * math.exp(-3.0 * depth))
    salinity = conductivity * 0.00055

    return {
        "timestamp": time_utc.isoformat().replace("+00:00", "Z"),
        "latitude": f"{lat:.6f}",
        "longitude": f"{lon:.6f}",
        "temperature": f"{profile['temp']:.2f}",
        "ph": f"{profile['ph']:.2f}",
        "do": f"{do_value:.2f}",
        "salinity": f"{salinity:.3f}",
        "tds": f"{tds:.0f}",
        "conductivity": f"{conductivity:.0f}",
        "turbidity": f"{profile['turbidity'] + station['turbidity_bias']:.1f}",
        "light": f"{light:.0f}",
        "uv": f"{uv:.2f}",
        "depth": f"{depth:.2f}",
        "heading": f"{heading:.0f}",
        "speed": f"{speed:.2f}",
        "battery": f"{battery:.1f}",
        "do_percent_saturation": f"{clamp(profile['sat'] + station['do_bias'] * 5.0, 0.0, 130.0):.0f}",
        "secchi_depth_m": f"{profile['secchi']:.2f}",
        "station_index": str(station_index + 1),
        "cast_index": str(cast_index),
        "oxygen_status_code": str(oxygen_status_code(do_value)),
    }


def build_mission(profile_rows):
    rows = []
    current_time = START_TIME
    battery = 98.0

    station_positions = [
        {"lat": BASE_LAT + station["lat_offset"], "lon": BASE_LON + station["lon_offset"]}
        for station in STATIONS
    ]

    for station_index, station in enumerate(STATIONS):
        pos = station_positions[station_index]
        next_pos = station_positions[(station_index + 1) % len(station_positions)]
        heading = heading_between(pos, next_pos)

        for cast_index, profile in enumerate(profile_rows, start=1):
            depth = profile["depth"]
            rows.append(
                make_sample(
                    current_time,
                    pos["lat"],
                    pos["lon"],
                    depth,
                    profile,
                    station_index,
                    cast_index,
                    heading,
                    0.08 if cast_index > 1 else 0.12,
                    battery,
                    station,
                )
            )
            current_time += timedelta(seconds=12)
            battery -= 0.08

        if station_index < len(STATIONS) - 1:
            target = station_positions[station_index + 1]
            transit_heading = heading_between(pos, target)
            surface = profile_rows[0]
            for step in range(1, 4):
                t = step / 3.0
                rows.append(
                    make_sample(
                        current_time,
                        pos["lat"] + (target["lat"] - pos["lat"]) * t,
                        pos["lon"] + (target["lon"] - pos["lon"]) * t,
                        0.10,
                        surface,
                        station_index,
                        0,
                        transit_heading,
                        0.75,
                        battery,
                        station,
                    )
                )
                current_time += timedelta(seconds=10)
                battery -= 0.06

    return rows


def write_csv(rows):
    for output in OUTPUTS:
        output.parent.mkdir(parents=True, exist_ok=True)
        with output.open("w", newline="", encoding="utf-8") as handle:
            writer = csv.DictWriter(handle, fieldnames=HEADERS)
            writer.writeheader()
            writer.writerows(rows)


def write_json(rows):
    samples = []
    for row in rows:
        samples.append(
            {
                "timestamp": row["timestamp"],
                "latitude": float(row["latitude"]),
                "longitude": float(row["longitude"]),
                "depth": float(row["depth"]),
                "heading": float(row["heading"]),
                "speed": float(row["speed"]),
                "battery": float(row["battery"]),
                "metrics": {
                    "temperature": float(row["temperature"]),
                    "ph": float(row["ph"]),
                    "do": float(row["do"]),
                    "salinity": float(row["salinity"]),
                    "tds": float(row["tds"]),
                    "conductivity": float(row["conductivity"]),
                    "turbidity": float(row["turbidity"]),
                    "light": float(row["light"]),
                    "uv": float(row["uv"]),
                    "do_percent_saturation": float(row["do_percent_saturation"]),
                    "secchi_depth_m": float(row["secchi_depth_m"]),
                    "station_index": float(row["station_index"]),
                    "cast_index": float(row["cast_index"]),
                    "oxygen_status_code": float(row["oxygen_status_code"]),
                },
            }
        )

    JSON_OUTPUT.write_text(
        json.dumps(
            {
                "missionName": "DO Extrapolated Mission Profile",
                "sourceProfile": str(SOURCE.relative_to(ROOT)).replace("\\", "/"),
                "method": "Five-station synthetic mission extrapolated from the dissolved oxygen depth profile.",
                "samples": samples,
            },
            indent=2,
        ),
        encoding="utf-8",
    )


def main():
    profile_rows = read_profile()
    rows = build_mission(profile_rows)
    write_csv(rows)
    write_json(rows)
    print(f"generated {len(rows)} samples")
    print(f"duration_seconds {(datetime.fromisoformat(rows[-1]['timestamp'].replace('Z', '+00:00')) - START_TIME).total_seconds():.0f}")
    print(f"min_do {min(float(row['do']) for row in rows):.2f}")
    print(f"max_do {max(float(row['do']) for row in rows):.2f}")


if __name__ == "__main__":
    main()
