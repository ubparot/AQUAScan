import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent, type DragEvent, type KeyboardEvent } from 'react'
import {
  Area,
  AreaChart,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { loadMissionFromFile, loadMissionFromUrl } from './domain/missionLoader'
import {
  analyzeMission,
  findingsFor,
  formatDepth,
  formatValue,
  metricStats,
  readingsCsv,
  stationName,
  stationValue,
  summaryJson,
  type Analysis,
  type Layer,
  type Metric,
  type Station,
} from './maris/analysis'
import './MarisLab.css'

const DATASETS = [
  { id: 'profiles', label: 'Pond profiles', file: '/missions/do-extrapolated-mission.csv' },
  { id: 'transect', label: 'Pond transect', file: '/missions/demo-mission.csv' },
  { id: 'pool', label: 'Pool test', file: '/missions/pool-demo-mission.csv' },
] as const

type DatasetId = (typeof DATASETS)[number]['id'] | 'upload'

const LAYERS: Array<{ id: Layer; label: string }> = [
  { id: 'surface', label: 'Surface' },
  { id: 'average', label: 'Average' },
  { id: 'bottom', label: 'Bottom' },
]

/** Sequential scale, deep blue (low) to warm yellow (high). */
const SCALE = ['#123a7a', '#1f6fb2', '#2fa4b9', '#7cc9a0', '#e9cf5b']
const SELECTED = '#0071e3'

function colorAt(t: number) {
  const x = Math.min(1, Math.max(0, Number.isFinite(t) ? t : 0.5)) * (SCALE.length - 1)
  const i = Math.min(SCALE.length - 2, Math.floor(x))
  const mix = (a: string, b: string, k: number) => {
    const pa = [1, 3, 5].map((o) => parseInt(a.slice(o, o + 2), 16))
    const pb = [1, 3, 5].map((o) => parseInt(b.slice(o, o + 2), 16))
    return `rgb(${pa.map((v, j) => Math.round(v + (pb[j] - v) * k)).join(',')})`
  }
  return mix(SCALE[i], SCALE[i + 1], x - i)
}

function download(name: string, contents: string, type: string) {
  const url = URL.createObjectURL(new Blob([contents], { type }))
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = name
  anchor.click()
  URL.revokeObjectURL(url)
}

function formatDuration(seconds: number) {
  const minutes = Math.floor(seconds / 60)
  const rest = Math.round(seconds % 60)
  return minutes ? `${minutes} min ${rest} s` : `${rest} s`
}

function MarisLab() {
  const [datasetId, setDatasetId] = useState<DatasetId>('profiles')
  const [analysis, setAnalysis] = useState<Analysis>()
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [metricId, setMetricId] = useState('do')
  const [layer, setLayer] = useState<Layer>('bottom')
  const [selected, setSelected] = useState<string>()
  const [dragging, setDragging] = useState(false)
  const fileInput = useRef<HTMLInputElement>(null)

  const adopt = useCallback((next: Analysis) => {
    setAnalysis(next)
    setError('')
    const metric = next.metrics.find((item) => item.id === 'do') ?? next.metrics[0]
    setMetricId(metric?.id ?? '')
    setLayer(next.hasProfiles ? 'bottom' : 'average')
    // Start on the most telling place: where the metric bottoms out, if the probe profiled it there.
    const stats = metric && metricStats(next, metric.id)
    const profiled = next.stations.filter((station) => station.maxDepth - station.minDepth >= 0.4)
    const start = profiled.find((station) => station.id === stats?.minAt.station) ?? profiled[0]
    setSelected(start?.id ?? stats?.minAt.station ?? next.stations[0]?.id)
  }, [])

  // Fetch a bundled dataset; `token` drops stale responses when the visitor switches quickly.
  const request = useRef(0)
  const fetchDataset = useCallback((id: DatasetId) => {
    const dataset = DATASETS.find((item) => item.id === id)
    if (!dataset) return
    const token = ++request.current
    loadMissionFromUrl(dataset.file)
      .then((mission) => { if (token === request.current) adopt(analyzeMission(mission)) })
      .catch((reason: unknown) => { if (token === request.current) setError(reason instanceof Error ? reason.message : 'Could not load the dataset.') })
      .finally(() => { if (token === request.current) setLoading(false) })
  }, [adopt])

  useEffect(() => fetchDataset('profiles'), [fetchDataset])

  const chooseDataset = (id: DatasetId) => {
    if (id === datasetId) return
    setDatasetId(id)
    setLoading(true)
    fetchDataset(id)
  }

  const openFile = async (file: File | undefined) => {
    if (!file) return
    setLoading(true)
    request.current++ // a newer request: ignore any bundled dataset still loading
    try {
      const mission = await loadMissionFromFile(file)
      adopt(analyzeMission(mission))
      setDatasetId('upload')
    } catch (reason) {
      setError(reason instanceof Error ? `${file.name}: ${reason.message}` : `Could not read ${file.name}.`)
    } finally {
      setLoading(false)
    }
  }

  const onFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    void openFile(event.target.files?.[0])
    event.target.value = ''
  }

  const onDrop = (event: DragEvent) => {
    event.preventDefault()
    setDragging(false)
    void openFile(event.dataTransfer.files?.[0])
  }

  const metric = analysis?.metrics.find((item) => item.id === metricId) ?? analysis?.metrics[0]

  return (
    <main
      className="maris"
      onDragOver={(event) => { event.preventDefault(); setDragging(true) }}
      onDragLeave={(event) => { if (event.currentTarget === event.target) setDragging(false) }}
      onDrop={onDrop}
    >
      <header className="maris-head">
        <div>
          <h1>Maris</h1>
          <p>Explore AquaScan water-quality data by place and by depth.</p>
        </div>
        <div className="maris-source">
          <div className="maris-segmented" role="group" aria-label="Dataset">
            {DATASETS.map((dataset) => (
              <button key={dataset.id} type="button" aria-pressed={datasetId === dataset.id} onClick={() => chooseDataset(dataset.id)}>
                {dataset.label}
              </button>
            ))}
            {datasetId === 'upload' && analysis && <button type="button" aria-pressed="true">{analysis.name}</button>}
          </div>
          <button className="maris-upload" type="button" onClick={() => fileInput.current?.click()}>Upload data</button>
          <input ref={fileInput} type="file" accept=".csv,.json,text/csv,application/json" hidden onChange={onFileChange} aria-label="Upload a mission CSV or JSON file" />
        </div>
      </header>

      <p className="maris-note">
        {datasetId === 'upload'
          ? 'Your file stays in this browser. Nothing is uploaded to a server.'
          : 'Sample datasets for illustration. Upload an AquaScan CSV or JSON, or drop one on the page, to analyze your own mission.'}
      </p>

      {error && <p className="maris-error" role="alert">{error}</p>}

      {!analysis || !metric ? (
        <div className="maris-empty">{loading ? 'Loading data…' : 'No water-quality readings found in this file.'}</div>
      ) : (
        <Workspace
          analysis={analysis}
          metric={metric}
          layer={layer}
          selected={selected}
          onMetric={setMetricId}
          onLayer={setLayer}
          onSelect={setSelected}
          busy={loading}
        />
      )}

      {dragging && <div className="maris-drop" aria-hidden="true"><span>Drop a CSV or JSON file to analyze it</span></div>}
    </main>
  )
}

function Workspace({ analysis, metric, layer, selected, onMetric, onLayer, onSelect, busy }: {
  analysis: Analysis
  metric: Metric
  layer: Layer
  selected?: string
  onMetric: (id: string) => void
  onLayer: (layer: Layer) => void
  onSelect: (id: string) => void
  busy: boolean
}) {
  const stats = metricStats(analysis, metric.id)
  const findings = useMemo(() => findingsFor(analysis, metric), [analysis, metric])
  const station = analysis.stations.find((item) => item.id === selected)
  const scale = (value: number | undefined) => (stats && value !== undefined ? colorAt((value - stats.min) / Math.max(1e-9, stats.max - stats.min)) : '#c7c7cc')

  return (
    <div className="maris-workspace" aria-busy={busy}>
      <div className="maris-toolbar">
        <div className="maris-chips" role="group" aria-label="Measurement" data-lenis-prevent>
          {analysis.metrics.map((item) => (
            <button key={item.id} type="button" aria-pressed={item.id === metric.id} onClick={() => onMetric(item.id)}>{item.name}</button>
          ))}
        </div>
        <div className="maris-actions">
          <button type="button" onClick={() => download(`${analysis.name}-summary.json`, JSON.stringify(summaryJson(analysis, metric, layer), null, 2), 'application/json')}>
            Export summary
          </button>
          <button type="button" onClick={() => download(`${analysis.name}.csv`, readingsCsv(analysis), 'text/csv')}>Export CSV</button>
        </div>
      </div>

      <dl className="maris-stats">
        <div><dt>Readings</dt><dd>{analysis.readings.length}</dd></div>
        <div><dt>{analysis.stations[0]?.label.startsWith('Station') ? 'Stations' : 'Locations'}</dt><dd>{analysis.stations.length}</dd></div>
        <div><dt>Deepest reading</dt><dd>{formatDepth(analysis.maxDepth)}</dd></div>
        <div><dt>Duration</dt><dd>{formatDuration(analysis.durationSeconds)}</dd></div>
      </dl>

      <div className="maris-grid">
        <section className="maris-card maris-map-card" aria-labelledby="maris-map-title">
          <div className="maris-card-head">
            <h2 id="maris-map-title">Map</h2>
            {analysis.hasProfiles && (
              <div className="maris-segmented maris-segmented-small" role="group" aria-label="Depth layer">
                {LAYERS.map((item) => (
                  <button key={item.id} type="button" aria-pressed={layer === item.id} onClick={() => onLayer(item.id)}>{item.label}</button>
                ))}
              </div>
            )}
          </div>
          <MapView analysis={analysis} metric={metric} layer={layer} selected={selected} onSelect={onSelect} color={scale} />
          <div className="maris-legend">
            <span>{formatValue(stats?.min, metric)}</span>
            <i style={{ background: `linear-gradient(90deg, ${SCALE.join(', ')})` }} />
            <span>{formatValue(stats?.max, metric)}</span>
          </div>
          {station && <StationSummary station={station} metric={metric} />}
        </section>

        <section className="maris-card" aria-labelledby="maris-profile-title">
          <div className="maris-card-head">
            <h2 id="maris-profile-title">Depth profile</h2>
            <p>{analysis.hasProfiles ? `${metric.name} against depth at each station` : `${metric.name} against depth`}</p>
          </div>
          <ProfileChart analysis={analysis} metric={metric} selected={selected} onSelect={onSelect} />
        </section>

        <section className="maris-card" aria-labelledby="maris-time-title">
          <div className="maris-card-head">
            <h2 id="maris-time-title">Over time</h2>
            <p>Every reading in the order it was taken</p>
          </div>
          <TimeChart analysis={analysis} metric={metric} />
        </section>
        <section className="maris-card" aria-labelledby="maris-findings-title">
          <div className="maris-card-head"><h2 id="maris-findings-title">What stands out</h2></div>
          <ul className="maris-findings">
            {findings.map((finding) => (
              <li key={finding.title} data-tone={finding.tone}>
                <strong>{finding.title}</strong>
                <span>{finding.detail}</span>
              </li>
            ))}
          </ul>
        </section>

      </div>

      <details className="maris-card maris-table">
        <summary>All readings <span>{analysis.readings.length}</span></summary>
        <div className="maris-table-scroll" data-lenis-prevent>
          <table>
            <thead>
              <tr>
                <th scope="col">Time</th>
                <th scope="col">Location</th>
                <th scope="col">Depth</th>
                {analysis.metrics.map((item) => <th key={item.id} scope="col" aria-current={item.id === metric.id ? 'true' : undefined}>{item.name}{item.unit && <small> {item.unit}</small>}</th>)}
              </tr>
            </thead>
            <tbody>
              {analysis.readings.map((reading) => (
                <tr key={reading.index} data-selected={reading.station === selected} onClick={() => onSelect(reading.station)}>
                  <td>{formatDuration(reading.timeSeconds)}</td>
                  <td>{stationName(analysis, reading.station)}</td>
                  <td>{formatDepth(reading.depth)}</td>
                  {analysis.metrics.map((item) => <td key={item.id}>{formatValue(reading.values[item.id], item, false)}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  )
}

function StationSummary({ station, metric }: { station: Station; metric: Metric }) {
  const surface = stationValue(station, metric.id, 'surface')
  const bottom = stationValue(station, metric.id, 'bottom')
  const profiled = station.maxDepth - station.minDepth >= 0.4
  return (
    <div className="maris-station">
      <strong>{station.label}</strong>
      <span>{station.readings.length} reading{station.readings.length === 1 ? '' : 's'}{profiled ? `, ${formatDepth(station.minDepth)} to ${formatDepth(station.maxDepth)}` : `, ${formatDepth(station.minDepth)}`}</span>
      <span>{profiled ? `${formatValue(surface, metric)} at the surface, ${formatValue(bottom, metric)} at the bottom` : formatValue(surface, metric)}</span>
    </div>
  )
}

function niceLength(meters: number) {
  const steps = [0.1, 0.2, 0.5, 1, 2, 5, 10, 20, 50, 100, 200, 500]
  return steps.reduce((best, step) => (step <= meters ? step : best), steps[0])
}

function MapView({ analysis, metric, layer, selected, onSelect, color }: {
  analysis: Analysis
  metric: Metric
  layer: Layer
  selected?: string
  onSelect: (id: string) => void
  color: (value: number | undefined) => string
}) {
  const width = 640
  const height = 400
  const pad = 56
  const xs = analysis.stations.map((station) => station.x)
  const zs = analysis.stations.map((station) => station.z)
  const span = Math.max(analysis.extentMeters, 2)
  const scale = Math.min((width - pad * 2) / span, (height - pad * 2) / span)
  const cx = (Math.min(...xs) + Math.max(...xs)) / 2
  const cz = (Math.min(...zs) + Math.max(...zs)) / 2
  const project = (x: number, z: number) => [width / 2 + (x - cx) * scale, height / 2 - (z - cz) * scale] as const
  const route = analysis.readings.map((reading) => project(reading.x, reading.z).join(',')).join(' ')
  const bar = niceLength(span * 0.3)
  const many = analysis.stations.length > 9
  const radius = many ? 9 : 14

  const onKey = (event: KeyboardEvent, id: string) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      onSelect(id)
    }
  }

  return (
    <svg className="maris-map" viewBox={`0 0 ${width} ${height}`} role="group" aria-label={`Map of ${analysis.stations.length} locations coloured by ${metric.name.toLowerCase()}`}>
      <defs>
        <pattern id="maris-grid" width="40" height="40" patternUnits="userSpaceOnUse">
          <path d="M40 0H0V40" fill="none" stroke="#e8e8ed" strokeWidth="1" />
        </pattern>
      </defs>
      <rect width={width} height={height} rx="14" fill="#f9f9fb" />
      <rect width={width} height={height} rx="14" fill="url(#maris-grid)" />
      <polyline points={route} fill="none" stroke="#c7c7cc" strokeWidth="1.5" strokeDasharray="3 5" strokeLinecap="round" />
      {analysis.stations.map((station) => {
        const [x, y] = project(station.x, station.z)
        const value = stationValue(station, metric.id, layer)
        const isSelected = station.id === selected
        return (
          <g
            key={station.id}
            className="maris-point"
            role="button"
            tabIndex={0}
            aria-pressed={isSelected}
            aria-label={`${station.label}: ${formatValue(value, metric)}`}
            onClick={() => onSelect(station.id)}
            onKeyDown={(event) => onKey(event, station.id)}
          >
            {isSelected && <circle cx={x} cy={y} r={radius + 6} fill="none" stroke={SELECTED} strokeWidth="2.5" />}
            <circle cx={x} cy={y} r={radius} fill={color(value)} stroke="#fff" strokeWidth="2.5" />
            {!many && <text x={x} y={y + radius + 18} textAnchor="middle">{station.label}</text>}
            <title>{`${station.label}: ${formatValue(value, metric)}`}</title>
          </g>
        )
      })}
      <g transform={`translate(${pad - 24}, ${height - 26})`} className="maris-scale">
        <path d={`M0 0h${bar * scale}`} stroke="#1d1d1f" strokeWidth="2" />
        <path d={`M0 -4v8M${bar * scale} -4v8`} stroke="#1d1d1f" strokeWidth="1.5" />
        <text x={(bar * scale) / 2} y="-9" textAnchor="middle">{bar >= 1 ? `${bar} m` : `${bar * 100} cm`}</text>
      </g>
      <g transform={`translate(${width - 34}, 34)`} className="maris-north" aria-hidden="true">
        <path d="M0 -12 6 6 0 2 -6 6Z" fill="#1d1d1f" />
        <text y="22" textAnchor="middle">N</text>
      </g>
    </svg>
  )
}

const axisTick = { fill: '#86868b', fontSize: 12 }
const tidy = (value: number) => String(Number(value.toPrecision(3)))

/** Evenly spaced depth ticks (0, 0.5, 1 … m) that cover the deepest reading. */
function depthTicks(maxDepth: number) {
  const step = maxDepth > 4 ? 1 : maxDepth > 1.5 ? 0.5 : maxDepth > 0.6 ? 0.25 : 0.1
  const top = Math.max(step, Math.ceil(maxDepth / step - 1e-9) * step)
  return Array.from({ length: Math.round(top / step) + 1 }, (_, index) => Number((index * step).toFixed(2)))
}

function profileSeries(station: Station, metricId: string) {
  // Down- and up-casts overlap; average readings that share a depth so each line reads cleanly.
  const byDepth = new Map<number, number[]>()
  station.readings.forEach((reading) => {
    const value = reading.values[metricId]
    if (!Number.isFinite(value)) return
    const key = Math.round(reading.depth * 20) / 20
    byDepth.set(key, [...(byDepth.get(key) ?? []), value])
  })
  return [...byDepth.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([depth, values]) => ({ depth, value: values.reduce((sum, value) => sum + value, 0) / values.length, station: station.id }))
}

function ProfileChart({ analysis, metric, selected, onSelect }: { analysis: Analysis; metric: Metric; selected?: string; onSelect: (id: string) => void }) {
  const series = analysis.hasProfiles
    ? analysis.stations.filter((station) => station.maxDepth - station.minDepth >= 0.4)
    : []
  // Draw the selected station last so it sits on top.
  const ordered = [...series.filter((station) => station.id !== selected), ...series.filter((station) => station.id === selected)]
  const scatter = analysis.readings
    .filter((reading) => Number.isFinite(reading.values[metric.id]))
    .map((reading) => ({ depth: reading.depth, value: reading.values[metric.id], station: reading.station }))
  const ticks = depthTicks(analysis.maxDepth)

  return (
    <div className="maris-chart">
      <ResponsiveContainer width="100%" height="100%">
        <ScatterChart margin={{ top: 8, right: 16, bottom: 24, left: 4 }}>
          <CartesianGrid stroke="#e8e8ed" vertical={false} />
          <XAxis type="number" dataKey="value" name={metric.name} domain={['auto', 'auto']} tick={axisTick} tickLine={false} axisLine={{ stroke: '#d2d2d7' }} tickFormatter={tidy}
            label={{ value: metric.unit ? `${metric.name} (${metric.unit})` : metric.name, position: 'insideBottom', offset: -14, fill: '#6e6e73', fontSize: 12 }} />
          <YAxis type="number" dataKey="depth" name="Depth" reversed domain={[0, ticks[ticks.length - 1]]} ticks={ticks} tick={axisTick} tickLine={false} axisLine={false} width={48}
            tickFormatter={(depth: number) => `${depth} m`} />
          <Tooltip cursor={{ strokeDasharray: '3 3' }} content={<PointTooltip analysis={analysis} metric={metric} />} />
          {analysis.hasProfiles
            ? ordered.map((station) => {
                const active = station.id === selected
                return (
                  <Scatter
                    key={station.id}
                    data={profileSeries(station, metric.id)}
                    line={{ stroke: active ? SELECTED : '#c7c7cc', strokeWidth: active ? 2.5 : 1.5 }}
                    fill={active ? SELECTED : '#c7c7cc'}
                    shape={active ? 'circle' : () => <g />}
                    isAnimationActive={false}
                    onClick={() => onSelect(station.id)}
                    style={{ cursor: 'pointer' }}
                  />
                )
              })
            : <Scatter data={scatter} fill={SELECTED} isAnimationActive={false} onClick={(point) => {
                const station = (point as { payload?: { station?: string } }).payload?.station
                if (station) onSelect(station)
              }} />}
        </ScatterChart>
      </ResponsiveContainer>
    </div>
  )
}

function PointTooltip({ active, payload, analysis, metric }: { active?: boolean; payload?: Array<{ payload: { depth: number; value: number; station: string } }>; analysis: Analysis; metric: Metric }) {
  const point = active ? payload?.[0]?.payload : undefined
  if (!point) return null
  return (
    <div className="maris-tooltip">
      <strong>{stationName(analysis, point.station)}</strong>
      <span>{formatValue(point.value, metric)} at {formatDepth(point.depth)}</span>
    </div>
  )
}

function TimeChart({ analysis, metric }: { analysis: Analysis; metric: Metric }) {
  const data = analysis.readings
    .filter((reading) => Number.isFinite(reading.values[metric.id]))
    .map((reading) => ({ t: reading.timeSeconds, value: reading.values[metric.id], depth: reading.depth, station: reading.station }))
  const minutes = analysis.durationSeconds >= 120
  return (
    <div className="maris-chart">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 16, bottom: 24, left: 4 }}>
          <defs>
            <linearGradient id="maris-area" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={SELECTED} stopOpacity={0.22} />
              <stop offset="100%" stopColor={SELECTED} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="#e8e8ed" vertical={false} />
          <XAxis dataKey="t" type="number" domain={['dataMin', 'dataMax']} tick={axisTick} tickLine={false} axisLine={{ stroke: '#d2d2d7' }}
            tickFormatter={(t: number) => (minutes ? `${Math.round(t / 60)}m` : `${Math.round(t)}s`)}
            label={{ value: 'Time since start', position: 'insideBottom', offset: -14, fill: '#6e6e73', fontSize: 12 }} />
          <YAxis domain={['auto', 'auto']} tick={axisTick} tickLine={false} axisLine={false} width={44} tickFormatter={tidy} />
          {metric.id === 'do' && <ReferenceLine y={5} stroke="#bf4800" strokeDasharray="4 4" label={{ value: '5 mg/L', position: 'insideTopRight', fill: '#bf4800', fontSize: 12 }} />}
          <Tooltip content={<TimeTooltip analysis={analysis} metric={metric} />} />
          <Area type="monotone" dataKey="value" stroke={SELECTED} strokeWidth={2} fill="url(#maris-area)" isAnimationActive={false} dot={false} activeDot={{ r: 4 }} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}

function TimeTooltip({ active, payload, analysis, metric }: { active?: boolean; payload?: Array<{ payload: { t: number; value: number; depth: number; station: string } }>; analysis: Analysis; metric: Metric }) {
  const point = active ? payload?.[0]?.payload : undefined
  if (!point) return null
  return (
    <div className="maris-tooltip">
      <strong>{formatValue(point.value, metric)}</strong>
      <span>{stationName(analysis, point.station)}, {formatDepth(point.depth)}, {formatDuration(point.t)}</span>
    </div>
  )
}

export default MarisLab
