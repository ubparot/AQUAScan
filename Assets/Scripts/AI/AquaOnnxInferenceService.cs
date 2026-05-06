using System;
using System.Collections.Generic;
using System.Globalization;
using System.IO;
using AQUAScan.AquaData;
using AQUAScan.IO;
using UnityEngine;

namespace AQUAScan.AI
{
    /// <summary>
    /// Unity-side inference adapter for the AQUAScan ONNX artifact.
    /// v1 loads the exported model and normalization metadata, then uses a deterministic
    /// local predictor until a Unity ONNX backend such as Sentis is installed.
    /// </summary>
    public class AquaOnnxInferenceService
    {
        private const string DefaultBackendName = "Heuristic fallback";
        private readonly Dictionary<string, int> _temporalFeatureIndex = new Dictionary<string, int>();
        private readonly Dictionary<string, int> _contextFeatureIndex = new Dictionary<string, int>();

        public bool ModelArtifactLoaded { get; private set; }
        public long ModelArtifactBytes { get; private set; }
        public bool NormalizationLoaded { get; private set; }
        public string BackendName { get; private set; } = DefaultBackendName;
        public string Status { get; private set; } = "Not initialized";
        public string ModelPath { get; private set; }
        public string NormalizationPath { get; private set; }

        public void Initialize(string modelPath, string normalizationPath)
        {
            ModelPath = ResolveProjectRelativePath(modelPath);
            NormalizationPath = ResolveProjectRelativePath(normalizationPath);
            ModelArtifactLoaded = TryReadModelArtifact(ModelPath, out long modelBytes);
            ModelArtifactBytes = modelBytes;
            NormalizationLoaded = LoadNormalization(NormalizationPath);
            BackendName = DefaultBackendName;

            if (ModelArtifactLoaded && NormalizationLoaded)
                Status = "ONNX artifact and normalization loaded; fallback predictor active";
            else if (!ModelArtifactLoaded && !NormalizationLoaded)
                Status = "Missing ONNX artifact and normalization";
            else if (!ModelArtifactLoaded)
                Status = "Missing ONNX artifact";
            else
                Status = "Missing normalization metadata";
        }

        private static bool TryReadModelArtifact(string path, out long bytes)
        {
            bytes = 0;
            if (string.IsNullOrWhiteSpace(path) || !File.Exists(path))
                return false;

            try
            {
                var data = File.ReadAllBytes(path);
                bytes = data.LongLength;
                return data.Length > 0;
            }
            catch (Exception exception)
            {
                Debug.LogWarning($"AquaOnnxInferenceService: Failed to read ONNX model artifact: {exception.Message}");
                return false;
            }
        }

        public AquaPredictionResult Predict(IReadOnlyList<AquaSample> samples, AquaSample current)
        {
            if (current == null)
                return BuildUnavailable("No current sample");

            float temperature = ReadMetric(current, "temperature", 18f);
            float oxygen = ReadMetric(current, "do", 8f);
            float ph = ReadMetric(current, "ph", 7.4f);
            float tds = ReadMetric(current, "tds", 320f);
            float turbidity = ReadMetric(current, "turbidity", 3f);
            float light = ReadMetric(current, "light", 0f);
            float depth = current.DepthMeters ?? ReadMetric(current, "depth", 1f);
            float wind = ReadMetric(current, "wind_speed", 2f);
            float precipitation = ReadMetric(current, "precipitation", 0f);
            float solar = ReadMetric(current, "solar_radiation", light);
            float doDelta = EstimateDelta(samples, current, "do");
            float tempDelta = EstimateDelta(samples, current, "temperature");
            float stratification = Mathf.Max(0f, temperature - (temperature - 0.22f * Mathf.Max(0f, depth - 0.5f)));

            float thermalPressure = Mathf.Max(0f, temperature - 20f) * 0.045f;
            float depthPressure = Mathf.Max(0f, depth - 2.5f) * 0.05f;
            float stormPressure = Mathf.Max(0f, precipitation - 0.25f) * 0.04f;
            float trendPressure = Mathf.Max(0f, -doDelta) * 0.35f;
            float mixingRelief = Mathf.Clamp01(wind / 8f) * 0.12f;

            float oxygen30 = oxygen - thermalPressure - depthPressure - stormPressure - trendPressure + mixingRelief;
            float oxygen60 = oxygen30 - thermalPressure * 0.8f - depthPressure * 0.6f - stormPressure * 0.8f;
            float oxygen120 = oxygen60 - thermalPressure * 0.7f - depthPressure * 0.7f - Mathf.Max(0f, stratification) * 0.05f;

            float bloomScore = 0f;
            bloomScore += Mathf.InverseLerp(19f, 27f, temperature) * 0.28f;
            bloomScore += Mathf.InverseLerp(250f, 900f, solar) * 0.22f;
            bloomScore += Mathf.InverseLerp(3f, 18f, turbidity) * 0.18f;
            bloomScore += Mathf.InverseLerp(320f, 620f, tds) * 0.18f;
            bloomScore += Mathf.InverseLerp(7.3f, 8.4f, ph) * 0.14f;

            float anomalyScore = 0f;
            anomalyScore = Mathf.Max(anomalyScore, Mathf.InverseLerp(5.2f, 2.8f, oxygen));
            anomalyScore = Mathf.Max(anomalyScore, Mathf.InverseLerp(-0.25f, -1.5f, doDelta));
            anomalyScore = Mathf.Max(anomalyScore, Mathf.InverseLerp(12f, 35f, turbidity));
            anomalyScore = Mathf.Max(anomalyScore, Mathf.InverseLerp(0.8f, 2.4f, Mathf.Abs(tempDelta)));
            if (ph < 6.5f || ph > 9f)
                anomalyScore = Mathf.Max(anomalyScore, 0.9f);

            return new AquaPredictionResult
            {
                OxygenNow = oxygen,
                Oxygen30Minutes = Mathf.Max(0f, oxygen30),
                Oxygen60Minutes = Mathf.Max(0f, oxygen60),
                Oxygen120Minutes = Mathf.Max(0f, oxygen120),
                BloomRisk = Mathf.Clamp01(bloomScore),
                AnomalyRisk = Mathf.Clamp01(anomalyScore),
                ModelArtifactLoaded = ModelArtifactLoaded,
                NormalizationLoaded = NormalizationLoaded,
                BackendName = BackendName,
                Status = Status
            };
        }

        private AquaPredictionResult BuildUnavailable(string reason)
        {
            return new AquaPredictionResult
            {
                BackendName = BackendName,
                Status = reason,
                ModelArtifactLoaded = ModelArtifactLoaded,
                NormalizationLoaded = NormalizationLoaded
            };
        }

        private bool LoadNormalization(string path)
        {
            _temporalFeatureIndex.Clear();
            _contextFeatureIndex.Clear();
            if (string.IsNullOrWhiteSpace(path) || !File.Exists(path))
                return false;

            try
            {
                var json = File.ReadAllText(path);
                if (SimpleJson.Deserialize(json) is not Dictionary<string, object> root)
                    return false;

                LoadFeatureList(root, "temporal_features", _temporalFeatureIndex);
                LoadFeatureList(root, "context_features", _contextFeatureIndex);
                return _temporalFeatureIndex.Count > 0 && _contextFeatureIndex.Count > 0;
            }
            catch (Exception exception)
            {
                Debug.LogWarning($"AquaOnnxInferenceService: Failed to load normalization metadata: {exception.Message}");
                return false;
            }
        }

        private static void LoadFeatureList(Dictionary<string, object> root, string key, Dictionary<string, int> target)
        {
            if (!root.TryGetValue(key, out var value) || value is not List<object> items)
                return;

            for (int i = 0; i < items.Count; i++)
            {
                string feature = Convert.ToString(items[i], CultureInfo.InvariantCulture);
                if (!string.IsNullOrWhiteSpace(feature))
                    target[feature] = i;
            }
        }

        private static float EstimateDelta(IReadOnlyList<AquaSample> samples, AquaSample current, string metricId)
        {
            if (samples == null || current == null || !current.TryGetMetric(metricId, out float currentValue))
                return 0f;

            for (int i = samples.Count - 1; i >= 0; i--)
            {
                var sample = samples[i];
                if (sample == null || sample.Timestamp >= current.Timestamp)
                    continue;
                if (sample.TryGetMetric(metricId, out float previousValue))
                    return currentValue - previousValue;
            }

            return 0f;
        }

        private static float ReadMetric(AquaSample sample, string metricId, float fallback)
        {
            return sample != null && sample.TryGetMetric(metricId, out float value) ? value : fallback;
        }

        private static string ResolveProjectRelativePath(string path)
        {
            if (string.IsNullOrWhiteSpace(path))
                return path;
            if (Path.IsPathRooted(path))
                return path;

            string assetsRelative = Path.Combine(Application.dataPath, path);
            if (File.Exists(assetsRelative))
                return assetsRelative;

            string projectRelative = Path.GetFullPath(Path.Combine(Application.dataPath, "..", path));
            return projectRelative;
        }
    }
}
