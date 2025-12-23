using System;
using UnityEngine;

namespace AQUAScan.AquaData
{
    /// <summary>
    /// Geographic helpers for projecting lat/long to a local tangent plane.
    /// </summary>
    public static class GeoUtils
    {
        // WGS84 mean radius in meters.
        private const double EarthRadius = 6378137.0;

        /// <summary>
        /// Converts geographic coordinates into a local Unity position in meters using an equirectangular approximation.
        /// Suitable for lake/river-scale areas (low distortion in small extents).
        /// </summary>
        public static Vector3 GeoToLocal(double originLat, double originLon, double lat, double lon, double? altitude = null, double? originAltitude = null)
        {
            double latRad = DegreesToRad(lat);
            double lonRad = DegreesToRad(lon);
            double originLatRad = DegreesToRad(originLat);
            double originLonRad = DegreesToRad(originLon);

            double deltaLon = lonRad - originLonRad;
            double deltaLat = latRad - originLatRad;

            double x = EarthRadius * deltaLon * Math.Cos(originLatRad);
            double z = EarthRadius * deltaLat;
            double y = (altitude ?? 0d) - (originAltitude ?? 0d);

            return new Vector3((float)x, (float)y, (float)z);
        }

        public static double DegreesToRad(double degrees) => degrees * Math.PI / 180d;
    }
}
