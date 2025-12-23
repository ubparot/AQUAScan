using System;
using System.Collections.Generic;
using System.IO;
using AQUAScan.AquaData;
using AQUAScan.Config;
using AQUAScan.IO;
using AQUAScan.Playback;
using AQUAScan.Visualization;
using UnityEngine;
using UnityEngine.UI;

namespace AQUAScan.Controllers
{
    /// <summary>
    /// High-level orchestrator that loads missions, drives playback, and syncs visualization/UI layers.
    /// </summary>
    public class AquaMissionController : MonoBehaviour
    {
        [Header("Loading")]
        public bool LoadDefaultOnStart = true;
        public string DefaultMissionFile = "demo-mission.csv"; // placed in StreamingAssets

        [Header("Visualization Layers")]
        public BoatTrackRenderer TrackRenderer;
        public SamplePointCloud PointCloud;
        public HeatmapSurface Heatmap;
        public BoatWakeEffect WakeEffect;

        [Header("Playback")]
        public AquaMissionPlayer Player;

        [Header("UI Wiring (UGUI)")]
        public Dropdown MetricDropdown;
        public Toggle TrackToggle;
        public Toggle PointsToggle;
        public Toggle HeatmapToggle;
        public Slider TimeSlider;
        public Text LegendLabel;
        public RawImage LegendGradient;
        public Text CurrentValueLabel;
        public Button PlayPauseButton;
        public Text PlayPauseText;
        public InputField PathInputField;
        public Button LoadButton;

        private AquaMission _mission;
        private string _activeMetricId = "temperature";
        private Texture2D _legendTexture;
        private List<MetricDescriptor> _metricsList = new List<MetricDescriptor>();

        private void Start()
        {
            if (Player != null)
                Player.OnTimeChanged += HandleTimeChanged;

            SetupMetricDropdown();
            WireUiCallbacks();

            if (LoadDefaultOnStart)
            {
                var defaultPath = Path.Combine(Application.streamingAssetsPath, DefaultMissionFile);
                if (File.Exists(defaultPath))
                {
                    LoadMission(defaultPath);
                }
                else
                {
                    Debug.LogWarning($"AquaMissionController: Default mission not found at {defaultPath}");
                }
            }
        }

        private void SetupMetricDropdown()
        {
            if (MetricDropdown == null)
                return;

            MetricDropdown.ClearOptions();
            _metricsList = new List<MetricDescriptor>(MetricRegistry.All());
            var options = _metricsList.ConvertAll(m => new Dropdown.OptionData(m.DisplayName));
            MetricDropdown.AddOptions(options);
            MetricDropdown.onValueChanged.AddListener(OnMetricDropdownChanged);
        }

        private void WireUiCallbacks()
        {
            if (TrackToggle != null) TrackToggle.onValueChanged.AddListener(OnTrackToggle);
            if (PointsToggle != null) PointsToggle.onValueChanged.AddListener(OnPointsToggle);
            if (HeatmapToggle != null) HeatmapToggle.onValueChanged.AddListener(OnHeatmapToggle);
            if (TimeSlider != null) TimeSlider.onValueChanged.AddListener(OnTimelineScrubbed);
            if (PlayPauseButton != null) PlayPauseButton.onClick.AddListener(TogglePlayPause);
            if (LoadButton != null) LoadButton.onClick.AddListener(() =>
            {
                if (PathInputField != null)
                    LoadMission(PathInputField.text);
            });
        }

        public void LoadMission(string path)
        {
            if (string.IsNullOrWhiteSpace(path))
            {
                Debug.LogError("AquaMissionController: Path is empty. Provide a CSV or JSON mission file.");
                return;
            }

            // Allow relative file names that live in StreamingAssets.
            if (!Path.IsPathRooted(path) && !File.Exists(path))
            {
                var streamingCandidate = Path.Combine(Application.streamingAssetsPath, path);
                if (File.Exists(streamingCandidate))
                    path = streamingCandidate;
            }

            var mission = MissionLoader.LoadFromFile(path);
            if (mission == null || mission.IsEmpty)
            {
                Debug.LogError($"AquaMissionController: Failed to load mission at {path}");
                return;
            }

            _mission = mission;
            Player?.LoadMission(mission);
            TrackRenderer?.RenderTrack(mission);
            PointCloud?.Render(mission, _activeMetricId);
            Heatmap?.Generate(mission, _activeMetricId);
            UpdateLegend(_activeMetricId);
            UpdateLayerVisibility();
            UpdateCurrentValueLabel();
            if (PlayPauseText != null && Player != null)
                PlayPauseText.text = Player.IsPlaying ? "Pause" : "Play";

            if (TimeSlider != null)
                TimeSlider.value = 0f;
        }

        private void OnMetricDropdownChanged(int index)
        {
            if (index >= 0 && index < _metricsList.Count)
                SetActiveMetric(_metricsList[index].Id);
        }

        public void SetActiveMetric(string metricId)
        {
            _activeMetricId = metricId.ToLowerInvariant();
            PointCloud?.UpdateMetric(_activeMetricId);
            Heatmap?.Generate(_mission, _activeMetricId);
            UpdateLegend(_activeMetricId);
            UpdateCurrentValueLabel();
        }

        private void OnTrackToggle(bool state)
        {
            TrackRenderer?.ToggleVisibility(state);
        }

        private void OnPointsToggle(bool state)
        {
            PointCloud?.ToggleVisibility(state);
        }

        private void OnHeatmapToggle(bool state)
        {
            Heatmap?.ToggleVisibility(state);
        }

        private void OnTimelineScrubbed(float normalized)
        {
            Player?.JumpToNormalized(normalized);
            UpdateCurrentValueLabel();
        }

        public void TogglePlayPause()
        {
            if (Player == null)
                return;
            Player.TogglePlayPause();
            if (PlayPauseText != null)
                PlayPauseText.text = Player.IsPlaying ? "Pause" : "Play";
        }

        private void HandleTimeChanged(float normalized)
        {
            if (TimeSlider != null)
                TimeSlider.SetValueWithoutNotify(normalized);

            if (Player != null && TrackRenderer != null && Player.TryGetSegment(out var from, out var to, out var lerp))
            {
                TrackRenderer.UpdateBoatPosition(from, to, lerp);
                if (WakeEffect != null)
                {
                    float speed = EstimateSpeed(from, to);
                    Vector3 moveDir = Vector3.Lerp(from.LocalPosition, to.LocalPosition, lerp) - from.LocalPosition;
                    WakeEffect.UpdateWake(speed, moveDir);
                }
            }

            UpdateCurrentValueLabel();
        }

        private void UpdateLegend(string metricId)
        {
            var descriptor = MetricRegistry.GetOrCreate(metricId);
            if (LegendLabel != null)
                LegendLabel.text = $"{descriptor.DisplayName} ({descriptor.Unit})";

            if (LegendGradient != null)
            {
                _legendTexture = BuildGradientTexture(descriptor.Gradient);
                LegendGradient.texture = _legendTexture;
            }
        }

        private Texture2D BuildGradientTexture(Gradient gradient)
        {
            const int width = 128;
            const int height = 1;
            var tex = new Texture2D(width, height, TextureFormat.RGBA32, false, true)
            {
                wrapMode = TextureWrapMode.Clamp
            };
            for (int x = 0; x < width; x++)
            {
                var c = gradient.Evaluate(x / (float)(width - 1));
                tex.SetPixel(x, 0, c);
            }
            tex.Apply();
            return tex;
        }

        private void UpdateCurrentValueLabel()
        {
            if (Player == null || _mission == null || _mission.IsEmpty || CurrentValueLabel == null)
                return;

            if (!Player.TryGetSegment(out var from, out var to, out var lerp))
                return;

            float value = EvaluateMetric(from, to, lerp, _activeMetricId, out bool hasValue);
            if (hasValue)
                CurrentValueLabel.text = $"{_activeMetricId.ToUpperInvariant()}: {value:F2}";
            else
                CurrentValueLabel.text = $"{_activeMetricId.ToUpperInvariant()}: n/a";
        }

        private float EvaluateMetric(AquaSample from, AquaSample to, float t, string metricId, out bool hasValue)
        {
            hasValue = false;
            float a = 0f;
            float b = 0f;
            bool hasA = from.TryGetMetric(metricId, out a);
            bool hasB = to.TryGetMetric(metricId, out b);

            if (hasA && hasB)
            {
                hasValue = true;
                return Mathf.Lerp(a, b, t);
            }
            if (hasA)
            {
                hasValue = true;
                return a;
            }
            if (hasB)
            {
                hasValue = true;
                return b;
            }
            return 0f;
        }

        private void UpdateLayerVisibility()
        {
            if (TrackToggle != null) TrackRenderer?.ToggleVisibility(TrackToggle.isOn);
            if (PointsToggle != null) PointCloud?.ToggleVisibility(PointsToggle.isOn);
            if (HeatmapToggle != null) Heatmap?.ToggleVisibility(HeatmapToggle.isOn);
        }

        private float EstimateSpeed(AquaSample from, AquaSample to)
        {
            if (from.SpeedMps.HasValue)
                return from.SpeedMps.Value;
            if (to.SpeedMps.HasValue)
                return to.SpeedMps.Value;

            double fromTs = from.Timestamp.Subtract(DateTime.UnixEpoch).TotalSeconds;
            double toTs = to.Timestamp.Subtract(DateTime.UnixEpoch).TotalSeconds;
            double dt = toTs - fromTs;
            if (dt <= 0.0001)
                return 0f;
            float distance = Vector3.Distance(to.LocalPosition, from.LocalPosition);
            return distance / (float)dt;
        }
    }
}
