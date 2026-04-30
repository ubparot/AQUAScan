using UnityEngine;

namespace AQUAScan.Control
{
    public static class DifferentialDriveMixer
    {
        public static Vector2 ApplyRadialDeadzone(Vector2 input, float deadzone)
        {
            float clampedDeadzone = Mathf.Clamp(deadzone, 0f, 0.99f);
            float magnitude = input.magnitude;
            if (magnitude <= clampedDeadzone)
                return Vector2.zero;

            float scaledMagnitude = Mathf.InverseLerp(clampedDeadzone, 1f, Mathf.Min(1f, magnitude));
            return input.normalized * scaledMagnitude;
        }

        public static Vector2 MixArcade(Vector2 joystick)
        {
            float left = joystick.y + joystick.x;
            float right = joystick.y - joystick.x;
            float maxMagnitude = Mathf.Max(1f, Mathf.Abs(left), Mathf.Abs(right));
            return new Vector2(left / maxMagnitude, right / maxMagnitude);
        }
    }
}
