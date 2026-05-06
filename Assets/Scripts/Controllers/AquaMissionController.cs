using System;
using System.Collections.Generic;
using System.Globalization;
using System.IO;
using System.Threading.Tasks;
using AQUAScan.AI;
using AQUAScan.AquaData;
using AQUAScan.Config;
using AQUAScan.Control;
using AQUAScan.IO;
using AQUAScan.Playback;
using AQUAScan.Visualization;
using UnityEngine;
using UnityEngine.UI;

namespace AQUAScan.Controllers
{
    /// <summary>
    /// Loads missions, manages playback, and drives live ESP8266 control when enabled.
    /// </summary>
    public class AquaMissionController : MonoBehaviour
    {
        private const string BoatHostPrefKey = "AQUAScan.Live.BoatHost";
        private const string BoatPortPrefKey = "AQUAScan.Live.BoatPort";
        private const string DeadzonePrefKey = "AQUAScan.Live.Deadzone";
        private const string MaxOutputPrefKey = "AQUAScan.Live.MaxOutput";
        private const string ModePrefKey = "AQUAScan.Live.Mode";

        [Header("Loading")]
        public bool LoadDefaultOnStart = true;
        public string DefaultMissionFile = "demo-mission.csv";

        [Header("Visualization Layers")]
        public BoatTrackRenderer TrackRenderer;
        public SamplePointCloud PointCloud;
        public HeatmapSurface Heatmap;
        public BoatWakeEffect WakeEffect;

        [Header("Playback")]
        public AquaMissionPlayer Player;

        [Header("AI Inference")]
        public AquaAiInferenceController AiInference;

        [Header("Live Control")]
        public AquaOperationMode DefaultOperationMode = AquaOperationMode.Playback;
        public string DefaultBoatHost = "192.168.4.1";
        public int DefaultBoatPort = 81;
        [Range(0f, 0.25f)] public float DefaultDeadzone = 0.08f;
        [Range(0.1f, 1f)] public float DefaultMaxOutput = 1f;
        [Min(1f)] public float CommandSendRateHz = 20f;
        [Range(0.1f, 1f)] public float ConnectionTimeoutSeconds = 0.3f;

        [Header("Mission UI Wiring (UGUI)")]
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

        [Header("Live UI Wiring (UGUI)")]
        public Toggle LiveModeToggle;
        public InputField BoatHostInputField;
        public InputField BoatPortInputField;
        public InputField DeadzoneInputField;
        public InputField MaxOutputInputField;
        public Button ConnectButton;
        public Text ConnectButtonText;
        public Button ArmButton;
        public Text ArmButtonText;
        public Button EStopButton;
        public Text EStopButtonText;
        public Image ArmedIndicatorImage;
        public Text ArmedIndicatorText;
        public Text ConnectionStatusText;
        public Text LeftPulseText;
        public Text RightPulseText;
        public VirtualJoystick DriveJoystick;

        public AquaOperationMode OperationMode { get; private set; }
        public DriveCommand LastDriveCommand { get; private set; }
        public DriveStatus CurrentDriveStatus { get; private set; } = DriveStatus.Disconnected();
        public bool IsLiveConnected => _liveTransport != null && _liveTransport.IsConnected;
        public bool IsArmed => _armed;
        public bool IsEStopLatched => _estopLatched;

        private AquaMission _mission;
        private string _activeMetricId = "temperature";
        private Texture2D _legendTexture;
        private readonly List<MetricDescriptor> _metricsList = new List<MetricDescriptor>();
        private Esp8266WebSocketClient _liveTransport;
        private string _boatHost;
        private int _boatPort;
        private float _deadzone;
        private float _maxOutput;
        private int _nextSequence;
        private float _nextDriveSendTime;
        private float _lastStatusSeenTime;
        private bool _armed;
        private bool _estopLatched;
        private bool _liveConnectInFlight;

        private void Awake()
        {
            _liveTransport = new Esp8266WebSocketClient();
            LoadLivePreferences();
            LastDriveCommand = DriveCommand.Neutral(0, false, false);
        }

        private void Start()
        {
            if (Player != null)
                Player.OnTimeChanged += HandleTimeChanged;

            RefreshUiBindings();

            if (LoadDefaultOnStart)
            {
                string defaultPath = Path.Combine(Application.streamingAssetsPath, DefaultMissionFile);
                if (File.Exists(defaultPath))
                    LoadMission(defaultPath);
                else
                    Debug.LogWarning($"AquaMissionController: Default mission not found at {defaultPath}");
            }

            SetOperationMode(OperationMode, false);
            RefreshLiveUi();
        }

        private void Update()
        {
            DrainLiveTransport();

            if (OperationMode != AquaOperationMode.LiveControl || !IsLiveConnected)
                return;

            if (_liveConnectInFlight)
                return;

            if (Time.unscaledTime - _lastStatusSeenTime > ConnectionTimeoutSeconds)
            {
                Debug.LogWarning("AquaMissionController: Live control timed out waiting for status.");
                _ = DisconnectLiveAsync("Timed out");
                return;
            }

            if (Time.unscaledTime >= _nextDriveSendTime)
            {
                _nextDriveSendTime = Time.unscaledTime + (1f / Mathf.Max(1f, CommandSendRateHz));
                SendCurrentDriveFrame();
            }
        }

        private void OnDestroy()
        {
            if (Player != null)
                Player.OnTimeChanged -= HandleTimeChanged;

            if (_liveTransport != null)
            {
                _ = _liveTransport.DisconnectAsync("Controller destroyed");
                _liveTransport.Dispose();
                _liveTransport = null;
            }

            SaveLivePreferences();
        }

        public void RefreshUiBindings()
        {
            SetupMetricDropdown();
            WireMissionUiCallbacks();
            WireLiveUiCallbacks();
            RefreshLiveInputFields();
            ApplyPlaybackUiState();
            RefreshLiveUi();
        }

        public void SetOperationMode(AquaOperationMode mode)
        {
            SetOperationMode(mode, true);
        }

        public void SetOperationMode(AquaOperationMode mode, bool savePreference)
        {
            OperationMode = mode;
            if (OperationMode == AquaOperationMode.LiveControl)
            {
                Player?.Pause();
                UpdatePlaybackButtonLabel();
            }
            else if (IsLiveConnected)
            {
                _ = DisconnectLiveAsync("Switched to playback");
            }

            if (LiveModeToggle != null)
                LiveModeToggle.SetIsOnWithoutNotify(OperationMode == AquaOperationMode.LiveControl);

            ApplyPlaybackUiState();
            RefreshLiveUi();

            if (savePreference)
                SaveLivePreferences();
        }

        public void LoadMission(string path)
        {
            if (string.IsNullOrWhiteSpace(path))
            {
                Debug.LogError("AquaMissionController: Path is empty. Provide a CSV or JSON mission file.");
                return;
            }

            if (!Path.IsPathRooted(path) && !File.Exists(path))
            {
                string streamingCandidate = Path.Combine(Application.streamingAssetsPath, path);
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
            RebuildMetricDropdown(_mission);
            Player?.LoadMission(mission);
            TrackRenderer?.RenderTrack(mission);
            PointCloud?.Render(mission, _activeMetricId);
            Heatmap?.Generate(mission, _activeMetricId);
            UpdateLegend(_activeMetricId);
            UpdateLayerVisibility();
            UpdateCurrentValueLabel();
            UpdatePlaybackButtonLabel();

            if (TimeSlider != null)
                TimeSlider.value = 0f;
        }

        public void TogglePlayPause()
        {
            if (Player == null || OperationMode != AquaOperationMode.Playback)
                return;

            Player.TogglePlayPause();
            UpdatePlaybackButtonLabel();
        }

        public void UpdateLiveUi()
        {
            RefreshLiveUi();
        }

        private void SetupMetricDropdown()
        {
            if (MetricDropdown == null)
                return;

            MetricDropdown.onValueChanged.RemoveListener(OnMetricDropdownChanged);
            MetricDropdown.onValueChanged.AddListener(OnMetricDropdownChanged);
            RebuildMetricDropdown(_mission);
        }

        private void RebuildMetricDropdown(AquaMission mission)
        {
            if (MetricDropdown == null)
                return;

            var descriptors = new Dictionary<string, MetricDescriptor>();
            foreach (var descriptor in MetricRegistry.All())
                descriptors[descriptor.Id] = descriptor;

            if (mission != null && mission.Samples != null)
            {
                foreach (var sample in mission.Samples)
                {
                    foreach (string key in sample.Metrics.Keys)
                    {
                        string metricId = key.ToLowerInvariant();
                        if (!descriptors.ContainsKey(metricId))
                            descriptors[metricId] = MetricRegistry.GetOrCreate(metricId);
                    }
                }
            }

            _metricsList.Clear();
            _metricsList.AddRange(descriptors.Values);
            _metricsList.Sort((a, b) => string.Compare(a.DisplayName, b.DisplayName, StringComparison.OrdinalIgnoreCase));

            MetricDropdown.ClearOptions();
            if (_metricsList.Count == 0)
                return;

            MetricDropdown.AddOptions(_metricsList.ConvertAll(metric => new Dropdown.OptionData(metric.DisplayName)));
            int targetIndex = Mathf.Max(0, _metricsList.FindIndex(metric => metric.Id == _activeMetricId));
            if (targetIndex < 0 || targetIndex >= _metricsList.Count)
                targetIndex = 0;

            MetricDropdown.SetValueWithoutNotify(targetIndex);
            SetActiveMetric(_metricsList[targetIndex].Id);
        }

        private void WireMissionUiCallbacks()
        {
            if (TrackToggle != null)
            {
                TrackToggle.onValueChanged.RemoveListener(OnTrackToggle);
                TrackToggle.onValueChanged.AddListener(OnTrackToggle);
            }

            if (PointsToggle != null)
            {
                PointsToggle.onValueChanged.RemoveListener(OnPointsToggle);
                PointsToggle.onValueChanged.AddListener(OnPointsToggle);
            }

            if (HeatmapToggle != null)
            {
                HeatmapToggle.onValueChanged.RemoveListener(OnHeatmapToggle);
                HeatmapToggle.onValueChanged.AddListener(OnHeatmapToggle);
            }

            if (TimeSlider != null)
            {
                TimeSlider.onValueChanged.RemoveListener(OnTimelineScrubbed);
                TimeSlider.onValueChanged.AddListener(OnTimelineScrubbed);
            }

            if (PlayPauseButton != null)
            {
                PlayPauseButton.onClick.RemoveListener(TogglePlayPause);
                PlayPauseButton.onClick.AddListener(TogglePlayPause);
            }

            if (LoadButton != null)
            {
                LoadButton.onClick.RemoveListener(OnLoadMissionButtonClicked);
                LoadButton.onClick.AddListener(OnLoadMissionButtonClicked);
            }
        }

        private void WireLiveUiCallbacks()
        {
            if (LiveModeToggle != null)
            {
                LiveModeToggle.onValueChanged.RemoveListener(OnLiveModeToggleChanged);
                LiveModeToggle.onValueChanged.AddListener(OnLiveModeToggleChanged);
            }

            if (ConnectButton != null)
            {
                ConnectButton.onClick.RemoveListener(OnConnectButtonClicked);
                ConnectButton.onClick.AddListener(OnConnectButtonClicked);
            }

            if (ArmButton != null)
            {
                ArmButton.onClick.RemoveListener(OnArmButtonClicked);
                ArmButton.onClick.AddListener(OnArmButtonClicked);
            }

            if (EStopButton != null)
            {
                EStopButton.onClick.RemoveListener(OnEStopButtonClicked);
                EStopButton.onClick.AddListener(OnEStopButtonClicked);
            }

            if (BoatHostInputField != null)
            {
                BoatHostInputField.onEndEdit.RemoveListener(OnBoatHostEdited);
                BoatHostInputField.onEndEdit.AddListener(OnBoatHostEdited);
            }

            if (BoatPortInputField != null)
            {
                BoatPortInputField.onEndEdit.RemoveListener(OnBoatPortEdited);
                BoatPortInputField.onEndEdit.AddListener(OnBoatPortEdited);
            }

            if (DeadzoneInputField != null)
            {
                DeadzoneInputField.onEndEdit.RemoveListener(OnDeadzoneEdited);
                DeadzoneInputField.onEndEdit.AddListener(OnDeadzoneEdited);
            }

            if (MaxOutputInputField != null)
            {
                MaxOutputInputField.onEndEdit.RemoveListener(OnMaxOutputEdited);
                MaxOutputInputField.onEndEdit.AddListener(OnMaxOutputEdited);
            }
        }

        private void OnLoadMissionButtonClicked()
        {
            if (PathInputField != null)
                LoadMission(PathInputField.text);
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
            if (OperationMode != AquaOperationMode.Playback)
                return;

            Player?.JumpToNormalized(normalized);
            UpdateCurrentValueLabel();
        }

        private void OnLiveModeToggleChanged(bool isOn)
        {
            SetOperationMode(isOn ? AquaOperationMode.LiveControl : AquaOperationMode.Playback);
        }

        private async void OnConnectButtonClicked()
        {
            if (OperationMode != AquaOperationMode.LiveControl || _liveConnectInFlight)
                return;

            if (IsLiveConnected)
                await DisconnectLiveAsync("Operator disconnected");
            else
            {
                SyncLiveSettingsFromUi();
                await ConnectLiveAsync();
            }
        }

        private void OnArmButtonClicked()
        {
            if (OperationMode != AquaOperationMode.LiveControl || !IsLiveConnected || _estopLatched)
                return;

            _armed = !_armed;
            if (!_armed)
                LastDriveCommand = DriveCommand.Neutral(NextSequence(), false, false);

            RefreshLiveUi();
            SendCurrentDriveFrame();
        }

        private async void OnEStopButtonClicked()
        {
            if (OperationMode != AquaOperationMode.LiveControl)
                return;

            if (_estopLatched)
            {
                _estopLatched = false;
                _armed = false;
                LastDriveCommand = DriveCommand.Neutral(NextSequence(), false, false);
                SendCurrentDriveFrame();
            }
            else
            {
                _estopLatched = true;
                _armed = false;
                LastDriveCommand = DriveCommand.Neutral(NextSequence(), false, true);
                if (IsLiveConnected)
                    await _liveTransport.SendEstopAsync(LastDriveCommand.Seq);
            }

            RefreshLiveUi();
        }

        private void OnBoatHostEdited(string value)
        {
            _boatHost = string.IsNullOrWhiteSpace(value) ? DefaultBoatHost : value.Trim();
            if (BoatHostInputField != null)
                BoatHostInputField.SetTextWithoutNotify(_boatHost);
            SaveLivePreferences();
        }

        private void OnBoatPortEdited(string value)
        {
            _boatPort = ParseInt(value, DefaultBoatPort, 1, 65535);
            if (BoatPortInputField != null)
                BoatPortInputField.SetTextWithoutNotify(_boatPort.ToString(CultureInfo.InvariantCulture));
            SaveLivePreferences();
        }

        private void OnDeadzoneEdited(string value)
        {
            _deadzone = ParseFloat(value, DefaultDeadzone, 0f, 0.25f);
            if (DeadzoneInputField != null)
                DeadzoneInputField.SetTextWithoutNotify(_deadzone.ToString("0.00", CultureInfo.InvariantCulture));
            SaveLivePreferences();
        }

        private void OnMaxOutputEdited(string value)
        {
            _maxOutput = ParseFloat(value, DefaultMaxOutput, 0.1f, 1f);
            if (MaxOutputInputField != null)
                MaxOutputInputField.SetTextWithoutNotify(_maxOutput.ToString("0.00", CultureInfo.InvariantCulture));
            SaveLivePreferences();
        }

        private async Task ConnectLiveAsync()
        {
            _liveConnectInFlight = true;
            string endpoint = $"ws://{_boatHost}:{_boatPort}/";
            Debug.Log($"AquaMissionController: Connecting to live endpoint {endpoint}");
            UpdateConnectionStatus($"Connecting to {endpoint}");
            RefreshLiveUi();

            bool connected = false;
            try
            {
                connected = await _liveTransport.ConnectAsync(_boatHost, _boatPort);
            }
            finally
            {
                _liveConnectInFlight = false;
            }

            if (!connected)
            {
                _armed = false;
                CurrentDriveStatus = DriveStatus.Disconnected();
                Debug.LogWarning($"AquaMissionController: Connect failed for {endpoint}");
                UpdateConnectionStatus($"Connect failed: {endpoint}");
                RefreshLiveUi();
                return;
            }

            _armed = false;
            _estopLatched = false;
            _lastStatusSeenTime = Time.unscaledTime;
            _nextDriveSendTime = Time.unscaledTime;
            CurrentDriveStatus = DriveStatus.Disconnected();
            Debug.Log($"AquaMissionController: WebSocket connected to {endpoint}");
            UpdateConnectionStatus($"Connected to {_boatHost}:{_boatPort}");
            RefreshLiveUi();
        }

        private async Task DisconnectLiveAsync(string reason)
        {
            _armed = false;
            _liveConnectInFlight = false;
            CurrentDriveStatus = DriveStatus.Disconnected();
            LastDriveCommand = DriveCommand.Neutral(NextSequence(), false, _estopLatched);

            if (DriveJoystick != null)
                DriveJoystick.ResetState();

            if (_liveTransport != null)
                await _liveTransport.DisconnectAsync(reason);

            UpdateConnectionStatus(reason);
            RefreshLiveUi();
        }

        private void SendCurrentDriveFrame()
        {
            if (_liveTransport == null || !IsLiveConnected)
                return;

            DriveCommand command = BuildDriveCommand();
            LastDriveCommand = command;
            _ = _liveTransport.SendDriveAsync(command);
            RefreshLiveUi();
        }

        private DriveCommand BuildDriveCommand()
        {
            int sequence = NextSequence();
            Vector2 rawInput = DriveJoystick != null ? DriveJoystick.Value : Vector2.zero;
            Vector2 shapedInput = DifferentialDriveMixer.ApplyRadialDeadzone(rawInput, _deadzone);
            Vector2 mixed = DifferentialDriveMixer.MixArcade(shapedInput);
            bool shouldDrive = _armed && !_estopLatched && OperationMode == AquaOperationMode.LiveControl;

            if (!shouldDrive)
                mixed = Vector2.zero;

            return new DriveCommand
            {
                Seq = sequence,
                Armed = shouldDrive,
                EStop = _estopLatched,
                JoystickX = rawInput.x,
                JoystickY = rawInput.y,
                LeftNormalized = mixed.x,
                RightNormalized = mixed.y,
                LeftMicros = EscPulseMapper.ToMicros(mixed.x, _maxOutput),
                RightMicros = EscPulseMapper.ToMicros(mixed.y, _maxOutput)
            };
        }

        private void DrainLiveTransport()
        {
            if (_liveTransport == null)
                return;

            while (_liveTransport.TryDequeueEvent(out var transportEvent))
                HandleLiveTransportEvent(transportEvent);

            while (_liveTransport.TryDequeueStatus(out var status))
                HandleLiveStatus(status);
        }

        private void HandleLiveTransportEvent(LiveTransportEvent transportEvent)
        {
            switch (transportEvent.Type)
            {
                case LiveTransportEventType.ConnectionChanged:
                    if (!transportEvent.Connected)
                    {
                        _armed = false;
                        if (DriveJoystick != null)
                            DriveJoystick.ResetState();
                        CurrentDriveStatus = DriveStatus.Disconnected();
                    }
                    else
                    {
                        _lastStatusSeenTime = Time.unscaledTime;
                    }
                    UpdateConnectionStatus(transportEvent.Message);
                    break;
                case LiveTransportEventType.Error:
                    _armed = false;
                    UpdateConnectionStatus(transportEvent.Message);
                    break;
                case LiveTransportEventType.Info:
                    UpdateConnectionStatus(transportEvent.Message);
                    break;
            }

            RefreshLiveUi();
        }

        private void HandleLiveStatus(DriveStatus status)
        {
            CurrentDriveStatus = status;
            _lastStatusSeenTime = Time.unscaledTime;

            if (status.EStop)
            {
                _estopLatched = true;
                _armed = false;
            }

            RefreshLiveUi();
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
            MetricDescriptor descriptor = MetricRegistry.GetOrCreate(metricId);
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
            const int width = 192;
            const int height = 18;
            const float radius = 7f;
            var texture = new Texture2D(width, height, TextureFormat.RGBA32, false, true)
            {
                wrapMode = TextureWrapMode.Clamp,
                filterMode = FilterMode.Bilinear
            };

            float maxX = width - 1f;
            float maxY = height - 1f;
            for (int y = 0; y < height; y++)
            {
                for (int x = 0; x < width; x++)
                {
                    float dx = Mathf.Max(radius - x, 0f, x - (maxX - radius));
                    float dy = Mathf.Max(radius - y, 0f, y - (maxY - radius));
                    float distance = Mathf.Sqrt(dx * dx + dy * dy);
                    float alpha = Mathf.Clamp01(radius + 0.5f - distance);
                    Color color = gradient.Evaluate(x / maxX);
                    color.a *= alpha;
                    texture.SetPixel(x, y, color);
                }
            }

            texture.Apply();
            return texture;
        }

        private void UpdateCurrentValueLabel()
        {
            if (Player == null || _mission == null || _mission.IsEmpty || CurrentValueLabel == null)
                return;

            if (!Player.TryGetSegment(out var from, out var to, out var lerp))
                return;

            MetricDescriptor descriptor = MetricRegistry.GetOrCreate(_activeMetricId);
            float value = EvaluateMetric(from, to, lerp, _activeMetricId, out bool hasValue);
            CurrentValueLabel.text = hasValue
                ? BuildReadoutMarkup(descriptor.DisplayName, descriptor.Unit, value.ToString("F2", CultureInfo.InvariantCulture))
                : BuildReadoutMarkup(descriptor.DisplayName, descriptor.Unit, "n/a");
        }

        private static string BuildReadoutMarkup(string metricName, string unit, string value)
        {
            string unitMarkup = string.IsNullOrWhiteSpace(unit) ? string.Empty : $" <size=14>{unit}</size>";
            return $"<size=11><color=#F2A33D>PROBE SAMPLE</color></size>\n<size=21><b>{value}</b></size>{unitMarkup}\n<size=13>{metricName}</size>";
        }

        private float EvaluateMetric(AquaSample from, AquaSample to, float t, string metricId, out bool hasValue)
        {
            hasValue = false;
            bool hasA = from.TryGetMetric(metricId, out float a);
            bool hasB = to.TryGetMetric(metricId, out float b);

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
            if (TrackToggle != null)
                TrackRenderer?.ToggleVisibility(TrackToggle.isOn);
            if (PointsToggle != null)
                PointCloud?.ToggleVisibility(PointsToggle.isOn);
            if (HeatmapToggle != null)
                Heatmap?.ToggleVisibility(HeatmapToggle.isOn);
        }

        private float EstimateSpeed(AquaSample from, AquaSample to)
        {
            if (from.SpeedMps.HasValue)
                return from.SpeedMps.Value;
            if (to.SpeedMps.HasValue)
                return to.SpeedMps.Value;

            double fromSeconds = from.Timestamp.Subtract(DateTime.UnixEpoch).TotalSeconds;
            double toSeconds = to.Timestamp.Subtract(DateTime.UnixEpoch).TotalSeconds;
            double deltaSeconds = toSeconds - fromSeconds;
            if (deltaSeconds <= 0.0001d)
                return 0f;

            float distance = Vector3.Distance(to.LocalPosition, from.LocalPosition);
            return distance / (float)deltaSeconds;
        }

        private void LoadLivePreferences()
        {
            _boatHost = PlayerPrefs.GetString(BoatHostPrefKey, DefaultBoatHost);
            _boatPort = PlayerPrefs.GetInt(BoatPortPrefKey, DefaultBoatPort);
            _deadzone = Mathf.Clamp(PlayerPrefs.GetFloat(DeadzonePrefKey, DefaultDeadzone), 0f, 0.25f);
            _maxOutput = Mathf.Clamp(PlayerPrefs.GetFloat(MaxOutputPrefKey, DefaultMaxOutput), 0.1f, 1f);
            OperationMode = (AquaOperationMode)PlayerPrefs.GetInt(ModePrefKey, (int)DefaultOperationMode);
        }

        private void SaveLivePreferences()
        {
            PlayerPrefs.SetString(BoatHostPrefKey, _boatHost);
            PlayerPrefs.SetInt(BoatPortPrefKey, _boatPort);
            PlayerPrefs.SetFloat(DeadzonePrefKey, _deadzone);
            PlayerPrefs.SetFloat(MaxOutputPrefKey, _maxOutput);
            PlayerPrefs.SetInt(ModePrefKey, (int)OperationMode);
            PlayerPrefs.Save();
        }

        private void SyncLiveSettingsFromUi()
        {
            if (BoatHostInputField != null)
            {
                _boatHost = string.IsNullOrWhiteSpace(BoatHostInputField.text)
                    ? DefaultBoatHost
                    : BoatHostInputField.text.Trim();
                BoatHostInputField.SetTextWithoutNotify(_boatHost);
            }

            if (BoatPortInputField != null)
            {
                _boatPort = ParseInt(BoatPortInputField.text, DefaultBoatPort, 1, 65535);
                BoatPortInputField.SetTextWithoutNotify(_boatPort.ToString(CultureInfo.InvariantCulture));
            }

            if (DeadzoneInputField != null)
            {
                _deadzone = ParseFloat(DeadzoneInputField.text, DefaultDeadzone, 0f, 0.25f);
                DeadzoneInputField.SetTextWithoutNotify(_deadzone.ToString("0.00", CultureInfo.InvariantCulture));
            }

            if (MaxOutputInputField != null)
            {
                _maxOutput = ParseFloat(MaxOutputInputField.text, DefaultMaxOutput, 0.1f, 1f);
                MaxOutputInputField.SetTextWithoutNotify(_maxOutput.ToString("0.00", CultureInfo.InvariantCulture));
            }

            SaveLivePreferences();
        }

        private void RefreshLiveInputFields()
        {
            if (BoatHostInputField != null)
                BoatHostInputField.SetTextWithoutNotify(_boatHost);
            if (BoatPortInputField != null)
                BoatPortInputField.SetTextWithoutNotify(_boatPort.ToString(CultureInfo.InvariantCulture));
            if (DeadzoneInputField != null)
                DeadzoneInputField.SetTextWithoutNotify(_deadzone.ToString("0.00", CultureInfo.InvariantCulture));
            if (MaxOutputInputField != null)
                MaxOutputInputField.SetTextWithoutNotify(_maxOutput.ToString("0.00", CultureInfo.InvariantCulture));
        }

        private void ApplyPlaybackUiState()
        {
            bool playbackMode = OperationMode == AquaOperationMode.Playback;
            SetInteractable(TimeSlider, playbackMode);
            SetInteractable(PlayPauseButton, playbackMode);
            SetInteractable(PathInputField, playbackMode);
            SetInteractable(LoadButton, playbackMode);
            UpdatePlaybackButtonLabel();
        }

        private void UpdatePlaybackButtonLabel()
        {
            if (PlayPauseText != null && Player != null)
                PlayPauseText.text = Player.IsPlaying ? "Pause" : "Play";
        }

        private void RefreshLiveUi()
        {
            bool liveMode = OperationMode == AquaOperationMode.LiveControl;
            bool connected = IsLiveConnected;
            bool canArm = liveMode && connected && !_estopLatched;
            bool canDrive = liveMode && connected && _armed && !_estopLatched;

            if (ConnectButtonText != null)
                ConnectButtonText.text = connected ? "Disconnect" : (_liveConnectInFlight ? "Connecting..." : "Connect");

            if (ArmButtonText != null)
                ArmButtonText.text = _armed ? "Disarm" : "Arm";

            if (EStopButtonText != null)
                EStopButtonText.text = _estopLatched ? "Reset E-Stop" : "E-Stop";

            if (ConnectionStatusText != null && string.IsNullOrWhiteSpace(ConnectionStatusText.text))
                ConnectionStatusText.text = liveMode ? "Disconnected" : "Playback mode";

            if (ArmedIndicatorText != null)
            {
                if (_estopLatched)
                    ArmedIndicatorText.text = "E-STOP";
                else if (canDrive)
                    ArmedIndicatorText.text = "ARMED";
                else
                    ArmedIndicatorText.text = "SAFE";
            }

            if (ArmedIndicatorImage != null)
            {
                if (_estopLatched)
                    ArmedIndicatorImage.color = new Color(0.86f, 0.22f, 0.2f, 1f);
                else if (canDrive)
                    ArmedIndicatorImage.color = new Color(0.18f, 0.8f, 0.48f, 1f);
                else
                    ArmedIndicatorImage.color = new Color(0.88f, 0.73f, 0.2f, 1f);
            }

            int leftPulse = connected ? CurrentDriveStatus.LeftMicros : LastDriveCommand.LeftMicros;
            int rightPulse = connected ? CurrentDriveStatus.RightMicros : LastDriveCommand.RightMicros;

            if (LeftPulseText != null)
                LeftPulseText.text = $"Left ESC\n<size=24><b>{leftPulse}</b></size> us";

            if (RightPulseText != null)
                RightPulseText.text = $"Right ESC\n<size=24><b>{rightPulse}</b></size> us";

            SetInteractable(LiveModeToggle, true);
            SetInteractable(BoatHostInputField, liveMode && !connected && !_liveConnectInFlight);
            SetInteractable(BoatPortInputField, liveMode && !connected && !_liveConnectInFlight);
            SetInteractable(DeadzoneInputField, liveMode);
            SetInteractable(MaxOutputInputField, liveMode);
            SetInteractable(ConnectButton, liveMode && !_liveConnectInFlight);
            SetInteractable(ArmButton, canArm || (_armed && liveMode));
            SetInteractable(EStopButton, liveMode);

            if (DriveJoystick != null)
                DriveJoystick.Interactable = liveMode && connected && !_estopLatched;
        }

        private void UpdateConnectionStatus(string message)
        {
            if (ConnectionStatusText == null)
                return;

            ConnectionStatusText.text = string.IsNullOrWhiteSpace(message)
                ? "Disconnected"
                : message;
        }

        private int NextSequence()
        {
            _nextSequence++;
            if (_nextSequence < 0)
                _nextSequence = 1;
            return _nextSequence;
        }

        private static void SetInteractable(Selectable selectable, bool interactable)
        {
            if (selectable != null)
                selectable.interactable = interactable;
        }

        private static int ParseInt(string value, int fallback, int min, int max)
        {
            if (!int.TryParse(value, NumberStyles.Integer, CultureInfo.InvariantCulture, out int parsed))
                return fallback;
            return Mathf.Clamp(parsed, min, max);
        }

        private static float ParseFloat(string value, float fallback, float min, float max)
        {
            if (!float.TryParse(value, NumberStyles.Float, CultureInfo.InvariantCulture, out float parsed))
                return fallback;
            return Mathf.Clamp(parsed, min, max);
        }
    }
}
