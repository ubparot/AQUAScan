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

        private LineRenderer _lineRenderer;
        private List<AquaSample> _samples;

        private void Awake()
        {
            _lineRenderer = GetComponent<LineRenderer>();
            _lineRenderer.useWorldSpace = true;
        }

        public void RenderTrack(AquaMission mission)
        {
            _samples = mission.Samples;
            _lineRenderer.positionCount = _samples.Count;
            for (int i = 0; i < _samples.Count; i++)
            {
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

            if (from.HeadingDeg.HasValue)
            {
                BoatMarker.rotation = Quaternion.Euler(0, -from.HeadingDeg.Value, 0);
            }
            else if (_samples.Count > 1)
            {
                var dir = (to.LocalPosition - from.LocalPosition).normalized;
                if (dir.sqrMagnitude > 0.0001f)
                    BoatMarker.rotation = Quaternion.LookRotation(new Vector3(dir.x, 0, dir.z), Vector3.up);
            }
        }
    }
}
