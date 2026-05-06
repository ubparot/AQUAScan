using UnityEngine;
using UnityEngine.UI;

namespace AQUAScan.Visualization
{
    public class AquaHudTabController : MonoBehaviour
    {
        [SerializeField] private Button drivingTabButton;
        [SerializeField] private Button aiTabButton;
        [SerializeField] private Button sensorTabButton;
        [SerializeField] private GameObject drivingTabPanel;
        [SerializeField] private GameObject aiInferenceTabPanel;
        [SerializeField] private GameObject sensorDataTabPanel;

        private static readonly Color ActiveColor = new Color(0f, 0.52f, 0.62f, 1f);
        private static readonly Color InactiveColor = new Color(0.024f, 0.034f, 0.038f, 1f);
        private static readonly Color ActiveTextColor = Color.white;
        private static readonly Color InactiveTextColor = new Color(0.64f, 0.7f, 0.67f, 1f);

        private enum HudTab
        {
            Driving,
            AiInference,
            SensorData
        }

        private void Awake()
        {
            ResolveReferences();
            WireButtons();
            ShowSensorData();
        }

        private void OnEnable()
        {
            ResolveReferences();
            WireButtons();
        }

        private void OnDisable()
        {
            if (drivingTabButton != null)
                drivingTabButton.onClick.RemoveListener(ShowDriving);
            if (aiTabButton != null)
                aiTabButton.onClick.RemoveListener(ShowAiInference);
            if (sensorTabButton != null)
                sensorTabButton.onClick.RemoveListener(ShowSensorData);
        }

        public void ShowDriving()
        {
            SetActiveTab(HudTab.Driving);
        }

        public void ShowAiInference()
        {
            SetActiveTab(HudTab.AiInference);
        }

        public void ShowSensorData()
        {
            SetActiveTab(HudTab.SensorData);
        }

        private void ResolveReferences()
        {
            drivingTabButton = drivingTabButton != null ? drivingTabButton : transform.Find("DrivingTabButton")?.GetComponent<Button>();
            aiTabButton = aiTabButton != null ? aiTabButton : transform.Find("AiTabButton")?.GetComponent<Button>();
            sensorTabButton = sensorTabButton != null ? sensorTabButton : transform.Find("SensorTabButton")?.GetComponent<Button>();
            drivingTabPanel = drivingTabPanel != null ? drivingTabPanel : transform.Find("DrivingTabPanel")?.gameObject;
            aiInferenceTabPanel = aiInferenceTabPanel != null ? aiInferenceTabPanel : transform.Find("AiInferenceTabPanel")?.gameObject;
            sensorDataTabPanel = sensorDataTabPanel != null ? sensorDataTabPanel : transform.Find("SensorDataTabPanel")?.gameObject;
        }

        private void WireButtons()
        {
            if (drivingTabButton != null)
            {
                drivingTabButton.onClick.RemoveListener(ShowDriving);
                drivingTabButton.onClick.AddListener(ShowDriving);
            }

            if (aiTabButton != null)
            {
                aiTabButton.onClick.RemoveListener(ShowAiInference);
                aiTabButton.onClick.AddListener(ShowAiInference);
            }

            if (sensorTabButton != null)
            {
                sensorTabButton.onClick.RemoveListener(ShowSensorData);
                sensorTabButton.onClick.AddListener(ShowSensorData);
            }
        }

        private void SetActiveTab(HudTab tab)
        {
            if (drivingTabPanel != null)
                drivingTabPanel.SetActive(tab == HudTab.Driving);
            if (aiInferenceTabPanel != null)
                aiInferenceTabPanel.SetActive(tab == HudTab.AiInference);
            if (sensorDataTabPanel != null)
                sensorDataTabPanel.SetActive(tab == HudTab.SensorData);

            StyleTabButton(drivingTabButton, tab == HudTab.Driving);
            StyleTabButton(aiTabButton, tab == HudTab.AiInference);
            StyleTabButton(sensorTabButton, tab == HudTab.SensorData);
        }

        private static void StyleTabButton(Button button, bool active)
        {
            if (button == null)
                return;

            if (button.TryGetComponent(out Image image))
                image.color = active ? ActiveColor : InactiveColor;

            var label = button.GetComponentInChildren<Text>(true);
            if (label != null)
                label.color = active ? ActiveTextColor : InactiveTextColor;
        }
    }
}
