using System.Collections.Generic;
using UnityEngine;

namespace AQUAScan.AquaData
{
    /// <summary>
    /// Container for an entire mission's samples plus origin reference.
    /// </summary>
    public class AquaMission
    {
        public string MissionName;
        public string SourceFile;
        public GeoReference GeoReference;
        public List<AquaSample> Samples = new List<AquaSample>();

        public bool IsEmpty => Samples == null || Samples.Count == 0;
    }

    /// <summary>
    /// Stores origin info for projecting GPS coordinates into local Unity space.
    /// </summary>
    public class GeoReference
    {
        public double OriginLatitude;
        public double OriginLongitude;
        public double? OriginAltitude;

        public Vector3 OffsetToLocal(double latitude, double longitude, double? altitude = null)
        {
            return GeoUtils.GeoToLocal(OriginLatitude, OriginLongitude, latitude, longitude, altitude, OriginAltitude);
        }
    }
}
