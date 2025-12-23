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

        private LineRenderer _lineRenderer;
        private List<AquaSample> _samples;
        private Dictionary<AquaSample, int> _sampleIndexLookup;

        private void Awake()
        {
            _lineRenderer = GetComponent<LineRenderer>();
            _lineRenderer.useWorldSpace = true;
        }

        public void RenderTrack(AquaMission mission)
        {
            _samples = mission.Samples;
            _sampleIndexLookup = new Dictionary<AquaSample, int>(_samples.Count);
            _lineRenderer.positionCount = _samples.Count;
            for (int i = 0; i < _samples.Count; i++)
            {
                _sampleIndexLookup[_samples[i]] = i;
                _lineRenderer.SetPosition(i, _samples[i].LocalPosition);
            }
        }

        public void ToggleVisibility(bool visible)
        {
            if (_lineRenderer != null)
                _lineRenderer.enabled = visible;
            if (BoatMarker != null)
                BoatMarker.gameObject.SetActive(visible);
        }

        /// <summary>
        /// Update boat marker position along the track (0..1).
        /// </summary>
        public void UpdateBoatPosition(AquaSample from, AquaSample to, float tLerp)
        {
            if (BoatMarker == null || _samples == null || _samples.Count == 0)
                return;

            var pos = Vector3.Lerp(from.LocalPosition, to.LocalPosition, tLerp);
            pos.y += BoatHeightOffset;
            BoatMarker.position = pos;

            Vector3 pathDir = Vector3.zero;
            if (_sampleIndexLookup != null && _sampleIndexLookup.TryGetValue(from, out int idx))
            {
                var prev = idx > 0 ? _samples[idx - 1].LocalPosition : from.LocalPosition;
                var next = idx + 1 < _samples.Count ? _samples[idx + 1].LocalPosition : to.LocalPosition;
                pathDir = next - prev;
            }

            if (pathDir.sqrMagnitude < 0.0001f)
                pathDir = to.LocalPosition - from.LocalPosition;

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
        }
    }
}
