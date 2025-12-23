using System;
using AQUAScan.AquaData;
using UnityEngine;

namespace AQUAScan.Playback
{
    /// <summary>
    /// Handles timeline playback and provides sample interpolation for visualization layers.
    /// </summary>
    public class AquaMissionPlayer : MonoBehaviour
    {
        public bool AutoPlay = true;
        public bool Loop = true;
        public float PlaybackSpeed = 1f;

        public AquaMission Mission { get; private set; }
        public bool IsPlaying { get; private set; }

        public float NormalizedTime => _durationSeconds > 0 ? _elapsedSeconds / (float)_durationSeconds : 0f;

        public event Action<float> OnTimeChanged;

        private double _startTimestamp;
        private double _durationSeconds;
        private float _elapsedSeconds;
        private int _segmentIndex;

        public void LoadMission(AquaMission mission)
        {
            Mission = mission;
            if (mission == null || mission.IsEmpty)
                return;

            _startTimestamp = mission.Samples[0].Timestamp.Subtract(DateTime.UnixEpoch).TotalSeconds;
            _durationSeconds = mission.Samples[^1].Timestamp.Subtract(DateTime.UnixEpoch).TotalSeconds - _startTimestamp;
            _elapsedSeconds = 0f;
            _segmentIndex = 0;
            IsPlaying = AutoPlay;
            OnTimeChanged?.Invoke(NormalizedTime);
        }

        private void Update()
        {
            if (Mission == null || Mission.IsEmpty || !IsPlaying || _durationSeconds <= 0)
                return;

            Advance(Time.deltaTime * PlaybackSpeed);
        }

        public void Play()
        {
            IsPlaying = true;
        }

        public void Pause()
        {
            IsPlaying = false;
        }

        public void TogglePlayPause()
        {
            IsPlaying = !IsPlaying;
        }

        public void JumpToNormalized(float normalized)
        {
            _elapsedSeconds = Mathf.Clamp01(normalized) * (float)_durationSeconds;
            _segmentIndex = FindSegmentIndex(GetAbsoluteTimestamp());
            OnTimeChanged?.Invoke(NormalizedTime);
        }

        private void Advance(float deltaSeconds)
        {
            _elapsedSeconds += deltaSeconds;
            if (_elapsedSeconds > _durationSeconds)
            {
                if (Loop)
                    _elapsedSeconds = 0f;
                else
                {
                    _elapsedSeconds = (float)_durationSeconds;
                    IsPlaying = false;
                }
            }
            else if (_elapsedSeconds < 0f)
            {
                _elapsedSeconds = 0f;
            }

            double targetTimestamp = GetAbsoluteTimestamp();
            _segmentIndex = FindSegmentIndex(targetTimestamp);
            OnTimeChanged?.Invoke(NormalizedTime);
        }

        public bool TryGetSegment(out AquaSample from, out AquaSample to, out float lerp)
        {
            from = null;
            to = null;
            lerp = 0f;

            if (Mission == null || Mission.Samples.Count < 2)
                return false;

            var samples = Mission.Samples;
            _segmentIndex = Mathf.Clamp(_segmentIndex, 0, samples.Count - 2);

            from = samples[_segmentIndex];
            to = samples[_segmentIndex + 1];

            double fromTs = from.Timestamp.Subtract(DateTime.UnixEpoch).TotalSeconds;
            double toTs = to.Timestamp.Subtract(DateTime.UnixEpoch).TotalSeconds;
            double target = GetAbsoluteTimestamp();

            lerp = toTs > fromTs
                ? Mathf.Clamp01((float)((target - fromTs) / (toTs - fromTs)))
                : 0f;
            return true;
        }

        public double GetAbsoluteTimestamp()
        {
            return _startTimestamp + _elapsedSeconds;
        }

        private int FindSegmentIndex(double targetTimestamp)
        {
            var samples = Mission.Samples;
            int count = samples.Count;
            int index = _segmentIndex;

            // Walk forward
            while (index < count - 2 && samples[index + 1].Timestamp.Subtract(DateTime.UnixEpoch).TotalSeconds < targetTimestamp)
                index++;

            // Walk backward if scrubbing backwards
            while (index > 0 && samples[index].Timestamp.Subtract(DateTime.UnixEpoch).TotalSeconds > targetTimestamp)
                index--;

            return Mathf.Clamp(index, 0, count - 2);
        }
    }
}
