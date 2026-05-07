import type { DriveCommand, LiveSettings } from '../types/aqua'

export const neutralMicros = 1500
export const rangeMicros = 500
export const minMicros = neutralMicros - rangeMicros
export const maxMicros = neutralMicros + rangeMicros

export function applyRadialDeadzone(input: [number, number], deadzone: number): [number, number] {
  const clampedDeadzone = clamp(deadzone, 0, 0.99)
  const magnitude = Math.hypot(input[0], input[1])
  if (magnitude <= clampedDeadzone) return [0, 0]
  const scaledMagnitude = inverseLerp(clampedDeadzone, 1, Math.min(1, magnitude))
  return [(input[0] / magnitude) * scaledMagnitude, (input[1] / magnitude) * scaledMagnitude]
}

export function mixArcade(joystick: [number, number]): [number, number] {
  const left = joystick[1] + joystick[0]
  const right = joystick[1] - joystick[0]
  const maxMagnitude = Math.max(1, Math.abs(left), Math.abs(right))
  return [left / maxMagnitude, right / maxMagnitude]
}

export function toMicros(normalized: number, maxOutput: number) {
  const scaled = clamp(normalized, -1, 1) * clamp(maxOutput, 0, 1)
  if (Math.abs(scaled) < 0.0001) return neutralMicros
  return Math.round(clamp(neutralMicros + scaled * rangeMicros, minMicros, maxMicros))
}

export function buildDriveCommand(
  seq: number,
  joystick: [number, number],
  settings: Pick<LiveSettings, 'deadzone' | 'maxOutput'>,
  armed: boolean,
  estop: boolean,
): DriveCommand {
  const raw = [clamp(joystick[0], -1, 1), clamp(joystick[1], -1, 1)] as [number, number]
  const shaped = applyRadialDeadzone(raw, settings.deadzone)
  const mixed = armed && !estop ? mixArcade(shaped) : [0, 0]
  return {
    seq,
    armed: armed && !estop,
    estop,
    joystickX: raw[0],
    joystickY: raw[1],
    leftMicros: toMicros(mixed[0], settings.maxOutput),
    rightMicros: toMicros(mixed[1], settings.maxOutput),
  }
}

function inverseLerp(a: number, b: number, value: number) {
  if (Math.abs(b - a) < 0.000001) return 0
  return clamp((value - a) / (b - a), 0, 1)
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}
