using System;

namespace AQUAScan.Control
{
    [Serializable]
    public struct DriveCommand
    {
        public int Seq;
        public bool Armed;
        public bool EStop;
        public float JoystickX;
        public float JoystickY;
        public float LeftNormalized;
        public float RightNormalized;
        public int LeftMicros;
        public int RightMicros;

        public static DriveCommand Neutral(int seq, bool armed, bool estop)
        {
            return new DriveCommand
            {
                Seq = seq,
                Armed = armed,
                EStop = estop,
                JoystickX = 0f,
                JoystickY = 0f,
                LeftNormalized = 0f,
                RightNormalized = 0f,
                LeftMicros = EscPulseMapper.NeutralMicros,
                RightMicros = EscPulseMapper.NeutralMicros
            };
        }
    }
}
