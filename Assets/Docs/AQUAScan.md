## AQUAScan 3D Visualizer

Unity 2022+ components for loading georeferenced water-quality missions, converting GPS to local space, and rendering interactive layers (track, boat, point cloud, heatmap) with timeline playback.

### Scene Setup (quick)
1. Create an empty GameObject `AquaRoot` and add these components:
   - `AquaMissionController`
   - `AquaMissionPlayer`
   - `BoatTrackRenderer` (add a `LineRenderer` component too)
   - `SamplePointCloud` (auto-adds `ParticleSystem`)
   - `HeatmapSurface` (auto-adds `MeshFilter`/`MeshRenderer`)
2. Boat marker: create a simple capsule/boat model, parent under `AquaRoot`, assign to `BoatTrackRenderer.BoatMarker`.
3. UI (UGUI):
   - Dropdown -> `MetricDropdown`
   - Toggles -> `TrackToggle`, `PointsToggle`, `HeatmapToggle`
   - Slider -> `TimeSlider`
   - RawImage -> `LegendGradient`
   - Text -> `LegendLabel`, `CurrentValueLabel`, `PlayPauseText`
   - Button -> `PlayPauseButton`
   - InputField -> `PathInputField` (optional; enter absolute or StreamingAssets path)
   - Button -> `LoadButton` (invokes load from `PathInputField`)
4. Materials: assign a simple transparent material that supports vertex colors to the `HeatmapSurface` renderer. Adjust `HeatmapSurface.VerticalOffset` to sit just above your water plane.
5. Default data: a demo CSV/JSON lives in `Assets/StreamingAssets/demo-mission.csv` / `demo-mission.json`. Leave `AquaMissionController.LoadDefaultOnStart` checked to auto-load.

### Controls & Interaction
- Metric dropdown: switches the coloring metric across points + heatmap; legend updates with units.
- Layer toggles: Track, Points, Heatmap visibility.
- Timeline slider: scrub through the mission. Boat animates along the track; current metric under the boat is shown in `CurrentValueLabel`.
- Play/Pause button: toggles playback; looping enabled by default.
- Load button: loads a CSV/JSON mission from the path typed into the input field (absolute path or file inside `StreamingAssets`).
- Boat wake: if you add a `ParticleSystem` under the boat marker with `BoatWakeEffect`, emission scales with playback speed.

### Data Schema
Required per-sample fields:
- `timestamp` (ISO-8601, UTC preferred)
- `latitude`, `longitude` (degrees)

Optional numeric fields (ingested if present): `altitude`, `heading`, `speed`, `depth`, `battery`.

Metrics (extensible):
- Known ids with gradients: `temperature` (°C), `ph`, `do` (mg/L), `salinity` (ppt), `turbidity` (NTU), `depth` (m).
- Any additional columns (CSV) or `metrics` entries (JSON) are auto-added and get a default blue→red gradient until configured in `MetricRegistry`.

CSV header example:
```
timestamp,latitude,longitude,temperature,ph,do,salinity,turbidity,depth,heading,speed
```

JSON example:
```json
{
  "missionName": "Demo JSON Mission",
  "samples": [
    { "timestamp": "2025-01-01T12:00:00Z", "latitude": 37.4251, "longitude": -122.0841, "metrics": { "temperature": 16.2, "ph": 7.5 } }
  ]
}
```

### Coordinate Conversion
- Uses first GPS fix as local origin.
- Projects lat/long to meters via equirectangular approximation (`GeoUtils.GeoToLocal`), suitable for lake/river extents.
- Altitude is preserved (optional) and added to Y.

### Heatmap Generation
- Grid-based averaging (cell size configurable) with vertex-colored mesh.
- Empty cells are omitted (no misleading smoothing); points remain visible for transparency of sparse regions.
- Extendable to interpolation (IDW/kriging) inside `HeatmapSurface`.

### Validation & Integrity
- Basic range checks for lat/long and timestamps.
- Raw points always available; heatmap is a secondary, toggleable layer.
- Metrics are stored in a lowercase dictionary per sample to keep the pipeline metric-agnostic.

### Extending Metrics
- Add new entries to `MetricRegistry` for custom gradients/units.
- New CSV columns or JSON `metrics` keys automatically flow through coloring, legend, and value readouts once registered.

### Live Streaming Hook
- `MissionLoader` is offline-oriented. For live use, feed `AquaMission` samples incrementally and call `GeoReference.OffsetToLocal` to append positions, then refresh the track/point cloud renderers.

### Visual polish (water + particles)
- Water: assign `Shaders/StylizedWater.shader` to a new material, set Rendering to Transparent, and drop it on your water plane. Tweak shallow/deep colors, alpha, and wave amplitude for your scale.
- Wake/spray: add a child GameObject to the boat marker with a `ParticleSystem` + `BoatWakeEffect`. Set start size 0.15–0.35, lifetime ~0.8s, emission over time ~10, and color over speed gradient from light foam to blue. `AquaMissionController` will call `UpdateWake` during playback so emission tracks vessel speed.
