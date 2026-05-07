import { OrbitControls } from '@react-three/drei'
import { Canvas, useFrame } from '@react-three/fiber'
import { Suspense, useEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { getMetricDescriptor, metricValue } from '../domain/metrics'
import { buildScenePoints, missionBounds } from '../domain/sceneData'
import type { AquaMission, LayerVisibility, Vec3 } from '../types/aqua'

type BoatSceneProps = {
  mission: AquaMission | undefined
  metricId: string
  boatPosition: Vec3
  boatHeadingRad?: number
  layers: LayerVisibility
}

export function BoatScene({ mission, metricId, boatPosition, boatHeadingRad, layers }: BoatSceneProps) {
  const bounds = useMemo(() => missionBounds(mission), [mission])
  return (
    <div className="scene-frame">
      <Canvas camera={{ position: [bounds.center[0] + 18, 22, bounds.center[2] + 26], fov: 48 }} dpr={[1, 1.75]}>
        <color attach="background" args={['#bfeeff']} />
        <fog attach="fog" args={['#d8f7ff', 90, 220]} />
        <hemisphereLight args={['#fff8d8', '#80c7d6', 1.4]} />
        <ambientLight intensity={0.55} />
        <directionalLight position={[42, 58, 24]} color="#fff1b8" intensity={2.45} />
        <Suspense fallback={null}>
          <SceneContent mission={mission} metricId={metricId} boatPosition={boatPosition} boatHeadingRad={boatHeadingRad} layers={layers} />
        </Suspense>
        <OrbitControls target={bounds.center} enableDamping maxPolarAngle={Math.PI * 0.48} minDistance={12} maxDistance={120} />
      </Canvas>
      {!mission && <div className="scene-empty">Load a mission to draw the track and sensor field.</div>}
    </div>
  )
}

function SceneContent({ mission, metricId, boatPosition, boatHeadingRad, layers }: BoatSceneProps) {
  const points = useMemo(() => buildScenePoints(mission, metricId), [mission, metricId])
  const linePoints = useMemo(
    () => mission?.samples.map((sample) => new THREE.Vector3(sample.localPosition[0], 0.24, sample.localPosition[2])) ?? [],
    [mission],
  )
  const bounds = useMemo(() => missionBounds(mission), [mission])

  return (
    <>
      <WaterPlane center={bounds.center} radius={bounds.radius} />
      {layers.heatmap && mission && <SmoothHeatmap mission={mission} metricId={metricId} center={bounds.center} radius={bounds.radius} />}
      {layers.track && linePoints.length > 1 && <TrackLine points={linePoints} />}
      {layers.points && points.map((point) => <SamplePoint key={point.key} point={point} />)}
      <Boat position={boatPosition} headingRad={boatHeadingRad} />
      {mission && <ProbeMarker position={boatPosition} />}
    </>
  )
}

function Boat({ position, headingRad }: { position: Vec3; headingRad?: number }) {
  const group = useRef<THREE.Group>(null)
  useFrame((state) => {
    if (!group.current) return
    group.current.position.y = 0.5 + Math.sin(state.clock.elapsedTime * 2.3) * 0.06
  })

  return (
    <group ref={group} position={[position[0], 0.5, position[2]]} rotation={[0, headingRad ?? 0, 0]}>
      <ModelBoat />
    </group>
  )
}

function ModelBoat() {
  const [model, setModel] = useState<THREE.Object3D | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let cancelled = false
    const loader = new GLTFLoader()
    loader.load(
      '/models/speed-boat.glb',
      (gltf) => {
        if (!cancelled) setModel(gltf.scene)
      },
      undefined,
      () => {
        if (!cancelled) setFailed(true)
      },
    )
    return () => {
      cancelled = true
    }
  }, [])

  const instance = useMemo(() => model?.clone(), [model])
  if (failed || !instance) return <FallbackBoat />
  return <primitive object={instance} scale={0.32} rotation={[0, -Math.PI / 2, 0]} />
}

function FallbackBoat() {
  return (
    <group scale={[1.2, 1.2, 1.2]}>
      <mesh position={[0, 0.1, 0]}>
        <boxGeometry args={[1.6, 0.35, 3.2]} />
        <meshStandardMaterial color="#0ea5ad" roughness={0.56} metalness={0.1} />
      </mesh>
      <mesh position={[0, 0.38, -0.25]}>
        <boxGeometry args={[1.05, 0.5, 1.25]} />
        <meshStandardMaterial color="#d8efe7" roughness={0.4} />
      </mesh>
      <mesh position={[0, 0.05, 1.75]} rotation={[Math.PI / 2, 0, 0]}>
        <coneGeometry args={[0.82, 0.9, 4]} />
        <meshStandardMaterial color="#0f766e" roughness={0.5} />
      </mesh>
    </group>
  )
}

function WaterPlane({ center, radius }: { center: Vec3; radius: number }) {
  const material = useRef<THREE.ShaderMaterial>(null)
  const waterMaps = useMemo(() => createWaterMaps(), [])
  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uHeightMap: { value: waterMaps.heightMap },
      uDetailMap: { value: waterMaps.detailMap },
      uDeepColor: { value: new THREE.Color('#075f83') },
      uShallowColor: { value: new THREE.Color('#2fc7dd') },
      uFoamColor: { value: new THREE.Color('#e9feff') },
      uSunColor: { value: new THREE.Color('#fff1a6') },
      uOpacity: { value: 0.96 },
    }),
    [waterMaps],
  )

  useEffect(() => {
    return () => {
      waterMaps.heightMap.dispose()
      waterMaps.detailMap.dispose()
    }
  }, [waterMaps])

  useFrame((state) => {
    if (!material.current) return
    material.current.uniforms.uTime.value = state.clock.elapsedTime
  })

  return (
    <mesh position={[center[0], -0.18, center[2]]} rotation={[-Math.PI / 2, 0, 0]}>
      <planeGeometry args={[radius * 3.5, radius * 3.5, 240, 240]} />
      <shaderMaterial
        ref={material}
        uniforms={uniforms}
        vertexShader={waterVertexShader}
        fragmentShader={waterFragmentShader}
        transparent
        depthWrite={false}
        side={THREE.DoubleSide}
      />
    </mesh>
  )
}

const waterVertexShader = `
  uniform float uTime;
  uniform sampler2D uHeightMap;
  varying vec2 vUv;
  varying float vWave;
  varying float vHeight;

  void main() {
    vUv = uv;
    vec3 transformed = position;
    vec2 scrollingUvA = fract(uv * 2.6 + vec2(uTime * 0.018, -uTime * 0.012));
    vec2 scrollingUvB = fract(uv * 4.8 + vec2(-uTime * 0.014, uTime * 0.021));
    float mapA = texture2D(uHeightMap, scrollingUvA).r - 0.5;
    float mapB = texture2D(uHeightMap, scrollingUvB).g - 0.5;
    float waveA = sin((position.x * 0.22) + (uTime * 0.95)) * 0.16;
    float waveB = sin((position.y * 0.38) - (uTime * 1.22)) * 0.075;
    float waveC = sin(((position.x + position.y) * 0.15) + (uTime * 0.68)) * 0.095;
    float wave = waveA + waveB + waveC + mapA * 0.34 + mapB * 0.18;
    transformed.z += wave;
    vWave = wave;
    vHeight = mapA + mapB;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(transformed, 1.0);
  }
`

const waterFragmentShader = `
  uniform float uTime;
  uniform sampler2D uDetailMap;
  uniform vec3 uDeepColor;
  uniform vec3 uShallowColor;
  uniform vec3 uFoamColor;
  uniform vec3 uSunColor;
  uniform float uOpacity;
  varying vec2 vUv;
  varying float vWave;
  varying float vHeight;

  void main() {
    vec2 detailUvA = fract(vUv * 9.0 + vec2(uTime * 0.035, -uTime * 0.018));
    vec2 detailUvB = fract(vUv * 18.0 + vec2(-uTime * 0.026, uTime * 0.041));
    float detailA = texture2D(uDetailMap, detailUvA).r;
    float detailB = texture2D(uDetailMap, detailUvB).g;
    float detail = (detailA * 0.62 + detailB * 0.38);
    float broadMotion = sin((vUv.x * 10.0) + (vUv.y * 6.0) + (uTime * 0.45)) * 0.5 + 0.5;
    float crossedMotion = sin((vUv.x * -5.0) + (vUv.y * 14.0) - (uTime * 0.62)) * 0.5 + 0.5;
    float depthMix = smoothstep(0.05, 0.95, vUv.y * 0.84 + broadMotion * 0.045 + vHeight * 0.025);
    vec3 color = mix(uDeepColor, uShallowColor, depthMix);

    float rippleC = smoothstep(0.76, 0.98, detail) * 0.22;
    float ripple = rippleC * 0.075 * (0.45 + crossedMotion * 0.55);

    float crest = smoothstep(0.14, 0.36, vWave + detail * 0.05);
    float sunGlint = smoothstep(0.94, 1.0, detail);
    sunGlint *= smoothstep(0.24, 0.9, vUv.y) * 0.12;

    color += uFoamColor * (ripple * 1.18 + crest * 0.04);
    color += uSunColor * sunGlint;
    color *= 0.96 + detail * 0.07;

    gl_FragColor = vec4(color, uOpacity);
  }
`

function createWaterMaps() {
  return {
    heightMap: createNoiseTexture(256, 10, 0.62),
    detailMap: createNoiseTexture(256, 38, 0.82),
  }
}

function createNoiseTexture(size: number, frequency: number, contrast: number) {
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const context = canvas.getContext('2d')
  if (context) {
    const image = context.createImageData(size, size)
    for (let y = 0; y < size; y += 1) {
      for (let x = 0; x < size; x += 1) {
        const nx = x / size
        const ny = y / size
        const base = fbmNoise(nx, ny, frequency)
        const secondary = fbmNoise(nx + 17.31, ny - 9.73, frequency * 1.9)
        const ridge = 1 - Math.abs(secondary * 2 - 1)
        const value = THREE.MathUtils.clamp(0.5 + (base - 0.5) * contrast + (ridge - 0.5) * contrast * 0.28, 0, 1)
        const offset = (y * size + x) * 4
        image.data[offset] = value * 255
        image.data[offset + 1] = THREE.MathUtils.clamp(secondary, 0, 1) * 255
        image.data[offset + 2] = THREE.MathUtils.clamp(1 - value * 0.45, 0, 1) * 255
        image.data[offset + 3] = 255
      }
    }
    context.putImageData(image, 0, 0)
  }
  const texture = new THREE.CanvasTexture(canvas)
  texture.wrapS = THREE.RepeatWrapping
  texture.wrapT = THREE.RepeatWrapping
  texture.colorSpace = THREE.NoColorSpace
  texture.needsUpdate = true
  return texture
}

function fbmNoise(x: number, y: number, frequency: number) {
  let value = 0
  let amplitude = 0.54
  let total = 0
  let currentFrequency = frequency
  for (let octave = 0; octave < 4; octave += 1) {
    value += smoothValueNoise(x * currentFrequency, y * currentFrequency) * amplitude
    total += amplitude
    amplitude *= 0.52
    currentFrequency *= 2.03
  }
  return total > 0 ? value / total : 0.5
}

function smoothValueNoise(x: number, y: number) {
  const x0 = Math.floor(x)
  const y0 = Math.floor(y)
  const tx = smoothStep(x - x0)
  const ty = smoothStep(y - y0)
  const a = seededNoise(x0, y0)
  const b = seededNoise(x0 + 1, y0)
  const c = seededNoise(x0, y0 + 1)
  const d = seededNoise(x0 + 1, y0 + 1)
  return lerp(lerp(a, b, tx), lerp(c, d, tx), ty)
}

function seededNoise(x: number, y: number) {
  const value = Math.sin(x * 127.1 + y * 311.7) * 43758.5453123
  return value - Math.floor(value)
}

function smoothStep(value: number) {
  return value * value * (3 - 2 * value)
}

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t
}

function TrackLine({ points }: { points: THREE.Vector3[] }) {
  const line = useMemo(() => {
    const geometry = new THREE.BufferGeometry().setFromPoints(points)
    return new THREE.Line(geometry, new THREE.LineBasicMaterial({ color: '#fbbf24' }))
  }, [points])
  return <primitive object={line} />
}

function SamplePoint({ point }: { point: { position: Vec3; color: string } }) {
  return (
    <mesh position={point.position}>
      <sphereGeometry args={[0.28, 16, 12]} />
      <meshStandardMaterial color={point.color} emissive={point.color} emissiveIntensity={0.08} />
    </mesh>
  )
}

function SmoothHeatmap({ mission, metricId, center, radius }: { mission: AquaMission; metricId: string; center: Vec3; radius: number }) {
  const span = radius * 2.45
  const texture = useMemo(() => {
    const descriptor = getMetricDescriptor(metricId)
    const canvas = document.createElement('canvas')
    const size = 768
    canvas.width = size
    canvas.height = size
    const context = canvas.getContext('2d')
    if (!context) return undefined

    const originX = center[0] - span / 2
    const originZ = center[2] - span / 2
    const brushRadius = Math.max(82, Math.min(150, size * 0.132))
    const values = mission.samples.map((sample) => metricValue(sample, metricId)).filter((value): value is number => value !== undefined)
    const localMin = values.length > 0 ? Math.min(...values) : descriptor.expectedRange[0]
    const localMax = values.length > 0 ? Math.max(...values) : descriptor.expectedRange[1]
    const localSpan = localMax - localMin
    context.clearRect(0, 0, size, size)
    context.globalCompositeOperation = 'source-over'

    mission.samples.forEach((sample) => {
      const value = metricValue(sample, metricId)
      const [min, max] = descriptor.expectedRange
      const normalized = value === undefined || max <= min ? 0.32 : THREE.MathUtils.clamp((value - min) / (max - min), 0.12, 1)
      const colorPosition = value === undefined ? 0.5 : localSpan > 0.0001 ? THREE.MathUtils.clamp((value - localMin) / localSpan, 0, 1) : 0.5
      const x = ((sample.localPosition[0] - originX) / span) * size
      const y = size - ((sample.localPosition[2] - originZ) / span) * size
      const color = colorFromGradient(descriptor.gradient, colorPosition)
      const gradient = context.createRadialGradient(x, y, 0, x, y, brushRadius)
      gradient.addColorStop(0, withAlpha(color, 0.28 + normalized * 0.14))
      gradient.addColorStop(0.36, withAlpha(color, 0.14 + normalized * 0.08))
      gradient.addColorStop(0.72, withAlpha(color, 0.04 + normalized * 0.03))
      gradient.addColorStop(1, withAlpha(color, 0))
      context.fillStyle = gradient
      context.fillRect(x - brushRadius, y - brushRadius, brushRadius * 2, brushRadius * 2)
    })

    const canvasTexture = new THREE.CanvasTexture(canvas)
    canvasTexture.colorSpace = THREE.SRGBColorSpace
    canvasTexture.anisotropy = 4
    canvasTexture.needsUpdate = true
    return canvasTexture
  }, [center, metricId, mission, span])

  const geometry = useMemo(() => {
    const half = span / 2
    const bufferGeometry = new THREE.BufferGeometry()
    bufferGeometry.setAttribute(
      'position',
      new THREE.BufferAttribute(
        new Float32Array([
          -half,
          0,
          -half,
          half,
          0,
          -half,
          half,
          0,
          half,
          -half,
          0,
          half,
        ]),
        3,
      ),
    )
    bufferGeometry.setAttribute('uv', new THREE.BufferAttribute(new Float32Array([0, 0, 1, 0, 1, 1, 0, 1]), 2))
    bufferGeometry.setIndex([0, 1, 2, 0, 2, 3])
    bufferGeometry.computeVertexNormals()
    return bufferGeometry
  }, [span])

  useEffect(() => {
    return () => texture?.dispose()
  }, [texture])

  useEffect(() => {
    return () => geometry.dispose()
  }, [geometry])

  if (!texture) return null
  return (
    <mesh position={[center[0], 0.055, center[2]]} geometry={geometry}>
      <meshBasicMaterial map={texture} transparent opacity={0.68} depthWrite={false} side={THREE.DoubleSide} />
    </mesh>
  )
}

function withAlpha(color: string, alpha: number) {
  const clamped = THREE.MathUtils.clamp(alpha, 0, 1)
  if (color.startsWith('rgb(')) return color.replace('rgb(', 'rgba(').replace(')', `, ${clamped})`)
  if (color.startsWith('#') && color.length === 7) {
    const red = Number.parseInt(color.slice(1, 3), 16)
    const green = Number.parseInt(color.slice(3, 5), 16)
    const blue = Number.parseInt(color.slice(5, 7), 16)
    return `rgba(${red}, ${green}, ${blue}, ${clamped})`
  }
  return color
}

function colorFromGradient(colors: string[], t: number) {
  if (colors.length === 0) return '#7dd3fc'
  if (colors.length === 1) return colors[0]
  const scaled = THREE.MathUtils.clamp(t, 0, 1) * (colors.length - 1)
  const index = Math.min(colors.length - 2, Math.floor(scaled))
  const localT = scaled - index
  const a = parseColor(colors[index])
  const b = parseColor(colors[index + 1])
  const red = Math.round(a[0] + (b[0] - a[0]) * localT)
  const green = Math.round(a[1] + (b[1] - a[1]) * localT)
  const blue = Math.round(a[2] + (b[2] - a[2]) * localT)
  return `rgb(${red}, ${green}, ${blue})`
}

function parseColor(color: string): [number, number, number] {
  if (color.startsWith('rgb(')) {
    const values = color
      .replace('rgb(', '')
      .replace(')', '')
      .split(',')
      .map((part) => Number.parseFloat(part.trim()))
    return [values[0] ?? 125, values[1] ?? 211, values[2] ?? 252]
  }
  if (color.startsWith('#') && color.length === 7) {
    return [Number.parseInt(color.slice(1, 3), 16), Number.parseInt(color.slice(3, 5), 16), Number.parseInt(color.slice(5, 7), 16)]
  }
  return [125, 211, 252]
}

function ProbeMarker({ position }: { position: Vec3 }) {
  return (
    <group position={[position[0], 0.15, position[2]]}>
      <mesh position={[0, -0.55, 0]}>
        <cylinderGeometry args={[0.07, 0.07, 1.2, 12]} />
        <meshStandardMaterial color="#dbeafe" />
      </mesh>
      <mesh position={[0, -1.25, 0]}>
        <sphereGeometry args={[0.18, 16, 12]} />
        <meshStandardMaterial color="#38bdf8" emissive="#155e75" />
      </mesh>
    </group>
  )
}
