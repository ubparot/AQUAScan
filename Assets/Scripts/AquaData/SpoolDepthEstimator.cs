using System;
using UnityEngine;

namespace AQUAScan.AquaData
{
    /// <summary>
    /// Converts spool rotation into paid-out probe cable length using layered spool geometry.
    /// </summary>
    public static class SpoolDepthEstimator
    {
        [Serializable]
        public struct Geometry
        {
            [Min(0.001f)] public float CoreRadiusMeters;
            [Min(0.001f)] public float CableDiameterMeters;
            [Min(0.001f)] public float SpoolWidthMeters;
            public float ZeroRotations;
            public float RotationToSpoolRatio;
            public bool InvertDirection;
            [Range(0.01f, 1f)] public float VerticalEfficiency;

            public static Geometry Default => new Geometry
            {
                CoreRadiusMeters = 0.018f,
                CableDiameterMeters = 0.0025f,
                SpoolWidthMeters = 0.045f,
                ZeroRotations = 0f,
                RotationToSpoolRatio = 1f,
                InvertDirection = false,
                VerticalEfficiency = 0.96f
            };
        }

        public static float EstimateDepthMeters(float measuredRotations, Geometry geometry)
        {
            return EstimateCableLengthMeters(measuredRotations, geometry) * Mathf.Clamp01(geometry.VerticalEfficiency);
        }

        public static float EstimateCableLengthMeters(float measuredRotations, Geometry geometry)
        {
            geometry = Sanitize(geometry);

            float signedSpoolRotations = (measuredRotations - geometry.ZeroRotations) * geometry.RotationToSpoolRatio;
            if (geometry.InvertDirection)
                signedSpoolRotations = -signedSpoolRotations;

            float remainingRotations = Mathf.Max(0f, signedSpoolRotations);
            if (remainingRotations <= 0f)
                return 0f;

            int wrapsPerLayer = Mathf.Max(1, Mathf.FloorToInt(geometry.SpoolWidthMeters / geometry.CableDiameterMeters));
            float cableLength = 0f;
            int layer = 0;

            while (remainingRotations > 0f && layer < 256)
            {
                float rotationsThisLayer = Mathf.Min(remainingRotations, wrapsPerLayer);
                float layerCenterRadius = geometry.CoreRadiusMeters + geometry.CableDiameterMeters * (0.5f + layer);
                cableLength += rotationsThisLayer * 2f * Mathf.PI * layerCenterRadius;
                remainingRotations -= rotationsThisLayer;
                layer++;
            }

            return cableLength;
        }

        public static float RotationsFromDegrees(float degrees)
        {
            return degrees / 360f;
        }

        public static float RotationsFromEncoderTicks(float ticks, float ticksPerRevolution)
        {
            return ticksPerRevolution > 0f ? ticks / ticksPerRevolution : 0f;
        }

        private static Geometry Sanitize(Geometry geometry)
        {
            if (geometry.CoreRadiusMeters <= 0f)
                geometry.CoreRadiusMeters = Geometry.Default.CoreRadiusMeters;
            if (geometry.CableDiameterMeters <= 0f)
                geometry.CableDiameterMeters = Geometry.Default.CableDiameterMeters;
            if (geometry.SpoolWidthMeters <= 0f)
                geometry.SpoolWidthMeters = Geometry.Default.SpoolWidthMeters;
            if (Mathf.Approximately(geometry.RotationToSpoolRatio, 0f))
                geometry.RotationToSpoolRatio = Geometry.Default.RotationToSpoolRatio;
            if (geometry.VerticalEfficiency <= 0f)
                geometry.VerticalEfficiency = Geometry.Default.VerticalEfficiency;

            return geometry;
        }
    }
}
