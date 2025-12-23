using System;
using System.Collections.Generic;
using UnityEngine;

namespace AQUAScan.AquaData
{
    /// <summary>
    /// Represents a single time-stamped sensor reading with dynamic metrics.
    /// </summary>
    [Serializable]
    public class AquaSample
    {
        public DateTime Timestamp;
        public double Latitude;
        public double Longitude;
        public double? Altitude;

        // Optional navigation info
        public float? HeadingDeg;
        public float? SpeedMps;
        public float? DepthMeters;
        public float? BatteryPercent;

        // Arbitrary scalar metrics keyed by lowercase metric id (e.g., "temperature", "ph").
        public Dictionary<string, float> Metrics = new Dictionary<string, float>();

        // Cached local position after coordinate conversion.
        [NonSerialized] public Vector3 LocalPosition;

        public bool TryGetMetric(string metricId, out float value)
        {
            return Metrics.TryGetValue(metricId.ToLowerInvariant(), out value);
        }

        public void SetMetric(string metricId, float value)
        {
            Metrics[metricId.ToLowerInvariant()] = value;
        }
    }
}
