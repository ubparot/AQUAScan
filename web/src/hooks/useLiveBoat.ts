import { useCallback, useEffect, useRef, useState } from 'react'
import { buildDriveCommand, neutralMicros } from '../domain/drive'
import type { AquaMission, AquaSample, DriveCommand, DriveStatus, LiveSettings, TelemetryHealth, TelemetrySnapshot } from '../types/aqua'

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

export function useLiveBoat(settings: LiveSettings, liveMode: boolean, joystick: [number, number], simulator?: { enabled: boolean; mission?: AquaMission }) {
  const [socketState, setSocketState] = useState<SocketState>('idle')
  const [status, setStatus] = useState<DriveStatus>(initialStatus)
  const [packetAgeMs, setPacketAgeMs] = useState<number>()
  const [history, setHistory] = useState<TelemetrySnapshot[]>([])
  const [armed, setArmed] = useState(false)
  const [estop, setEstop] = useState(false)
  const [lastCommand, setLastCommand] = useState<DriveCommand>(() =>
    buildDriveCommand(0, [0, 0], settings, false, false),
  )
  const socketRef = useRef<WebSocket | null>(null)
  const seqRef = useRef(0)
  const lastSeenRef = useRef(0)
  const simProgressRef = useRef(0)
  const simLastTickRef = useRef(0)

  const disconnect = useCallback((reason = 'Disconnected') => {
    const socket = socketRef.current
    socketRef.current = null
    if (socket && socket.readyState <= WebSocket.OPEN) socket.close(1000, reason)
    setSocketState('idle')
    setArmed(false)
    setStatus((previous) => ({ ...previous, connected: false, armed: false, leftMicros: neutralMicros, rightMicros: neutralMicros }))
    setPacketAgeMs(undefined)
  }, [])

  const sendJson = useCallback((payload: unknown) => {
    const socket = socketRef.current
    if (!socket || socket.readyState !== WebSocket.OPEN) return false
    socket.send(JSON.stringify(payload))
    return true
  }, [])

  const connect = useCallback(() => {
    if (socketRef.current && socketRef.current.readyState <= WebSocket.OPEN) return
    if (simulator?.enabled) {
      const receivedAtMs = Date.now()
      lastSeenRef.current = receivedAtMs
      simLastTickRef.current = receivedAtMs
      setSocketState('connected')
      setStatus((previous) => ({
        ...previous,
        connected: true,
        armed: false,
        estop: false,
        rssi: -42,
        lastSeenUtc: new Date().toISOString(),
      }))
      setPacketAgeMs(0)
      return
    }
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
          lat?: number
          lng?: number
          lon?: number
          latitude?: number
          longitude?: number
          altitude?: number
          heading?: number
          headingDeg?: number
          speed?: number
          speedMps?: number
          battery?: number
          batteryPercent?: number
          depth?: number
          depthMeters?: number
        }
        if (message.type !== 'status') return
        const receivedAtMs = Date.now()
        lastSeenRef.current = receivedAtMs
        const nextStatus = {
          connected: Boolean(message.connected),
          armed: Boolean(message.armed),
          estop: Boolean(message.estop),
          lastSeq: message.lastSeq ?? 0,
          leftMicros: message.left ?? neutralMicros,
          rightMicros: message.right ?? neutralMicros,
          rssi: message.rssi,
          latitude: firstNumber(message.latitude, message.lat),
          longitude: firstNumber(message.longitude, message.lon, message.lng),
          altitude: firstNumber(message.altitude),
          headingDeg: firstNumber(message.headingDeg, message.heading),
          speedMps: firstNumber(message.speedMps, message.speed),
          batteryPercent: firstNumber(message.batteryPercent, message.battery),
          depthMeters: firstNumber(message.depthMeters, message.depth),
          lastSeenUtc: new Date().toISOString(),
        }
        setStatus(nextStatus)
        setPacketAgeMs(0)
        setHistory((previous) => [
          { ...nextStatus, receivedAtMs, packetAgeMs: 0 },
          ...previous.slice(0, 59).map((snapshot) => ({ ...snapshot, packetAgeMs: receivedAtMs - snapshot.receivedAtMs })),
        ])
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
        setPacketAgeMs(undefined)
      }
    })
  }, [settings.host, settings.port, simulator?.enabled])

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
    if (!liveMode && simulator?.enabled && socketState === 'connected') {
      const timer = window.setTimeout(() => disconnect('Switched to playback'), 0)
      return () => window.clearTimeout(timer)
    }
  }, [disconnect, liveMode, simulator?.enabled, socketState])

  useEffect(() => {
    if (!liveMode || socketState !== 'connected') return
    const intervalMs = Math.max(20, 1000 / Math.max(1, settings.sendRateHz))
    const timer = window.setInterval(() => {
      const connected = socketRef.current?.readyState === WebSocket.OPEN
      if (!simulator?.enabled && !connected) return
      if (!simulator?.enabled && lastSeenRef.current > 0 && Date.now() - lastSeenRef.current > settings.timeoutSeconds * 1000) {
        disconnect('Timed out')
        return
      }
      const command = buildDriveCommand(seqRef.current + 1, joystick, settings, armed, estop)
      seqRef.current = command.seq
      setLastCommand(command)
      if (!simulator?.enabled) sendJson({
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
  }, [armed, disconnect, estop, joystick, liveMode, sendJson, settings, simulator?.enabled, socketState])

  useEffect(() => {
    if (!simulator?.enabled || !liveMode || socketState !== 'connected') return
    const timer = window.setInterval(() => {
      const now = Date.now()
      const deltaSeconds = simLastTickRef.current > 0 ? Math.min(1, (now - simLastTickRef.current) / 1000) : 0
      simLastTickRef.current = now
      if (armed && !estop) {
        const throttle = Math.max(0, joystick[1])
        simProgressRef.current = (simProgressRef.current + deltaSeconds * (0.012 + throttle * 0.06)) % 1
      }
      const pose = simulatorPose(simulator.mission, simProgressRef.current)
      const nextStatus: DriveStatus = {
        connected: true,
        armed,
        estop,
        lastSeq: seqRef.current,
        leftMicros: lastCommand.leftMicros,
        rightMicros: lastCommand.rightMicros,
        rssi: -42 - Math.round(Math.sin(now / 1700) * 4),
        latitude: pose.latitude,
        longitude: pose.longitude,
        altitude: pose.altitude,
        headingDeg: pose.headingDeg,
        speedMps: armed && !estop ? Math.max(0, joystick[1]) * 1.8 : 0,
        batteryPercent: Math.max(42, 96 - simProgressRef.current * 12),
        depthMeters: pose.depthMeters,
        lastSeenUtc: new Date().toISOString(),
      }
      lastSeenRef.current = now
      setStatus(nextStatus)
      setPacketAgeMs(0)
      setHistory((previous) => [
        { ...nextStatus, receivedAtMs: now, packetAgeMs: 0 },
        ...previous.slice(0, 59).map((snapshot) => ({ ...snapshot, packetAgeMs: now - snapshot.receivedAtMs })),
      ])
    }, 250)
    return () => window.clearInterval(timer)
  }, [armed, estop, joystick, lastCommand.leftMicros, lastCommand.rightMicros, liveMode, simulator?.enabled, simulator?.mission, socketState])

  useEffect(() => {
    if (socketState !== 'connected' || lastSeenRef.current <= 0) return
    const timer = window.setInterval(() => {
      const age = Date.now() - lastSeenRef.current
      setPacketAgeMs(age)
      setHistory((previous) => previous.map((snapshot) => ({ ...snapshot, packetAgeMs: Date.now() - snapshot.receivedAtMs })))
    }, 250)
    return () => window.clearInterval(timer)
  }, [socketState])

  useEffect(() => () => disconnect('Page closed'), [disconnect])

  const health: TelemetryHealth =
    socketState === 'error'
      ? 'error'
      : socketState === 'connecting'
        ? 'connecting'
        : socketState !== 'connected'
          ? 'offline'
          : packetAgeMs !== undefined && packetAgeMs > settings.timeoutSeconds * 1000 * 0.75
            ? 'stale'
            : 'fresh'

  return {
    socketState,
    status,
    history,
    packetAgeMs,
    health,
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

function firstNumber(...values: Array<number | undefined>) {
  return values.find((value): value is number => typeof value === 'number' && Number.isFinite(value))
}

function simulatorPose(mission: AquaMission | undefined, progress: number) {
  const samples = mission?.samples
  if (!samples || samples.length === 0) {
    return {
      latitude: 37.4251,
      longitude: -122.0841,
      altitude: 0,
      headingDeg: 45,
      depthMeters: 2.5,
    }
  }
  if (samples.length === 1) return poseFromSample(samples[0], samples[0], 0)
  const scaled = Math.max(0, Math.min(0.999999, progress)) * (samples.length - 1)
  const index = Math.min(samples.length - 2, Math.floor(scaled))
  return poseFromSample(samples[index], samples[index + 1], scaled - index)
}

function poseFromSample(from: AquaSample, to: AquaSample, t: number) {
  const latitude = lerp(from.latitude, to.latitude, t)
  const longitude = lerp(from.longitude, to.longitude, t)
  const dx = to.localPosition[0] - from.localPosition[0]
  const dz = to.localPosition[2] - from.localPosition[2]
  const heading = Math.hypot(dx, dz) > 0.001 ? (Math.atan2(dx, dz) * 180) / Math.PI : (from.headingDeg ?? 0)
  return {
    latitude,
    longitude,
    altitude: lerpOptional(from.altitude, to.altitude, t),
    headingDeg: heading < 0 ? heading + 360 : heading,
    depthMeters: lerpOptional(from.depthMeters, to.depthMeters, t),
  }
}

function lerpOptional(a: number | undefined, b: number | undefined, t: number) {
  if (a === undefined) return b
  if (b === undefined) return a
  return lerp(a, b, t)
}

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t
}
