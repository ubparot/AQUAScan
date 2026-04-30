using System.Collections.Generic;
using AQUAScan.AquaData;
using UnityEngine;

namespace AQUAScan.Visualization
{
    /// <summary>
    /// Draws the mission track and animates a boat marker along it.
    /// </summary>
    [RequireComponent(typeof(LineRenderer))]
    public class BoatTrackRenderer : MonoBehaviour
    {
        public Transform BoatMarker;
        public float BoatHeightOffset = 0.2f;
        [Tooltip("Use this if your boat model's forward axis is rotated (e.g. model points left/right).")]
        public float BoatYawOffsetDeg = 90f;
        [Tooltip("Optional transform to place the track in a specific space (e.g., HeatmapSurface transform).")]
        public Transform ReferenceSpace;

        [Header("Deployable Probe Visualization")]
        public bool ShowProbeTether = true;
        [Tooltip("World units used per meter of probe depth.")]
        public float ProbeDepthScale = 1.25f;
        public float ProbeMinVisibleDepth = 0.7f;
        public float ProbeMaxVisibleDepth = 7.5f;
        public Vector3 TetherBoatOffset = new Vector3(0f, -0.12f, 0f);

        private LineRenderer _lineRenderer;
        private List<AquaSample> _samples;
        private Dictionary<AquaSample, int> _sampleIndexLookup;
        private LineRenderer _tetherLine;
        private Transform _probeBody;
        private Transform _probeGlow;
        private readonly LineRenderer[] _depthRings = new LineRenderer[3];
        private Material _tetherMaterial;
        private Material _probeMaterial;
        private Material _probeGlowMaterial;

        private void Awake()
        {
            EnsureLineRenderer();
        }

        private void OnEnable()
        {
            EnsureLineRenderer();
        }

        private void EnsureLineRenderer()
        {
            if (_lineRenderer == null)
                _lineRenderer = GetComponent<LineRenderer>();
            if (_lineRenderer != null)
                _lineRenderer.useWorldSpace = true;

            EnsureProbeVisuals();
        }

        public void RenderTrack(AquaMission mission)
        {
            EnsureLineRenderer();
            if (_lineRenderer == null || mission == null)
                return;

            _samples = mission.Samples;
            _sampleIndexLookup = new Dictionary<AquaSample, int>(_samples.Count);
            _lineRenderer.positionCount = _samples.Count;
            for (int i = 0; i < _samples.Count; i++)
            {
                _sampleIndexLookup[_samples[i]] = i;
                _lineRenderer.SetPosition(i, ToWorld(_samples[i].LocalPosition));
            }

            if (_samples.Count >= 2)
                UpdateBoatPosition(_samples[0], _samples[1], 0f);
            else
                SetProbeVisible(false);
        }

        public void ToggleVisibility(bool visible)
        {
            EnsureLineRenderer();
            if (_lineRenderer != null)
                _lineRenderer.enabled = visible;
            if (BoatMarker != null)
                BoatMarker.gameObject.SetActive(visible);
            SetProbeVisible(visible && ShowProbeTether);
        }

        /// <summary>
        /// Update boat marker position along the track (0..1).
        /// </summary>
        public void UpdateBoatPosition(AquaSample from, AquaSample to, float tLerp)
        {
            if (BoatMarker == null || _samples == null || _samples.Count == 0)
                return;

            var fromWorld = ToWorld(from.LocalPosition);
            var toWorld = ToWorld(to.LocalPosition);

            var pos = Vector3.Lerp(fromWorld, toWorld, tLerp);
            pos.y += BoatHeightOffset;
            BoatMarker.position = pos;

            Vector3 pathDir = Vector3.zero;
            if (_sampleIndexLookup != null && _sampleIndexLookup.TryGetValue(from, out int idx))
            {
                var prev = idx > 0 ? _samples[idx - 1].LocalPosition : from.LocalPosition;
                var next = idx + 1 < _samples.Count ? _samples[idx + 1].LocalPosition : to.LocalPosition;
                prev = ToWorld(prev);
                next = ToWorld(next);
                pathDir = next - prev;
            }

            if (pathDir.sqrMagnitude < 0.0001f)
                pathDir = toWorld - fromWorld;

            if (pathDir.sqrMagnitude > 0.0001f)
            {
                var flatDir = new Vector3(pathDir.x, 0f, pathDir.z).normalized;
                var rot = Quaternion.LookRotation(flatDir, Vector3.up);
                BoatMarker.rotation = rot * Quaternion.Euler(0f, BoatYawOffsetDeg, 0f);
            }
            else if (from.HeadingDeg.HasValue)
            {
                var rot = Quaternion.Euler(0f, -from.HeadingDeg.Value, 0f);
                BoatMarker.rotation = rot * Quaternion.Euler(0f, BoatYawOffsetDeg, 0f);
            }

            UpdateProbeTether(from, to, tLerp, pos);
        }

        private Vector3 ToWorld(Vector3 missionLocal)
        {
            if (ReferenceSpace != null)
                return ReferenceSpace.TransformPoint(missionLocal);
            return missionLocal;
        }

        private void EnsureProbeVisuals()
        {
            if (!ShowProbeTether)
                return;

            if (_tetherMaterial == null)
                _tetherMaterial = BuildUnlitMaterial(new Color(0.35f, 0.95f, 1f, 0.9f));
            if (_probeMaterial == null)
                _probeMaterial = BuildUnlitMaterial(new Color(0.92f, 0.96f, 0.98f, 1f));
            if (_probeGlowMaterial == null)
                _probeGlowMaterial = BuildUnlitMaterial(new Color(0.1f, 0.85f, 1f, 0.9f));

            if (_tetherLine == null)
            {
                var tetherGo = new GameObject("AquaScan Probe Tether");
                tetherGo.transform.SetParent(transform, false);
                _tetherLine = tetherGo.AddComponent<LineRenderer>();
                _tetherLine.useWorldSpace = true;
                _tetherLine.positionCount = 2;
                _tetherLine.widthCurve = AnimationCurve.Constant(0f, 1f, 0.055f);
                _tetherLine.numCapVertices = 8;
                _tetherLine.sharedMaterial = _tetherMaterial;
                _tetherLine.shadowCastingMode = UnityEngine.Rendering.ShadowCastingMode.Off;
                _tetherLine.receiveShadows = false;
            }

            if (_probeBody == null)
            {
                var probe = GameObject.CreatePrimitive(PrimitiveType.Capsule);
                probe.name = "AquaScan Depth Probe";
                probe.transform.SetParent(transform, false);
                probe.transform.localScale = new Vector3(0.22f, 0.55f, 0.22f);
                if (probe.TryGetComponent(out Collider collider))
                    DestroyRuntimeAware(collider);
                if (probe.TryGetComponent(out MeshRenderer renderer))
                    renderer.sharedMaterial = _probeMaterial;
                _probeBody = probe.transform;
            }

            if (_probeGlow == null)
            {
                var glow = GameObject.CreatePrimitive(PrimitiveType.Sphere);
                glow.name = "AquaScan Probe Sensor Glow";
                glow.transform.SetParent(transform, false);
                glow.transform.localScale = new Vector3(0.36f, 0.36f, 0.36f);
                if (glow.TryGetComponent(out Collider collider))
                    DestroyRuntimeAware(collider);
                if (glow.TryGetComponent(out MeshRenderer renderer))
                    renderer.sharedMaterial = _probeGlowMaterial;
                _probeGlow = glow.transform;
            }

            for (int i = 0; i < _depthRings.Length; i++)
            {
                if (_depthRings[i] != null)
                    continue;

                var ringGo = new GameObject($"AquaScan Depth Ring {i + 1}");
                ringGo.transform.SetParent(transform, false);
                var ring = ringGo.AddComponent<LineRenderer>();
                ring.useWorldSpace = true;
                ring.loop = true;
                ring.positionCount = 48;
                ring.widthCurve = AnimationCurve.Constant(0f, 1f, 0.025f);
                ring.numCapVertices = 4;
                ring.sharedMaterial = _tetherMaterial;
                ring.shadowCastingMode = UnityEngine.Rendering.ShadowCastingMode.Off;
                ring.receiveShadows = false;
                _depthRings[i] = ring;
            }
        }

        private void UpdateProbeTether(AquaSample from, AquaSample to, float tLerp, Vector3 boatPosition)
        {
            EnsureProbeVisuals();
            if (!ShowProbeTether || _tetherLine == null || _probeBody == null)
            {
                SetProbeVisible(false);
                return;
            }

            float depth = InterpolateDepth(from, to, tLerp);
            float visibleDepth = Mathf.Clamp(depth * Mathf.Max(0.01f, ProbeDepthScale), ProbeMinVisibleDepth, ProbeMaxVisibleDepth);
            var top = boatPosition + TetherBoatOffset;
            var bottom = top + Vector3.down * visibleDepth;

            SetProbeVisible(true);
            _tetherLine.SetPosition(0, top);
            _tetherLine.SetPosition(1, bottom);

            _probeBody.position = bottom + Vector3.down * 0.28f;
            _probeBody.rotation = Quaternion.identity;

            if (_probeGlow != null)
                _probeGlow.position = bottom + Vector3.down * 0.58f;

            UpdateDepthRings(top, visibleDepth);
        }

        private float InterpolateDepth(AquaSample from, AquaSample to, float tLerp)
        {
            bool hasFrom = TryResolveDepth(from, out float fromDepth);
            bool hasTo = TryResolveDepth(to, out float toDepth);
            if (hasFrom && hasTo)
                return Mathf.Lerp(fromDepth, toDepth, tLerp);
            if (hasFrom)
                return fromDepth;
            if (hasTo)
                return toDepth;
            return 1.2f;
        }

        private static bool TryResolveDepth(AquaSample sample, out float depth)
        {
            depth = 0f;
            if (sample == null)
                return false;
            if (sample.DepthMeters.HasValue)
            {
                depth = sample.DepthMeters.Value;
                return true;
            }
            return sample.TryGetMetric("depth", out depth);
        }

        private void UpdateDepthRings(Vector3 top, float visibleDepth)
        {
            for (int i = 0; i < _depthRings.Length; i++)
            {
                var ring = _depthRings[i];
                if (ring == null)
                    continue;

                float normalized = (i + 1f) / (_depthRings.Length + 1f);
                float y = visibleDepth * normalized;
                float radius = Mathf.Lerp(0.34f, 0.58f, normalized);
                var center = top + Vector3.down * y;
                WriteCircle(ring, center, radius);
            }
        }

        private static void WriteCircle(LineRenderer ring, Vector3 center, float radius)
        {
            int count = ring.positionCount;
            for (int i = 0; i < count; i++)
            {
                float angle = (i / (float)count) * Mathf.PI * 2f;
                ring.SetPosition(i, center + new Vector3(Mathf.Cos(angle) * radius, 0f, Mathf.Sin(angle) * radius));
            }
        }

        private void SetProbeVisible(bool visible)
        {
            if (_tetherLine != null)
                _tetherLine.enabled = visible;
            if (_probeBody != null)
                _probeBody.gameObject.SetActive(visible);
            if (_probeGlow != null)
                _probeGlow.gameObject.SetActive(visible);
            for (int i = 0; i < _depthRings.Length; i++)
            {
                if (_depthRings[i] != null)
                    _depthRings[i].enabled = visible;
            }
        }

        private static Material BuildUnlitMaterial(Color color)
        {
            var shader = Shader.Find("Universal Render Pipeline/Unlit") ?? Shader.Find("Sprites/Default") ?? Shader.Find("Unlit/Color");
            var material = new Material(shader);
            if (material.HasProperty("_BaseColor"))
                material.SetColor("_BaseColor", color);
            if (material.HasProperty("_Color"))
                material.SetColor("_Color", color);
            return material;
        }

        private static void DestroyRuntimeAware(Object obj)
        {
            if (obj == null)
                return;
            if (Application.isPlaying)
                Destroy(obj);
            else
                DestroyImmediate(obj);
        }
    }
}
