import { useEffect, useRef, useState } from 'react'

/** Station 5 of the sample pond-profile mission (public/missions/do-extrapolated-mission.csv). */
const PROFILE: Array<[depth: number, temperature: number, oxygen: number]> = [
  [0.1, 27.1, 5.95], [0.25, 26.9, 5.74], [0.5, 26.5, 5.23], [0.75, 26.0, 4.63], [1.0, 25.4, 3.82], [1.25, 24.9, 3.11],
  [1.5, 24.3, 2.4], [1.75, 23.9, 1.89], [2.0, 23.6, 1.49], [2.25, 23.4, 1.18], [2.5, 23.2, 0.97],
]
const STOPS = [1, 4, 10] // the three readings called out in the scene (0.25 m sits just below the hull)

// Shared vertical scale: depth in metres to SVG y, for the scene and both charts.
const TOP = 112
const PER_METRE = 152
const y = (depth: number) => TOP + depth * PER_METRE
const BED = y(2.72)

const TEMP = { x0: 690, width: 108, min: 22.5, max: 28 }
const OXY = { x0: 834, width: 112, min: 0, max: 7 }
const sx = (scale: typeof TEMP, value: number) => scale.x0 + ((value - scale.min) / (scale.max - scale.min)) * scale.width
const line = (scale: typeof TEMP, index: 1 | 2) =>
  PROFILE.map((row, k) => `${k ? 'L' : 'M'}${sx(scale, row[index]).toFixed(1)} ${y(row[0]).toFixed(1)}`).join(' ')

const TETHER_X = 430

function Boat() {
  // AquaScan from the side: twin hulls, deck, canopy, blue rail. Drawn sitting on the surface at y = TOP - 14.
  return (
    <g className="dg-boat" transform={`translate(${TETHER_X} ${TOP - 6}) scale(1.35)`}>
      <path d="M-74 4h148l-10 14h-128z" fill="#0d141d" />
      <rect x="-60" y="-10" width="120" height="14" rx="3" fill="#18212d" />
      <path d="M-34 -10c6-24 34-30 62-24l10 24z" fill="#0d141d" />
      <path d="M-18 -30c18-8 36-8 48-2" stroke="#4f9de6" strokeWidth="3" fill="none" strokeLinecap="round" />
      <rect x="-70" y="-6" width="40" height="5" rx="2.5" fill="#3d8be0" />
      <path d="M-6 -36v-16" stroke="#18212d" strokeWidth="2.5" strokeLinecap="round" />
    </g>
  )
}

function Probe() {
  // The probe hangs nose-down: fins at the top, clear nose cone at the bottom.
  return (
    <g className="dg-probe">
      <path d="M-11 -30l-8 -12M11 -30l8 -12" stroke="#1c2633" strokeWidth="4" strokeLinecap="round" />
      <rect x="-9" y="-34" width="18" height="40" rx="4" fill="#141c26" />
      <path d="M-9 4h18v6a9 9 0 0 1 -18 0z" fill="#e9eef2" />
      <rect x="-3" y="-40" width="6" height="7" rx="1.5" fill="#141c26" />
    </g>
  )
}

export function DepthGraphic() {
  const ref = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(() => typeof IntersectionObserver === 'undefined')

  useEffect(() => {
    const node = ref.current
    if (!node || visible) return
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        setVisible(true)
        observer.disconnect()
      }
    }, { threshold: 0.35 })
    observer.observe(node)
    return () => observer.disconnect()
  }, [visible])

  const probeDepth = y(2.5)
  return (
    <figure className="depth-graphic" ref={ref} data-visible={visible}>
      <div className="dg-panels">
      <svg className="dg-scene-svg" viewBox="0 0 620 560" role="img" aria-labelledby="dg-title dg-desc">
        <title id="dg-title">How water changes with depth</title>
        <desc id="dg-desc">
          A pond in cross-section with AquaScan at the surface and its probe lowered to 2.5 metres. In this sample
          profile the water cools from 27.1 to 23.2 degrees Celsius and dissolved oxygen falls from 6.0 to 1.0 milligrams
          per litre between the surface and the bottom.
        </desc>
        <defs>
          <linearGradient id="dg-water" x1="0" y1={TOP} x2="0" y2={BED} gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#2b8fd8" />
            <stop offset="24%" stopColor="#1d74bf" />
            <stop offset="52%" stopColor="#14508e" />
            <stop offset="78%" stopColor="#0c335f" />
            <stop offset="100%" stopColor="#082447" />
          </linearGradient>
          <linearGradient id="dg-sky" x1="0" y1="0" x2="0" y2={TOP}>
            <stop offset="0%" stopColor="#0d1622" />
            <stop offset="100%" stopColor="#1a2a3c" />
          </linearGradient>
          <linearGradient id="dg-ray" x1="0" y1={TOP} x2="0" y2={y(1.6)} gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="0.22" />
            <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="dg-thermo" x1="0" y1={y(0.6)} x2="0" y2={y(1.5)} gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#7fd0ff" stopOpacity="0" />
            <stop offset="50%" stopColor="#7fd0ff" stopOpacity="0.12" />
            <stop offset="100%" stopColor="#7fd0ff" stopOpacity="0" />
          </linearGradient>
          <clipPath id="dg-scene"><rect x="0" y="0" width="620" height="560" rx="18" /></clipPath>
        </defs>

        {/* Scene */}
        <g clipPath="url(#dg-scene)">
          <rect width="620" height={TOP} fill="url(#dg-sky)" />
          <path d={`M0 ${TOP - 26}c40-10 70-12 110-4s70 6 100-6 60-14 96-2 64 8 104-4 70-6 106 2 60 4 104-6v${30}H0z`} fill="#122030" />
          <rect y={TOP} width="620" height={BED - TOP} fill="url(#dg-water)" />
          <rect y={y(0.6)} width="620" height={y(1.5) - y(0.6)} fill="url(#dg-thermo)" />
          <g className="dg-rays">
            <path d={`M70 ${TOP}l40 0-90 ${y(1.6) - TOP}h-30z`} fill="url(#dg-ray)" />
            <path d={`M190 ${TOP}l28 0-70 ${y(1.4) - TOP}h-22z`} fill="url(#dg-ray)" />
            <path d={`M300 ${TOP}l34 0-80 ${y(1.5) - TOP}h-26z`} fill="url(#dg-ray)" />
          </g>
          <path d={`M0 ${BED}c80-10 160 8 250 0s180-12 260 2 80 6 110 0V560H0z`} fill="#2a2a24" />
          <path d={`M0 ${BED}c80-10 160 8 250 0s180-12 260 2 80 6 110 0`} fill="none" stroke="#3b3a31" strokeWidth="3" />
          <path d={`M0 ${TOP}c30-6 60-6 90 0s60 6 90 0 60-6 90 0 60 6 90 0 60-6 90 0 60 6 90 0 60-6 90 0`} fill="none" stroke="#bfe6ff" strokeWidth="2" opacity="0.8" />

          <line x1="20" x2="600" y1={y(0.6)} y2={y(0.6)} className="dg-boundary" />
          <line x1="20" x2="600" y1={y(1.5)} y2={y(1.5)} className="dg-boundary" />
          <text x="32" y={y(0.15)} className="dg-zone">Surface</text>
          <text x="32" y={y(0.15) + 20} className="dg-zone-note">Warm, mixed by wind</text>
          <text x="32" y={y(0.9)} className="dg-zone">Transition</text>
          <text x="32" y={y(0.9) + 20} className="dg-zone-note">Temperature drops quickly</text>
          <text x="32" y={y(1.85)} className="dg-zone">Bottom</text>
          <text x="32" y={y(1.85) + 20} className="dg-zone-note">Cold, little oxygen</text>

          <line x1={TETHER_X} x2={TETHER_X} y1={TOP - 4} y2={probeDepth - 40} className="dg-tether" />
          {STOPS.map((index, order) => {
            const [depth, temperature, oxygen] = PROFILE[index]
            const low = oxygen < 2
            return (
              <g key={depth} className="dg-reading" style={{ transitionDelay: `${0.5 + order * 0.75}s` }}>
                <circle cx={TETHER_X} cy={y(depth)} r="6" className={low ? 'dg-dot dg-dot-low' : 'dg-dot'} />
                <g transform={`translate(${order === 0 ? TETHER_X - 18 - 180 : TETHER_X + 18} ${y(depth) - 17})`}>
                  <rect width="180" height="34" rx="9" className="dg-chip" />
                  <text x="12" y="22" className="dg-chip-depth">{depth} m</text>
                  <text x="62" y="22" className="dg-chip-value">{temperature.toFixed(1)}<tspan className="dg-chip-unit"> °C</tspan></text>
                  <text x="118" y="22" className={low ? 'dg-chip-value dg-chip-low' : 'dg-chip-value'}>{oxygen.toFixed(1)}<tspan className="dg-chip-unit"> mg/L</tspan></text>
                </g>
              </g>
            )
          })}
          <g className="dg-probe-move"><g transform={`translate(${TETHER_X} ${probeDepth})`}><Probe /></g></g>
          <Boat />
        </g>

      </svg>
      <svg className="dg-chart-svg" viewBox="640 0 320 560" role="img" aria-label="Charts of temperature and dissolved oxygen against depth for the same profile">
        {/* Charts on the same depth scale */}
        <text x={TEMP.x0} y="44" className="dg-chart-title">Temperature</text>
        <text x={TEMP.x0} y="64" className="dg-chart-unit">°C</text>
        <text x={OXY.x0} y="44" className="dg-chart-title">Oxygen</text>
        <text x={OXY.x0} y="64" className="dg-chart-unit">mg/L</text>
        {[0, 0.5, 1, 1.5, 2, 2.5].map((depth) => (
          <g key={depth}>
            <line x1={TEMP.x0} x2={OXY.x0 + OXY.width} y1={y(depth)} y2={y(depth)} className="dg-grid" />
            <text x={TEMP.x0 - 12} y={y(depth) + 4} className="dg-axis" textAnchor="end">{depth} m</text>
          </g>
        ))}
        <rect x={sx(OXY, 0)} y={y(0)} width={sx(OXY, 2) - sx(OXY, 0)} height={y(2.5) - y(0)} className="dg-danger" />
        <line x1={sx(OXY, 5)} x2={sx(OXY, 5)} y1={y(0)} y2={y(2.5)} className="dg-threshold" />
        <text x={sx(OXY, 5)} y={y(0) - 8} className="dg-threshold-label" textAnchor="middle">5</text>
        <text x={sx(OXY, 1)} y={y(0) - 8} className="dg-danger-label" textAnchor="middle">&lt; 2</text>
        {[0, 2, 4, 6].map((o) => <text key={o} x={sx(OXY, o)} y={y(2.5) + 18} className="dg-axis" textAnchor="middle">{o}</text>)}
        {[23, 25, 27].map((t) => <text key={t} x={sx(TEMP, t)} y={y(2.5) + 18} className="dg-axis" textAnchor="middle">{t}</text>)}
        <path d={line(TEMP, 1)} className="dg-line dg-line-temp" pathLength={1} />
        <path d={line(OXY, 2)} className="dg-line dg-line-oxy" pathLength={1} />
        {STOPS.map((index) => (
          <g key={index}>
            <circle cx={sx(TEMP, PROFILE[index][1])} cy={y(PROFILE[index][0])} r="4" className="dg-point dg-point-temp" />
            <circle cx={sx(OXY, PROFILE[index][2])} cy={y(PROFILE[index][0])} r="4" className="dg-point dg-point-oxy" />
          </g>
        ))}
      </svg>
      </div>
      <figcaption>
        Readings from a sample AquaScan pond profile. Temperature in °C, dissolved oxygen in mg/L. Most fish struggle
        below about 5 mg/L, and water under 2 mg/L is severely low in oxygen.
      </figcaption>
    </figure>
  )
}
