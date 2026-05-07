import { useCallback, useRef } from 'react'

type JoystickProps = {
  value: [number, number]
  disabled: boolean
  onChange: (value: [number, number]) => void
}

export function Joystick({ value, disabled, onChange }: JoystickProps) {
  const ref = useRef<HTMLDivElement | null>(null)

  const updatePointer = useCallback(
    (clientX: number, clientY: number) => {
      const rect = ref.current?.getBoundingClientRect()
      if (!rect || disabled) return
      const x = ((clientX - rect.left) / rect.width) * 2 - 1
      const y = -(((clientY - rect.top) / rect.height) * 2 - 1)
      const magnitude = Math.hypot(x, y)
      onChange(magnitude > 1 ? [x / magnitude, y / magnitude] : [x, y])
    },
    [disabled, onChange],
  )

  return (
    <div
      className="joystick"
      data-disabled={disabled}
      ref={ref}
      onPointerDown={(event) => {
        event.currentTarget.setPointerCapture(event.pointerId)
        updatePointer(event.clientX, event.clientY)
      }}
      onPointerMove={(event) => {
        if (event.buttons === 1) updatePointer(event.clientX, event.clientY)
      }}
      onPointerUp={(event) => {
        event.currentTarget.releasePointerCapture(event.pointerId)
        onChange([0, 0])
      }}
      onPointerCancel={() => onChange([0, 0])}
    >
      <div className="joystick-cross joystick-cross-x" />
      <div className="joystick-cross joystick-cross-y" />
      <div className="joystick-handle" style={{ transform: `translate(${value[0] * 58}px, ${-value[1] * 58}px)` }} />
    </div>
  )
}
