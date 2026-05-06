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

        private static readonly GradientAlphaKey[] _opaqueAlpha =
        {
            new GradientAlphaKey(1f, 0f),
            new GradientAlphaKey(1f, 1f)
        };

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

            AddOrUpdate(new MetricDescriptor(
                "temperature",
                "Temperature",
                "deg C",
                new Vector2(0, 35),
                BuildThermalGradient()
            ));

            AddOrUpdate(new MetricDescriptor(
                "ph",
                "pH",
                string.Empty,
                new Vector2(6, 9),
                BuildGradient(new Color(0.2f, 0.3f, 0.8f), new Color(0.9f, 0.9f, 0.2f))
            ));

            AddOrUpdate(new MetricDescriptor(
                "do",
                "Dissolved Oxygen",
                "mg/L",
                new Vector2(4, 12),
                BuildDivergingGradient(new Color(0.6f, 0, 0), new Color(1f, 0.72f, 0.2f), new Color(0.0f, 0.8f, 1f))
            ));

            AddOrUpdate(new MetricDescriptor(
                "salinity",
                "Salinity",
                "psu",
                new Vector2(0, 35),
                BuildGradient(new Color(0.05f, 0.25f, 0.65f), new Color(0.9f, 0.4f, 0.1f))
            ));

            AddOrUpdate(new MetricDescriptor(
                "tds",
                "Total Dissolved Solids",
                "ppm",
                new Vector2(0, 1000),
                BuildGradient(new Color(0.05f, 0.42f, 0.72f), new Color(0.9f, 0.64f, 0.18f))
            ));

            AddOrUpdate(new MetricDescriptor(
                "conductivity",
                "Conductivity",
                "uS/cm",
                new Vector2(0, 2000),
                BuildGradient(new Color(0.1f, 0.38f, 0.72f), new Color(0.92f, 0.7f, 0.22f))
            ));

            AddOrUpdate(new MetricDescriptor(
                "turbidity",
                "Turbidity",
                "NTU",
                new Vector2(0, 100),
                BuildDivergingGradient(new Color(0.0f, 0.45f, 0.75f), new Color(0.95f, 0.9f, 0.55f), new Color(0.55f, 0.35f, 0.15f))
            ));

            AddOrUpdate(new MetricDescriptor(
                "light",
                "Light",
                "lux",
                new Vector2(0, 1200),
                BuildGradient(new Color(0.02f, 0.08f, 0.14f), new Color(1f, 0.86f, 0.32f))
            ));

            AddOrUpdate(new MetricDescriptor(
                "uv",
                "Ultraviolet",
                "index",
                new Vector2(0, 11),
                BuildGradient(new Color(0.18f, 0.12f, 0.45f), new Color(0.88f, 0.4f, 1f))
            ));

            AddOrUpdate(new MetricDescriptor(
                "depth",
                "Depth",
                "m",
                new Vector2(0, 30),
                BuildGradient(new Color(0.65f, 0.9f, 1f), new Color(0.0f, 0.15f, 0.35f))
            ));

            AddOrUpdate(new MetricDescriptor(
                "spool_cable_length",
                "Spool Cable",
                "m",
                new Vector2(0, 30),
                BuildGradient(new Color(0.7f, 1f, 0.95f), new Color(0.0f, 0.42f, 0.5f))
            ));

            AddOrUpdate(new MetricDescriptor(
                "speed",
                "Speed",
                "m/s",
                new Vector2(0, 3),
                BuildGradient(new Color(0.55f, 0.8f, 0.95f), new Color(0.9f, 0.2f, 0.15f))
            ));

            AddOrUpdate(new MetricDescriptor(
                "battery",
                "Battery",
                "%",
                new Vector2(0, 100),
                BuildDivergingGradient(new Color(0.85f, 0.05f, 0.05f), new Color(1f, 0.75f, 0.1f), new Color(0.2f, 0.8f, 0.25f))
            ));
        }

        private static Gradient BuildThermalGradient()
        {
            var gradient = new Gradient();

            // Five-color "Turbo/Jet" style ramp for better data visualization
            gradient.SetKeys(
                new[]
                {
                    new GradientColorKey(new Color(0.05f, 0.35f, 0.9f), 0.0f),
                    new GradientColorKey(Color.cyan, 0.25f),
                    new GradientColorKey(Color.green, 0.5f),
                    new GradientColorKey(Color.yellow, 0.75f),
                    new GradientColorKey(new Color(0.9f, 0.2f, 0.1f), 1.0f)
                },
                _opaqueAlpha);
            return gradient;
        }

        private static Gradient BuildGradient(Color start, Color end)
        {
            var gradient = new Gradient();
            gradient.SetKeys(
                new[] { new GradientColorKey(start, 0f), new GradientColorKey(end, 1f) },
                _opaqueAlpha);
            return gradient;
        }

        private static Gradient BuildDivergingGradient(Color low, Color mid, Color high)
        {
            var gradient = new Gradient();
            gradient.SetKeys(
                new[]
                {
                    new GradientColorKey(low, 0f),
                    new GradientColorKey(mid, 0.5f),
                    new GradientColorKey(high, 1f)
                },
                _opaqueAlpha);
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
