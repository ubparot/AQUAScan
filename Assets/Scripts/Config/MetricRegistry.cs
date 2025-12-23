using System.Collections.Generic;
using UnityEngine;

namespace AQUAScan.Config
{
    /// <summary>
    /// Describes a metric for coloring/legend purposes.
    /// </summary>
    [System.Serializable]
    public class MetricDescriptor
    {
        public string Id;
        public string DisplayName;
        public string Unit;
        public Vector2 ExpectedRange;
        public Gradient Gradient;

        public MetricDescriptor(string id, string displayName, string unit, Vector2 expectedRange, Gradient gradient)
        {
            Id = id.ToLowerInvariant();
            DisplayName = displayName;
            Unit = unit;
            ExpectedRange = expectedRange;
            Gradient = gradient;
        }
    }

    /// <summary>
    /// Central registry for known metrics and default color ramps. It remains extensible via AddOrUpdate.
    /// </summary>
    public static class MetricRegistry
    {
        private static readonly Dictionary<string, MetricDescriptor> _metrics = new Dictionary<string, MetricDescriptor>();
        private static bool _initialized;

        public static MetricDescriptor GetOrCreate(string id)
        {
            if (!_initialized)
                InitDefaults();

            id = id.ToLowerInvariant();
            if (_metrics.TryGetValue(id, out var descriptor))
                return descriptor;

            // Unknown metric: generate a neutral blue-to-red gradient and unitless display.
            descriptor = new MetricDescriptor(id, UppercaseFirst(id), string.Empty, new Vector2(0, 1), BuildDefaultGradient());
            _metrics[id] = descriptor;
            return descriptor;
        }

        public static IEnumerable<MetricDescriptor> All()
        {
            if (!_initialized)
                InitDefaults();
            return _metrics.Values;
        }

        public static void AddOrUpdate(MetricDescriptor descriptor)
        {
            if (!_initialized)
                InitDefaults();
            _metrics[descriptor.Id.ToLowerInvariant()] = descriptor;
        }

        private static void InitDefaults()
        {
            _initialized = true;
            _metrics.Clear();

            AddOrUpdate(new MetricDescriptor("temperature", "Temperature", "°C", new Vector2(0, 35), BuildGradient(Color.cyan, Color.red)));
            AddOrUpdate(new MetricDescriptor("ph", "pH", "", new Vector2(6, 9), BuildGradient(new Color(0.1f, 0.2f, 0.8f), new Color(0.9f, 0.9f, 0.2f))));
            AddOrUpdate(new MetricDescriptor("do", "Dissolved Oxygen", "mg/L", new Vector2(0, 14), BuildGradient(Color.blue, Color.green)));
            AddOrUpdate(new MetricDescriptor("salinity", "Salinity", "ppt", new Vector2(0, 40), BuildGradient(new Color(0.8f, 0.95f, 1f), new Color(0.0f, 0.3f, 0.6f))));
            AddOrUpdate(new MetricDescriptor("turbidity", "Turbidity", "NTU", new Vector2(0, 100), BuildGradient(new Color(0.9f, 0.9f, 0.9f), new Color(0.3f, 0.2f, 0.0f))));
            AddOrUpdate(new MetricDescriptor("depth", "Depth", "m", new Vector2(0, 50), BuildGradient(new Color(0.9f, 0.95f, 1f), new Color(0.0f, 0.0f, 0.4f))));
        }

        private static Gradient BuildGradient(Color start, Color end)
        {
            var gradient = new Gradient();
            gradient.SetKeys(
                new GradientColorKey[] { new GradientColorKey(start, 0f), new GradientColorKey(end, 1f) },
                new GradientAlphaKey[] { new GradientAlphaKey(1f, 0f), new GradientAlphaKey(1f, 1f) });
            return gradient;
        }

        private static Gradient BuildDefaultGradient()
        {
            return BuildGradient(new Color(0.0f, 0.6f, 0.9f), new Color(0.9f, 0.2f, 0.2f));
        }

        private static string UppercaseFirst(string input)
        {
            if (string.IsNullOrEmpty(input))
                return input;
            if (input.Length == 1)
                return char.ToUpperInvariant(input[0]).ToString();
            return char.ToUpperInvariant(input[0]) + input.Substring(1);
        }
    }
}
