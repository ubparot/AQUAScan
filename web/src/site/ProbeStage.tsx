import { useEffect, useRef, type RefObject } from 'react'
import {
  Box3,
  CanvasTexture,
  Color,
  DirectionalLight,
  Group,
  Matrix3,
  Mesh,
  MeshBasicMaterial,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  NeutralToneMapping,
  Object3D,
  PerspectiveCamera,
  PlaneGeometry,
  Quaternion,
  PMREMGenerator,
  Scene,
  Sphere,
  SRGBColorSpace,
  Vector3,
  WebGLRenderer,
} from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js'
import { clamp, explodeAt } from './probeTimeline'

/** Scroll position through the hero, 0..1, written by the parent without re-rendering. */
export type ProgressRef = RefObject<number>

/** How far each part travels when fully exploded, in model metres (+X toward the nose, +Y up). */
const NOSE = 0.13
const TAIL = -0.12
const EXPLODE_OFFSETS: Record<string, Vector3> = {
  nose_cone: new Vector3(NOSE, 0, 0),
  main_body: new Vector3(0, 0, 0),
  tail_base: new Vector3(TAIL, 0, 0),
  tether_mount: new Vector3(-0.01, 0.105, 0),
  internal_brace: new Vector3(TAIL * 0.55, 0, 0),
  component_tray: new Vector3(0.04, -0.09, 0),
  pcb: new Vector3(0.04, -0.175, 0.03),
  oring_front_0: new Vector3(NOSE * 0.5, 0, 0),
  oring_front_1: new Vector3(NOSE * 0.42, 0, 0),
  oring_rear_0: new Vector3(TAIL * 0.42, 0, 0),
  oring_rear_1: new Vector3(TAIL * 0.5, 0, 0),
}

/** Screws back out along the probe axis ahead of the parts they hold; fins splay out from the tail. */
function derivedOffset(name: string, node: Object3D, toWorld: Matrix3) {
  if (name.startsWith('screw_front')) return new Vector3(NOSE + 0.045, 0, 0)
  if (name.startsWith('screw_rear')) return new Vector3(TAIL - 0.045, 0, 0)
  if (name.startsWith('fin_')) {
    // CAD frame: Z is the probe axis, so a fin's radial direction is its local X/Y position.
    const radial = new Vector3(node.position.x, node.position.y, 0).applyMatrix3(toWorld).normalize()
    return radial.multiplyScalar(0.045).add(new Vector3(TAIL, 0, 0))
  }
  return EXPLODE_OFFSETS[name]
}

function shadowTexture() {
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = 256
  const ctx = canvas.getContext('2d')!
  const gradient = ctx.createRadialGradient(128, 128, 0, 128, 128, 128)
  gradient.addColorStop(0, 'rgba(0,0,0,0.5)')
  gradient.addColorStop(0.5, 'rgba(0,0,0,0.18)')
  gradient.addColorStop(1, 'rgba(0,0,0,0)')
  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, 256, 256)
  return new CanvasTexture(canvas)
}

export default function ProbeStage({ progress, onReady }: { progress: ProgressRef; onReady: () => void }) {
  const hostRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const host = hostRef.current
    if (!host) return
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches

    let renderer: WebGLRenderer
    try {
      renderer = new WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' })
    } catch {
      return
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.outputColorSpace = SRGBColorSpace
    renderer.toneMapping = NeutralToneMapping
    renderer.toneMappingExposure = 1
    renderer.domElement.setAttribute('role', 'img')
    renderer.domElement.setAttribute('aria-label', '3D model of the AquaScan sensor probe. It separates into its parts as you scroll.')
    host.appendChild(renderer.domElement)

    // Studio lighting: soft room reflections, a broad key from above, and a cool rim to separate black from black.
    const scene = new Scene()
    const pmrem = new PMREMGenerator(renderer)
    const environment = pmrem.fromScene(new RoomEnvironment(), 0.03).texture
    scene.environment = environment
    scene.environmentIntensity = 0.85
    const key = new DirectionalLight(0xffffff, 2.2)
    key.position.set(0.4, 1.6, 0.8)
    scene.add(key)
    const fill = new DirectionalLight(0xffffff, 0.6)
    fill.position.set(-1.2, 0.3, 1)
    scene.add(fill)
    const rim = new DirectionalLight(0xdbe8ff, 1.6)
    rim.position.set(-0.6, 0.8, -1.2)
    scene.add(rim)

    const camera = new PerspectiveCamera(26, 1, 0.01, 20)
    const turntable = new Group()
    scene.add(turntable)

    const shadow = new Mesh(new PlaneGeometry(1, 1), new MeshBasicMaterial({ map: shadowTexture(), transparent: true, depthWrite: false, opacity: 0.45 }))
    shadow.rotation.x = -Math.PI / 2
    scene.add(shadow)

    // Materials matched to the printed prototype: satin black PETG, a milky white nose cap, steel screws, rubber O-rings.
    const petg = new MeshPhysicalMaterial({ color: new Color('#101113'), roughness: 0.5, metalness: 0, clearcoat: 0.25, clearcoatRoughness: 0.45, sheen: 0.25, sheenRoughness: 0.6, sheenColor: new Color('#3a3d42') })
    const tray = new MeshStandardMaterial({ color: new Color('#26292d'), roughness: 0.7 })
    const cap = new MeshPhysicalMaterial({ color: new Color('#eceeec'), roughness: 0.28, metalness: 0, clearcoat: 0.7, clearcoatRoughness: 0.12, sheen: 0.4, sheenRoughness: 0.5, sheenColor: new Color('#ffffff') })
    const steel = new MeshStandardMaterial({ color: new Color('#c4c7cc'), roughness: 0.28, metalness: 1 })
    const rubber = new MeshStandardMaterial({ color: new Color('#0a0a0b'), roughness: 0.75 })

    const materialFor = (name: string) => {
      if (name === 'nose_cone') return cap
      if (name === 'component_tray' || name === 'internal_brace') return tray
      if (name.startsWith('screw_')) return steel
      if (name.startsWith('oring_')) return rubber
      if (name === 'pcb') return null
      return petg
    }

    const parts: Array<{ node: Object3D; home: Vector3; offset: Vector3 }> = []
    // The board tilts toward the camera as it drops out, so its traces face the viewer.
    let pcbNode: Object3D | undefined
    let pcbHomeQuaternion: Quaternion | undefined
    const pcbTilt = new Quaternion()
    let assembledRadius = 0.25
    let explodedRadius = 0.32
    let floorY = -0.1
    let modelRoot: Object3D | null = null
    const restPosition = new Vector3()
    const explodedShift = new Vector3() // keeps the exploded view centred on the turntable axis
    let disposed = false

    const loader = new GLTFLoader()
    loader.setMeshoptDecoder(MeshoptDecoder)
    loader.load('/models/aquascan-probe.glb', (gltf) => {
      if (disposed) return
      const root = gltf.scene
      const box = new Box3().setFromObject(root)
      const center = box.getCenter(new Vector3())
      root.position.sub(center)
      turntable.add(root)

      const probe = root.getObjectByName('AquaScanProbe') ?? root
      // Parts live under the CAD root (millimetres, Z forward). Convert world-metre offsets into that space.
      root.updateMatrixWorld(true)
      const toWorld = new Matrix3().setFromMatrix4(probe.matrixWorld)
      const toLocal = toWorld.clone().invert()
      probe.children.forEach((node) => {
        const name = node.name
        const material = materialFor(name)
        node.traverse((child) => {
          if (child instanceof Mesh && material) child.material = material
        })
        if (name === 'pcb') {
          pcbNode = node
          pcbHomeQuaternion = node.quaternion.clone()
          // Tilt about the probe axis (world X), expressed in the CAD root's local frame.
          const axis = new Vector3(1, 0, 0).applyMatrix3(toLocal).normalize()
          pcbTilt.setFromAxisAngle(axis, 0.3)
        }
        const worldOffset = derivedOffset(name, node, toWorld)
        if (!worldOffset) return
        parts.push({ node, home: node.position.clone(), offset: worldOffset.clone().applyMatrix3(toLocal) })
      })

      // Measure both states once so the camera can frame them without guessing.
      root.updateMatrixWorld(true)
      assembledRadius = new Box3().setFromObject(root).getBoundingSphere(new Sphere()).radius
      parts.forEach((part) => part.node.position.copy(part.home).add(part.offset))
      root.updateMatrixWorld(true)
      const explodedBox = new Box3().setFromObject(root)
      explodedRadius = explodedBox.getBoundingSphere(new Sphere()).radius
      explodedBox.getCenter(explodedShift)
      parts.forEach((part) => part.node.position.copy(part.home))
      floorY = explodedBox.min.y - explodedShift.y - 0.015
      modelRoot = root
      restPosition.copy(root.position)

      needsRender = true
      onReady()
    })

    // A fixed three-quarter view; only scrolling moves the parts.
    const yaw = -0.55
    let needsRender = true
    const canvas = renderer.domElement

    let width = 1
    let height = 1
    const resize = () => {
      width = host.clientWidth
      height = host.clientHeight
      renderer.setSize(width, height, false)
      camera.aspect = width / height
      camera.updateProjectionMatrix()
      needsRender = true
    }
    const resizeObserver = new ResizeObserver(resize)
    resizeObserver.observe(host)
    resize()

    let visible = true
    const visibility = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting
      needsRender = true
    })
    visibility.observe(host)

    const elevation = 0.32 // radians above the horizon
    let explode = 0
    let frame = 0
    let last = performance.now()

    const tick = (now: number) => {
      frame = requestAnimationFrame(tick)
      const dt = Math.min(0.05, (now - last) / 1000)
      last = now
      if (!visible) return

      // Ease toward the scroll position so wheel steps glide instead of jumping.
      const target = explodeAt(clamp(progress.current ?? 0))
      const gap = target - explode
      if (Math.abs(gap) > 0.0005) {
        explode += gap * (reduceMotion ? 1 : 1 - Math.exp(-dt * 9))
        needsRender = true
      } else if (gap !== 0) {
        explode = target
        needsRender = true
      }
      // Only draw when something changed; an idle hero costs nothing while the page scrolls.
      if (!needsRender) return
      needsRender = false

      turntable.rotation.y = yaw
      for (const part of parts) part.node.position.copy(part.home).addScaledVector(part.offset, explode)
      if (pcbNode && pcbHomeQuaternion) pcbNode.quaternion.copy(pcbHomeQuaternion).premultiply(new Quaternion().slerp(pcbTilt, explode))
      modelRoot?.position.copy(restPosition).addScaledVector(explodedShift, -explode)
      shadow.position.y = floorY
      shadow.scale.set(0.52 + explode * 0.32, 0.2 + explode * 0.16, 1)

      // Fixed viewing angle. The camera only eases back as the parts spread, so the whole probe always stays in frame.
      const vFov = (camera.fov * Math.PI) / 180
      const hFov = 2 * Math.atan(Math.tan(vFov / 2) * camera.aspect)
      const radius = assembledRadius + (explodedRadius - assembledRadius) * explode
      const margin = width < 734 ? 1.06 : 1.05 - explode * 0.12
      const distance = (radius / Math.sin(Math.min(vFov, hFov) / 2)) * margin
      const lift = radius * (width < 734 ? 0.42 : 0.3) // keeps the probe below the headline
      camera.position.set(0, Math.sin(elevation) * distance + lift, Math.cos(elevation) * distance)
      camera.lookAt(0, lift, 0)

      renderer.render(scene, camera)
    }
    frame = requestAnimationFrame(tick)

    return () => {
      disposed = true
      cancelAnimationFrame(frame)
      resizeObserver.disconnect()
      visibility.disconnect()
      scene.traverse((object) => {
        if (object instanceof Mesh) {
          object.geometry.dispose()
          const materials = Array.isArray(object.material) ? object.material : [object.material]
          materials.forEach((material) => material.dispose())
        }
      })
      environment.dispose()
      pmrem.dispose()
      renderer.dispose()
      canvas.remove()
    }
  }, [progress, onReady])

  return <div ref={hostRef} className="probe-stage-canvas" />
}
