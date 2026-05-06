using System.Globalization;
using AQUAScan.AquaData;
using AQUAScan.Controllers;
using UnityEngine;
using UnityEngine.UI;

namespace AQUAScan.AI
{
    [DefaultExecutionOrder(180)]
    public class AquaAiInferenceController : MonoBehaviour
    {
        [Header("Model Artifacts")]
        public string ModelPath = "ML/artifacts/aquascan_multitask.onnx";
        public string NormalizationPath = "ML/artifacts/normalization.json";
        [Min(0.1f)] public float RefreshIntervalSeconds = 1f;

        [Header("HUD Wiring")]
        public Text StatusText;
        public Text OxygenText;
        public Text ForecastText;
        public Text BloomText;
        public Text AnomalyText;
        public Button RunInferenceButton;

        public AquaPredictionResult LastResult { get; private set; }

        private readonly AquaOnnxInferenceService _service = new AquaOnnxInferenceService();
        private AquaMissionController _missionController;
        private float _nextRefreshTime;

        private void Awake()
        {
            _missionController = GetComponent<AquaMissionController>();
            _service.Initialize(ModelPath, NormalizationPath);
        }

        private void OnEnable()
        {
            WireCallbacks();
        }

        private void OnDisable()
        {
            if (RunInferenceButton != null)
                RunInferenceButton.onClick.RemoveListener(RefreshPrediction);
        }

        private void Update()
        {
            if (Time.unscaledTime < _nextRefreshTime)
                return;

            _nextRefreshTime = Time.unscaledTime + RefreshIntervalSeconds;
            RefreshPrediction();
        }

        public void WireCallbacks()
        {
            if (RunInferenceButton == null)
                return;

            RunInferenceButton.onClick.RemoveListener(RefreshPrediction);
            RunInferenceButton.onClick.AddListener(RefreshPrediction);
        }

        public void RefreshPrediction()
        {
            if (_missionController == null)
                _missionController = GetComponent<AquaMissionController>();

            if (_missionController == null || _missionController.Player == null || _missionController.Player.Mission == null)
            {
                LastResult = null;
                UpdateHudUnavailable("No mission loaded");
                return;
            }

            if (!_missionController.Player.TryGetSegment(out AquaSample from, out AquaSample to, out float lerp))
            {
                LastResult = null;
                UpdateHudUnavailable("Waiting for playback sample");
                return;
            }

            AquaSample current = lerp < 0.5f ? from : to;
            LastResult = _service.Predict(_missionController.Player.Mission.Samples, current);
            UpdateHud(LastResult);
        }

        private void UpdateHud(AquaPredictionResult result)
        {
            if (result == null)
            {
                UpdateHudUnavailable("No prediction");
                return;
            }

            if (StatusText != null)
                StatusText.text = $"{result.BackendName}\n{result.Status}";
            if (OxygenText != null)
                OxygenText.text = $"Current O2\n<size=26><b>{result.OxygenNow:F2}</b></size> mg/L";
            if (ForecastText != null)
                ForecastText.text = $"Forecast\n+30 {result.Oxygen30Minutes:F2}  +60 {result.Oxygen60Minutes:F2}  +120 {result.Oxygen120Minutes:F2}";
            if (BloomText != null)
                BloomText.text = $"Bloom Risk\n<size=26><b>{(result.BloomRisk * 100f).ToString("F0", CultureInfo.InvariantCulture)}%</b></size>";
            if (AnomalyText != null)
                AnomalyText.text = $"Anomaly\n<size=26><b>{(result.AnomalyRisk * 100f).ToString("F0", CultureInfo.InvariantCulture)}%</b></size>";
        }

        private void UpdateHudUnavailable(string message)
        {
            if (StatusText != null)
                StatusText.text = message;
            if (OxygenText != null)
                OxygenText.text = "Current O2\n<size=26><b>--</b></size> mg/L";
            if (ForecastText != null)
                ForecastText.text = "Forecast\n+30 --  +60 --  +120 --";
            if (BloomText != null)
                BloomText.text = "Bloom Risk\n<size=26><b>--</b></size>";
            if (AnomalyText != null)
                AnomalyText.text = "Anomaly\n<size=26><b>--</b></size>";
        }
    }
}
