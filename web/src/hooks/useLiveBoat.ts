import { useCallback, useEffect, useRef, useState } from 'react'
import { buildDriveCommand, neutralMicros } from '../domain/drive'
import type { DriveCommand, DriveStatus, LiveSettings } from '../types/aqua'

type SocketState = 'idle' | 'connecting' | 'connected' | 'error'

const initialStatus: DriveStatus = {
  connected: false,
  armed: false,
  estop: false,
  lastSeq: 0,
  leftMicros: neutralMicros,
  rightMicros: neutralMicros,
  lastSeenUtc: '',
}

export function useLiveBoat(settings: LiveSettings, liveMode: boolean, joystick: [number, number]) {
  const [socketState, setSocketState] = useState<SocketState>('idle')
  const [status, setStatus] = useState<DriveStatus>(initialStatus)
  const [armed, setArmed] = useState(false)
  const [estop, setEstop] = useState(false)
  const [lastCommand, setLastCommand] = useState<DriveCommand>(() =>
    buildDriveCommand(0, [0, 0], settings, false, false),
  )
  const socketRef = useRef<WebSocket | null>(null)
  const seqRef = useRef(0)
  const lastSeenRef = useRef(0)

  const disconnect = useCallback((reason = 'Disconnected') => {
    const socket = socketRef.current
    socketRef.current = null
    if (socket && socket.readyState <= WebSocket.OPEN) socket.close(1000, reason)
    setSocketState('idle')
    setArmed(false)
    setStatus((previous) => ({ ...previous, connected: false, armed: false, leftMicros: neutralMicros, rightMicros: neutralMicros }))
  }, [])

  const sendJson = useCallback((payload: unknown) => {
    const socket = socketRef.current
    if (!socket || socket.readyState !== WebSocket.OPEN) return false
    socket.send(JSON.stringify(payload))
    return true
  }, [])

  const connect = useCallback(() => {
    if (socketRef.current && socketRef.current.readyState <= WebSocket.OPEN) return
    setSocketState('connecting')
    const socket = new WebSocket(`ws://${settings.host}:${settings.port}/`)
    socketRef.current = socket

    socket.addEventListener('open', () => {
      setSocketState('connected')
      lastSeenRef.current = Date.now()
      socket.send(JSON.stringify({ type: 'hello', client: 'AQUAScan Web', version: '0.1.0' }))
    })

    socket.addEventListener('message', (event) => {
      try {
        const message = JSON.parse(String(event.data)) as Partial<DriveStatus> & {
          type?: string
          left?: number
          right?: number
          lastSeq?: number
          rssi?: number
        }
        if (message.type !== 'status') return
        lastSeenRef.current = Date.now()
        setStatus({
          connected: Boolean(message.connected),
          armed: Boolean(message.armed),
          estop: Boolean(message.estop),
          lastSeq: message.lastSeq ?? 0,
          leftMicros: message.left ?? neutralMicros,
          rightMicros: message.right ?? neutralMicros,
          rssi: message.rssi,
          lastSeenUtc: new Date().toISOString(),
        })
        setEstop(Boolean(message.estop))
      } catch {
        setSocketState('error')
      }
    })

    socket.addEventListener('error', () => setSocketState('error'))
    socket.addEventListener('close', () => {
      if (socketRef.current === socket) {
        socketRef.current = null
        setSocketState('idle')
        setArmed(false)
        setStatus((previous) => ({ ...previous, connected: false, armed: false }))
      }
    })
  }, [settings.host, settings.port])

  const toggleArm = useCallback(() => {
    if (!liveMode || socketState !== 'connected' || estop) return
    setArmed((value) => !value)
  }, [estop, liveMode, socketState])

  const triggerEstop = useCallback(() => {
    const nextSeq = seqRef.current + 1
    seqRef.current = nextSeq
    setEstop(true)
    setArmed(false)
    sendJson({ type: 'estop', seq: nextSeq })
  }, [sendJson])

  const resetEstop = useCallback(() => {
    setEstop(false)
    setArmed(false)
  }, [])

  useEffect(() => {
    if (!liveMode && socketRef.current) disconnect('Switched to playback')
  }, [disconnect, liveMode])

  useEffect(() => {
    if (!liveMode || socketState !== 'connected') return
    const intervalMs = Math.max(20, 1000 / Math.max(1, settings.sendRateHz))
    const timer = window.setInterval(() => {
      const connected = socketRef.current?.readyState === WebSocket.OPEN
      if (!connected) return
      if (lastSeenRef.current > 0 && Date.now() - lastSeenRef.current > settings.timeoutSeconds * 1000) {
        disconnect('Timed out')
        return
      }
      const command = buildDriveCommand(seqRef.current + 1, joystick, settings, armed, estop)
      seqRef.current = command.seq
      setLastCommand(command)
      sendJson({
        type: 'drive',
        seq: command.seq,
        armed: command.armed,
        estop: command.estop,
        x: command.joystickX,
        y: command.joystickY,
        left: command.leftMicros,
        right: command.rightMicros,
      })
    }, intervalMs)
    return () => window.clearInterval(timer)
  }, [armed, disconnect, estop, joystick, liveMode, sendJson, settings, socketState])

  useEffect(() => () => disconnect('Page closed'), [disconnect])

  return {
    socketState,
    status,
    armed,
    estop,
    lastCommand,
    connect,
    disconnect,
    toggleArm,
    triggerEstop,
    resetEstop,
  }
}
