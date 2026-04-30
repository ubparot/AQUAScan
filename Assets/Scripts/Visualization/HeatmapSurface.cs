using System.Collections.Generic;
using AQUAScan.AquaData;
using AQUAScan.Config;
using UnityEngine;

namespace AQUAScan.Visualization
{
    [RequireComponent(typeof(MeshFilter), typeof(MeshRenderer))]
    public class HeatmapSurface : MonoBehaviour
    {
        [Header("Grid Settings")]
        public float CellSize = 2f;
        public float WorldSize = 500f;
        public float VerticalOffset = 0.05f;
        [Tooltip("When enabled, the heatmap grid auto-fits to the mission bounds with padding.")]
        public bool AutoFitBounds = true;

        [Header("Blending & Smoothing")]
        [Range(1f, 30f)]
        public float InfluenceRadius = 8f;
        [Range(0.01f, 5f)]
        [Tooltip("Higher values make the edges of the trail softer")]
        public float TrailSoftness = 1.0f;

        private MeshFilter _meshFilter;
        private MeshRenderer _meshRenderer;
        private MetricDescriptor _metricDescriptor;
        private bool _isVisible = true;

        private AquaMission _lastMission;
        private string _lastMetricId;
        private bool _needsRedraw = false;

        private void Awake()
        {
            EnsureComponents();
        }

        private void OnEnable()
        {
            EnsureComponents();
        }

        private void EnsureComponents()
        {
            if (_meshFilter == null)
                _meshFilter = GetComponent<MeshFilter>();
            if (_meshRenderer == null)
                _meshRenderer = GetComponent<MeshRenderer>();
        }

        public void ToggleVisibility(bool visible)
        {
            _isVisible = visible;
            if (_meshRenderer != null) _meshRenderer.enabled = visible;
        }

        private void OnValidate()
        {
            // Instead of generating here, we set a flag.
            _needsRedraw = true;
        }

        private void Update()
        {
            // Only redraw if a value changed and we have data.
            if (_needsRedraw && Application.isPlaying && _lastMission != null)
            {
                GenerateInternal(_lastMission, _lastMetricId);
                _needsRedraw = false;
            }
        }

        public void Generate(AquaMission mission, string metricId)
        {
            _lastMission = mission;
            _lastMetricId = metricId;
            GenerateInternal(mission, metricId);
        }

        private void GenerateInternal(AquaMission mission, string metricId)
        {
            if (mission == null || mission.IsEmpty) return;
            EnsureComponents();
            if (_meshFilter == null)
                return;

            _metricDescriptor = MetricRegistry.GetOrCreate(metricId);
            var worldToLocal = transform.worldToLocalMatrix;

            // Work in local space so the heatmap follows the GameObject transform (position/rotation).
            List<Vector3> sampleLocalPositions = new List<Vector3>(mission.Samples.Count);
            for (int i = 0; i < mission.Samples.Count; i++)
                sampleLocalPositions.Add(worldToLocal.MultiplyPoint3x4(mission.Samples[i].LocalPosition));

            Bounds dataBounds = ComputeBounds(sampleLocalPositions);
            float padding = Mathf.Max(CellSize, InfluenceRadius);

            Vector3 origin;
            int resX;
            int resZ;

            if (AutoFitBounds)
            {
                float sizeX = dataBounds.size.x + padding * 2f;
                float sizeZ = dataBounds.size.z + padding * 2f;

                origin = new Vector3(
                    Mathf.Floor((dataBounds.min.x - padding) / CellSize) * CellSize,
                    0f,
                    Mathf.Floor((dataBounds.min.z - padding) / CellSize) * CellSize);

                resX = Mathf.CeilToInt(sizeX / CellSize) + 1;
                resZ = Mathf.CeilToInt(sizeZ / CellSize) + 1;
            }
            else
            {
                origin = dataBounds.center - new Vector3(WorldSize / 2f, 0, WorldSize / 2f);
                origin.x = Mathf.Floor(origin.x / CellSize) * CellSize;
                origin.z = Mathf.Floor(origin.z / CellSize) * CellSize;

                resX = Mathf.CeilToInt(WorldSize / CellSize) + 1;
                resZ = Mathf.CeilToInt(WorldSize / CellSize) + 1;
            }

            float[] vertexValues = new float[resX * resZ];
            float[] vertexWeights = new float[resX * resZ];
            float radiusSq = InfluenceRadius * InfluenceRadius;

            // 1. DATA SPLATTING (Smoother Weighting)
            for (int sampleIndex = 0; sampleIndex < mission.Samples.Count; sampleIndex++)
            {
                var sample = mission.Samples[sampleIndex];
                if (!sample.TryGetMetric(metricId, out var val)) continue;

                Vector3 sampleLocal = sampleLocalPositions[sampleIndex];

                int minX = Mathf.Max(0, Mathf.FloorToInt((sampleLocal.x - origin.x - InfluenceRadius) / CellSize));
                int maxX = Mathf.Min(resX - 1, Mathf.CeilToInt((sampleLocal.x - origin.x + InfluenceRadius) / CellSize));
                int minZ = Mathf.Max(0, Mathf.FloorToInt((sampleLocal.z - origin.z - InfluenceRadius) / CellSize));
                int maxZ = Mathf.Min(resZ - 1, Mathf.CeilToInt((sampleLocal.z - origin.z + InfluenceRadius) / CellSize));

                for (int z = minZ; z <= maxZ; z++)
                {
                    for (int x = minX; x <= maxX; x++)
                    {
                        Vector3 vertexPos = new Vector3(origin.x + x * CellSize, 0, origin.z + z * CellSize);
                        float distSq = (new Vector2(sampleLocal.x - vertexPos.x, sampleLocal.z - vertexPos.z)).sqrMagnitude;

                        if (distSq < radiusSq)
                        {
                            float t = distSq / radiusSq;
                            float falloff = (1.0f - t) * (1.0f - t);

                            int idx = z * resX + x;
                            vertexValues[idx] += val * falloff;
                            vertexWeights[idx] += falloff;
                        }
                    }
                }
            }

            // 2. MESH GENERATION
            Vector3[] vertices = new Vector3[resX * resZ];
            Color[] colors = new Color[resX * resZ];
            List<int> triangles = new List<int>();

            for (int z = 0; z < resZ; z++)
            {
                for (int x = 0; x < resX; x++)
                {
                    int i = z * resX + x;
                    vertices[i] = new Vector3(origin.x + x * CellSize, dataBounds.center.y + VerticalOffset, origin.z + z * CellSize);

                    if (vertexWeights[i] > 0.001f)
                    {
                        float avg = vertexValues[i] / vertexWeights[i];
                        float t = Mathf.InverseLerp(_metricDescriptor.ExpectedRange.x, _metricDescriptor.ExpectedRange.y, avg);
                        colors[i] = _metricDescriptor.Gradient.Evaluate(t);

                        // Use TrailSoftness to divide the weight for a smoother fade.
                        colors[i].a = Mathf.Clamp01(vertexWeights[i] / TrailSoftness);
                    }
                    else
                    {
                        colors[i] = new Color(0, 0, 0, 0);
                    }

                    if (x < resX - 1 && z < resZ - 1)
                    {
                        int row = z * resX;
                        int nextRow = (z + 1) * resX;
                        triangles.Add(row + x); triangles.Add(nextRow + x); triangles.Add(row + x + 1);
                        triangles.Add(row + x + 1); triangles.Add(nextRow + x); triangles.Add(nextRow + x + 1);
                    }
                }
            }

            Mesh mesh = new Mesh { indexFormat = UnityEngine.Rendering.IndexFormat.UInt32 };
            mesh.vertices = vertices;
            mesh.colors = colors;
            mesh.triangles = triangles.ToArray();
            mesh.RecalculateNormals();

            _meshFilter.sharedMesh = mesh;
            if (_meshRenderer != null) _meshRenderer.enabled = _isVisible;
        }

        private Bounds ComputeBounds(List<Vector3> positions)
        {
            var b = new Bounds(positions[0], Vector3.zero);
            foreach (var p in positions) b.Encapsulate(p);
            return b;
        }
    }
}
