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

        private static readonly Color ActiveColor = new Color(0.02f, 0.54f, 0.68f, 1f);
        private static readonly Color InactiveColor = new Color(0.055f, 0.066f, 0.07f, 1f);
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
            drivingTabButton = drivingTabButton != null ? drivingTabButton : FindChildComponent<Button>("DrivingTabButton");
            aiTabButton = aiTabButton != null ? aiTabButton : FindChildComponent<Button>("AiTabButton");
            sensorTabButton = sensorTabButton != null ? sensorTabButton : FindChildComponent<Button>("SensorTabButton");
            drivingTabPanel = drivingTabPanel != null ? drivingTabPanel : FindChild("DrivingTabPanel");
            aiInferenceTabPanel = aiInferenceTabPanel != null ? aiInferenceTabPanel : FindChild("AiInferenceTabPanel");
            sensorDataTabPanel = sensorDataTabPanel != null ? sensorDataTabPanel : FindChild("SensorDataTabPanel");
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

        private T FindChildComponent<T>(string childName) where T : Component
        {
            var child = FindChild(childName);
            return child != null ? child.GetComponent<T>() : null;
        }

        private GameObject FindChild(string childName)
        {
            var transforms = GetComponentsInChildren<Transform>(true);
            foreach (var child in transforms)
            {
                if (child.name == childName)
                    return child.gameObject;
            }

            return null;
        }
    }
}
