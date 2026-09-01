import {
  Atom,
  Binary,
  BrainCircuit,
  Cpu,
  Database,
  Download,
  Gauge,
  GitBranch,
  Grid3X3,
  LineChart as LineChartIcon,
  Play,
  RadioTower,
  RotateCcw,
  ScanLine,
  Sparkles,
  Waves,
  Zap,
} from 'lucide-react'
import { useMemo, useState, type CSSProperties, type ReactNode } from 'react'
import {
  Area,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Line,
  LineChart,
  PolarAngleAxis,
  PolarGrid,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import './MarisLab.css'

type GraphMode = 'cascade' | 'spectral' | 'risk' | 'depth'
type Density = 'normal' | 'extreme'

type SeriesPoint = {
  tick: number
  oxygen: number
  bloom: number
  anomaly: number
  turbidity: number
  temperature: number
  signal: number
  depth: number
}

type Finding = {
  id: string
  label: string
  confidence: number
  tone: 'good' | 'warn' | 'bad'
  detail: string
}

const modes: Array<{ id: GraphMode; label: string; detail: string }> = [
  { id: 'cascade', label: 'Cascade', detail: 'Multi-sensor temporal overlays' },
  { id: 'spectral', label: 'Spectral', detail: 'Frequency bands and probe noise' },
  { id: 'risk', label: 'Risk', detail: 'Bloom and anomaly synthesis' },
  { id: 'depth', label: 'Depth', detail: 'Water-column profile generator' },
]

const palette = ['#3be7ff', '#7cffb2', '#ffd166', '#ff5c8a', '#a78bfa', '#ff8f3d']

function MarisLab() {
  const [mode, setMode] = useState<GraphMode>('cascade')
  const [seed, setSeed] = useState(42)
  const [density, setDensity] = useState<Density>('extreme')
  const [scanLevel, setScanLevel] = useState(68)
  const [selectedMetric, setSelectedMetric] = useState('oxygen')
  const [events, setEvents] = useState<string[]>(['Booted Maris analysis runtime', 'Loaded synthetic watershed mission'])

  const frameCount = density === 'extreme' ? 96 : 48
  const data = useMemo(() => generateSeries(seed, frameCount, scanLevel), [frameCount, scanLevel, seed])
  const spectrum = useMemo(() => generateSpectrum(data, seed), [data, seed])
  const heatCells = useMemo(() => generateHeatCells(data), [data])
  const radar = useMemo(() => buildRadar(data), [data])
  const findings = useMemo(() => buildFindings(data, scanLevel), [data, scanLevel])
  const summary = useMemo(() => summarize(data, findings), [data, findings])

  const runScan = () => {
    setSeed((value) => value + 17)
    setScanLevel((value) => Math.min(96, value + 3))
    setEvents((items) => [`Generated ${mode} graph packet #${seed + 17}`, `Reweighted ${selectedMetric} channel`, ...items].slice(0, 7))
  }

  const randomize = () => {
    setSeed((value) => value * 3 + 11)
    setScanLevel(Math.round(45 + pseudo(seed + 91) * 45))
    setEvents((items) => ['Randomized signal field and model weights', ...items].slice(0, 7))
  }

  const exportSnapshot = () => {
    const payload = {
      app: 'Maris by AQUAScan',
      generatedAtUtc: new Date().toISOString(),
      mode,
      density,
      scanLevel,
      selectedMetric,
      summary,
      findings,
      sample: data.slice(0, 12),
    }
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `maris-${mode}-snapshot.json`
    anchor.click()
    URL.revokeObjectURL(url)
    setEvents((items) => ['Exported graph snapshot JSON', ...items].slice(0, 7))
  }

  return (
    <main className="maris-lab" data-density={density}>
      <header className="maris-command">
        <div className="maris-brand-lockup">
          <div className="maris-mark"><Atom size={26} /></div>
          <div>
            <p>Congressional App Challenge Console</p>
            <h1>Maris</h1>
          </div>
        </div>
        <div className="maris-command-strip" aria-label="Maris runtime status">
          <StatusChip icon={<Cpu size={15} />} label="Neural graph runtime" value="online" tone="good" />
          <StatusChip icon={<RadioTower size={15} />} label="Signal frames" value={String(frameCount)} tone="neutral" />
          <StatusChip icon={<BrainCircuit size={15} />} label="Model confidence" value={`${summary.confidence}%`} tone={summary.confidence > 72 ? 'good' : 'warn'} />
          <StatusChip icon={<Zap size={15} />} label="Anomaly field" value={`${summary.anomaly}%`} tone={summary.anomaly > 62 ? 'bad' : summary.anomaly > 38 ? 'warn' : 'good'} />
        </div>
      </header>

      <section className="maris-grid">
        <aside className="maris-sidebar">
          <section className="maris-panel maris-control-panel">
            <div className="maris-panel-heading">
              <p>Graph generator</p>
              <h2>Analysis modes</h2>
            </div>
            <div className="maris-mode-list">
              {modes.map((item) => (
                <button key={item.id} type="button" data-active={mode === item.id} onClick={() => setMode(item.id)}>
                  <strong>{item.label}</strong>
                  <span>{item.detail}</span>
                </button>
              ))}
            </div>
            <label className="maris-field">
              <span>Primary channel</span>
              <select value={selectedMetric} onChange={(event) => setSelectedMetric(event.target.value)}>
                <option value="oxygen">Dissolved oxygen</option>
                <option value="bloom">Bloom probability</option>
                <option value="anomaly">Anomaly vector</option>
                <option value="turbidity">Turbidity plume</option>
                <option value="temperature">Thermal layer</option>
              </select>
            </label>
            <label className="maris-field">
              <span>Scan intensity {scanLevel}%</span>
              <input type="range" min={20} max={96} value={scanLevel} onChange={(event) => setScanLevel(Number(event.target.value))} />
            </label>
            <div className="maris-segmented" aria-label="Data density">
              <button type="button" data-active={density === 'normal'} onClick={() => setDensity('normal')}>Normal</button>
              <button type="button" data-active={density === 'extreme'} onClick={() => setDensity('extreme')}>Extreme</button>
            </div>
            <div className="maris-action-grid">
              <button type="button" className="maris-primary" onClick={runScan}><Play size={16} /> Generate</button>
              <button type="button" onClick={randomize}><Sparkles size={16} /> Randomize</button>
              <button type="button" onClick={() => setScanLevel(68)}><RotateCcw size={16} /> Reset</button>
              <button type="button" onClick={exportSnapshot}><Download size={16} /> Export</button>
            </div>
          </section>

          <section className="maris-panel">
            <div className="maris-panel-heading">
              <p>Decision engine</p>
              <h2>Detected phenomena</h2>
            </div>
            <div className="maris-findings">
              {findings.map((finding) => (
                <article key={finding.id} data-tone={finding.tone}>
                  <strong>{finding.label}</strong>
                  <span>{finding.confidence}% confidence</span>
                  <small>{finding.detail}</small>
                </article>
              ))}
            </div>
          </section>
        </aside>

        <section className="maris-stage">
          <section className="maris-panel maris-hero-panel">
            <div className="maris-panel-heading">
              <p>Live synthesis canvas</p>
              <h2>{modeTitle(mode)}</h2>
            </div>
            <div className="maris-hero-chart">
              {mode === 'cascade' && <CascadeGraph data={data} />}
              {mode === 'spectral' && <SpectralGraph data={spectrum} />}
              {mode === 'risk' && <RiskGraph data={data} />}
              {mode === 'depth' && <DepthGraph data={data} />}
            </div>
          </section>

          <section className="maris-panel-grid">
            <section className="maris-panel">
              <div className="maris-panel-heading compact">
                <p>Correlation matrix</p>
                <h2>Sensor heat field</h2>
              </div>
              <HeatMatrix cells={heatCells} />
            </section>

            <section className="maris-panel">
              <div className="maris-panel-heading compact">
                <p>Model geometry</p>
                <h2>Environmental shape</h2>
              </div>
              <div className="maris-mini-chart">
                <ResponsiveContainer width="100%" height="100%">
                  <RadarChart data={radar}>
                    <PolarGrid stroke="rgba(112, 241, 255, 0.22)" />
                    <PolarAngleAxis dataKey="metric" tick={{ fill: '#8bdce8', fontSize: 10 }} />
                    <Radar dataKey="value" stroke="#7cffb2" fill="#3be7ff" fillOpacity={0.32} />
                  </RadarChart>
                </ResponsiveContainer>
              </div>
            </section>

            <section className="maris-panel maris-terminal-panel">
              <div className="maris-panel-heading compact">
                <p>Runtime log</p>
                <h2>Graph operations</h2>
              </div>
              <div className="maris-terminal">
                {events.map((event, index) => (
                  <p key={`${event}-${index}`}><span>{String(index + 1).padStart(2, '0')}</span>{event}</p>
                ))}
              </div>
            </section>
          </section>
        </section>

        <aside className="maris-rightbar">
          <section className="maris-panel maris-metrics-panel">
            <div className="maris-panel-heading">
              <p>System readouts</p>
              <h2>Current synthetic run</h2>
            </div>
            <MetricReadout icon={<Gauge />} label="Risk pressure" value={`${summary.risk}%`} />
            <MetricReadout icon={<Waves />} label="Oxygen stability" value={`${summary.oxygen}%`} />
            <MetricReadout icon={<ScanLine />} label="Signal clarity" value={`${summary.signal}%`} />
            <MetricReadout icon={<Database />} label="Graph packets" value={`${frameCount * 7}`} />
          </section>

          <section className="maris-panel">
            <div className="maris-panel-heading">
              <p>Output tools</p>
              <h2>Performative controls</h2>
            </div>
            <div className="maris-tool-stack">
              <button type="button" onClick={runScan}><LineChartIcon size={16} /> Build forecast ribbons</button>
              <button type="button" onClick={randomize}><Grid3X3 size={16} /> Recompute matrix</button>
              <button type="button" onClick={runScan}><GitBranch size={16} /> Branch scenario tree</button>
              <button type="button" onClick={exportSnapshot}><Binary size={16} /> Compile report packet</button>
            </div>
          </section>

          <section className="maris-panel maris-waterfall-panel">
            <div className="maris-panel-heading compact">
              <p>Packet waterfall</p>
              <h2>Encoded samples</h2>
            </div>
            <div className="maris-waterfall" aria-label="Encoded packet waterfall">
              {data.slice(0, 44).map((point, index) => (
                <span key={`${point.tick}-${index}`} style={{ '--level': `${Math.round(point.signal)}%`, '--delay': `${index * 18}ms` } as CSSProperties} />
              ))}
            </div>
          </section>
        </aside>
      </section>
    </main>
  )
}

function CascadeGraph({ data }: { data: SeriesPoint[] }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <ComposedChart data={data}>
        <CartesianGrid stroke="rgba(112, 241, 255, 0.12)" vertical={false} />
        <XAxis dataKey="tick" tick={{ fill: '#8bdce8', fontSize: 11 }} />
        <YAxis tick={{ fill: '#8bdce8', fontSize: 11 }} />
        <Tooltip contentStyle={tooltipStyle} />
        <Area type="monotone" dataKey="bloom" fill="#ff5c8a" fillOpacity={0.18} stroke="#ff5c8a" strokeWidth={2} />
        <Line type="monotone" dataKey="oxygen" stroke="#7cffb2" strokeWidth={3} dot={false} />
        <Line type="monotone" dataKey="turbidity" stroke="#3be7ff" strokeWidth={2} dot={false} />
        <Bar dataKey="anomaly" fill="#ffd166" opacity={0.42} />
      </ComposedChart>
    </ResponsiveContainer>
  )
}

function SpectralGraph({ data }: { data: Array<{ band: string; energy: number; noise: number }> }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data}>
        <CartesianGrid stroke="rgba(112, 241, 255, 0.12)" vertical={false} />
        <XAxis dataKey="band" tick={{ fill: '#8bdce8', fontSize: 11 }} />
        <YAxis tick={{ fill: '#8bdce8', fontSize: 11 }} />
        <Tooltip contentStyle={tooltipStyle} />
        <Bar dataKey="energy" radius={[4, 4, 0, 0]}>
          {data.map((_, index) => <Cell key={`energy-${index}`} fill={palette[index % palette.length]} />)}
        </Bar>
        <Bar dataKey="noise" fill="rgba(255,255,255,0.24)" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  )
}

function RiskGraph({ data }: { data: SeriesPoint[] }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <ScatterChart>
        <CartesianGrid stroke="rgba(112, 241, 255, 0.12)" />
        <XAxis dataKey="bloom" name="bloom" tick={{ fill: '#8bdce8', fontSize: 11 }} />
        <YAxis dataKey="anomaly" name="anomaly" tick={{ fill: '#8bdce8', fontSize: 11 }} />
        <Tooltip cursor={{ strokeDasharray: '3 3' }} contentStyle={tooltipStyle} />
        <Scatter name="Risk vectors" data={data} fill="#3be7ff">
          {data.map((point, index) => <Cell key={`risk-${index}`} fill={point.anomaly > 58 ? '#ff5c8a' : point.bloom > 60 ? '#ffd166' : '#3be7ff'} />)}
        </Scatter>
      </ScatterChart>
    </ResponsiveContainer>
  )
}

function DepthGraph({ data }: { data: SeriesPoint[] }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={data}>
        <CartesianGrid stroke="rgba(112, 241, 255, 0.12)" />
        <XAxis dataKey="temperature" tick={{ fill: '#8bdce8', fontSize: 11 }} />
        <YAxis dataKey="depth" reversed tick={{ fill: '#8bdce8', fontSize: 11 }} />
        <Tooltip contentStyle={tooltipStyle} />
        <Line type="monotone" dataKey="depth" stroke="#3be7ff" strokeWidth={2} dot={false} />
        <Line type="monotone" dataKey="oxygen" stroke="#7cffb2" strokeWidth={2} dot={false} />
      </LineChart>
    </ResponsiveContainer>
  )
}

function HeatMatrix({ cells }: { cells: Array<{ id: string; level: number }> }) {
  return (
    <div className="maris-heat-grid">
      {cells.map((cell) => (
        <span key={cell.id} style={{ '--level': `${cell.level}%` } as CSSProperties} />
      ))}
    </div>
  )
}

function StatusChip({ icon, label, value, tone }: { icon: ReactNode; label: string; value: string; tone: 'neutral' | 'good' | 'warn' | 'bad' }) {
  return (
    <div className="maris-status-chip" data-tone={tone}>
      {icon}
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  )
}

function MetricReadout({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <div className="maris-readout">
      {icon}
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  )
}

function generateSeries(seed: number, count: number, scanLevel: number): SeriesPoint[] {
  return Array.from({ length: count }, (_, index) => {
    const wave = Math.sin((index + seed) / 7)
    const pulse = Math.cos((index + seed * 0.4) / 11)
    const drift = pseudo(seed + index * 13) - 0.5
    const oxygen = clamp(58 + wave * 15 - scanLevel * 0.08 + drift * 8)
    const bloom = clamp(38 + pulse * 20 + scanLevel * 0.18 + drift * 12)
    const anomaly = clamp(18 + Math.abs(wave * pulse) * 58 + pseudo(seed * 2 + index) * 16)
    return {
      tick: index,
      oxygen,
      bloom,
      anomaly,
      turbidity: clamp(35 + Math.sin(index / 4) * 24 + drift * 22),
      temperature: clamp(48 + Math.cos(index / 9) * 16 + scanLevel * 0.12),
      signal: clamp(52 + Math.sin(index / 3 + seed) * 30 + pseudo(index + seed) * 20),
      depth: clamp(8 + index * 0.32 + Math.sin(index / 6) * 4, 2, 42),
    }
  })
}

function generateSpectrum(data: SeriesPoint[], seed: number) {
  return ['O2-LOW', 'O2-HI', 'PHASE', 'TURB', 'THERM', 'UV', 'CHL', 'NOISE'].map((band, index) => ({
    band,
    energy: Math.round(clamp((data[index * 7]?.signal ?? 40) + pseudo(seed + index) * 34)),
    noise: Math.round(clamp((data[index * 5]?.anomaly ?? 20) * 0.58 + pseudo(seed - index) * 22)),
  }))
}

function generateHeatCells(data: SeriesPoint[]) {
  return Array.from({ length: 80 }, (_, index) => {
    const point = data[index % data.length]
    const level = clamp((point.bloom * 0.38 + point.anomaly * 0.36 + point.turbidity * 0.26 + index) % 100)
    return { id: `${point.tick}-${index}`, level }
  })
}

function buildRadar(data: SeriesPoint[]) {
  const avg = (key: keyof SeriesPoint) => data.reduce((sum, point) => sum + Number(point[key]), 0) / Math.max(1, data.length)
  return [
    { metric: 'oxygen', value: Math.round(avg('oxygen')) },
    { metric: 'bloom', value: Math.round(avg('bloom')) },
    { metric: 'anomaly', value: Math.round(avg('anomaly')) },
    { metric: 'turbidity', value: Math.round(avg('turbidity')) },
    { metric: 'thermal', value: Math.round(avg('temperature')) },
    { metric: 'signal', value: Math.round(avg('signal')) },
  ]
}

function buildFindings(data: SeriesPoint[], scanLevel: number): Finding[] {
  const summary = summarize(data, [])
  return [
    {
      id: 'oxygen',
      label: 'Oxygen stability corridor',
      confidence: Math.round(clamp(summary.oxygen + scanLevel * 0.12)),
      tone: summary.oxygen > 62 ? 'good' : 'warn',
      detail: summary.oxygen > 62 ? 'Stable enough for public-water review mode.' : 'Oxygen trace is uneven across the sample window.',
    },
    {
      id: 'bloom',
      label: 'Bloom pressure cluster',
      confidence: Math.round(clamp(summary.risk + 12)),
      tone: summary.risk > 64 ? 'bad' : summary.risk > 42 ? 'warn' : 'good',
      detail: 'Combines thermal, light, turbidity, and synthetic chlorophyll signals.',
    },
    {
      id: 'anomaly',
      label: 'Outlier plume candidate',
      confidence: Math.round(clamp(summary.anomaly + 18)),
      tone: summary.anomaly > 58 ? 'bad' : summary.anomaly > 35 ? 'warn' : 'good',
      detail: 'Flags points that visually deserve investigation in a field report.',
    },
  ]
}

function summarize(data: SeriesPoint[], findings: Finding[]) {
  const avg = (key: keyof SeriesPoint) => data.reduce((sum, point) => sum + Number(point[key]), 0) / Math.max(1, data.length)
  const oxygen = Math.round(clamp(avg('oxygen')))
  const risk = Math.round(clamp((avg('bloom') + avg('turbidity')) / 2))
  const anomaly = Math.round(clamp(avg('anomaly')))
  const signal = Math.round(clamp(avg('signal')))
  const confidence = Math.round(clamp((signal + oxygen + (findings[0]?.confidence ?? 72)) / 3))
  return { oxygen, risk, anomaly, signal, confidence }
}

function pseudo(value: number) {
  const x = Math.sin(value * 999) * 10000
  return x - Math.floor(x)
}

function clamp(value: number, min = 0, max = 100) {
  return Math.max(min, Math.min(max, value))
}

function modeTitle(mode: GraphMode) {
  if (mode === 'spectral') return 'Spectral decomposition graph'
  if (mode === 'risk') return 'Risk-vector scatter synthesis'
  if (mode === 'depth') return 'Depth profile graph generator'
  return 'Sensor cascade graph generator'
}

const tooltipStyle = {
  background: '#061014',
  border: '1px solid rgba(59, 231, 255, 0.32)',
  color: '#e9fbff',
}

export default MarisLab
