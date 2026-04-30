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
                if (Has("battery")) sample.BatteryPercent = ParseNullableFloat(cells[Idx("battery")]);

                // Promote navigation/housekeeping values to metrics so they can be visualized like chemistry layers.
                if (sample.DepthMeters.HasValue) sample.SetMetric("depth", sample.DepthMeters.Value);
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
                if (TryGetFloat(dict, "battery", out var battery)) sample.BatteryPercent = battery;

                if (sample.DepthMeters.HasValue) sample.SetMetric("depth", sample.DepthMeters.Value);
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
