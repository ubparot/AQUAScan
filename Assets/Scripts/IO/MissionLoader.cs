using System;
using System.Collections.Generic;
using System.Globalization;
using System.IO;
using System.Linq;
using AQUAScan.AquaData;
using UnityEngine;

namespace AQUAScan.IO
{
    /// <summary>
    /// Loads mission files from CSV or JSON and projects them into local coordinates.
    /// </summary>
    public static class MissionLoader
    {
        public static AquaMission LoadFromFile(string path)
        {
            if (string.IsNullOrEmpty(path) || !File.Exists(path))
            {
                Debug.LogError($"MissionLoader: File not found at {path}");
                return null;
            }

            var extension = Path.GetExtension(path).ToLowerInvariant();
            AquaMission mission = extension switch
            {
                ".csv" => LoadFromCsv(path),
                ".json" => LoadFromJson(path),
                _ => null
            };

            if (mission == null)
            {
                Debug.LogError($"MissionLoader: Unsupported or failed to load file {path}");
                return null;
            }

            mission.SourceFile = path;
            FinalizeMission(mission);
            return mission;
        }

        public static AquaMission LoadFromCsv(string path)
        {
            var lines = File.ReadAllLines(path);
            if (lines.Length < 2)
            {
                Debug.LogError("MissionLoader: CSV has no data rows.");
                return null;
            }

            var header = lines[0].Split(',');
            var columnIndex = header
                .Select((column, index) => new { column = column.Trim().ToLowerInvariant(), index })
                .ToDictionary(c => c.column, c => c.index);

            bool Has(string key) => columnIndex.ContainsKey(key);
            int Idx(string key) => columnIndex[key];

            if (!Has("timestamp") || !Has("latitude") || !Has("longitude"))
            {
                Debug.LogError("MissionLoader: CSV missing required headers: timestamp, latitude, longitude.");
                return null;
            }

            var samples = new List<AquaSample>();
            for (int i = 1; i < lines.Length; i++)
            {
                var row = lines[i];
                if (string.IsNullOrWhiteSpace(row))
                    continue;

                var cells = row.Split(',');
                if (cells.Length < 3)
                    continue;

                var sample = new AquaSample();
                if (!DateTime.TryParse(cells[Idx("timestamp")], CultureInfo.InvariantCulture, DateTimeStyles.AssumeUniversal | DateTimeStyles.AdjustToUniversal, out var timestamp))
                {
                    Debug.LogWarning($"MissionLoader: Invalid timestamp at line {i + 1}: {cells[Idx("timestamp")]}");
                    continue;
                }
                sample.Timestamp = timestamp;
                sample.Latitude = ParseDoubleSafe(cells[Idx("latitude")]);
                sample.Longitude = ParseDoubleSafe(cells[Idx("longitude")]);

                if (Has("altitude")) sample.Altitude = ParseNullableFloat(cells[Idx("altitude")]);
                if (Has("heading")) sample.HeadingDeg = ParseNullableFloat(cells[Idx("heading")]);
                if (Has("speed")) sample.SpeedMps = ParseNullableFloat(cells[Idx("speed")]);
                if (Has("depth")) sample.DepthMeters = ParseNullableFloat(cells[Idx("depth")]);
                if (!sample.DepthMeters.HasValue && TryEstimateSpoolDepthCsv(cells, Has, Idx, out var spoolDepth))
                    sample.DepthMeters = spoolDepth;
                if (Has("battery")) sample.BatteryPercent = ParseNullableFloat(cells[Idx("battery")]);

                // Promote navigation/housekeeping values to metrics so they can be visualized like chemistry layers.
                if (sample.DepthMeters.HasValue) sample.SetMetric("depth", sample.DepthMeters.Value);
                if (TryEstimateSpoolLengthCsv(cells, Has, Idx, out var spoolLength)) sample.SetMetric("spool_cable_length", spoolLength);
                if (sample.SpeedMps.HasValue) sample.SetMetric("speed", sample.SpeedMps.Value);
                if (sample.BatteryPercent.HasValue) sample.SetMetric("battery", sample.BatteryPercent.Value);

                // Known metrics
                foreach (var metric in new[] { "temperature", "ph", "do", "salinity", "tds", "conductivity", "turbidity", "light", "uv" })
                {
                    if (Has(metric))
                    {
                        var val = ParseNullableFloat(cells[Idx(metric)]);
                        if (val.HasValue) sample.SetMetric(metric, val.Value);
                    }
                }

                if (Has("dissolved_oxygen") && !sample.Metrics.ContainsKey("do"))
                {
                    var val = ParseNullableFloat(cells[Idx("dissolved_oxygen")]);
                    if (val.HasValue) sample.SetMetric("do", val.Value);
                }

                // Any remaining numeric columns become metrics as well to keep extensible.
                for (int c = 0; c < cells.Length && c < header.Length; c++)
                {
                    var key = header[c].Trim().ToLowerInvariant();
                    if (key is "timestamp" or "latitude" or "longitude" or "altitude" or "heading" or "speed" or "depth" or "battery")
                        continue;
                    if (sample.Metrics.ContainsKey(key))
                        continue;

                    var val = ParseNullableFloat(cells[c]);
                    if (val.HasValue)
                        sample.SetMetric(key, val.Value);
                }

                if (ValidateSample(sample, i))
                    samples.Add(sample);
            }

            return new AquaMission { Samples = samples, MissionName = Path.GetFileNameWithoutExtension(path) };
        }

        public static AquaMission LoadFromJson(string path)
        {
            var json = File.ReadAllText(path);
            var root = SimpleJson.Deserialize(json) as Dictionary<string, object>;
            if (root == null || !root.TryGetValue("samples", out var samplesObj))
            {
                Debug.LogError("MissionLoader: JSON missing samples.");
                return null;
            }

            string missionName = root.TryGetValue("missionName", out var nameObj) ? nameObj as string : Path.GetFileNameWithoutExtension(path);
            var sampleArray = samplesObj as List<object>;
            if (sampleArray == null || sampleArray.Count == 0)
            {
                Debug.LogError("MissionLoader: JSON samples not an array.");
                return null;
            }

            var samples = new List<AquaSample>();
            for (int i = 0; i < sampleArray.Count; i++)
            {
                if (sampleArray[i] is not Dictionary<string, object> dict)
                    continue;

                if (!dict.TryGetValue("timestamp", out var tsObj) || !(tsObj is string tsString) ||
                    !DateTime.TryParse(tsString, CultureInfo.InvariantCulture, DateTimeStyles.AssumeUniversal | DateTimeStyles.AdjustToUniversal, out var timestamp))
                {
                    Debug.LogWarning($"MissionLoader: Invalid timestamp in JSON sample {i}");
                    continue;
                }

                if (!TryGetDouble(dict, "latitude", out var latitude) || !TryGetDouble(dict, "longitude", out var longitude))
                {
                    Debug.LogWarning($"MissionLoader: Missing lat/long in JSON sample {i}");
                    continue;
                }

                var sample = new AquaSample
                {
                    Timestamp = timestamp,
                    Latitude = latitude,
                    Longitude = longitude,
                    Metrics = new Dictionary<string, float>()
                };

                if (TryGetDouble(dict, "altitude", out var altitude)) sample.Altitude = (float)altitude;
                if (TryGetFloat(dict, "heading", out var heading)) sample.HeadingDeg = heading;
                if (TryGetFloat(dict, "speed", out var speed)) sample.SpeedMps = speed;
                if (TryGetFloat(dict, "depth", out var depth)) sample.DepthMeters = depth;
                if (!sample.DepthMeters.HasValue && TryEstimateSpoolDepthJson(dict, out var spoolDepth)) sample.DepthMeters = spoolDepth;
                if (TryGetFloat(dict, "battery", out var battery)) sample.BatteryPercent = battery;

                if (sample.DepthMeters.HasValue) sample.SetMetric("depth", sample.DepthMeters.Value);
                if (TryEstimateSpoolLengthJson(dict, out var spoolLength)) sample.SetMetric("spool_cable_length", spoolLength);
                if (sample.SpeedMps.HasValue) sample.SetMetric("speed", sample.SpeedMps.Value);
                if (sample.BatteryPercent.HasValue) sample.SetMetric("battery", sample.BatteryPercent.Value);

                if (dict.TryGetValue("metrics", out var metricsObj) && metricsObj is Dictionary<string, object> metricsDict)
                {
                    foreach (var kvp in metricsDict)
                    {
                        if (float.TryParse(kvp.Value.ToString(), NumberStyles.Float, CultureInfo.InvariantCulture, out var val))
                        {
                            string metricId = kvp.Key.Equals("dissolved_oxygen", StringComparison.OrdinalIgnoreCase) ? "do" : kvp.Key;
                            sample.SetMetric(metricId, val);
                        }
                    }
                }

                if (ValidateSample(sample, i))
                    samples.Add(sample);
            }

            return new AquaMission { Samples = samples, MissionName = missionName };
        }

        private static void FinalizeMission(AquaMission mission)
        {
            if (mission.IsEmpty)
                return;

            var first = mission.Samples[0];
            mission.GeoReference = new GeoReference
            {
                OriginLatitude = first.Latitude,
                OriginLongitude = first.Longitude,
                OriginAltitude = first.Altitude
            };

            foreach (var sample in mission.Samples)
            {
                sample.LocalPosition = mission.GeoReference.OffsetToLocal(sample.Latitude, sample.Longitude, sample.Altitude);
            }
        }

        private static bool ValidateSample(AquaSample sample, int lineIndex)
        {
            bool valid = true;
            if (sample.Latitude < -90 || sample.Latitude > 90)
            {
                Debug.LogWarning($"MissionLoader: Latitude out of range at row {lineIndex}");
                valid = false;
            }
            if (sample.Longitude < -180 || sample.Longitude > 180)
            {
                Debug.LogWarning($"MissionLoader: Longitude out of range at row {lineIndex}");
                valid = false;
            }
            return valid;
        }

        private static bool TryEstimateSpoolDepthCsv(string[] cells, Func<string, bool> has, Func<string, int> idx, out float depthMeters)
        {
            depthMeters = 0f;
            if (!TryGetSpoolRotationsCsv(cells, has, idx, out var rotations))
                return false;

            var geometry = ReadSpoolGeometryCsv(cells, has, idx);
            depthMeters = SpoolDepthEstimator.EstimateDepthMeters(rotations, geometry);
            return true;
        }

        private static bool TryEstimateSpoolLengthCsv(string[] cells, Func<string, bool> has, Func<string, int> idx, out float cableLengthMeters)
        {
            cableLengthMeters = 0f;
            if (!TryGetSpoolRotationsCsv(cells, has, idx, out var rotations))
                return false;

            var geometry = ReadSpoolGeometryCsv(cells, has, idx);
            cableLengthMeters = SpoolDepthEstimator.EstimateCableLengthMeters(rotations, geometry);
            return true;
        }

        private static bool TryGetSpoolRotationsCsv(string[] cells, Func<string, bool> has, Func<string, int> idx, out float rotations)
        {
            rotations = 0f;
            if (TryGetOptionalCsvFloat(cells, has, idx, "spool_rotations", out rotations))
                return true;
            if (TryGetOptionalCsvFloat(cells, has, idx, "spool_rotation", out rotations))
                return true;
            if (TryGetOptionalCsvFloat(cells, has, idx, "spool_revolutions", out rotations))
                return true;
            if (TryGetOptionalCsvFloat(cells, has, idx, "spool_degrees", out var degrees))
            {
                rotations = SpoolDepthEstimator.RotationsFromDegrees(degrees);
                return true;
            }
            if (TryGetOptionalCsvFloat(cells, has, idx, "spool_encoder_ticks", out var ticks) ||
                TryGetOptionalCsvFloat(cells, has, idx, "spool_ticks", out ticks))
            {
                float ticksPerRevolution = SpoolDepthEstimator.Geometry.Default.RotationToSpoolRatio;
                if (!TryGetOptionalCsvFloat(cells, has, idx, "spool_ticks_per_revolution", out ticksPerRevolution) &&
                    !TryGetOptionalCsvFloat(cells, has, idx, "encoder_ticks_per_revolution", out ticksPerRevolution))
                {
                    ticksPerRevolution = 4096f;
                }

                rotations = SpoolDepthEstimator.RotationsFromEncoderTicks(ticks, ticksPerRevolution);
                return true;
            }

            return false;
        }

        private static SpoolDepthEstimator.Geometry ReadSpoolGeometryCsv(string[] cells, Func<string, bool> has, Func<string, int> idx)
        {
            var geometry = SpoolDepthEstimator.Geometry.Default;
            if (TryGetOptionalCsvFloat(cells, has, idx, "spool_core_radius_m", out var coreRadius)) geometry.CoreRadiusMeters = coreRadius;
            if (TryGetOptionalCsvFloat(cells, has, idx, "cable_diameter_m", out var cableDiameter)) geometry.CableDiameterMeters = cableDiameter;
            if (TryGetOptionalCsvFloat(cells, has, idx, "spool_width_m", out var spoolWidth)) geometry.SpoolWidthMeters = spoolWidth;
            if (TryGetOptionalCsvFloat(cells, has, idx, "spool_zero_rotations", out var zeroRotations)) geometry.ZeroRotations = zeroRotations;
            if (TryGetOptionalCsvFloat(cells, has, idx, "spool_rotation_to_spool_ratio", out var ratio)) geometry.RotationToSpoolRatio = ratio;
            if (TryGetOptionalCsvFloat(cells, has, idx, "probe_vertical_efficiency", out var efficiency)) geometry.VerticalEfficiency = efficiency;
            if (TryGetOptionalCsvFloat(cells, has, idx, "spool_direction", out var direction)) geometry.InvertDirection = direction < 0f;
            return geometry;
        }

        private static bool TryGetOptionalCsvFloat(string[] cells, Func<string, bool> has, Func<string, int> idx, string key, out float value)
        {
            value = 0f;
            if (!has(key))
                return false;

            int cellIndex = idx(key);
            if (cellIndex < 0 || cellIndex >= cells.Length)
                return false;

            var parsed = ParseNullableFloat(cells[cellIndex]);
            if (!parsed.HasValue)
                return false;

            value = parsed.Value;
            return true;
        }

        private static bool TryEstimateSpoolDepthJson(Dictionary<string, object> dict, out float depthMeters)
        {
            depthMeters = 0f;
            if (!TryGetSpoolRotationsJson(dict, out var rotations))
                return false;

            var geometry = ReadSpoolGeometryJson(dict);
            depthMeters = SpoolDepthEstimator.EstimateDepthMeters(rotations, geometry);
            return true;
        }

        private static bool TryEstimateSpoolLengthJson(Dictionary<string, object> dict, out float cableLengthMeters)
        {
            cableLengthMeters = 0f;
            if (!TryGetSpoolRotationsJson(dict, out var rotations))
                return false;

            var geometry = ReadSpoolGeometryJson(dict);
            cableLengthMeters = SpoolDepthEstimator.EstimateCableLengthMeters(rotations, geometry);
            return true;
        }

        private static bool TryGetSpoolRotationsJson(Dictionary<string, object> dict, out float rotations)
        {
            rotations = 0f;
            if (TryGetFloatAny(dict, out rotations, "spool_rotations", "spool_rotation", "spool_revolutions"))
                return true;
            if (TryGetFloatAny(dict, out var degrees, "spool_degrees"))
            {
                rotations = SpoolDepthEstimator.RotationsFromDegrees(degrees);
                return true;
            }
            if (TryGetFloatAny(dict, out var ticks, "spool_encoder_ticks", "spool_ticks"))
            {
                if (!TryGetFloatAny(dict, out var ticksPerRevolution, "spool_ticks_per_revolution", "encoder_ticks_per_revolution"))
                    ticksPerRevolution = 4096f;

                rotations = SpoolDepthEstimator.RotationsFromEncoderTicks(ticks, ticksPerRevolution);
                return true;
            }

            return false;
        }

        private static SpoolDepthEstimator.Geometry ReadSpoolGeometryJson(Dictionary<string, object> dict)
        {
            var geometry = SpoolDepthEstimator.Geometry.Default;
            if (TryGetFloatAny(dict, out var coreRadius, "spool_core_radius_m")) geometry.CoreRadiusMeters = coreRadius;
            if (TryGetFloatAny(dict, out var cableDiameter, "cable_diameter_m")) geometry.CableDiameterMeters = cableDiameter;
            if (TryGetFloatAny(dict, out var spoolWidth, "spool_width_m")) geometry.SpoolWidthMeters = spoolWidth;
            if (TryGetFloatAny(dict, out var zeroRotations, "spool_zero_rotations")) geometry.ZeroRotations = zeroRotations;
            if (TryGetFloatAny(dict, out var ratio, "spool_rotation_to_spool_ratio")) geometry.RotationToSpoolRatio = ratio;
            if (TryGetFloatAny(dict, out var efficiency, "probe_vertical_efficiency")) geometry.VerticalEfficiency = efficiency;
            if (TryGetFloatAny(dict, out var direction, "spool_direction")) geometry.InvertDirection = direction < 0f;
            return geometry;
        }

        private static bool TryGetFloatAny(Dictionary<string, object> dict, out float value, params string[] keys)
        {
            foreach (var key in keys)
            {
                if (TryGetFloat(dict, key, out value))
                    return true;
            }

            value = 0f;
            return false;
        }

        private static double ParseDoubleSafe(string value)
        {
            double.TryParse(value, NumberStyles.Float, CultureInfo.InvariantCulture, out var result);
            return result;
        }

        private static float? ParseNullableFloat(string value)
        {
            if (float.TryParse(value, NumberStyles.Float, CultureInfo.InvariantCulture, out var result))
                return result;
            return null;
        }

        private static bool TryGetDouble(Dictionary<string, object> dict, string key, out double value)
        {
            if (dict.TryGetValue(key, out var obj) && double.TryParse(obj.ToString(), NumberStyles.Float, CultureInfo.InvariantCulture, out var parsed))
            {
                value = parsed;
                return true;
            }
            value = 0;
            return false;
        }

        private static bool TryGetFloat(Dictionary<string, object> dict, string key, out float value)
        {
            if (dict.TryGetValue(key, out var obj) && float.TryParse(obj.ToString(), NumberStyles.Float, CultureInfo.InvariantCulture, out var parsed))
            {
                value = parsed;
                return true;
            }
            value = 0;
            return false;
        }
    }
}
