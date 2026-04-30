using UnityEngine;

namespace AQUAScan.Control
{
    public static class EscPulseMapper
    {
        public const int NeutralMicros = 1500;
        public const int RangeMicros = 500;
        public const int MinMicros = NeutralMicros - RangeMicros;
        public const int MaxMicros = NeutralMicros + RangeMicros;

        public static int ToMicros(float normalized, float maxOutput)
        {
            float scaled = Mathf.Clamp(normalized, -1f, 1f) * Mathf.Clamp(maxOutput, 0f, 1f);
            if (Mathf.Abs(scaled) < 0.0001f)
                return NeutralMicros;

            int micros = NeutralMicros + Mathf.RoundToInt(scaled * RangeMicros);
            return Mathf.Clamp(micros, MinMicros, MaxMicros);
        }
    }
}
