using System.Collections.Generic;
using AQUAScan.AquaData;
using AQUAScan.Config;
using UnityEngine;

namespace AQUAScan.Visualization
{
    /// <summary>
    /// Renders mission samples as a GPU-friendly particle cloud colored by the active metric.
    /// </summary>
    [RequireComponent(typeof(ParticleSystem))]
    public class SamplePointCloud : MonoBehaviour
    {
        public float PointSize = 0.6f;

        private ParticleSystem _particleSystem;
        private List<AquaSample> _samples;
        private string _metricId = "temperature";
        private MetricDescriptor _metricDescriptor;
        private float _min;
        private float _max;

        private void Awake()
        {
            EnsureParticleSystem();
        }

        private void OnEnable()
        {
            EnsureParticleSystem();
        }

        private void EnsureParticleSystem()
        {
            if (_particleSystem == null)
                _particleSystem = GetComponent<ParticleSystem>();
            if (_particleSystem != null)
                ConfigureParticleSystem();
        }

        private void ConfigureParticleSystem()
        {
            if (_particleSystem == null)
                return;

            var main = _particleSystem.main;
            main.simulationSpace = ParticleSystemSimulationSpace.World;
            main.startLifetime = float.MaxValue;
            main.startSpeed = 0f;
            main.maxParticles = 50000;
            main.loop = false;
            _particleSystem.Clear();
        }

        public void Render(AquaMission mission, string metricId)
        {
            EnsureParticleSystem();
            if (_particleSystem == null || mission == null)
                return;

            _samples = mission.Samples;
            _metricId = metricId.ToLowerInvariant();
            _metricDescriptor = MetricRegistry.GetOrCreate(metricId);
            _min = _metricDescriptor.ExpectedRange.x;
            _max = _metricDescriptor.ExpectedRange.y;

            _particleSystem.Clear();

            var particles = new ParticleSystem.Particle[_samples.Count];
            for (int i = 0; i < _samples.Count; i++)
            {
                var sample = _samples[i];
                var particle = new ParticleSystem.Particle
                {
                    position = sample.LocalPosition,
                    startSize = PointSize,
                    startLifetime = float.MaxValue,
                    remainingLifetime = float.MaxValue,
                    startColor = EvaluateColor(sample)
                };
                particles[i] = particle;
            }
            _particleSystem.SetParticles(particles, particles.Length);
        }

        public void UpdateMetric(string metricId)
        {
            EnsureParticleSystem();
            if (_samples == null || _samples.Count == 0)
                return;

            _metricId = metricId.ToLowerInvariant();
            _metricDescriptor = MetricRegistry.GetOrCreate(metricId);
            _min = _metricDescriptor.ExpectedRange.x;
            _max = _metricDescriptor.ExpectedRange.y;

            var count = _particleSystem.particleCount;
            var particles = new ParticleSystem.Particle[count];
            _particleSystem.GetParticles(particles);
            int maxIndex = Mathf.Min(count, _samples.Count);
            for (int i = 0; i < maxIndex; i++)
            {
                particles[i].startColor = EvaluateColor(_samples[i]);
            }
            _particleSystem.SetParticles(particles, count);
        }

        public void ToggleVisibility(bool visible)
        {
            EnsureParticleSystem();
            if (_particleSystem != null)
                _particleSystem.gameObject.SetActive(visible);
        }

        private Color EvaluateColor(AquaSample sample)
        {
            if (_metricDescriptor == null)
                _metricDescriptor = MetricRegistry.GetOrCreate(_metricId);

            if (sample.TryGetMetric(_metricId, out var value))
            {
                float t = Mathf.InverseLerp(_min, _max, value);
                return _metricDescriptor.Gradient.Evaluate(t);
            }

            return new Color(0.5f, 0.5f, 0.5f, 0.4f);
        }
    }
}
