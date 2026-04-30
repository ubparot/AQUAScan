using System;

namespace AQUAScan.Control
{
    [Serializable]
    public struct DriveStatus
    {
        public bool Connected;
        public bool Armed;
        public bool EStop;
        public int LastSeq;
        public int LeftMicros;
        public int RightMicros;
        public DateTime LastSeenUtc;
        public int? Rssi;

        public static DriveStatus Disconnected()
        {
            return new DriveStatus
            {
                Connected = false,
                Armed = false,
                EStop = false,
                LastSeq = 0,
                LeftMicros = EscPulseMapper.NeutralMicros,
                RightMicros = EscPulseMapper.NeutralMicros,
                LastSeenUtc = DateTime.MinValue,
                Rssi = null
            };
        }
    }
}
