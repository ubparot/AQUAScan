using AQUAScan.Control;
using AQUAScan.Controllers;
using AQUAScan.Playback;
using NUnit.Framework;
using UnityEngine;

namespace AQUAScan.Tests.Editor
{
    public class DriveControlTests
    {
        [Test]
        public void MixArcade_ForwardAndReverseAreSymmetric()
        {
            Vector2 forward = DifferentialDriveMixer.MixArcade(new Vector2(0f, 1f));
            Vector2 reverse = DifferentialDriveMixer.MixArcade(new Vector2(0f, -1f));

            Assert.AreEqual(new Vector2(1f, 1f), forward);
            Assert.AreEqual(new Vector2(-1f, -1f), reverse);
        }

        [Test]
        public void MixArcade_PivotRightProducesOppositeTracks()
        {
            Vector2 mixed = DifferentialDriveMixer.MixArcade(new Vector2(1f, 0f));

            Assert.AreEqual(1f, mixed.x);
            Assert.AreEqual(-1f, mixed.y);
        }

        [Test]
        public void MixArcade_SaturatesDiagonalInput()
        {
            Vector2 mixed = DifferentialDriveMixer.MixArcade(new Vector2(1f, 1f));

            Assert.AreEqual(1f, mixed.x);
            Assert.AreEqual(0f, mixed.y);
        }

        [Test]
        public void ApplyRadialDeadzone_ZeroesSmallInput()
        {
            Vector2 filtered = DifferentialDriveMixer.ApplyRadialDeadzone(new Vector2(0.03f, 0.04f), 0.08f);

            Assert.AreEqual(Vector2.zero, filtered);
        }

        [Test]
        public void EscPulseMapper_MapsNormalizedRangeToMicros()
        {
            Assert.AreEqual(1000, EscPulseMapper.ToMicros(-1f, 1f));
            Assert.AreEqual(1500, EscPulseMapper.ToMicros(0f, 1f));
            Assert.AreEqual(2000, EscPulseMapper.ToMicros(1f, 1f));
            Assert.AreEqual(1750, EscPulseMapper.ToMicros(1f, 0.5f));
        }

        [Test]
        public void OperationModeSwitch_PausesPlaybackAndReturnsToPlayback()
        {
            var root = new GameObject("ControllerRoot");
            var player = root.AddComponent<AquaMissionPlayer>();
            var controller = root.AddComponent<AquaMissionController>();
            controller.Player = player;

            player.Play();
            controller.SetOperationMode(AquaOperationMode.LiveControl, false);

            Assert.AreEqual(AquaOperationMode.LiveControl, controller.OperationMode);
            Assert.IsFalse(player.IsPlaying);

            controller.SetOperationMode(AquaOperationMode.Playback, false);

            Assert.AreEqual(AquaOperationMode.Playback, controller.OperationMode);

            Object.DestroyImmediate(root);
        }
    }
}
