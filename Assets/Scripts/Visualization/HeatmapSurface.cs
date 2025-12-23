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
        public float CellSize = 2f;
        public Vector2 MinWorldSize = new Vector2(200f, 200f);
        public float VerticalOffset = 0.0f;

        [Header("Visuals")]
        public float MinAlpha = 0.35f;
        public float MaxAlpha = 0.9f;
        public float EdgeFeather = 25f; // Increased for better edge fading

        [Tooltip("Color for water areas with no heatmap data")]
        public Color BaseWaterColor = new Color(0, 0, 0, 0);

        [Header("Expansion Settings")]
        public float WorldSize = 500f;
        public Color EmptyCellColor = new Color(0, 0, 0, 0);

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

        public void ToggleVisibility(bool visible)
        {
            _isVisible = visible;
            if (_meshRenderer != null) _meshRenderer.enabled = visible;
        }

        public void ToggleVisibility()
        {
            ToggleVisibility(!_isVisible);
        }

        public void Generate(AquaMission mission, string metricId)
        {
            if (mission == null || mission.IsEmpty) return;
            if (!_isVisible) return; // Optimization

            _metricId = metricId.ToLowerInvariant();
            _metricDescriptor = MetricRegistry.GetOrCreate(metricId);
            _min = _metricDescriptor.ExpectedRange.x;
            _max = _metricDescriptor.ExpectedRange.y;

            Bounds dataBounds = ComputeBounds(mission.Samples);
            Vector3 origin = dataBounds.center - new Vector3(WorldSize / 2f, 0, WorldSize / 2f);

            // Ensure grid aligns to cell size to prevent jitter
            origin.x = Mathf.Floor(origin.x / CellSize) * CellSize;
            origin.z = Mathf.Floor(origin.z / CellSize) * CellSize;

            int cellsX = Mathf.Max(1, Mathf.CeilToInt(WorldSize / CellSize));
            int cellsZ = Mathf.Max(1, Mathf.CeilToInt(WorldSize / CellSize));

            // 1. Map Data
            var sums = new Dictionary<Vector2Int, float>();
            var counts = new Dictionary<Vector2Int, int>();

            foreach (var sample in mission.Samples)
            {
                if (!sample.TryGetMetric(_metricId, out var value)) continue;

                int gx = Mathf.FloorToInt((sample.LocalPosition.x - origin.x) / CellSize);
                int gz = Mathf.FloorToInt((sample.LocalPosition.z - origin.z) / CellSize);

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

            // 2. Build Mesh with Neighbor Blending
            for (int x = 0; x < cellsX; x++)
            {
                for (int z = 0; z < cellsZ; z++)
                {
                    Vector2Int key = new Vector2Int(x, z);
                    bool hasData = counts.ContainsKey(key);

                    // Check Neighbors to create soft edges
                    bool leftEmpty = !counts.ContainsKey(new Vector2Int(x - 1, z));
                    bool rightEmpty = !counts.ContainsKey(new Vector2Int(x + 1, z));
                    bool downEmpty = !counts.ContainsKey(new Vector2Int(x, z - 1));
                    bool upEmpty = !counts.ContainsKey(new Vector2Int(x, z + 1));

                    float avg = hasData ? sums[key] / counts[key] : 0f;
                    Color baseColor = hasData ? EvaluateColor(avg) : EmptyCellColor;

                    // If this cell is empty, we just add transparent verts
                    if (!hasData)
                    {
                        AddQuad(vertices, colors, triangles, x, z, origin, dataBounds.center.y, EmptyCellColor, EmptyCellColor, EmptyCellColor, EmptyCellColor, cellsX, cellsZ);
                        continue;
                    }

                    // If this cell HAS data, calculate alpha for each corner based on neighbors
                    // BL, BR, TL, TR
                    Color cBL = baseColor;
                    Color cBR = baseColor;
                    Color cTL = baseColor;
                    Color cTR = baseColor;

                    // Fade edges if neighbor is missing
                    if (leftEmpty) { cBL.a = 0; cTL.a = 0; }
                    if (rightEmpty) { cBR.a = 0; cTR.a = 0; }
                    if (downEmpty) { cBL.a = 0; cBR.a = 0; }
                    if (upEmpty) { cTL.a = 0; cTR.a = 0; }

                    // Also handle global edge feathering (distance from center of world)
                    ApplyGlobalFeather(ref cBL, x, z, cellsX, cellsZ);
                    ApplyGlobalFeather(ref cBR, x + 1, z, cellsX, cellsZ);
                    ApplyGlobalFeather(ref cTL, x, z + 1, cellsX, cellsZ);
                    ApplyGlobalFeather(ref cTR, x + 1, z + 1, cellsX, cellsZ);

                    AddQuad(vertices, colors, triangles, x, z, origin, dataBounds.center.y, cBL, cBR, cTL, cTR, cellsX, cellsZ);
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

        private void AddQuad(List<Vector3> verts, List<Color> cols, List<int> tris, int x, int z, Vector3 origin, float yCenter, Color cBL, Color cBR, Color cTL, Color cTR, int maxX, int maxZ)
        {
            float x0 = origin.x + x * CellSize;
            float x1 = x0 + CellSize;
            float z0 = origin.z + z * CellSize;
            float z1 = z0 + CellSize;
            float y = yCenter + VerticalOffset;

            int vStart = verts.Count;

            verts.Add(new Vector3(x0, y, z0)); // 0: Bottom-Left
            verts.Add(new Vector3(x1, y, z0)); // 1: Bottom-Right
            verts.Add(new Vector3(x0, y, z1)); // 2: Top-Left
            verts.Add(new Vector3(x1, y, z1)); // 3: Top-Right

            cols.Add(cBL);
            cols.Add(cBR);
            cols.Add(cTL);
            cols.Add(cTR);

            tris.Add(vStart + 0);
            tris.Add(vStart + 2);
            tris.Add(vStart + 1);
            tris.Add(vStart + 1);
            tris.Add(vStart + 2);
            tris.Add(vStart + 3);
        }

        private void ApplyGlobalFeather(ref Color c, float x, float z, float width, float height)
        {
            if (EdgeFeather <= 0.0001f) return;
            float dx = Mathf.Min(x, width - x) * CellSize;
            float dz = Mathf.Min(z, height - z) * CellSize;
            float fade = Mathf.Clamp01(Mathf.Min(dx, dz) / EdgeFeather);
            c.a *= fade;
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
            Color c = _metricDescriptor.Gradient.Evaluate(t);

            // We set alpha to 1.0 here. 
            // This tells the shader: "THIS PIXEL HAS DATA."
            // The shader then uses this 1.0 to decide to show the tint.
            c.a = 1f;

            return c;
        }
    }
}