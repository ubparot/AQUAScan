from __future__ import annotations

import math
import random
from datetime import datetime, timedelta

from .data import Mission, MissionSample


def generate_synthetic_missions(
    count: int,
    seed: int = 7,
    hours: int = 8,
    step_minutes: int = 5,
) -> list[Mission]:
    rng = random.Random(seed)
    missions: list[Mission] = []
    for mission_index in range(count):
        start = datetime(2026, 4, 1, 8, 0, 0) + timedelta(days=mission_index)
        base_lat = 37.1 + rng.random() * 0.4
        base_lon = -76.6 + rng.random() * 0.5
        eutrophic = rng.random() < 0.45
        storm_hour = rng.choice([None, 2, 3, 4])
        samples: list[MissionSample] = []
        total_steps = int(hours * 60 / step_minutes)

        for step in range(total_steps):
            t = start + timedelta(minutes=step * step_minutes)
            hour = t.hour + t.minute / 60.0
            daylight = max(0.0, math.sin((hour - 6.0) / 12.0 * math.pi))
            depth = 0.4 + 5.8 * (0.5 + 0.5 * math.sin(step / 9.0 + mission_index))
            surface_temp = 18.0 + 6.0 * daylight + rng.gauss(0.0, 0.25)
            stratification = max(0.0, 0.35 * daylight * depth)
            temperature = surface_temp - 0.32 * depth - 0.35 * stratification
            solar_radiation = 850.0 * daylight + rng.gauss(0.0, 35.0)
            wind_speed = max(0.0, 2.0 + 2.5 * rng.random())
            precipitation = 0.0
            if storm_hour is not None and storm_hour <= (step * step_minutes / 60.0) <= storm_hour + 1.5:
                wind_speed += 4.0 + rng.random() * 2.0
                precipitation = 2.0 + rng.random() * 6.0
            pressure = 1015.0 - 3.0 * precipitation + rng.gauss(0.0, 1.2)
            turbidity = max(0.05, 1.2 + 0.7 * depth + 2.4 * precipitation + rng.gauss(0.0, 0.4))
            tds = 260.0 + 45.0 * depth + (90.0 if eutrophic else 0.0) + rng.gauss(0.0, 10.0)
            salinity = max(0.0, 0.25 + 0.035 * tds / 10.0 + rng.gauss(0.0, 0.02))
            conductivity = tds * 1.9
            ph = 7.25 + 0.18 * daylight - 0.03 * precipitation + rng.gauss(0.0, 0.04)
            light = max(0.0, solar_radiation * math.exp(-0.22 * depth - 0.035 * turbidity))
            uv = max(0.0, daylight * 3.0 * math.exp(-0.35 * depth))

            oxygen_solubility_pressure = 11.0 - 0.18 * temperature
            bloom_bonus = 0.35 if eutrophic and daylight > 0.4 and temperature > 21.0 else 0.0
            bottom_stress = 0.55 * max(0.0, depth - 3.0) + 0.28 * stratification
            storm_delay_stress = 0.2 * max(0.0, precipitation - 1.5)
            dissolved_oxygen = oxygen_solubility_pressure + bloom_bonus - bottom_stress - storm_delay_stress
            dissolved_oxygen += rng.gauss(0.0, 0.18)

            if rng.random() < 0.015:
                dissolved_oxygen -= rng.uniform(1.5, 3.0)
                turbidity += rng.uniform(8.0, 20.0)

            metrics = {
                "temperature": temperature,
                "do": max(0.2, dissolved_oxygen),
                "ph": ph,
                "salinity": salinity,
                "tds": tds,
                "conductivity": conductivity,
                "turbidity": turbidity,
                "light": light,
                "uv": uv,
                "depth": depth,
                "air_temp": surface_temp + rng.gauss(0.0, 0.6),
                "wind_speed": wind_speed,
                "pressure": pressure,
                "precipitation": precipitation,
                "solar_radiation": max(0.0, solar_radiation),
            }
            samples.append(
                MissionSample(
                    timestamp=t,
                    latitude=base_lat + 0.002 * math.sin(step / 21.0),
                    longitude=base_lon + 0.002 * math.cos(step / 18.0),
                    metrics=metrics,
                )
            )

        missions.append(Mission(f"synthetic-{mission_index:03d}", "synthetic", samples))
    return missions
