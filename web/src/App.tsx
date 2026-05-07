import { Activity, BrainCircuit, Gauge, Power, Radio, ShieldAlert, ShipWheel, Upload } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import './App.css'
import { BoatScene } from './components/BoatScene'
import { Joystick } from './components/Joystick'
import { predictWaterQuality } from './domain/ai'
import { formatMetricValue, getMetricDescriptor, gradientCss, listMissionMetrics, metricValue } from './domain/metrics'
import { loadMissionFromFile, loadMissionFromUrl } from './domain/missionLoader'
import { getPlaybackSegment, missionDurationSeconds } from './domain/playback'
import { useLiveBoat } from './hooks/useLiveBoat'
import { useLocalStorageState } from './hooks/useLocalStorageState'
import type { AquaMission, LayerVisibility, LiveSettings, TabId } from './types/aqua'

const defaultSettings: LiveSettings = {
  host: '192.168.0.67',
  port: 81,
  deadzone: 0.08,
  maxOutput: 1,
  sendRateHz: 20,
  timeoutSeconds: 1,
}

const defaultLayers: LayerVisibility = {
  track: true,
  points: true,
  heatmap: true,
}

function App() {
  const [mission, setMission] = useState<AquaMission>()
  const [missionError, setMissionError] = useState('')
  const [metricId, setMetricId] = useState('temperature')
  const [normalizedTime, setNormalizedTime] = useState(0)
  const [isPlaying, setIsPlaying] = useState(true)
  const [activeTab, setActiveTab] = useState<TabId>('sensors')
  const [liveMode, setLiveMode] = useState(false)
  const [joystick, setJoystick] = useState<[number, number]>([0, 0])
  const [layers, setLayers] = useLocalStorageState('aquascan.layers', defaultLayers)
  const [settings, setSettings] = useLocalStorageState('aquascan.liveSettings', defaultSettings)
  const live = useLiveBoat(settings, liveMode, joystick)

  const segment = useMemo(() => getPlaybackSegment(mission, normalizedTime), [mission, normalizedTime])
  const boatHeadingRad = useMemo(() => {
    if (!segment) return 0
    const dx = segment.to.localPosition[0] - segment.from.localPosition[0]
    const dz = segment.to.localPosition[2] - segment.from.localPosition[2]
    return Math.hypot(dx, dz) > 0.001 ? Math.atan2(dx, dz) : 0
  }, [segment])
  const metrics = useMemo(() => listMissionMetrics(mission), [mission])
  const descriptor = useMemo(() => getMetricDescriptor(metricId), [metricId])
  const currentValue = metricValue(segment?.sample, metricId)
  const prediction = useMemo(() => predictWaterQuality(mission, segment?.sample), [mission, segment?.sample])
  const durationSeconds = missionDurationSeconds(mission)
  const chartData = useMemo(
    () =>
      mission?.samples.map((sample, index) => ({
        index,
        label: new Date(sample.timestamp).toLocaleTimeString([], { minute: '2-digit', second: '2-digit' }),
        value: metricValue(sample, metricId) ?? null,
      })) ?? [],
    [mission, metricId],
  )

  useEffect(() => {
    loadMissionFromUrl('/missions/demo-mission.csv')
      .then((loaded) => {
        setMission(loaded)
        setMetricId('temperature')
        setMissionError('')
      })
      .catch((error: unknown) => setMissionError(error instanceof Error ? error.message : 'Failed to load demo mission'))
  }, [])

  useEffect(() => {
    if (!isPlaying || !mission || durationSeconds <= 0 || liveMode) return
    const timer = window.setInterval(() => {
      setNormalizedTime((value) => {
        const next = value + 1 / durationSeconds / 12
        return next > 1 ? 0 : next
      })
    }, 1000 / 12)
    return () => window.clearInterval(timer)
  }, [durationSeconds, isPlaying, liveMode, mission])

  const loadFile = async (file: File | undefined) => {
    if (!file) return
    try {
      const loaded = await loadMissionFromFile(file)
      setMission(loaded)
      setMetricId(listMissionMetrics(loaded)[0]?.id ?? 'temperature')
      setNormalizedTime(0)
      setMissionError('')
    } catch (error) {
      setMissionError(error instanceof Error ? error.message : 'Failed to load mission')
    }
  }

  const connectionLabel =
    live.socketState === 'connected'
      ? `Connected ${settings.host}:${settings.port}`
      : live.socketState === 'connecting'
        ? `Connecting ${settings.host}:${settings.port}`
        : live.socketState === 'error'
          ? 'Connection error'
          : liveMode
            ? 'Live mode ready'
            : 'Playback mode'

  return (
    <main className="app-shell">
      <header className="top-bar">
        <div>
          <p className="eyebrow">AQUAScan Web</p>
          <h1>Mission control</h1>
        </div>
        <div className="status-strip">
          <StatusPill icon={<Radio size={16} />} label={connectionLabel} tone={live.socketState === 'connected' ? 'good' : live.socketState === 'error' ? 'bad' : 'neutral'} />
          <StatusPill icon={<Gauge size={16} />} label={`L ${live.status.leftMicros} / R ${live.status.rightMicros} us`} tone={live.armed ? 'good' : 'neutral'} />
          <StatusPill icon={<ShieldAlert size={16} />} label={live.estop ? 'E-stop latched' : live.armed ? 'Armed' : 'Safe'} tone={live.estop ? 'bad' : live.armed ? 'warn' : 'neutral'} />
        </div>
      </header>

      <section className="workspace">
        <aside className="control-panel">
          <nav className="tab-rail">
            <TabButton id="drive" label="Drive" icon={<ShipWheel size={17} />} active={activeTab === 'drive'} onClick={setActiveTab} />
            <TabButton id="ai" label="AI" icon={<BrainCircuit size={17} />} active={activeTab === 'ai'} onClick={setActiveTab} />
            <TabButton id="sensors" label="Sensors" icon={<Activity size={17} />} active={activeTab === 'sensors'} onClick={setActiveTab} />
          </nav>

          {activeTab === 'drive' && (
            <section className="panel-section">
              <div className="section-heading">
                <h2>Live drive</h2>
                <label className="switch-row">
                  <input type="checkbox" checked={liveMode} onChange={(event) => setLiveMode(event.target.checked)} />
                  <span>Live control mode</span>
                </label>
              </div>

              <div className="form-grid">
                <Field label="Boat host" value={settings.host} onChange={(value) => setSettings({ ...settings, host: value })} />
                <Field label="Port" type="number" value={settings.port} onChange={(value) => setSettings({ ...settings, port: Number(value) || 81 })} />
                <Field label="Deadzone" type="number" step="0.01" value={settings.deadzone} onChange={(value) => setSettings({ ...settings, deadzone: Number(value) || 0 })} />
                <Field label="Max output" type="number" step="0.05" value={settings.maxOutput} onChange={(value) => setSettings({ ...settings, maxOutput: Number(value) || 1 })} />
              </div>

              <div className="button-row">
                <button className="primary-button" disabled={!liveMode || live.socketState === 'connecting'} onClick={() => (live.socketState === 'connected' ? live.disconnect('Operator disconnected') : live.connect())}>
                  <Power size={16} />
                  {live.socketState === 'connected' ? 'Disconnect' : 'Connect'}
                </button>
                <button className="secondary-button" disabled={!liveMode || live.socketState !== 'connected' || live.estop} onClick={live.toggleArm}>
                  {live.armed ? 'Disarm' : 'Arm'}
                </button>
                <button className="danger-button" disabled={!liveMode} onClick={live.estop ? live.resetEstop : live.triggerEstop}>
                  {live.estop ? 'Reset E-stop' : 'E-stop'}
                </button>
              </div>

              <Joystick value={joystick} disabled={!liveMode || live.socketState !== 'connected' || live.estop} onChange={setJoystick} />
              <div className="telemetry-grid">
                <Readout label="Joystick X" value={joystick[0].toFixed(2)} />
                <Readout label="Joystick Y" value={joystick[1].toFixed(2)} />
                <Readout label="Left ESC" value={`${live.lastCommand.leftMicros} us`} />
                <Readout label="Right ESC" value={`${live.lastCommand.rightMicros} us`} />
              </div>
            </section>
          )}

          {activeTab === 'ai' && (
            <section className="panel-section">
              <div className="section-heading">
                <h2>AI inference</h2>
                <span className="muted">{prediction.backendName}</span>
              </div>
              <p className="status-copy">{prediction.status}</p>
              <div className="ai-grid">
                <Readout label="Current O2" value={`${prediction.oxygenNow.toFixed(2)} mg/L`} />
                <Readout label="Bloom risk" value={`${Math.round(prediction.bloomRisk * 100)}%`} />
                <Readout label="Anomaly" value={`${Math.round(prediction.anomalyRisk * 100)}%`} />
              </div>
              <div className="forecast-row">
                <span>+30 min {prediction.oxygen30Minutes.toFixed(2)}</span>
                <span>+60 min {prediction.oxygen60Minutes.toFixed(2)}</span>
                <span>+120 min {prediction.oxygen120Minutes.toFixed(2)}</span>
              </div>
            </section>
          )}

          {activeTab === 'sensors' && (
            <section className="panel-section">
              <div className="section-heading">
                <h2>Sensor data</h2>
                <label className="upload-button">
                  <Upload size={15} />
                  Upload
                  <input type="file" accept=".csv,.json" onChange={(event) => void loadFile(event.target.files?.[0])} />
                </label>
              </div>
              {missionError && <p className="error-copy">{missionError}</p>}
              <label className="field-stack">
                <span>Metric</span>
                <select value={metricId} onChange={(event) => setMetricId(event.target.value)}>
                  {metrics.map((metric) => (
                    <option key={metric.id} value={metric.id}>
                      {metric.displayName}
                    </option>
                  ))}
                </select>
              </label>
              <div className="layer-list">
                <LayerToggle label="Track" checked={layers.track} onChange={(track) => setLayers({ ...layers, track })} />
                <LayerToggle label="Sample points" checked={layers.points} onChange={(points) => setLayers({ ...layers, points })} />
                <LayerToggle label="Heatmap" checked={layers.heatmap} onChange={(heatmap) => setLayers({ ...layers, heatmap })} />
              </div>
              <div className="chart-card">
                <ResponsiveContainer width="100%" height={150}>
                  <AreaChart data={chartData}>
                    <defs>
                      <linearGradient id="metricFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#0ea5ad" stopOpacity={0.7} />
                        <stop offset="95%" stopColor="#0ea5ad" stopOpacity={0.04} />
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="label" hide />
                    <YAxis hide domain={['auto', 'auto']} />
                    <Tooltip contentStyle={{ background: '#101819', border: '1px solid #244145', color: '#e7f4ef' }} />
                    <Area type="monotone" dataKey="value" stroke="#18c2c8" fill="url(#metricFill)" strokeWidth={2} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </section>
          )}
        </aside>

        <section className="scene-panel">
          <BoatScene mission={mission} metricId={metricId} boatPosition={segment?.position ?? [0, 0, 0]} boatHeadingRad={boatHeadingRad} layers={layers} />
        </section>

        <aside className="info-panel">
          <div className="metric-summary">
            <span>{descriptor.displayName}</span>
            <strong>{formatMetricValue(currentValue, descriptor)}</strong>
            <div className="legend-bar" style={{ background: gradientCss(descriptor) }} />
            <small>
              {descriptor.expectedRange[0]} {descriptor.unit} - {descriptor.expectedRange[1]} {descriptor.unit}
            </small>
          </div>
          <div className="telemetry-grid single">
            <Readout label="Mission" value={mission?.missionName ?? 'No mission'} />
            <Readout label="Samples" value={mission ? String(mission.samples.length) : '--'} />
            <Readout label="Battery" value={segment?.sample.batteryPercent !== undefined ? `${segment.sample.batteryPercent.toFixed(0)}%` : '--'} />
            <Readout label="Depth" value={segment?.sample.depthMeters !== undefined ? `${segment.sample.depthMeters.toFixed(2)} m` : '--'} />
            <Readout label="RSSI" value={live.status.rssi !== undefined ? `${live.status.rssi} dBm` : '--'} />
          </div>
        </aside>
      </section>

      <footer className="timeline-panel">
        <button className="primary-button" disabled={liveMode || !mission} onClick={() => setIsPlaying((value) => !value)}>
          {isPlaying ? 'Pause' : 'Play'}
        </button>
        <input type="range" min={0} max={1} step={0.001} value={normalizedTime} onChange={(event) => setNormalizedTime(Number(event.target.value))} />
        <span>{durationSeconds > 0 ? `${Math.round(normalizedTime * durationSeconds)}s / ${Math.round(durationSeconds)}s` : '0s / 0s'}</span>
      </footer>
    </main>
  )
}

function StatusPill({ icon, label, tone }: { icon: ReactNode; label: string; tone: 'neutral' | 'good' | 'warn' | 'bad' }) {
  return (
    <div className="status-pill" data-tone={tone}>
      {icon}
      <span>{label}</span>
    </div>
  )
}

function TabButton({ id, label, icon, active, onClick }: { id: TabId; label: string; icon: ReactNode; active: boolean; onClick: (id: TabId) => void }) {
  return (
    <button className="tab-button" data-active={active} onClick={() => onClick(id)}>
      {icon}
      {label}
    </button>
  )
}

function Field({
  label,
  value,
  onChange,
  type = 'text',
  step,
}: {
  label: string
  value: string | number
  onChange: (value: string) => void
  type?: string
  step?: string
}) {
  return (
    <label className="field-stack">
      <span>{label}</span>
      <input type={type} step={step} value={value} onChange={(event) => onChange(event.target.value)} />
    </label>
  )
}

function LayerToggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (checked: boolean) => void }) {
  return (
    <label className="check-row">
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />
      <span>{label}</span>
    </label>
  )
}

function Readout({ label, value }: { label: string; value: string }) {
  return (
    <div className="readout">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  )
}

export default App
