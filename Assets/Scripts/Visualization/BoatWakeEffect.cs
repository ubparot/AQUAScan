using AQUAScan.AquaData;
using UnityEngine;

namespace AQUAScan.Visualization
{
    /// <summary>
    /// Controls a wake/spray particle system attached to the boat marker.
    /// </summary>
    [RequireComponent(typeof(ParticleSystem))]
    public class BoatWakeEffect : MonoBehaviour
    {
        public float BaseEmission = 8f;
        public float EmissionPerMps = 6f;
        public float MinSpeedForWake = 0.25f;
        public float AlignSmoothing = 8f;
        public Gradient ColorBySpeed;

        private ParticleSystem _ps;
        private ParticleSystem.EmissionModule _emission;
        private ParticleSystem.MainModule _main;

        private void Awake()
        {
            _ps = GetComponent<ParticleSystem>();
            _emission = _ps.emission;
            _main = _ps.main;

            _main.simulationSpace = ParticleSystemSimulationSpace.World;
            _main.startLifetime = 0.8f;
            _main.startSpeed = 0.5f;
            _main.startSize = new ParticleSystem.MinMaxCurve(0.15f, 0.35f);
            _main.gravityModifier = 0.05f;
        }

        public void UpdateWake(float speedMps, Vector3 moveDirection)
        {
            if (_ps == null)
                return;

            bool active = speedMps >= MinSpeedForWake;
            _emission.enabled = active;
            if (!active)
            {
                _emission.rateOverTime = 0f;
                return;
            }

            _emission.rateOverTime = BaseEmission + speedMps * EmissionPerMps;

            if (ColorBySpeed != null && ColorBySpeed.colorKeys.Length > 0)
            {
                float t = Mathf.InverseLerp(0f, 4f, speedMps);
                _main.startColor = ColorBySpeed.Evaluate(t);
            }

            if (moveDirection.sqrMagnitude > 0.0001f)
            {
                var flatDir = new Vector3(moveDirection.x, 0f, moveDirection.z).normalized;
                var targetRot = Quaternion.LookRotation(-flatDir, Vector3.up); // emit backwards
                transform.rotation = Quaternion.Slerp(transform.rotation, targetRot, AlignSmoothing * Time.deltaTime);
            }
        }
    }
}
