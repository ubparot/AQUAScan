using UnityEngine;

namespace AQUAScan.Visualization
{
    /// <summary>
    /// Simple orbit + zoom camera that pivots around the boat marker.
    /// Attach to your scene camera and assign BoatMarker as Target.
    /// - Right mouse drag: orbit
    /// - Scroll wheel: zoom
    /// </summary>
    public class CameraBoatOrbit : MonoBehaviour
    {
        public Transform Target;
        public Vector3 TargetOffset = new Vector3(0f, 1.0f, 0f);
        public float Distance = 20f;
        public float MinDistance = 5f;
        public float MaxDistance = 80f;
        public float OrbitSpeed = 120f;
        public float PitchMin = 10f;
        public float PitchMax = 80f;
        public float ZoomSpeed = 8f;

        private float _yaw;
        private float _pitch;

        private void Start()
        {
            if (Target == null)
                return;

            Vector3 toCam = (transform.position - (Target.position + TargetOffset));
            Distance = Mathf.Clamp(toCam.magnitude, MinDistance, MaxDistance);
            if (toCam.sqrMagnitude > 0.0001f)
            {
                Vector3 dir = toCam.normalized;
                _pitch = Mathf.Asin(dir.y) * Mathf.Rad2Deg;
                _yaw = Mathf.Atan2(dir.x, dir.z) * Mathf.Rad2Deg;
            }
        }

        private void LateUpdate()
        {
            if (Target == null)
                return;

            HandleInput();

            _pitch = Mathf.Clamp(_pitch, PitchMin, PitchMax);
            Distance = Mathf.Clamp(Distance, MinDistance, MaxDistance);

            Quaternion rot = Quaternion.Euler(_pitch, _yaw, 0f);
            Vector3 pivot = Target.position + TargetOffset;
            Vector3 camPos = pivot + rot * (Vector3.back * Distance);

            transform.position = camPos;
            transform.rotation = rot;
        }

        private void HandleInput()
        {
            if (Input.GetMouseButton(1))
            {
                float dx = Input.GetAxis("Mouse X");
                float dy = Input.GetAxis("Mouse Y");
                _yaw += dx * OrbitSpeed * Time.deltaTime;
                _pitch -= dy * OrbitSpeed * Time.deltaTime;
            }

            float scroll = Input.mouseScrollDelta.y;
            if (Mathf.Abs(scroll) > 0.0001f)
            {
                Distance *= 1f - scroll * ZoomSpeed * 0.1f * Time.deltaTime;
            }
        }
    }
}
