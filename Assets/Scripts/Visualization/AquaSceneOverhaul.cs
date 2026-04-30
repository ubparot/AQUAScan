using System.Collections;
using System.IO;
using AQUAScan.Controllers;
using AQUAScan.Control;
using UnityEngine;
using UnityEngine.EventSystems;
using UnityEngine.Rendering;
using UnityEngine.Rendering.Universal;
using UnityEngine.UI;
#if UNITY_EDITOR
using UnityEditor;
using UnityEditor.SceneManagement;
#endif

namespace AQUAScan.Visualization
{
    /// <summary>
    /// Runtime-only presentation pass for the demo scene.
    /// It keeps the existing scene wiring intact and rebuilds the visual shell around it.
    /// </summary>
    [ExecuteAlways]
    [DefaultExecutionOrder(250)]
    public class AquaSceneOverhaul : MonoBehaviour
    {
        private static readonly Color PanelColor = new Color(0.004f, 0.007f, 0.008f, 0.985f);
        private static readonly Color PanelBorder = new Color(0.28f, 0.5f, 0.52f, 0.3f);
        private static readonly Color PanelAccent = new Color(0.06f, 0.68f, 0.72f, 0.92f);
        private static readonly Color InsetColor = new Color(0.012f, 0.017f, 0.018f, 0.975f);
        private static readonly Color InsetBorder = new Color(0.32f, 0.46f, 0.44f, 0.18f);
        private static readonly Color AccentColor = new Color(0.02f, 0.62f, 0.66f, 1f);
        private static readonly Color AccentPressed = new Color(0.015f, 0.42f, 0.48f, 1f);
        private static readonly Color WarmAccent = new Color(0.95f, 0.64f, 0.24f, 1f);
        private static readonly Color GoodAccent = new Color(0.35f, 0.76f, 0.45f, 1f);
        private static readonly Color TrackColor = new Color(0.38f, 0.88f, 0.9f, 1f);
        private static readonly Color TextPrimary = new Color(0.94f, 0.96f, 0.94f, 1f);
        private static readonly Color TextMuted = new Color(0.63f, 0.7f, 0.7f, 1f);
        private static readonly Color FieldColor = new Color(0.006f, 0.01f, 0.012f, 1f);
        private const string WaterNormalAPath = "Assets/Shaders/Water 0175normal.jpg";
        private const string WaterNormalBPath = "Assets/Shaders/water 0342normal.jpg";
        private const string WaterFoamPath = "Assets/Shaders/Water 0325.jpg";
        private const int RoundedSpriteSize = 64;
        private const int SkyboxWidth = 1024;
        private const int SkyboxHeight = 512;

        private static Sprite s_panelSprite;
        private static Sprite s_inputSprite;
        private static Sprite s_pillSprite;
        private static Texture2D s_sunnySkyboxTexture;
        private static Material s_sunnySkyboxMaterial;

        private AquaMissionController _controller;
        private HeatmapSurface _heatmap;
        private CameraBoatOrbit _orbit;
        private Camera _mainCamera;
        private Canvas _canvas;
        private CanvasScaler _canvasScaler;
        private Font _font;
        private Sprite _panelSprite;
        private Sprite _inputSprite;
        private Sprite _pillSprite;
        private Text _modeBadge;

        private Transform _generatedRoot;
        private GameObject _waterPlane;
        private GameObject _seabedPlane;
        private Material _waterMaterial;
        private Material _seabedMaterial;
        private Bounds _lastStageBounds;
        private bool _hasStageBounds;
        private bool _cameraFramed;
        private bool _visualsStyled;
        private bool _refreshQueued;
        private bool _hudBuilt;

        private IEnumerator Start()
        {
            if (!Application.isPlaying)
                yield break;

            yield return null;
            ApplyOverhaul();
            yield return null;
            ApplyOverhaul();
        }

        private void LateUpdate()
        {
            if (!Application.isPlaying)
                return;

            if (_controller == null || _heatmap == null)
                return;

            RefreshMissionDrivenPresentation();
        }

        private void OnEnable()
        {
            QueueRefresh();
        }

        private void OnDisable()
        {
#if UNITY_EDITOR
            EditorApplication.delayCall -= RunQueuedRefresh;
#endif
            _refreshQueued = false;
        }

        private void OnValidate()
        {
            ResetCaches();
            QueueRefresh();
        }

        [ContextMenu("Apply Overhaul")]
        public void ApplyOverhaul()
        {
            CacheSceneReferences();
            if (_controller == null || _canvas == null)
                return;

            SetupScenePresentation();
            EnsureEditorMissionPreview();
            BuildHud();
            RefreshMissionDrivenPresentation();
        }

        private void CacheSceneReferences()
        {
            _controller = GetComponent<AquaMissionController>();
            _heatmap = GetComponent<HeatmapSurface>();
            _canvas = FindObjectOfType<Canvas>();
            _canvasScaler = _canvas != null ? _canvas.GetComponent<CanvasScaler>() : null;
            _mainCamera = Camera.main != null ? Camera.main : FindObjectOfType<Camera>();
            _orbit = _mainCamera != null ? _mainCamera.GetComponent<CameraBoatOrbit>() : null;
            _font = Resources.GetBuiltinResource<Font>("LegacyRuntime.ttf");
            _panelSprite = ResolvePanelSprite();
            _inputSprite = ResolveInputSprite();
            _pillSprite = ResolvePillSprite();
        }

        private void ResetCaches()
        {
            _controller = null;
            _heatmap = null;
            _orbit = null;
            _mainCamera = null;
            _canvas = null;
            _canvasScaler = null;
            _modeBadge = null;
            _pillSprite = null;
            _generatedRoot = null;
            _waterPlane = null;
            _seabedPlane = null;
            _hasStageBounds = false;
            _cameraFramed = false;
            _visualsStyled = false;
            _hudBuilt = false;
        }

        private void QueueRefresh()
        {
            if (Application.isPlaying)
                return;

#if UNITY_EDITOR
            if (_refreshQueued)
                return;

            _refreshQueued = true;
            EditorApplication.delayCall += RunQueuedRefresh;
#endif
        }

        private Sprite ResolvePanelSprite()
        {
            if (s_panelSprite == null)
                s_panelSprite = CreateRoundedSprite("AquaScan Rounded Panel", 18);

            if (s_pillSprite == null)
                s_pillSprite = CreateRoundedSprite("AquaScan Rounded Pill", 31);

            return s_panelSprite;
        }

        private Sprite ResolveInputSprite()
        {
            if (s_inputSprite == null)
                s_inputSprite = CreateRoundedSprite("AquaScan Rounded Input", 12);

            return s_inputSprite;
        }

        private Sprite ResolvePillSprite()
        {
            if (s_pillSprite == null)
                s_pillSprite = CreateRoundedSprite("AquaScan Rounded Pill", 31);

            return s_pillSprite;
        }

#if UNITY_EDITOR
        private void RunQueuedRefresh()
        {
            _refreshQueued = false;
            if (this == null || gameObject == null)
                return;

            ApplyOverhaul();
            EditorSceneManager.MarkSceneDirty(gameObject.scene);
        }
#endif

        private void SetupScenePresentation()
        {
            EnsureGeneratedRoot();
            ConfigureRenderSettings();
            ConfigureCamera();
            ConfigureLighting();
            ConfigurePostProcessing();
            StyleVisualizers();
        }

        private void EnsureEditorMissionPreview()
        {
            if (Application.isPlaying || _controller == null || _heatmap == null)
                return;

            if (_heatmap.TryGetComponent(out MeshFilter meshFilter) && meshFilter.sharedMesh != null)
                return;

            if (!_controller.LoadDefaultOnStart || string.IsNullOrWhiteSpace(_controller.DefaultMissionFile))
                return;

            string missionPath = Path.Combine(Application.streamingAssetsPath, _controller.DefaultMissionFile);
            if (!File.Exists(missionPath))
                return;

            _controller.LoadMission(missionPath);
            _cameraFramed = false;
            _visualsStyled = false;
        }

        private void EnsureGeneratedRoot()
        {
            if (_generatedRoot != null)
                return;

            var existing = transform.Find("SceneOverhaulRuntime");
            if (existing != null)
            {
                _generatedRoot = existing;
                return;
            }

            var go = new GameObject("SceneOverhaulRuntime");
            go.transform.SetParent(transform, false);
            _generatedRoot = go.transform;
        }

        private void ConfigureRenderSettings()
        {
            RenderSettings.fog = true;
            RenderSettings.fogMode = FogMode.Linear;
            RenderSettings.fogStartDistance = 360f;
            RenderSettings.fogEndDistance = 1100f;
            RenderSettings.fogColor = new Color(0.91f, 0.96f, 1f, 1f);
            RenderSettings.ambientMode = AmbientMode.Trilight;
            RenderSettings.ambientSkyColor = new Color(0.93f, 0.98f, 1f, 1f);
            RenderSettings.ambientEquatorColor = new Color(0.78f, 0.88f, 0.94f, 1f);
            RenderSettings.ambientGroundColor = new Color(0.42f, 0.5f, 0.52f, 1f);
            RenderSettings.reflectionIntensity = 1.9f;
            RenderSettings.defaultReflectionMode = DefaultReflectionMode.Skybox;

            var skyboxMaterial = BuildSunnySkyboxMaterial();
            if (skyboxMaterial != null)
                RenderSettings.skybox = skyboxMaterial;
        }

        private Material BuildSunnySkyboxMaterial()
        {
            var panoramicShader = Shader.Find("Skybox/Panoramic");
            if (panoramicShader != null)
            {
                if (s_sunnySkyboxTexture == null)
                    s_sunnySkyboxTexture = CreateSunnySkyboxTexture();

                if (s_sunnySkyboxMaterial == null || s_sunnySkyboxMaterial.shader != panoramicShader)
                {
                    s_sunnySkyboxMaterial = new Material(panoramicShader)
                    {
                        name = "AquaScan Sunny Panoramic Sky",
                        hideFlags = HideFlags.HideAndDontSave
                    };
                }

                if (s_sunnySkyboxMaterial.HasProperty("_MainTex"))
                    s_sunnySkyboxMaterial.SetTexture("_MainTex", s_sunnySkyboxTexture);
                if (s_sunnySkyboxMaterial.HasProperty("_Tint"))
                    s_sunnySkyboxMaterial.SetColor("_Tint", new Color(0.78f, 0.88f, 1f, 1f));
                if (s_sunnySkyboxMaterial.HasProperty("_Exposure"))
                    s_sunnySkyboxMaterial.SetFloat("_Exposure", 0.68f);
                if (s_sunnySkyboxMaterial.HasProperty("_Rotation"))
                    s_sunnySkyboxMaterial.SetFloat("_Rotation", 18f);

                return s_sunnySkyboxMaterial;
            }

            var proceduralShader = Shader.Find("Skybox/Procedural");
            if (proceduralShader == null)
                return null;

            if (s_sunnySkyboxMaterial == null || s_sunnySkyboxMaterial.shader != proceduralShader)
            {
                s_sunnySkyboxMaterial = new Material(proceduralShader)
                {
                    name = "AquaScan Sunny Procedural Sky",
                    hideFlags = HideFlags.HideAndDontSave
                };
            }

            if (s_sunnySkyboxMaterial.HasProperty("_SunDisk"))
                s_sunnySkyboxMaterial.SetFloat("_SunDisk", 2f);
            s_sunnySkyboxMaterial.SetFloat("_SunSize", 0.08f);
            s_sunnySkyboxMaterial.SetFloat("_SunSizeConvergence", 9f);
            s_sunnySkyboxMaterial.SetFloat("_AtmosphereThickness", 0.42f);
            s_sunnySkyboxMaterial.SetColor("_SkyTint", new Color(0.7f, 0.88f, 1f, 1f));
            s_sunnySkyboxMaterial.SetColor("_GroundColor", new Color(0.76f, 0.8f, 0.72f, 1f));
            s_sunnySkyboxMaterial.SetFloat("_Exposure", 2.15f);
            return s_sunnySkyboxMaterial;
        }

        private static Texture2D CreateSunnySkyboxTexture()
        {
            var texture = new Texture2D(SkyboxWidth, SkyboxHeight, TextureFormat.RGBA32, false)
            {
                name = "AquaScan Sunny Sky Texture",
                hideFlags = HideFlags.HideAndDontSave,
                filterMode = FilterMode.Bilinear,
                wrapMode = TextureWrapMode.Repeat
            };

            var pixels = new Color32[SkyboxWidth * SkyboxHeight];
            var deepZenith = new Color(0.08f, 0.33f, 0.72f, 1f);
            var upperSky = new Color(0.22f, 0.58f, 0.9f, 1f);
            var horizon = new Color(0.64f, 0.82f, 0.94f, 1f);
            var warmHaze = new Color(0.9f, 0.72f, 0.44f, 1f);
            var lowerAtmosphere = new Color(0.42f, 0.62f, 0.72f, 1f);
            var sunColor = new Color(1f, 0.78f, 0.34f, 1f);
            var sunCore = new Color(1f, 0.9f, 0.58f, 1f);
            const float sunU = 0.68f;
            const float sunV = 0.68f;

            for (int y = 0; y < SkyboxHeight; y++)
            {
                float v = y / (float)(SkyboxHeight - 1);
                float vertical = Mathf.SmoothStep(0f, 1f, v);
                Color baseColor;

                if (v < 0.46f)
                {
                    float lowerT = Mathf.SmoothStep(0f, 0.46f, v);
                    baseColor = Color.Lerp(lowerAtmosphere, horizon, lowerT);
                }
                else
                {
                    float skyT = Mathf.SmoothStep(0.46f, 1f, v);
                    baseColor = Color.Lerp(horizon, Color.Lerp(upperSky, deepZenith, skyT), skyT);
                }

                float hazeStrength = 1f - Mathf.Abs(v - 0.52f) / 0.28f;
                baseColor = Color.Lerp(baseColor, warmHaze, Mathf.Clamp01(hazeStrength) * 0.08f);

                for (int x = 0; x < SkyboxWidth; x++)
                {
                    float u = x / (float)(SkyboxWidth - 1);
                    float du = Mathf.Abs(u - sunU);
                    du = Mathf.Min(du, 1f - du);
                    float dv = (v - sunV) * 0.75f;
                    float sunDistance = Mathf.Sqrt(du * du + dv * dv);
                    float glow = Mathf.Exp(-sunDistance * sunDistance * 70f);
                    float halo = Mathf.Exp(-sunDistance * sunDistance * 420f);
                    float disc = Mathf.SmoothStep(0.026f, 0.004f, sunDistance);

                    float cloudNoise = Mathf.PerlinNoise(u * 7.5f + 3.1f, v * 5.4f + 8.7f);
                    float highCloud = Mathf.SmoothStep(0.62f, 0.9f, cloudNoise) * Mathf.SmoothStep(0.45f, 0.7f, v) * (1f - Mathf.SmoothStep(0.92f, 1f, v));
                    Color color = Color.Lerp(baseColor, new Color(0.82f, 0.9f, 0.96f, 1f), highCloud * 0.08f);
                    color = Color.Lerp(color, sunColor, glow * 0.18f);
                    color = Color.Lerp(color, sunCore, halo * 0.22f + disc * 0.85f);
                    color *= 0.82f + vertical * 0.08f;
                    color.a = 1f;
                    pixels[y * SkyboxWidth + x] = color;
                }
            }

            texture.SetPixels32(pixels);
            texture.Apply(false, true);
            return texture;
        }

        private void ConfigureCamera()
        {
            if (_mainCamera == null)
                return;

            _mainCamera.clearFlags = CameraClearFlags.Skybox;
            _mainCamera.backgroundColor = new Color(0.84f, 0.94f, 1f, 1f);
            _mainCamera.fieldOfView = 50f;
            _mainCamera.nearClipPlane = 0.1f;
            _mainCamera.farClipPlane = 900f;
            _mainCamera.allowHDR = true;
            _mainCamera.allowMSAA = true;
            _mainCamera.depthTextureMode = DepthTextureMode.Depth;

            if (!_mainCamera.TryGetComponent(out UniversalAdditionalCameraData cameraData))
                return;

            cameraData.renderPostProcessing = true;
            cameraData.requiresColorOption = CameraOverrideOption.On;
            cameraData.requiresDepthOption = CameraOverrideOption.On;
            cameraData.antialiasing = AntialiasingMode.SubpixelMorphologicalAntiAliasing;
            cameraData.antialiasingQuality = AntialiasingQuality.High;
            cameraData.dithering = true;
            cameraData.stopNaN = true;
        }

        private void ConfigureLighting()
        {
            var light = FindObjectOfType<Light>();
            if (light == null || light.type != LightType.Directional)
                return;

            RenderSettings.sun = light;
            light.color = new Color(1f, 0.96f, 0.84f, 1f);
            light.intensity = 2.15f;
            light.shadows = LightShadows.Soft;
            light.shadowStrength = 0.38f;
            light.shadowBias = 0.016f;
            light.shadowNormalBias = 0.1f;
            light.transform.rotation = Quaternion.Euler(58f, -28f, 0f);
        }

        private void ConfigurePostProcessing()
        {
            var volumeObject = _generatedRoot.Find("GlobalVolume");
            Volume volume;
            if (volumeObject == null)
            {
                var go = new GameObject("GlobalVolume");
                go.transform.SetParent(_generatedRoot, false);
                volume = go.AddComponent<Volume>();
                volume.isGlobal = true;
                volume.priority = 100f;
                volume.sharedProfile = ScriptableObject.CreateInstance<VolumeProfile>();
            }
            else
            {
                volume = volumeObject.GetComponent<Volume>();
                if (volume.sharedProfile == null)
                    volume.sharedProfile = ScriptableObject.CreateInstance<VolumeProfile>();
            }

            var profile = volume.sharedProfile;
            EnsureOverride(profile, out Tonemapping tonemapping).mode.value = TonemappingMode.ACES;

            var bloom = EnsureOverride(profile, out Bloom bloomOverride);
            bloomOverride.intensity.value = 0.36f;
            bloomOverride.threshold.value = 1.12f;
            bloomOverride.scatter.value = 0.52f;

            var color = EnsureOverride(profile, out ColorAdjustments colorOverride);
            colorOverride.postExposure.value = 0.48f;
            colorOverride.contrast.value = 3f;
            colorOverride.saturation.value = 10f;
            colorOverride.colorFilter.value = new Color(1f, 0.995f, 0.94f, 1f);

            var vignette = EnsureOverride(profile, out Vignette vignetteOverride);
            vignetteOverride.intensity.value = 0.02f;
            vignetteOverride.smoothness.value = 0.22f;
            vignetteOverride.rounded.value = false;

            var depthOfField = EnsureOverride(profile, out DepthOfField dofOverride);
            dofOverride.active = false;
        }

        private static T EnsureOverride<T>(VolumeProfile profile, out T component) where T : VolumeComponent
        {
            if (!profile.TryGet(out component))
                component = profile.Add<T>(true);

            component.active = true;
            return component;
        }

        private void StyleVisualizers()
        {
            if (_visualsStyled)
                return;

            if (_controller?.TrackRenderer != null)
                StyleTrackRenderer(_controller.TrackRenderer.GetComponent<LineRenderer>());

            if (_controller?.PointCloud != null)
                StylePointCloud(_controller.PointCloud.GetComponent<ParticleSystem>(), _controller.PointCloud.GetComponent<ParticleSystemRenderer>());

            if (_heatmap != null)
            {
                var heatmapRenderer = _heatmap.GetComponent<MeshRenderer>();
                if (heatmapRenderer != null)
                    StyleHeatmapMaterial(heatmapRenderer);
            }

            _visualsStyled = true;
        }

        private void StyleTrackRenderer(LineRenderer lineRenderer)
        {
            if (lineRenderer == null)
                return;

            lineRenderer.alignment = LineAlignment.View;
            lineRenderer.widthCurve = new AnimationCurve(
                new Keyframe(0f, 0.35f),
                new Keyframe(0.5f, 0.5f),
                new Keyframe(1f, 0.35f));
            lineRenderer.numCapVertices = 14;
            lineRenderer.numCornerVertices = 6;
            lineRenderer.shadowCastingMode = UnityEngine.Rendering.ShadowCastingMode.Off;
            lineRenderer.receiveShadows = false;

            var gradient = new Gradient();
            gradient.SetKeys(
                new[]
                {
                    new GradientColorKey(TrackColor, 0f),
                    new GradientColorKey(new Color(0.2f, 0.63f, 0.86f, 1f), 0.55f),
                    new GradientColorKey(new Color(0.11f, 0.32f, 0.45f, 1f), 1f)
                },
                new[]
                {
                    new GradientAlphaKey(0.95f, 0f),
                    new GradientAlphaKey(0.92f, 0.7f),
                    new GradientAlphaKey(0.32f, 1f)
                });
            lineRenderer.colorGradient = gradient;

            var shader = Shader.Find("Sprites/Default");
            if (shader == null)
                return;

            var material = lineRenderer.sharedMaterial;
            if (material == null || material.shader != shader)
                material = new Material(shader);

            material.color = Color.white;
            lineRenderer.sharedMaterial = material;
        }

        private void StylePointCloud(ParticleSystem particleSystem, ParticleSystemRenderer renderer)
        {
            if (particleSystem == null || renderer == null)
                return;

            var main = particleSystem.main;
            main.startSizeMultiplier = Mathf.Clamp(main.startSizeMultiplier, 0.08f, 0.16f);
            main.maxParticles = Mathf.Max(main.maxParticles, 20000);

            renderer.renderMode = ParticleSystemRenderMode.Billboard;
            renderer.sortMode = ParticleSystemSortMode.Distance;
            renderer.normalDirection = 0.2f;
            renderer.minParticleSize = 0.006f;
            renderer.maxParticleSize = 0.025f;

            var shader = Shader.Find("Universal Render Pipeline/Particles/Unlit");
            if (shader == null)
                shader = Shader.Find("Particles/Standard Unlit");

            if (shader == null)
                return;

            var material = renderer.sharedMaterial;
            if (material == null || material.shader != shader)
                material = new Material(shader);

            if (material.HasProperty("_Surface"))
                material.SetFloat("_Surface", 1f);
            if (material.HasProperty("_Blend"))
                material.SetFloat("_Blend", 0f);
            if (material.HasProperty("_Color"))
                material.SetColor("_Color", new Color(1f, 1f, 1f, 0.1f));
            if (material.HasProperty("_BaseColor"))
                material.SetColor("_BaseColor", new Color(1f, 1f, 1f, 0.1f));
            renderer.sharedMaterial = material;
        }

        private void StyleHeatmapMaterial(MeshRenderer renderer)
        {
            var material = renderer.sharedMaterial;
            if (material == null)
                return;

            ApplyWaterTextures(material);
            if (material.HasProperty("_ShallowColor"))
                material.SetColor("_ShallowColor", new Color(0.16f, 0.48f, 0.62f, 0.1f));
            if (material.HasProperty("_DeepColor"))
                material.SetColor("_DeepColor", new Color(0.02f, 0.08f, 0.14f, 0.16f));
            if (material.HasProperty("_FoamColor"))
                material.SetColor("_FoamColor", new Color(0.92f, 0.98f, 1f, 1f));
            if (material.HasProperty("_WaveScale"))
                material.SetFloat("_WaveScale", 0.16f);
            if (material.HasProperty("_WaveHeight"))
                material.SetFloat("_WaveHeight", 0.025f);
            if (material.HasProperty("_WaveSpeed"))
                material.SetFloat("_WaveSpeed", 0.35f);
            if (material.HasProperty("_Chop"))
                material.SetFloat("_Chop", 0.02f);
            if (material.HasProperty("_NormalStrength"))
                material.SetFloat("_NormalStrength", 0.35f);
            if (material.HasProperty("_NormalTilingA"))
                material.SetFloat("_NormalTilingA", 0.28f);
            if (material.HasProperty("_NormalTilingB"))
                material.SetFloat("_NormalTilingB", 0.54f);
            if (material.HasProperty("_NormalSpeedA"))
                material.SetVector("_NormalSpeedA", new Vector4(0.012f, 0.008f, 0f, 0f));
            if (material.HasProperty("_NormalSpeedB"))
                material.SetVector("_NormalSpeedB", new Vector4(-0.008f, 0.016f, 0f, 0f));
            if (material.HasProperty("_DepthDistance"))
                material.SetFloat("_DepthDistance", 24f);
            if (material.HasProperty("_Absorption"))
                material.SetFloat("_Absorption", 1.6f);
            if (material.HasProperty("_Scatter"))
                material.SetFloat("_Scatter", 0.04f);
            if (material.HasProperty("_RefractionStrength"))
                material.SetFloat("_RefractionStrength", 0f);
            if (material.HasProperty("_RefractionDepthFade"))
                material.SetFloat("_RefractionDepthFade", 0f);
            if (material.HasProperty("_FoamSize"))
                material.SetFloat("_FoamSize", 0.2f);
            if (material.HasProperty("_FoamCutoff"))
                material.SetFloat("_FoamCutoff", 0.95f);
            if (material.HasProperty("_FoamTiling"))
                material.SetFloat("_FoamTiling", 0.28f);
            if (material.HasProperty("_FoamSpeed"))
                material.SetVector("_FoamSpeed", new Vector4(0.004f, -0.003f, 0f, 0f));
            if (material.HasProperty("_CrestFoam"))
                material.SetFloat("_CrestFoam", 0f);
            if (material.HasProperty("_HeatmapTintStrength"))
                material.SetFloat("_HeatmapTintStrength", 0.95f);
            if (material.HasProperty("_HeatmapEmission"))
                material.SetFloat("_HeatmapEmission", 0.08f);
            if (material.HasProperty("_HeatmapAlphaMin"))
                material.SetFloat("_HeatmapAlphaMin", 0.02f);
            if (material.HasProperty("_HeatmapAlphaMax"))
                material.SetFloat("_HeatmapAlphaMax", 0.18f);
            if (material.HasProperty("_Smoothness"))
                material.SetFloat("_Smoothness", 0.68f);
            if (material.HasProperty("_SpecularColor"))
                material.SetColor("_SpecularColor", new Color(0.6f, 0.72f, 0.8f, 1f));
            if (material.HasProperty("_FresnelPower"))
                material.SetFloat("_FresnelPower", 3.2f);
            if (material.HasProperty("_ReflectionTopColor"))
                material.SetColor("_ReflectionTopColor", new Color(0.25f, 0.42f, 0.58f, 1f));
            if (material.HasProperty("_ReflectionHorizonColor"))
                material.SetColor("_ReflectionHorizonColor", new Color(0.54f, 0.64f, 0.72f, 1f));
            if (material.HasProperty("_ReflectionStrength"))
                material.SetFloat("_ReflectionStrength", 0.18f);
            if (material.HasProperty("_CausticsStrength"))
                material.SetFloat("_CausticsStrength", 0.04f);
            if (material.HasProperty("_CausticsScale"))
                material.SetFloat("_CausticsScale", 1.45f);
            if (material.HasProperty("_CausticsSpeed"))
                material.SetFloat("_CausticsSpeed", 0.62f);

            renderer.shadowCastingMode = UnityEngine.Rendering.ShadowCastingMode.Off;
            renderer.receiveShadows = true;
        }

        private void BuildHud()
        {
            if (_canvas == null || _controller == null)
                return;

            ConfigureCanvas();

            var canvasRect = _canvas.GetComponent<RectTransform>();
            if (Application.isPlaying && _hudBuilt)
            {
                RefreshExistingHud(canvasRect);
                return;
            }

            if (!Application.isPlaying)
                RebuildHudShell(canvasRect);
            else
                PrepareRuntimeHudShell(canvasRect);

            var backdrop = EnsurePanel("Backdrop", canvasRect);
            StretchToParent(backdrop);
            backdrop.SetAsFirstSibling();
            var backdropImage = GetOrAddComponent<Image>(backdrop.gameObject);
            backdropImage.raycastTarget = false;
            backdropImage.color = new Color(0f, 0.012f, 0.018f, 0.26f);

            RemoveDirectChild(canvasRect, "SceneEyebrow");
            RemoveDirectChild(canvasRect, "SceneTitle");
            RemoveDirectChild(canvasRect, "SceneSubtitle");

            var topBar = CreatePanel("TopCommandBar", canvasRect, new Vector2(0.5f, 1f), new Vector2(0.5f, 1f), new Vector2(0f, -24f), new Vector2(1180f, 76f));
            topBar.SetAsLastSibling();

            var eyebrow = EnsureText("SceneEyebrow", topBar, "WATER QUALITY OPS", 11, FontStyle.Bold, WarmAccent);
            SetLocalRect(eyebrow.rectTransform, new Vector2(24f, -12f), new Vector2(220f, 18f));

            var title = EnsureText("SceneTitle", topBar, "AquaScan", 30, FontStyle.Bold, TextPrimary);
            SetLocalRect(title.rectTransform, new Vector2(24f, -30f), new Vector2(230f, 36f));

            var subtitle = EnsureText("SceneSubtitle", topBar, "GPS-tagged depth probe, water-quality layers, and live vessel control", 13, FontStyle.Normal, TextMuted);
            SetLocalRect(subtitle.rectTransform, new Vector2(250f, -36f), new Vector2(420f, 24f));

            _modeBadge = EnsureText("ModeBadge", topBar, "PLAYBACK READY", 13, FontStyle.Bold, GoodAccent);
            _modeBadge.alignment = TextAnchor.MiddleRight;
            SetLocalRect(_modeBadge.rectTransform, new Vector2(916f, -27f), new Vector2(240f, 28f));

            var leftPanel = CreatePanel("ControlPanel", canvasRect, new Vector2(0f, 0.5f), new Vector2(0f, 0.5f), new Vector2(26f, 8f), new Vector2(360f, 612f));
            var rightPanel = CreatePanel("InfoPanel", canvasRect, new Vector2(1f, 0.5f), new Vector2(1f, 0.5f), new Vector2(-26f, 36f), new Vector2(336f, 468f));
            var bottomPanel = CreatePanel("TimelinePanel", canvasRect, new Vector2(0.5f, 0f), new Vector2(0.5f, 0f), new Vector2(0f, 24f), new Vector2(1000f, 112f));

            EnsureMissionUiControls(canvasRect);
            BuildLeftPanel(leftPanel);
            BuildRightPanel(rightPanel);
            BuildBottomPanel(bottomPanel);
            _controller.RefreshUiBindings();
            StyleControlsIn(leftPanel);
            StyleControlsIn(rightPanel);
            StyleControlsIn(bottomPanel);
            _hudBuilt = true;
        }

        private void RefreshExistingHud(RectTransform canvasRect)
        {
            EnsureMissionUiControls(canvasRect);
            _controller.RefreshUiBindings();

            var leftPanel = canvasRect.Find("ControlPanel") as RectTransform;
            var rightPanel = canvasRect.Find("InfoPanel") as RectTransform;
            var bottomPanel = canvasRect.Find("TimelinePanel") as RectTransform;

            if (leftPanel != null)
                StyleControlsIn(leftPanel);
            if (rightPanel != null)
                StyleControlsIn(rightPanel);
            if (bottomPanel != null)
                StyleControlsIn(bottomPanel);
        }

        private void PrepareRuntimeHudShell(RectTransform canvasRect)
        {
            ClearDestroyedControllerReferences();
            DetachReusableControls(canvasRect);

            RemoveDirectChildImmediateSafe(canvasRect, "Backdrop");
            RemoveDirectChildImmediateSafe(canvasRect, "TopCommandBar");
            RemoveDirectChildImmediateSafe(canvasRect, "ControlPanel");
            RemoveDirectChildImmediateSafe(canvasRect, "InfoPanel");
            RemoveDirectChildImmediateSafe(canvasRect, "TimelinePanel");
            RemoveDirectChildImmediateSafe(canvasRect, "SceneEyebrow");
            RemoveDirectChildImmediateSafe(canvasRect, "SceneTitle");
            RemoveDirectChildImmediateSafe(canvasRect, "SceneSubtitle");

            _modeBadge = null;
        }

        private void RebuildHudShell(RectTransform canvasRect)
        {
            ClearDestroyedControllerReferences();
            DetachReusableControls(canvasRect);

            RemoveDirectChild(canvasRect, "Backdrop");
            RemoveDirectChild(canvasRect, "TopCommandBar");
            RemoveDirectChild(canvasRect, "ControlPanel");
            RemoveDirectChild(canvasRect, "InfoPanel");
            RemoveDirectChild(canvasRect, "TimelinePanel");
            RemoveDirectChild(canvasRect, "SceneEyebrow");
            RemoveDirectChild(canvasRect, "SceneTitle");
            RemoveDirectChild(canvasRect, "SceneSubtitle");

            _modeBadge = null;
        }

        private void DetachReusableControls(RectTransform canvasRect)
        {
            MoveControlToCanvas(GetRect(_controller.MetricDropdown), canvasRect);
            MoveControlToCanvas(GetRect(_controller.TrackToggle), canvasRect);
            MoveControlToCanvas(GetRect(_controller.PointsToggle), canvasRect);
            MoveControlToCanvas(GetRect(_controller.HeatmapToggle), canvasRect);
            MoveControlToCanvas(GetRect(_controller.TimeSlider), canvasRect);
            MoveControlToCanvas(GetRect(_controller.LegendLabel), canvasRect);
            MoveControlToCanvas(GetRect(_controller.LegendGradient), canvasRect);
            MoveControlToCanvas(GetRect(_controller.CurrentValueLabel), canvasRect);
            MoveControlToCanvas(GetRect(_controller.PlayPauseButton), canvasRect);
            MoveControlToCanvas(GetRect(_controller.PathInputField), canvasRect);
            MoveControlToCanvas(GetRect(_controller.LoadButton), canvasRect);
        }

        private void ClearDestroyedControllerReferences()
        {
            if (!_controller.MetricDropdown) _controller.MetricDropdown = null;
            if (!_controller.TrackToggle) _controller.TrackToggle = null;
            if (!_controller.PointsToggle) _controller.PointsToggle = null;
            if (!_controller.HeatmapToggle) _controller.HeatmapToggle = null;
            if (!_controller.TimeSlider) _controller.TimeSlider = null;
            if (!_controller.LegendLabel) _controller.LegendLabel = null;
            if (!_controller.LegendGradient) _controller.LegendGradient = null;
            if (!_controller.CurrentValueLabel) _controller.CurrentValueLabel = null;
            if (!_controller.PlayPauseButton) _controller.PlayPauseButton = null;
            if (!_controller.PlayPauseText) _controller.PlayPauseText = null;
            if (!_controller.PathInputField) _controller.PathInputField = null;
            if (!_controller.LoadButton) _controller.LoadButton = null;
        }

        private void EnsureMissionUiControls(RectTransform canvasRect)
        {
            if (!_controller.MetricDropdown)
                _controller.MetricDropdown = EnsureDropdownControl("MetricDropdown", canvasRect);
            if (!_controller.TrackToggle)
                _controller.TrackToggle = EnsureToggleControl("TrackToggle", canvasRect, "Track");
            if (!_controller.PointsToggle)
                _controller.PointsToggle = EnsureToggleControl("PointsToggle", canvasRect, "Points");
            if (!_controller.HeatmapToggle)
                _controller.HeatmapToggle = EnsureToggleControl("HeatmapToggle", canvasRect, "Heat");
            if (!_controller.PathInputField)
                _controller.PathInputField = EnsureInputField("PathInputField", canvasRect, "StreamingAssets file or absolute path");
            if (!_controller.LoadButton)
                _controller.LoadButton = EnsureButtonControl("LoadButton", canvasRect, "Load");
            if (!_controller.TimeSlider)
                _controller.TimeSlider = EnsureSliderControl("TimeSlider", canvasRect);
            if (!_controller.PlayPauseButton)
                _controller.PlayPauseButton = EnsureButtonControl("PlayPauseButton", canvasRect, "Play");
            if (!_controller.PlayPauseText)
                _controller.PlayPauseText = _controller.PlayPauseButton.GetComponentInChildren<Text>(true);
            if (!_controller.LegendLabel)
                _controller.LegendLabel = EnsureText("LegendLabel", canvasRect, "Metric", 13, FontStyle.Bold, TextPrimary);
            if (!_controller.LegendGradient)
                _controller.LegendGradient = EnsureRawImageControl("LegendGradient", canvasRect);
            if (!_controller.CurrentValueLabel)
                _controller.CurrentValueLabel = EnsureText("CurrentValueLabel", canvasRect, "Probe sample", 14, FontStyle.Bold, TextPrimary);
        }

        private static RectTransform GetRect(Component component)
        {
            if (!component)
                return null;
            return component.transform as RectTransform;
        }

        private static void MoveControlToCanvas(RectTransform rect, RectTransform canvasRect)
        {
            if (rect == null || canvasRect == null)
                return;

            rect.SetParent(canvasRect, false);
        }

        private void ConfigureCanvas()
        {
            if (_canvasScaler == null)
                return;

            GetOrAddComponent<GraphicRaycaster>(_canvas.gameObject);
            EnsureEventSystem();
            _canvasScaler.uiScaleMode = CanvasScaler.ScaleMode.ScaleWithScreenSize;
            _canvasScaler.referenceResolution = new Vector2(1920f, 1080f);
            _canvasScaler.screenMatchMode = CanvasScaler.ScreenMatchMode.MatchWidthOrHeight;
            _canvasScaler.matchWidthOrHeight = 0.6f;
            _canvas.pixelPerfect = false;
        }

        private void BuildLeftPanel(RectTransform panel)
        {
            var heading = EnsureText("ControlsHeading", panel, "AquaScan Control", 19, FontStyle.Bold, TextPrimary);
            SetLocalRect(heading.rectTransform, new Vector2(20f, -18f), new Vector2(240f, 26f));

            var subheading = EnsureText("ControlsSubheading", panel, "Semi-autonomous sampling and propulsion", 12, FontStyle.Normal, TextMuted);
            SetLocalRect(subheading.rectTransform, new Vector2(20f, -44f), new Vector2(280f, 18f));

            var missionCard = CreateInsetBlock("MissionCard", panel, new Vector2(16f, -72f), new Vector2(328f, 270f));
            var liveCard = CreateInsetBlock("LiveCard", panel, new Vector2(16f, -354f), new Vector2(328f, 242f));

            var missionHeading = EnsureText("MissionHeading", missionCard, "GPS + DEPTH DATASET", 11, FontStyle.Bold, WarmAccent);
            SetLocalRect(missionHeading.rectTransform, new Vector2(14f, -12f), new Vector2(160f, 18f));

            var metricLabel = EnsureText("MetricLabel", missionCard, "Metric", 12, FontStyle.Bold, TextMuted);
            SetLocalRect(metricLabel.rectTransform, new Vector2(14f, -38f), new Vector2(130f, 20f));
            PlaceControl(_controller.MetricDropdown?.transform as RectTransform, missionCard, new Vector2(14f, -62f), new Vector2(300f, 38f));

            var layersLabel = EnsureText("LayersLabel", missionCard, "Layers", 12, FontStyle.Bold, TextMuted);
            SetLocalRect(layersLabel.rectTransform, new Vector2(14f, -112f), new Vector2(130f, 20f));
            SetToggleLabel(_controller.TrackToggle, "Track");
            SetToggleLabel(_controller.PointsToggle, "Points");
            SetToggleLabel(_controller.HeatmapToggle, "Heat");
            PlaceControl(_controller.TrackToggle?.transform as RectTransform, missionCard, new Vector2(14f, -138f), new Vector2(96f, 28f));
            PlaceControl(_controller.PointsToggle?.transform as RectTransform, missionCard, new Vector2(116f, -138f), new Vector2(96f, 28f));
            PlaceControl(_controller.HeatmapToggle?.transform as RectTransform, missionCard, new Vector2(218f, -138f), new Vector2(96f, 28f));

            var pathLabel = EnsureText("PathLabel", missionCard, "CSV / JSON output", 12, FontStyle.Bold, TextMuted);
            SetLocalRect(pathLabel.rectTransform, new Vector2(14f, -178f), new Vector2(130f, 20f));

            if (_controller.PathInputField != null)
            {
                if (_controller.PathInputField.placeholder is Text placeholder)
                    placeholder.text = "StreamingAssets file or absolute path";

                PlaceControl(_controller.PathInputField.transform as RectTransform, missionCard, new Vector2(14f, -202f), new Vector2(196f, 38f));
            }

            if (_controller.LoadButton != null)
            {
                var loadLabel = _controller.LoadButton.GetComponentInChildren<Text>(true);
                if (loadLabel != null)
                    loadLabel.text = "Load";

                PlaceControl(_controller.LoadButton.transform as RectTransform, missionCard, new Vector2(220f, -202f), new Vector2(94f, 38f));
            }

            BuildLiveCard(liveCard);
            StyleControlsIn(panel);
        }

        private void BuildRightPanel(RectTransform panel)
        {
            var heading = EnsureText("InfoHeading", panel, "Telemetry", 19, FontStyle.Bold, TextPrimary);
            SetLocalRect(heading.rectTransform, new Vector2(20f, -18f), new Vector2(220f, 26f));

            var subheading = EnsureText("InfoSubheading", panel, "Probe sample, layer legend, and vessel status", 12, FontStyle.Normal, TextMuted);
            SetLocalRect(subheading.rectTransform, new Vector2(20f, -44f), new Vector2(280f, 18f));

            var readingCard = CreateInsetBlock("ReadingCard", panel, new Vector2(16f, -72f), new Vector2(304f, 116f));
            var legendCard = CreateInsetBlock("LegendCard", panel, new Vector2(16f, -200f), new Vector2(304f, 86f));
            var telemetryCard = CreateInsetBlock("TelemetryCard", panel, new Vector2(16f, -298f), new Vector2(304f, 146f));

            if (_controller.LegendLabel != null)
                PlaceControl(_controller.LegendLabel.rectTransform, legendCard, new Vector2(14f, -12f), new Vector2(276f, 20f));

            if (_controller.LegendGradient != null)
                PlaceControl(_controller.LegendGradient.rectTransform, legendCard, new Vector2(14f, -42f), new Vector2(276f, 24f));

            var readingLabel = EnsureText("CurrentReadingLabel", readingCard, "DEPTH PROBE SAMPLE", 11, FontStyle.Bold, WarmAccent);
            SetLocalRect(readingLabel.rectTransform, new Vector2(14f, -12f), new Vector2(180f, 18f));

            if (_controller.CurrentValueLabel != null)
                PlaceControl(_controller.CurrentValueLabel.rectTransform, readingCard, new Vector2(14f, -38f), new Vector2(276f, 62f));

            var telemetryLabel = EnsureText("TelemetryLabel", telemetryCard, "LINK STATUS", 11, FontStyle.Bold, WarmAccent);
            SetLocalRect(telemetryLabel.rectTransform, new Vector2(14f, -12f), new Vector2(180f, 18f));

            _controller.ConnectionStatusText = EnsureText("ConnectionStatusText", telemetryCard, "Playback mode", 13, FontStyle.Normal, TextPrimary);
            PlaceControl(_controller.ConnectionStatusText.rectTransform, telemetryCard, new Vector2(14f, -36f), new Vector2(276f, 24f));

            var probeContext = EnsureText("ProbeContextText", telemetryCard, "Depth probe tags each sample with GPS + tether depth", 11, FontStyle.Bold, TextMuted);
            PlaceControl(probeContext.rectTransform, telemetryCard, new Vector2(14f, -58f), new Vector2(276f, 22f));

            _controller.LeftPulseText = EnsureText("LeftPulseText", telemetryCard, "Left ESC\n<size=22><b>1500</b></size> us", 12, FontStyle.Bold, TextPrimary);
            PlaceControl(_controller.LeftPulseText.rectTransform, telemetryCard, new Vector2(14f, -92f), new Vector2(126f, 46f));

            _controller.RightPulseText = EnsureText("RightPulseText", telemetryCard, "Right ESC\n<size=22><b>1500</b></size> us", 12, FontStyle.Bold, TextPrimary);
            PlaceControl(_controller.RightPulseText.rectTransform, telemetryCard, new Vector2(158f, -92f), new Vector2(126f, 46f));

            StyleControlsIn(panel);
        }

        private void BuildLiveCard(RectTransform liveCard)
        {
            var liveHeading = EnsureText("LiveHeading", liveCard, "LIVE USV CONTROL", 11, FontStyle.Bold, WarmAccent);
            SetLocalRect(liveHeading.rectTransform, new Vector2(14f, -12f), new Vector2(160f, 18f));

            _controller.LiveModeToggle = EnsureToggleControl("LiveModeToggle", liveCard, "Wi-Fi motors");
            PlaceControl(_controller.LiveModeToggle.transform as RectTransform, liveCard, new Vector2(14f, -36f), new Vector2(130f, 28f));

            var networkLabel = EnsureText("NetworkLabel", liveCard, "ESP32 vessel link", 12, FontStyle.Bold, TextMuted);
            SetLocalRect(networkLabel.rectTransform, new Vector2(14f, -74f), new Vector2(160f, 18f));

            _controller.BoatHostInputField = EnsureInputField("BoatHostInputField", liveCard, "192.168.4.1");
            PlaceControl(_controller.BoatHostInputField.transform as RectTransform, liveCard, new Vector2(14f, -98f), new Vector2(146f, 34f));

            _controller.BoatPortInputField = EnsureInputField("BoatPortInputField", liveCard, "81");
            PlaceControl(_controller.BoatPortInputField.transform as RectTransform, liveCard, new Vector2(168f, -98f), new Vector2(54f, 34f));

            _controller.ConnectButton = EnsureButtonControl("ConnectButton", liveCard, "Connect");
            _controller.ConnectButtonText = _controller.ConnectButton.GetComponentInChildren<Text>(true);
            PlaceControl(_controller.ConnectButton.transform as RectTransform, liveCard, new Vector2(232f, -98f), new Vector2(82f, 34f));

            var tuningLabel = EnsureText("TuningLabel", liveCard, "Drive tuning", 12, FontStyle.Bold, TextMuted);
            SetLocalRect(tuningLabel.rectTransform, new Vector2(14f, -142f), new Vector2(160f, 18f));

            var deadzoneLabel = EnsureText("DeadzoneLabel", liveCard, "Deadzone", 11, FontStyle.Normal, TextMuted);
            SetLocalRect(deadzoneLabel.rectTransform, new Vector2(14f, -164f), new Vector2(80f, 16f));

            _controller.DeadzoneInputField = EnsureInputField("DeadzoneInputField", liveCard, "0.08");
            PlaceControl(_controller.DeadzoneInputField.transform as RectTransform, liveCard, new Vector2(14f, -184f), new Vector2(74f, 32f));

            var maxLabel = EnsureText("MaxOutputLabel", liveCard, "Max Output", 11, FontStyle.Normal, TextMuted);
            SetLocalRect(maxLabel.rectTransform, new Vector2(98f, -164f), new Vector2(80f, 16f));

            _controller.MaxOutputInputField = EnsureInputField("MaxOutputInputField", liveCard, "1.00");
            PlaceControl(_controller.MaxOutputInputField.transform as RectTransform, liveCard, new Vector2(98f, -184f), new Vector2(74f, 32f));

            _controller.ArmButton = EnsureButtonControl("ArmButton", liveCard, "Arm");
            _controller.ArmButtonText = _controller.ArmButton.GetComponentInChildren<Text>(true);
            PlaceControl(_controller.ArmButton.transform as RectTransform, liveCard, new Vector2(184f, -36f), new Vector2(58f, 32f));

            _controller.EStopButton = EnsureButtonControl("EStopButton", liveCard, "E-Stop");
            _controller.EStopButtonText = _controller.EStopButton.GetComponentInChildren<Text>(true);
            PlaceControl(_controller.EStopButton.transform as RectTransform, liveCard, new Vector2(252f, -36f), new Vector2(62f, 32f));

            _controller.ArmedIndicatorImage = EnsureIndicator("ArmedIndicator", liveCard, new Color(0.88f, 0.73f, 0.2f, 1f));
            PlaceControl(_controller.ArmedIndicatorImage.rectTransform, liveCard, new Vector2(184f, -184f), new Vector2(16f, 16f));

            _controller.ArmedIndicatorText = EnsureText("ArmedIndicatorText", liveCard, "SAFE", 12, FontStyle.Bold, TextPrimary);
            PlaceControl(_controller.ArmedIndicatorText.rectTransform, liveCard, new Vector2(208f, -186f), new Vector2(92f, 20f));

            var joystickLabel = EnsureText("JoystickLabel", liveCard, "Differential Drive", 12, FontStyle.Bold, TextMuted);
            SetLocalRect(joystickLabel.rectTransform, new Vector2(202f, -142f), new Vector2(96f, 18f));

            _controller.DriveJoystick = EnsureJoystickControl("DriveJoystick", liveCard);
            PlaceControl(_controller.DriveJoystick.transform as RectTransform, liveCard, new Vector2(208f, -160f), new Vector2(72f, 72f));
        }

        private void BuildBottomPanel(RectTransform panel)
        {
            var timelineLabel = EnsureText("TimelineHeading", panel, "Timeline", 18, FontStyle.Bold, TextPrimary);
            SetLocalRect(timelineLabel.rectTransform, new Vector2(20f, -16f), new Vector2(150f, 26f));

            var hintLabel = EnsureText("TimelineHint", panel, "Replay GPS-tagged samples, depth readings, and sensor layers.", 12, FontStyle.Normal, TextMuted);
            SetLocalRect(hintLabel.rectTransform, new Vector2(20f, -42f), new Vector2(360f, 20f));

            var scrubCard = CreateInsetBlock("ScrubCard", panel, new Vector2(168f, -30f), new Vector2(620f, 50f));

            if (_controller.TimeSlider != null)
                PlaceControl(_controller.TimeSlider.transform as RectTransform, scrubCard, new Vector2(16f, -15f), new Vector2(588f, 22f));

            if (_controller.PlayPauseText != null && _controller.PlayPauseButton != null)
            {
                _controller.PlayPauseText.transform.SetParent(_controller.PlayPauseButton.transform, false);
                _controller.PlayPauseText.rectTransform.anchorMin = Vector2.zero;
                _controller.PlayPauseText.rectTransform.anchorMax = Vector2.one;
                _controller.PlayPauseText.rectTransform.offsetMin = Vector2.zero;
                _controller.PlayPauseText.rectTransform.offsetMax = Vector2.zero;
                _controller.PlayPauseText.alignment = TextAnchor.MiddleCenter;
            }

            if (_controller.PlayPauseButton != null)
                PlaceControl(_controller.PlayPauseButton.transform as RectTransform, panel, new Vector2(812f, -30f), new Vector2(160f, 50f));

            if (_controller.TimeSlider != null)
            {
                var timeTexts = _controller.TimeSlider.GetComponentsInChildren<Text>(true);
                foreach (var timeText in timeTexts)
                {
                    timeText.color = TextMuted;
                    timeText.fontSize = Mathf.Min(timeText.fontSize, 11);
                }
            }

            StyleControlsIn(panel);
        }

        private void RefreshMissionDrivenPresentation()
        {
            StyleVisualizers();
            UpdateModeBadge();

            if (_heatmap == null || !_heatmap.TryGetComponent(out MeshFilter meshFilter) || meshFilter.sharedMesh == null)
                return;

            var worldBounds = TransformBounds(_heatmap.transform.localToWorldMatrix, meshFilter.sharedMesh.bounds);
            worldBounds.Expand(new Vector3(22f, 1f, 22f));

            if (_hasStageBounds && ApproximatelyEqual(worldBounds, _lastStageBounds))
                return;

            _lastStageBounds = worldBounds;
            _hasStageBounds = true;

            EnsureStageSurface(ref _waterPlane, "WaterPlane", BuildWaterMaterial(), worldBounds.center.y - 0.08f, 1.9f);
            EnsureStageSurface(ref _seabedPlane, "SeabedPlane", BuildSeabedMaterial(), worldBounds.center.y - 5.5f, 2.3f);
            FrameCamera(worldBounds);
        }

        private void UpdateModeBadge()
        {
            if (_modeBadge == null || _controller == null)
                return;

            if (_controller.OperationMode == AquaOperationMode.LiveControl)
            {
                _modeBadge.text = _controller.IsLiveConnected ? "LIVE LINK ACTIVE" : "LIVE LINK STANDBY";
                _modeBadge.color = _controller.IsLiveConnected ? GoodAccent : WarmAccent;
                return;
            }

            _modeBadge.text = "PLAYBACK READY";
            _modeBadge.color = GoodAccent;
        }

        private void EnsureStageSurface(ref GameObject plane, string name, Material material, float yPosition, float scaleMultiplier)
        {
            if (plane == null && _generatedRoot != null)
            {
                var existing = _generatedRoot.Find(name);
                if (existing != null)
                    plane = existing.gameObject;
            }

            if (plane == null)
            {
                plane = GameObject.CreatePrimitive(PrimitiveType.Plane);
                plane.name = name;
                plane.transform.SetParent(_generatedRoot, false);
                var collider = plane.GetComponent<Collider>();
                if (collider != null)
                {
                    if (Application.isPlaying)
                        Destroy(collider);
                    else
                        DestroyImmediate(collider);
                }
            }

            var width = Mathf.Max(60f, _lastStageBounds.size.x * scaleMultiplier);
            var depth = Mathf.Max(60f, _lastStageBounds.size.z * scaleMultiplier);
            plane.transform.position = new Vector3(_lastStageBounds.center.x, yPosition, _lastStageBounds.center.z);
            plane.transform.localScale = new Vector3(width / 10f, 1f, depth / 10f);

            var renderer = plane.GetComponent<MeshRenderer>();
            renderer.sharedMaterial = material;
            renderer.shadowCastingMode = UnityEngine.Rendering.ShadowCastingMode.Off;
            renderer.receiveShadows = name == "SeabedPlane";
        }

        private Material BuildWaterMaterial()
        {
            if (_waterMaterial != null)
                return _waterMaterial;

            var shader = Shader.Find("AQUAScan/RealisticWater_Pro") ?? Shader.Find("Universal Render Pipeline/Lit");
            _waterMaterial = new Material(shader);
            ApplyWaterTextures(_waterMaterial);

            if (_waterMaterial.HasProperty("_Surface"))
                _waterMaterial.SetFloat("_Surface", 1f);
            if (_waterMaterial.HasProperty("_Blend"))
                _waterMaterial.SetFloat("_Blend", 0f);
            if (_waterMaterial.HasProperty("_BaseColor"))
                _waterMaterial.SetColor("_BaseColor", new Color(0.05f, 0.18f, 0.28f, 0.94f));

            if (_waterMaterial.HasProperty("_ShallowColor"))
                _waterMaterial.SetColor("_ShallowColor", new Color(0.12f, 0.36f, 0.52f, 0.9f));
            if (_waterMaterial.HasProperty("_DeepColor"))
                _waterMaterial.SetColor("_DeepColor", new Color(0.01f, 0.045f, 0.095f, 0.98f));
            if (_waterMaterial.HasProperty("_FoamColor"))
                _waterMaterial.SetColor("_FoamColor", new Color(0.82f, 0.91f, 0.98f, 1f));
            if (_waterMaterial.HasProperty("_WaveScale"))
                _waterMaterial.SetFloat("_WaveScale", 0.24f);
            if (_waterMaterial.HasProperty("_WaveHeight"))
                _waterMaterial.SetFloat("_WaveHeight", 0.045f);
            if (_waterMaterial.HasProperty("_WaveSpeed"))
                _waterMaterial.SetFloat("_WaveSpeed", 0.46f);
            if (_waterMaterial.HasProperty("_Chop"))
                _waterMaterial.SetFloat("_Chop", 0.05f);
            if (_waterMaterial.HasProperty("_HeatmapIntensity"))
                _waterMaterial.SetFloat("_HeatmapIntensity", 0f);
            if (_waterMaterial.HasProperty("_Smoothness"))
                _waterMaterial.SetFloat("_Smoothness", 0.9f);
            if (_waterMaterial.HasProperty("_SpecularColor"))
                _waterMaterial.SetColor("_SpecularColor", new Color(0.88f, 0.94f, 1f, 1f));
            if (_waterMaterial.HasProperty("_FresnelPower"))
                _waterMaterial.SetFloat("_FresnelPower", 5.8f);
            if (_waterMaterial.HasProperty("_NormalStrength"))
                _waterMaterial.SetFloat("_NormalStrength", 1.3f);
            if (_waterMaterial.HasProperty("_NormalTilingA"))
                _waterMaterial.SetFloat("_NormalTilingA", 0.38f);
            if (_waterMaterial.HasProperty("_NormalTilingB"))
                _waterMaterial.SetFloat("_NormalTilingB", 0.78f);
            if (_waterMaterial.HasProperty("_NormalSpeedA"))
                _waterMaterial.SetVector("_NormalSpeedA", new Vector4(0.022f, 0.012f, 0f, 0f));
            if (_waterMaterial.HasProperty("_NormalSpeedB"))
                _waterMaterial.SetVector("_NormalSpeedB", new Vector4(-0.014f, 0.026f, 0f, 0f));
            if (_waterMaterial.HasProperty("_DepthDistance"))
                _waterMaterial.SetFloat("_DepthDistance", 18f);
            if (_waterMaterial.HasProperty("_Absorption"))
                _waterMaterial.SetFloat("_Absorption", 2.2f);
            if (_waterMaterial.HasProperty("_Scatter"))
                _waterMaterial.SetFloat("_Scatter", 0.16f);
            if (_waterMaterial.HasProperty("_RefractionStrength"))
                _waterMaterial.SetFloat("_RefractionStrength", 0.002f);
            if (_waterMaterial.HasProperty("_RefractionDepthFade"))
                _waterMaterial.SetFloat("_RefractionDepthFade", 0.12f);
            if (_waterMaterial.HasProperty("_FoamSize"))
                _waterMaterial.SetFloat("_FoamSize", 0.18f);
            if (_waterMaterial.HasProperty("_FoamCutoff"))
                _waterMaterial.SetFloat("_FoamCutoff", 0.97f);
            if (_waterMaterial.HasProperty("_FoamTiling"))
                _waterMaterial.SetFloat("_FoamTiling", 0.22f);
            if (_waterMaterial.HasProperty("_FoamSpeed"))
                _waterMaterial.SetVector("_FoamSpeed", new Vector4(0.003f, -0.002f, 0f, 0f));
            if (_waterMaterial.HasProperty("_CrestFoam"))
                _waterMaterial.SetFloat("_CrestFoam", 0.015f);
            if (_waterMaterial.HasProperty("_ReflectionTopColor"))
                _waterMaterial.SetColor("_ReflectionTopColor", new Color(0.24f, 0.4f, 0.56f, 1f));
            if (_waterMaterial.HasProperty("_ReflectionHorizonColor"))
                _waterMaterial.SetColor("_ReflectionHorizonColor", new Color(0.66f, 0.76f, 0.84f, 1f));
            if (_waterMaterial.HasProperty("_ReflectionStrength"))
                _waterMaterial.SetFloat("_ReflectionStrength", 0.78f);
            if (_waterMaterial.HasProperty("_CausticsStrength"))
                _waterMaterial.SetFloat("_CausticsStrength", 0f);
            if (_waterMaterial.HasProperty("_CausticsScale"))
                _waterMaterial.SetFloat("_CausticsScale", 1.2f);
            if (_waterMaterial.HasProperty("_CausticsSpeed"))
                _waterMaterial.SetFloat("_CausticsSpeed", 0.25f);

            return _waterMaterial;
        }

        private Material BuildSeabedMaterial()
        {
            if (_seabedMaterial != null)
                return _seabedMaterial;

            var shader = Shader.Find("Universal Render Pipeline/Lit") ?? Shader.Find("Standard");
            _seabedMaterial = new Material(shader);
            if (_seabedMaterial.HasProperty("_BaseColor"))
                _seabedMaterial.SetColor("_BaseColor", new Color(0.03f, 0.08f, 0.11f, 1f));
            if (_seabedMaterial.HasProperty("_Smoothness"))
                _seabedMaterial.SetFloat("_Smoothness", 0.04f);
            if (_seabedMaterial.HasProperty("_Metallic"))
                _seabedMaterial.SetFloat("_Metallic", 0f);
            return _seabedMaterial;
        }

        private void FrameCamera(Bounds bounds)
        {
            if (_mainCamera == null || _orbit == null || _controller?.TrackRenderer?.BoatMarker == null)
                return;

            var radius = Mathf.Max(bounds.extents.x, bounds.extents.z);
            _orbit.OrbitSpeed = 180f;
            _orbit.ZoomSpeed = 14f;
            _orbit.PitchMin = 16f;
            _orbit.PitchMax = 76f;
            _orbit.MinDistance = Mathf.Max(10f, radius * 0.42f);
            _orbit.MaxDistance = Mathf.Max(70f, radius * 3f);
            _orbit.Distance = Mathf.Clamp(radius * 1.2f, 18f, _orbit.MaxDistance);
            _orbit.TargetOffset = new Vector3(0f, 1.9f, 0f);

            if (_cameraFramed)
                return;

            _mainCamera.transform.position = bounds.center + new Vector3(radius * 0.72f, Mathf.Max(16f, radius * 0.62f), -radius * 0.96f);
            _mainCamera.transform.LookAt(_controller.TrackRenderer.BoatMarker.position + _orbit.TargetOffset);
            _cameraFramed = true;
        }

        private void StyleControlsIn(RectTransform root)
        {
            foreach (var text in root.GetComponentsInChildren<Text>(true))
            {
                if (text == null)
                    continue;

                if (text == _controller?.PlayPauseText)
                {
                    text.font = _font;
                    text.fontStyle = FontStyle.Bold;
                    text.fontSize = 18;
                    text.color = TextPrimary;
                    continue;
                }

                text.font = _font;
                text.color = TextPrimary;
                if (text.fontSize <= 12)
                    text.fontSize = 13;
            }

            foreach (var image in root.GetComponentsInChildren<Image>(true))
            {
                if (image == null)
                    continue;

                if (image.gameObject.name.Contains("Background"))
                {
                    image.color = FieldColor;
                    if (_inputSprite != null || _panelSprite != null)
                    {
                        image.sprite = _inputSprite != null ? _inputSprite : _panelSprite;
                        image.type = Image.Type.Sliced;
                    }
                }
            }

            StyleDropdown(_controller?.MetricDropdown);
            StyleButton(_controller?.PlayPauseButton);
            StyleButton(_controller?.LoadButton);
            StyleButton(_controller?.ConnectButton);
            StyleButton(_controller?.ArmButton);
            StyleDangerButton(_controller?.EStopButton);
            StyleSlider(_controller?.TimeSlider);
            StyleToggle(_controller?.TrackToggle);
            StyleToggle(_controller?.PointsToggle);
            StyleToggle(_controller?.HeatmapToggle);
            StyleToggle(_controller?.LiveModeToggle);
            StyleInput(_controller?.PathInputField);
            StyleInput(_controller?.BoatHostInputField);
            StyleInput(_controller?.BoatPortInputField);
            StyleInput(_controller?.DeadzoneInputField);
            StyleInput(_controller?.MaxOutputInputField);
            StyleTelemetry();
            StyleJoystick(_controller?.DriveJoystick);
            StyleLegendReadout();
        }

        private void StyleDropdown(Dropdown dropdown)
        {
            if (dropdown == null)
                return;

            if (dropdown.targetGraphic is Image image)
            {
                image.color = FieldColor;
                if (_panelSprite != null)
                {
                    image.sprite = _panelSprite;
                    image.type = Image.Type.Sliced;
                }
            }

            var colors = dropdown.colors;
            colors.normalColor = FieldColor;
            colors.highlightedColor = new Color(0.05f, 0.11f, 0.13f, 1f);
            colors.pressedColor = new Color(0.025f, 0.06f, 0.07f, 1f);
            colors.selectedColor = colors.highlightedColor;
            colors.disabledColor = new Color(0.2f, 0.24f, 0.25f, 0.55f);
            colors.colorMultiplier = 1f;
            dropdown.colors = colors;

            if (dropdown.captionText != null)
            {
                dropdown.captionText.color = TextPrimary;
                dropdown.captionText.font = _font;
                dropdown.captionText.fontSize = 15;
                dropdown.captionText.alignment = TextAnchor.MiddleLeft;
            }

            if (dropdown.itemText != null)
            {
                dropdown.itemText.color = TextPrimary;
                dropdown.itemText.font = _font;
                dropdown.itemText.fontSize = 14;
            }

            var arrow = dropdown.transform.Find("Arrow")?.GetComponent<Image>();
            if (arrow != null)
                arrow.color = AccentColor;

            if (dropdown.template != null)
            {
                var templateImage = dropdown.template.GetComponent<Image>();
                if (templateImage != null)
                {
                    templateImage.color = new Color(0.018f, 0.028f, 0.032f, 0.98f);
                    if (_panelSprite != null)
                    {
                        templateImage.sprite = _panelSprite;
                        templateImage.type = Image.Type.Sliced;
                    }
                }

                foreach (var itemImage in dropdown.template.GetComponentsInChildren<Image>(true))
                {
                    if (itemImage.gameObject.name.Contains("Item"))
                        itemImage.color = new Color(0.028f, 0.044f, 0.048f, 0.96f);
                }
            }
        }

        private void StyleButton(Button button)
        {
            if (button == null)
                return;

            var normalColor = button == _controller?.ArmButton ? GoodAccent : AccentColor;
            if (button == _controller?.LoadButton)
                normalColor = WarmAccent;
            var highlightedColor = new Color(
                Mathf.Min(normalColor.r + 0.12f, 1f),
                Mathf.Min(normalColor.g + 0.12f, 1f),
                Mathf.Min(normalColor.b + 0.12f, 1f),
                1f);
            var pressedColor = new Color(normalColor.r * 0.72f, normalColor.g * 0.72f, normalColor.b * 0.72f, 1f);

            Image image = button.targetGraphic as Image;
            if (image != null)
            {
                image.color = normalColor;
                ApplyRoundedSprite(image, _inputSprite);
            }

            var colors = button.colors;
            colors.normalColor = normalColor;
            colors.highlightedColor = highlightedColor;
            colors.pressedColor = pressedColor;
            colors.selectedColor = colors.highlightedColor;
            colors.disabledColor = new Color(0.22f, 0.36f, 0.42f, 0.5f);
            colors.colorMultiplier = 1f;
            button.colors = colors;

            var text = button.GetComponentInChildren<Text>(true);
            if (text != null)
            {
                text.color = TextPrimary;
                text.font = _font;
                text.fontStyle = FontStyle.Bold;
                text.fontSize = button == _controller?.ConnectButton || button == _controller?.EStopButton ? 13 : 15;
                text.alignment = TextAnchor.MiddleCenter;
            }

            if (image != null)
                AddSoftShadow(image);
        }

        private void StyleDangerButton(Button button)
        {
            if (button == null)
                return;

            if (button.targetGraphic is Image image)
            {
                image.color = new Color(0.76f, 0.16f, 0.16f, 1f);
                ApplyRoundedSprite(image, _inputSprite);
            }

            var colors = button.colors;
            colors.normalColor = new Color(0.76f, 0.16f, 0.16f, 1f);
            colors.highlightedColor = new Color(0.88f, 0.22f, 0.22f, 1f);
            colors.pressedColor = new Color(0.56f, 0.1f, 0.1f, 1f);
            colors.selectedColor = colors.highlightedColor;
            colors.disabledColor = new Color(0.32f, 0.16f, 0.16f, 0.5f);
            colors.colorMultiplier = 1f;
            button.colors = colors;

            var text = button.GetComponentInChildren<Text>(true);
            if (text != null)
            {
                text.color = TextPrimary;
                text.font = _font;
                text.fontStyle = FontStyle.Bold;
                text.fontSize = 16;
                text.alignment = TextAnchor.MiddleCenter;
            }
        }

        private void StyleSlider(Slider slider)
        {
            if (slider == null)
                return;

            if (slider.fillRect != null && slider.fillRect.TryGetComponent(out Image fillImage))
                fillImage.color = AccentColor;

            if (slider.targetGraphic is Image handleImage)
            {
                handleImage.color = TextPrimary;
                ApplyRoundedSprite(handleImage, _pillSprite);
                slider.handleRect.sizeDelta = new Vector2(20f, 24f);
            }

            var background = slider.transform.Find("Background")?.GetComponent<Image>();
            if (background != null)
                background.color = new Color(0.018f, 0.038f, 0.044f, 0.98f);

            var colors = slider.colors;
            colors.normalColor = TextPrimary;
            colors.highlightedColor = new Color(0.92f, 0.98f, 1f, 1f);
            colors.pressedColor = new Color(0.72f, 0.88f, 0.95f, 1f);
            colors.selectedColor = colors.highlightedColor;
            colors.colorMultiplier = 1f;
            slider.colors = colors;
        }

        private void StyleToggle(Toggle toggle)
        {
            if (toggle == null)
                return;

            var label = toggle.GetComponentInChildren<Text>(true);
            if (label != null)
            {
                label.color = TextPrimary;
                label.font = _font;
                label.fontSize = 13;
                label.fontStyle = FontStyle.Bold;
                label.alignment = TextAnchor.MiddleLeft;
                label.horizontalOverflow = HorizontalWrapMode.Overflow;
                label.verticalOverflow = VerticalWrapMode.Truncate;
                StretchChild(label.rectTransform, new Vector2(28f, 0f), Vector2.zero);
            }

            var background = toggle.transform.Find("Background")?.GetComponent<Image>();
            if (background != null)
            {
                SetLocalRect(background.rectTransform, new Vector2(0f, -4f), new Vector2(18f, 18f));
                background.color = new Color(0.02f, 0.05f, 0.058f, 1f);
                ApplyRoundedSprite(background, _inputSprite);
            }

            var checkmark = toggle.transform.Find("Background/Checkmark")?.GetComponent<Image>();
            if (checkmark != null)
            {
                SetLocalRect(checkmark.rectTransform, new Vector2(4f, -4f), new Vector2(10f, 10f));
                checkmark.color = AccentColor;
            }
        }

        private void StyleInput(InputField input)
        {
            if (input == null)
                return;

            if (input.targetGraphic is Image image)
            {
                image.color = FieldColor;
                if (_inputSprite != null || _panelSprite != null)
                {
                    image.sprite = _inputSprite != null ? _inputSprite : _panelSprite;
                    image.type = Image.Type.Sliced;
                }
            }

            if (input.placeholder is Text placeholder)
            {
                placeholder.font = _font;
                placeholder.fontSize = 13;
                placeholder.fontStyle = FontStyle.Italic;
                placeholder.color = new Color(TextMuted.r, TextMuted.g, TextMuted.b, 0.6f);
            }

            if (input.textComponent != null)
            {
                input.textComponent.font = _font;
                input.textComponent.fontSize = 14;
                input.textComponent.color = TextPrimary;
            }

            input.caretColor = AccentColor;
            input.selectionColor = new Color(AccentColor.r, AccentColor.g, AccentColor.b, 0.35f);
        }

        private void StyleLegendReadout()
        {
            if (_controller?.LegendGradient != null)
            {
                _controller.LegendGradient.color = new Color(1f, 1f, 1f, 0.92f);
                AddSoftShadow(_controller.LegendGradient);
            }

            if (_controller?.LegendLabel != null)
            {
                _controller.LegendLabel.fontStyle = FontStyle.Bold;
                _controller.LegendLabel.fontSize = 14;
                _controller.LegendLabel.alignment = TextAnchor.MiddleLeft;
            }

            if (_controller?.CurrentValueLabel != null)
            {
                _controller.CurrentValueLabel.fontStyle = FontStyle.Bold;
                _controller.CurrentValueLabel.fontSize = 14;
                _controller.CurrentValueLabel.alignment = TextAnchor.UpperLeft;
                _controller.CurrentValueLabel.horizontalOverflow = HorizontalWrapMode.Wrap;
                _controller.CurrentValueLabel.verticalOverflow = VerticalWrapMode.Truncate;
            }
        }

        private void StyleTelemetry()
        {
            if (_controller?.ConnectionStatusText != null)
            {
                _controller.ConnectionStatusText.fontSize = 13;
                _controller.ConnectionStatusText.alignment = TextAnchor.MiddleLeft;
            }

            if (_controller?.LeftPulseText != null)
            {
                _controller.LeftPulseText.fontStyle = FontStyle.Bold;
                _controller.LeftPulseText.alignment = TextAnchor.UpperLeft;
            }

            if (_controller?.RightPulseText != null)
            {
                _controller.RightPulseText.fontStyle = FontStyle.Bold;
                _controller.RightPulseText.alignment = TextAnchor.UpperLeft;
            }

            if (_controller?.ArmedIndicatorImage != null && _panelSprite != null)
            {
                ApplyRoundedSprite(_controller.ArmedIndicatorImage, _pillSprite);
            }
        }

        private void StyleJoystick(VirtualJoystick joystick)
        {
            if (joystick == null)
                return;

            if (joystick.TryGetComponent(out Image background))
            {
                background.color = new Color(0.018f, 0.048f, 0.062f, 0.98f);
                ApplyRoundedSprite(background, _pillSprite);
            }

            var handle = joystick.transform.Find("Handle")?.GetComponent<Image>();
            if (handle != null)
            {
                handle.color = new Color(0.18f, 0.82f, 0.94f, 0.95f);
                ApplyRoundedSprite(handle, _pillSprite);
            }
        }

        private void SetToggleLabel(Toggle toggle, string labelText)
        {
            var label = toggle != null ? toggle.GetComponentInChildren<Text>(true) : null;
            if (label != null)
                label.text = labelText;
        }

        private RectTransform CreatePanel(string name, RectTransform parent, Vector2 anchorMin, Vector2 anchorMax, Vector2 anchoredPosition, Vector2 size)
        {
            var rect = EnsurePanel(name, parent);
            var image = GetOrAddComponent<Image>(rect.gameObject);
            ApplyRoundedSprite(image, _panelSprite);
            image.color = PanelColor;
            AddSoftShadow(image, new Color(0f, 0f, 0f, 0.52f), new Vector2(0f, -5f));

            SetAnchoredRect(rect, anchorMin, anchorMax, anchoredPosition, size);

            var border = rect.Find("Border") as RectTransform;
            if (border == null)
            {
                border = new GameObject("Border", typeof(RectTransform), typeof(Image)).GetComponent<RectTransform>();
                border.SetParent(rect, false);
            }

            StretchToParent(border, 2f);
            var borderImage = border.GetComponent<Image>();
            ApplyRoundedSprite(borderImage, _panelSprite);
            borderImage.color = PanelBorder;
            borderImage.raycastTarget = false;
            border.SetAsFirstSibling();

            var wash = rect.Find("Wash") as RectTransform;
            if (wash == null)
            {
                wash = new GameObject("Wash", typeof(RectTransform), typeof(Image)).GetComponent<RectTransform>();
                wash.SetParent(rect, false);
            }

            StretchToParent(wash, 1f);
            var washImage = wash.GetComponent<Image>();
            ApplyRoundedSprite(washImage, _panelSprite);
            washImage.color = new Color(1f, 1f, 1f, 0.008f);
            washImage.raycastTarget = false;
            wash.SetSiblingIndex(1);

            var accent = rect.Find("Accent") as RectTransform;
            if (accent == null)
            {
                accent = new GameObject("Accent", typeof(RectTransform), typeof(Image)).GetComponent<RectTransform>();
                accent.SetParent(rect, false);
            }

            accent.anchorMin = new Vector2(0f, 1f);
            accent.anchorMax = new Vector2(1f, 1f);
            accent.pivot = new Vector2(0.5f, 1f);
            accent.anchoredPosition = new Vector2(0f, -1f);
            accent.sizeDelta = new Vector2(0f, 4f);
            var accentImage = accent.GetComponent<Image>();
            accentImage.color = PanelAccent;
            accentImage.raycastTarget = false;
            accent.SetSiblingIndex(2);

            return rect;
        }

        private RectTransform CreateInsetBlock(string name, RectTransform parent, Vector2 anchoredPosition, Vector2 size)
        {
            var rect = EnsurePanel(name, parent);
            var image = GetOrAddComponent<Image>(rect.gameObject);
            ApplyRoundedSprite(image, _panelSprite);
            image.color = InsetColor;
            SetLocalRect(rect, anchoredPosition, size);
            AddSoftShadow(image, new Color(0f, 0f, 0f, 0.42f), new Vector2(0f, -3f));

            var border = rect.Find("Border") as RectTransform;
            if (border == null)
            {
                border = new GameObject("Border", typeof(RectTransform), typeof(Image)).GetComponent<RectTransform>();
                border.SetParent(rect, false);
            }

            StretchToParent(border, 1f);
            var borderImage = border.GetComponent<Image>();
            ApplyRoundedSprite(borderImage, _panelSprite);
            borderImage.color = InsetBorder;
            borderImage.raycastTarget = false;
            border.SetAsFirstSibling();
            return rect;
        }

        private RectTransform EnsurePanel(string name, RectTransform parent)
        {
            var existing = parent.Find(name) as RectTransform;
            if (existing != null)
                return existing;

            var rect = new GameObject(name, typeof(RectTransform)).GetComponent<RectTransform>();
            rect.SetParent(parent, false);
            return rect;
        }

        private static void RemoveDirectChild(RectTransform parent, string childName)
        {
            var child = parent != null ? parent.Find(childName) : null;
            if (child == null)
                return;

            if (Application.isPlaying)
                Destroy(child.gameObject);
            else
                DestroyImmediate(child.gameObject);
        }

        private static void RemoveDirectChildImmediateSafe(RectTransform parent, string childName)
        {
            var child = parent != null ? parent.Find(childName) : null;
            if (child == null)
                return;

            DestroyImmediate(child.gameObject);
        }

        private static Sprite CreateRoundedSprite(string name, int radius)
        {
            var texture = new Texture2D(RoundedSpriteSize, RoundedSpriteSize, TextureFormat.RGBA32, false)
            {
                name = name,
                hideFlags = HideFlags.HideAndDontSave,
                filterMode = FilterMode.Bilinear,
                wrapMode = TextureWrapMode.Clamp
            };

            float r = Mathf.Clamp(radius, 1, RoundedSpriteSize / 2);
            float max = RoundedSpriteSize - 1;
            var pixels = new Color32[RoundedSpriteSize * RoundedSpriteSize];

            for (int y = 0; y < RoundedSpriteSize; y++)
            {
                for (int x = 0; x < RoundedSpriteSize; x++)
                {
                    float dx = Mathf.Max(r - x, 0f, x - (max - r));
                    float dy = Mathf.Max(r - y, 0f, y - (max - r));
                    float distance = Mathf.Sqrt(dx * dx + dy * dy);
                    float alpha = Mathf.Clamp01(r + 0.5f - distance);
                    pixels[y * RoundedSpriteSize + x] = new Color(1f, 1f, 1f, alpha);
                }
            }

            texture.SetPixels32(pixels);
            texture.Apply(false, true);

            float border = Mathf.Max(4f, radius);
            var sprite = Sprite.Create(
                texture,
                new Rect(0f, 0f, RoundedSpriteSize, RoundedSpriteSize),
                new Vector2(0.5f, 0.5f),
                100f,
                0,
                SpriteMeshType.FullRect,
                new Vector4(border, border, border, border));
            sprite.name = name;
            sprite.hideFlags = HideFlags.HideAndDontSave;
            return sprite;
        }

        private static void ApplyRoundedSprite(Image image, Sprite sprite)
        {
            if (image == null || sprite == null)
                return;

            image.sprite = sprite;
            image.type = Image.Type.Sliced;
            image.pixelsPerUnitMultiplier = 1f;
        }

        private Text EnsureText(string name, RectTransform parent, string value, int fontSize, FontStyle fontStyle, Color color)
        {
            var existing = parent.Find(name)?.GetComponent<Text>();
            if (existing != null)
            {
                existing.text = value;
                return existing;
            }

            var text = new GameObject(name, typeof(RectTransform), typeof(CanvasRenderer), typeof(Text)).GetComponent<Text>();
            text.transform.SetParent(parent, false);
            text.font = _font;
            text.text = value;
            text.fontSize = fontSize;
            text.fontStyle = fontStyle;
            text.color = color;
            text.alignment = TextAnchor.MiddleLeft;
            text.horizontalOverflow = HorizontalWrapMode.Wrap;
            text.verticalOverflow = VerticalWrapMode.Overflow;
            return text;
        }

        private InputField EnsureInputField(string name, RectTransform parent, string placeholderText)
        {
            var rect = EnsurePanel(name, parent);
            var image = GetOrAddComponent<Image>(rect.gameObject);
            var input = GetOrAddComponent<InputField>(rect.gameObject);
            input.targetGraphic = image;
            input.lineType = InputField.LineType.SingleLine;

            var text = EnsureText("Text", rect, string.Empty, 14, FontStyle.Normal, TextPrimary);
            text.alignment = TextAnchor.MiddleLeft;
            StretchChild(text.rectTransform, new Vector2(12f, 6f), new Vector2(-10f, -8f));

            var placeholder = EnsureText("Placeholder", rect, placeholderText, 13, FontStyle.Italic, new Color(TextMuted.r, TextMuted.g, TextMuted.b, 0.6f));
            placeholder.alignment = TextAnchor.MiddleLeft;
            StretchChild(placeholder.rectTransform, new Vector2(12f, 6f), new Vector2(-10f, -8f));

            input.textComponent = text;
            input.placeholder = placeholder;
            return input;
        }

        private Dropdown EnsureDropdownControl(string name, RectTransform parent)
        {
            var rect = EnsurePanel(name, parent);
            var image = GetOrAddComponent<Image>(rect.gameObject);
            ApplyRoundedSprite(image, _inputSprite);
            image.color = FieldColor;

            var dropdown = GetOrAddComponent<Dropdown>(rect.gameObject);
            dropdown.targetGraphic = image;

            var label = EnsureText("Label", rect, "Metric", 14, FontStyle.Bold, TextPrimary);
            label.alignment = TextAnchor.MiddleLeft;
            StretchChild(label.rectTransform, new Vector2(12f, 0f), new Vector2(-34f, 0f));
            dropdown.captionText = label;

            var arrow = EnsureText("Arrow", rect, "v", 14, FontStyle.Bold, AccentColor);
            arrow.alignment = TextAnchor.MiddleCenter;
            arrow.raycastTarget = false;
            arrow.rectTransform.anchorMin = new Vector2(1f, 0f);
            arrow.rectTransform.anchorMax = new Vector2(1f, 1f);
            arrow.rectTransform.pivot = new Vector2(1f, 0.5f);
            arrow.rectTransform.anchoredPosition = new Vector2(-8f, 0f);
            arrow.rectTransform.sizeDelta = new Vector2(24f, 0f);

            var template = EnsurePanel("Template", rect);
            var templateImage = GetOrAddComponent<Image>(template.gameObject);
            ApplyRoundedSprite(templateImage, _panelSprite);
            templateImage.color = new Color(0.018f, 0.028f, 0.032f, 0.98f);
            SetLocalRect(template, new Vector2(0f, -40f), new Vector2(300f, 180f));
            template.gameObject.SetActive(false);

            var viewport = EnsurePanel("Viewport", template);
            StretchToParent(viewport, 6f);
            var mask = GetOrAddComponent<Mask>(viewport.gameObject);
            mask.showMaskGraphic = false;
            var viewportImage = GetOrAddComponent<Image>(viewport.gameObject);
            viewportImage.color = Color.white;

            var content = EnsurePanel("Content", viewport);
            content.anchorMin = new Vector2(0f, 1f);
            content.anchorMax = new Vector2(1f, 1f);
            content.pivot = new Vector2(0.5f, 1f);
            content.anchoredPosition = Vector2.zero;
            content.sizeDelta = new Vector2(0f, 34f);

            var item = EnsurePanel("Item", content);
            item.anchorMin = new Vector2(0f, 1f);
            item.anchorMax = new Vector2(1f, 1f);
            item.pivot = new Vector2(0.5f, 1f);
            item.anchoredPosition = Vector2.zero;
            item.sizeDelta = new Vector2(0f, 32f);
            var itemToggle = GetOrAddComponent<Toggle>(item.gameObject);
            var itemBackground = GetOrAddComponent<Image>(item.gameObject);
            itemBackground.color = new Color(0.03f, 0.05f, 0.055f, 0.98f);
            itemToggle.targetGraphic = itemBackground;
            var itemLabel = EnsureText("Item Label", item, "Metric", 13, FontStyle.Normal, TextPrimary);
            itemLabel.alignment = TextAnchor.MiddleLeft;
            StretchChild(itemLabel.rectTransform, new Vector2(10f, 0f), new Vector2(-10f, 0f));
            dropdown.itemText = itemLabel;

            var scrollRect = GetOrAddComponent<ScrollRect>(template.gameObject);
            scrollRect.viewport = viewport;
            scrollRect.content = content;
            scrollRect.horizontal = false;
            scrollRect.vertical = true;
            scrollRect.movementType = ScrollRect.MovementType.Clamped;

            dropdown.template = template;
            return dropdown;
        }

        private Slider EnsureSliderControl(string name, RectTransform parent)
        {
            var rect = EnsurePanel(name, parent);
            var slider = GetOrAddComponent<Slider>(rect.gameObject);
            slider.minValue = 0f;
            slider.maxValue = 1f;

            var background = EnsurePanel("Background", rect);
            StretchChild(background, new Vector2(0f, 8f), new Vector2(0f, -8f));
            var backgroundImage = GetOrAddComponent<Image>(background.gameObject);
            ApplyRoundedSprite(backgroundImage, _inputSprite);
            backgroundImage.color = new Color(0.018f, 0.038f, 0.044f, 0.98f);

            var fillArea = EnsurePanel("Fill Area", rect);
            StretchChild(fillArea, new Vector2(8f, 8f), new Vector2(-8f, -8f));

            var fill = EnsurePanel("Fill", fillArea);
            StretchToParent(fill);
            var fillImage = GetOrAddComponent<Image>(fill.gameObject);
            ApplyRoundedSprite(fillImage, _inputSprite);
            fillImage.color = AccentColor;
            slider.fillRect = fill;

            var handleArea = EnsurePanel("Handle Slide Area", rect);
            StretchChild(handleArea, new Vector2(10f, 0f), new Vector2(-10f, 0f));

            var handle = EnsurePanel("Handle", handleArea);
            handle.anchorMin = new Vector2(0f, 0.5f);
            handle.anchorMax = new Vector2(0f, 0.5f);
            handle.pivot = new Vector2(0.5f, 0.5f);
            handle.anchoredPosition = Vector2.zero;
            handle.sizeDelta = new Vector2(20f, 24f);
            var handleImage = GetOrAddComponent<Image>(handle.gameObject);
            ApplyRoundedSprite(handleImage, _pillSprite);
            handleImage.color = TextPrimary;
            slider.targetGraphic = handleImage;
            slider.handleRect = handle;
            return slider;
        }

        private RawImage EnsureRawImageControl(string name, RectTransform parent)
        {
            var rect = EnsurePanel(name, parent);
            return GetOrAddComponent<RawImage>(rect.gameObject);
        }

        private Button EnsureButtonControl(string name, RectTransform parent, string label)
        {
            var rect = EnsurePanel(name, parent);
            var image = GetOrAddComponent<Image>(rect.gameObject);
            var button = GetOrAddComponent<Button>(rect.gameObject);
            button.targetGraphic = image;

            var text = EnsureText("Label", rect, label, 15, FontStyle.Bold, TextPrimary);
            text.alignment = TextAnchor.MiddleCenter;
            StretchToParent(text.rectTransform, 0f);
            return button;
        }

        private Toggle EnsureToggleControl(string name, RectTransform parent, string labelText)
        {
            var rect = EnsurePanel(name, parent);
            var toggle = GetOrAddComponent<Toggle>(rect.gameObject);

            var background = EnsurePanel("Background", rect);
            SetLocalRect(background, new Vector2(0f, 0f), new Vector2(22f, 22f));
            var backgroundImage = GetOrAddComponent<Image>(background.gameObject);

            var checkmark = EnsurePanel("Checkmark", background);
            SetLocalRect(checkmark, new Vector2(4f, -4f), new Vector2(14f, 14f));
            var checkmarkImage = GetOrAddComponent<Image>(checkmark.gameObject);

            var label = EnsureText("Label", rect, labelText, 15, FontStyle.Normal, TextPrimary);
            label.alignment = TextAnchor.MiddleLeft;
            StretchChild(label.rectTransform, new Vector2(34f, 0f), new Vector2(0f, 0f));

            toggle.targetGraphic = backgroundImage;
            toggle.graphic = checkmarkImage;
            return toggle;
        }

        private Image EnsureIndicator(string name, RectTransform parent, Color color)
        {
            var rect = EnsurePanel(name, parent);
            var image = GetOrAddComponent<Image>(rect.gameObject);
            image.color = color;
            return image;
        }

        private VirtualJoystick EnsureJoystickControl(string name, RectTransform parent)
        {
            var rect = EnsurePanel(name, parent);
            var image = GetOrAddComponent<Image>(rect.gameObject);
            image.raycastTarget = true;

            var handle = EnsurePanel("Handle", rect);
            handle.anchorMin = new Vector2(0.5f, 0.5f);
            handle.anchorMax = new Vector2(0.5f, 0.5f);
            handle.pivot = new Vector2(0.5f, 0.5f);
            handle.sizeDelta = new Vector2(36f, 36f);
            handle.anchoredPosition = Vector2.zero;
            var handleImage = GetOrAddComponent<Image>(handle.gameObject);
            // Let the root joystick surface receive pointer events even when the drag starts on the handle.
            handleImage.raycastTarget = false;

            var joystick = GetOrAddComponent<VirtualJoystick>(rect.gameObject);
            joystick.Configure(rect, handle);
            return joystick;
        }

        private void PlaceControl(RectTransform rect, RectTransform parent, Vector2 localPosition, Vector2 size)
        {
            if (rect == null)
                return;

            rect.SetParent(parent, false);
            rect.anchorMin = new Vector2(0f, 1f);
            rect.anchorMax = new Vector2(0f, 1f);
            rect.pivot = new Vector2(0f, 1f);
            rect.anchoredPosition = localPosition;
            rect.sizeDelta = size;
            rect.localScale = Vector3.one;
        }

        private static void StretchChild(RectTransform rect, Vector2 offsetMin, Vector2 offsetMax)
        {
            rect.anchorMin = Vector2.zero;
            rect.anchorMax = Vector2.one;
            rect.offsetMin = offsetMin;
            rect.offsetMax = offsetMax;
            rect.localScale = Vector3.one;
        }

        private void SetAnchoredRect(RectTransform rect, Vector2 anchorMin, Vector2 anchorMax, Vector2 anchoredPosition, Vector2 size)
        {
            rect.anchorMin = anchorMin;
            rect.anchorMax = anchorMax;
            rect.pivot = new Vector2(anchorMin.x == anchorMax.x ? anchorMin.x : 0.5f, anchorMin.y == anchorMax.y ? anchorMin.y : 0.5f);
            rect.anchoredPosition = anchoredPosition;
            rect.sizeDelta = size;
            rect.localScale = Vector3.one;
        }

        private void SetLocalRect(RectTransform rect, Vector2 anchoredPosition, Vector2 size)
        {
            rect.anchorMin = new Vector2(0f, 1f);
            rect.anchorMax = new Vector2(0f, 1f);
            rect.pivot = new Vector2(0f, 1f);
            rect.anchoredPosition = anchoredPosition;
            rect.sizeDelta = size;
            rect.localScale = Vector3.one;
        }

        private static void StretchToParent(RectTransform rect, float inset = 0f)
        {
            rect.anchorMin = Vector2.zero;
            rect.anchorMax = Vector2.one;
            rect.offsetMin = new Vector2(inset, inset);
            rect.offsetMax = new Vector2(-inset, -inset);
            rect.localScale = Vector3.one;
        }

        private void EnsureEventSystem()
        {
            if (FindObjectOfType<EventSystem>() != null)
                return;

            var eventSystem = new GameObject("EventSystem", typeof(EventSystem), typeof(StandaloneInputModule));
            eventSystem.transform.SetParent(_generatedRoot != null ? _generatedRoot : transform, false);
        }

        private void AddSoftShadow(Graphic graphic)
        {
            AddSoftShadow(graphic, new Color(0f, 0.12f, 0.18f, 0.24f), new Vector2(0f, -4f));
        }

        private void AddSoftShadow(Graphic graphic, Color effectColor, Vector2 effectDistance)
        {
            if (graphic == null)
                return;

            var shadow = GetOrAddComponent<Shadow>(graphic.gameObject);
            shadow.effectColor = effectColor;
            shadow.effectDistance = effectDistance;
            shadow.useGraphicAlpha = true;
        }

        private void ApplyWaterTextures(Material material)
        {
            if (material == null)
                return;

#if UNITY_EDITOR
            AssignTexture(material, "_NormalA", WaterNormalAPath);
            AssignTexture(material, "_NormalB", WaterNormalBPath);
            AssignTexture(material, "_FoamNoise", WaterFoamPath);
#endif
        }

#if UNITY_EDITOR
        private static void AssignTexture(Material material, string propertyName, string assetPath)
        {
            if (!material.HasProperty(propertyName))
                return;

            var texture = AssetDatabase.LoadAssetAtPath<Texture2D>(assetPath);
            if (texture != null)
                material.SetTexture(propertyName, texture);
        }
#endif

        private static T GetOrAddComponent<T>(GameObject gameObject) where T : Component
        {
            if (!gameObject.TryGetComponent(out T component))
                component = gameObject.AddComponent<T>();
            return component;
        }

        private static Bounds TransformBounds(Matrix4x4 matrix, Bounds bounds)
        {
            var center = matrix.MultiplyPoint3x4(bounds.center);
            var extents = bounds.extents;

            var axisX = matrix.MultiplyVector(new Vector3(extents.x, 0f, 0f));
            var axisY = matrix.MultiplyVector(new Vector3(0f, extents.y, 0f));
            var axisZ = matrix.MultiplyVector(new Vector3(0f, 0f, extents.z));

            extents.x = Mathf.Abs(axisX.x) + Mathf.Abs(axisY.x) + Mathf.Abs(axisZ.x);
            extents.y = Mathf.Abs(axisX.y) + Mathf.Abs(axisY.y) + Mathf.Abs(axisZ.y);
            extents.z = Mathf.Abs(axisX.z) + Mathf.Abs(axisY.z) + Mathf.Abs(axisZ.z);
            return new Bounds(center, extents * 2f);
        }

        private static bool ApproximatelyEqual(Bounds a, Bounds b)
        {
            return Vector3.SqrMagnitude(a.center - b.center) < 0.01f &&
                   Vector3.SqrMagnitude(a.size - b.size) < 0.25f;
        }
    }
}
