using System.Collections.Generic;
using AQUAScan.AquaData;
using AQUAScan.Config;
using UnityEngine;

namespace AQUAScan.Visualization
{
    [RequireComponent(typeof(MeshFilter))]
    [RequireComponent(typeof(MeshRenderer))]
    public class HeatmapSurface : MonoBehaviour
    {
        [Header("Grid Settings")]
        public float CellSize = 2f; // Smaller cell size looks better for waves
        public Vector2 MinWorldSize = new Vector2(200f, 200f); // Minimum size of the water plane
        public float VerticalOffset = 0.0f;

        [Header("Visuals")]
        public float MinAlpha = 0.35f;
        public float MaxAlpha = 0.9f;
        public float EdgeFeather = 10f; // Soften edges of the mesh

        [Tooltip("Color for water areas with no heatmap data")]
        public Color BaseWaterColor = new Color(0, 0, 0, 0);

        private MeshFilter _meshFilter;
        private MeshRenderer _meshRenderer;
        private MetricDescriptor _metricDescriptor;
        private string _metricId = "temperature";
        private float _min;
        private float _max;
        private bool _isVisible = true;
        private void Awake()
        {
            _meshFilter = GetComponent<MeshFilter>();
            _meshRenderer = GetComponent<MeshRenderer>();
        }

        /// <summary>
        /// Toggles the visibility of the heatmap mesh.
        /// </summary>
        /// <param name="visible">True to show, False to hide.</param>
        public void ToggleVisibility(bool visible)
        {
            _isVisible = visible;

            // Option A: Disable the GameObject entirely 
            // (Best for performance if no other logic is on this object)
            gameObject.SetActive(visible);

            // Option B: Only disable the Renderer
            // (Best if you want the script to keep processing data while hidden)
            // if (_meshRenderer != null) _meshRenderer.enabled = visible;
        }

        /// <summary>
        /// A simple overload to switch state without needing to know current state.
        /// Useful for UI Buttons.
        /// </summary>
        public void ToggleVisibility()
        {
            ToggleVisibility(!_isVisible);
        }

        [Header("Expansion Settings")]
        public float WorldSize = 500f; // Total width/length of the water surface
        public Color EmptyCellColor = new Color(0, 0, 0, 0); // Transparent for non-data areas

        public void Generate(AquaMission mission, string metricId)
        {
            if (mission == null || mission.IsEmpty)
                return;

            _metricId = metricId.ToLowerInvariant();
            _metricDescriptor = MetricRegistry.GetOrCreate(metricId);
            _min = _metricDescriptor.ExpectedRange.x;
            _max = _metricDescriptor.ExpectedRange.y;

            // 1. Calculate the center of the mission data
            Bounds dataBounds = ComputeBounds(mission.Samples);

            // 2. Define a fixed grid based on WorldSize centered on the data
            // This ensures the water surface stays large regardless of boat movement
            Vector3 origin = dataBounds.center - new Vector3(WorldSize / 2f, 0, WorldSize / 2f);
            int cellsX = Mathf.Max(1, Mathf.CeilToInt(WorldSize / CellSize));
            int cellsZ = Mathf.Max(1, Mathf.CeilToInt(WorldSize / CellSize));

            // 3. Map mission samples to the grid for quick lookup
            var sums = new Dictionary<Vector2Int, float>();
            var counts = new Dictionary<Vector2Int, int>();
            foreach (var sample in mission.Samples)
            {
                if (!sample.TryGetMetric(_metricId, out var value))
                    continue;

                int gx = Mathf.FloorToInt((sample.LocalPosition.x - origin.x) / CellSize);
                int gz = Mathf.FloorToInt((sample.LocalPosition.z - origin.z) / CellSize);

                // Only map if within our generated world bounds
                if (gx >= 0 && gx < cellsX && gz >= 0 && gz < cellsZ)
                {
                    Vector2Int key = new Vector2Int(gx, gz);
                    if (!sums.ContainsKey(key)) { sums[key] = 0; counts[key] = 0; }
                    sums[key] += value;
                    counts[key] += 1;
                }
            }

            var vertices = new List<Vector3>();
            var colors = new List<Color>();
            var triangles = new List<int>();

            // 4. Generate the full grid mesh
            for (int x = 0; x < cellsX; x++)
            {
                for (int z = 0; z < cellsZ; z++)
                {
                    Vector2Int key = new Vector2Int(x, z);
                    bool hasData = counts.ContainsKey(key);

                    float avg = hasData ? sums[key] / counts[key] : 0f;
                    Color color = hasData ? EvaluateColor(avg) : EmptyCellColor;

                    float x0 = origin.x + x * CellSize;
                    float x1 = x0 + CellSize;
                    float z0 = origin.z + z * CellSize;
                    float z1 = z0 + CellSize;
                    float y = dataBounds.center.y + VerticalOffset;

                    // Global Mesh Edge Feathering (Fades the far edges of the 500m plane)
                    if (EdgeFeather > 0.0001f)
                    {
                        float dx = Mathf.Min(x, cellsX - x) * CellSize;
                        float dz = Mathf.Min(z, cellsZ - z) * CellSize;
                        float fade = Mathf.Clamp01(Mathf.Min(dx, dz) / EdgeFeather);
                        color.a *= fade;
                    }

                    int vertStart = vertices.Count;
                    vertices.Add(new Vector3(x0, y, z0));
                    vertices.Add(new Vector3(x1, y, z0));
                    vertices.Add(new Vector3(x0, y, z1));
                    vertices.Add(new Vector3(x1, y, z1));

                    for (int i = 0; i < 4; i++) colors.Add(color);

                    triangles.Add(vertStart + 0);
                    triangles.Add(vertStart + 2);
                    triangles.Add(vertStart + 1);
                    triangles.Add(vertStart + 1);
                    triangles.Add(vertStart + 2);
                    triangles.Add(vertStart + 3);
                }
            }

            Mesh mesh = new Mesh
            {
                indexFormat = vertices.Count > 65535 ? UnityEngine.Rendering.IndexFormat.UInt32 : UnityEngine.Rendering.IndexFormat.UInt16
            };
            mesh.SetVertices(vertices);
            mesh.SetTriangles(triangles, 0);
            mesh.SetColors(colors);
            mesh.RecalculateNormals();

            _meshFilter.sharedMesh = mesh;
        }

        private Bounds ComputeBounds(List<AquaSample> samples)
        {
            if (samples.Count == 0) return new Bounds(Vector3.zero, Vector3.zero);
            var b = new Bounds(samples[0].LocalPosition, Vector3.zero);
            foreach (var s in samples) b.Encapsulate(s.LocalPosition);
            return b;
        }

        private Color EvaluateColor(float value)
        {
            float t = Mathf.InverseLerp(_min, _max, value);
            var c = _metricDescriptor.Gradient.Evaluate(t);

            // IMPORTANT: alpha is a DATA MASK, not transparency.
            // 1 = data exists, 0 = no data.
            c.a = 1f;

            return c;
        }

    }
}