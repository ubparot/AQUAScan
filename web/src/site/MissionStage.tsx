import { useEffect, useRef } from 'react'
import {
  Box3,
  BufferAttribute,
  BufferGeometry,
  CanvasTexture,
  Color,
  CylinderGeometry,
  DirectionalLight,
  DoubleSide,
  Group,
  Line,
  LineDashedMaterial,
  Mesh,
  MeshBasicMaterial,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  NeutralToneMapping,
  Object3D,
  PerspectiveCamera,
  PlaneGeometry,
  PMREMGenerator,
  Scene,
  SphereGeometry,
  SRGBColorSpace,
  TorusGeometry,
  Vector3,
  WebGLRenderer,
} from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js'
import {
  bedDepth, missionAt, oxygenColor, PROBE_STOWED_Y, SECTION, sectionOxygen, STATIONS, WATER_DEPTH,
} from './missionTimeline'
import type { ProgressRef } from './ProbeStage'

/** The water runs well past the frame either side; the page fades it out at the edges. */
const REACH = { from: -14, to: 12 }
/** The near face of the water, where the cut-away section is drawn. The boat and probe sit at z = 0. */
const FACE_Z = 0.75

/** The winch spool in the boat model's frame (see the Blender build): its axle runs across the boat, so side-on
 * it's a circle, and the tether pays off its forward side straight down. */
const SPOOL = { x: -0.17, y: 0.224, radius: 0.034 }
const TETHER_X = SPOOL.x + SPOOL.radius

/** Side-on camera beats: where to look, and how far back to stand. */
const SHOTS = [
  { x: 0, y: -0.65, distance: 11.5 },    // the drive in, stopping in the middle
  { x: 0.05, y: -0.9, distance: 9.6 },   // the probe going down
  { x: 0, y: -1.15, distance: 12.5 },    // the section map
]

const rgb = ([r, g, b]: [number, number, number]) => new Color(r / 255, g / 255, b / 255)

/** The near face of the water, darkening with depth down to the bed. */
function waterFace() {
  const columns = 120
  const rows = 24
  const positions: number[] = []
  const colors: number[] = []
  const indices: number[] = []
  const shallow = new Color('#a6d8e3')
  const deep = new Color('#1f5670')
  const c = new Color()
  for (let i = 0; i <= columns; i++) {
    const x = REACH.from + ((REACH.to - REACH.from) * i) / columns
    const bottom = bedDepth(x)
    for (let j = 0; j <= rows; j++) {
      const t = j / rows
      positions.push(x, -bottom * t, FACE_Z)
      c.copy(shallow).lerp(deep, ((bottom * t) / WATER_DEPTH) ** 0.85)
      colors.push(c.r, c.g, c.b)
    }
  }
  for (let i = 0; i < columns; i++) {
    for (let j = 0; j < rows; j++) {
      const a = i * (rows + 1) + j
      const b = a + rows + 1
      indices.push(a, b, a + 1, b, b + 1, a + 1)
    }
  }
  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new BufferAttribute(new Float32Array(positions), 3))
  geometry.setAttribute('color', new BufferAttribute(new Float32Array(colors), 3))
  geometry.setIndex(indices)
  const mesh = new Mesh(geometry, new MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.62, depthWrite: false, side: DoubleSide }))
  mesh.renderOrder = 3
  return mesh
}

/** The pond bed: a band of sand following the bottom, in front of everything below the water. */
function bedBand() {
  const columns = 120
  const positions: number[] = []
  const indices: number[] = []
  for (let i = 0; i <= columns; i++) {
    const x = REACH.from + ((REACH.to - REACH.from) * i) / columns
    const y = -bedDepth(x)
    positions.push(x, y, FACE_Z + 0.01, x, y - 1.2, FACE_Z + 0.01)
  }
  for (let i = 0; i < columns; i++) {
    const a = i * 2
    indices.push(a, a + 2, a + 1, a + 2, a + 3, a + 1)
  }
  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new BufferAttribute(new Float32Array(positions), 3))
  geometry.setIndex(indices)
  const mesh = new Mesh(geometry, new MeshBasicMaterial({ color: '#c8b48b', side: DoubleSide }))
  mesh.renderOrder = 6
  return mesh
}

/** The oxygen section: every point between the stations, from the surface to the bed, coloured by oxygen. */
function sectionTexture() {
  const w = 512
  const h = 160
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')!
  const image = ctx.createImageData(w, h)
  for (let i = 0; i < w; i++) {
    const x = SECTION.from + ((SECTION.to - SECTION.from) * i) / (w - 1)
    for (let j = 0; j < h; j++) {
      const depth = (WATER_DEPTH * j) / (h - 1)
      const [r, g, b] = oxygenColor(sectionOxygen(x, depth))
      image.data.set([r, g, b, 255], (j * w + i) * 4)
    }
  }
  ctx.putImageData(image, 0, 0)
  const texture = new CanvasTexture(canvas)
  texture.colorSpace = SRGBColorSpace
  return texture
}

export default function MissionStage({ progress, onReady }: { progress: ProgressRef; onReady: () => void }) {
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
    renderer.domElement.setAttribute('role', 'img')
    renderer.domElement.setAttribute(
      'aria-label',
      'Side view of an AquaScan mission: the boat drives to a sampling point, lowers its probe to the bottom, records readings at each depth, and the readings become a map of oxygen through the pond.',
    )
    host.appendChild(renderer.domElement)
    const canvas = renderer.domElement

    const scene = new Scene()
    const pmrem = new PMREMGenerator(renderer)
    const environment = pmrem.fromScene(new RoomEnvironment(), 0.03).texture
    scene.environment = environment
    scene.environmentIntensity = 0.85
    const key = new DirectionalLight(0xffffff, 2)
    key.position.set(1.5, 4, 5)
    scene.add(key)
    const fill = new DirectionalLight(0xdfeaff, 0.6)
    fill.position.set(-3, 1, 2)
    scene.add(fill)

    const camera = new PerspectiveCamera(22, 1, 0.1, 80)

    // ---------- Water ----------
    scene.add(waterFace())
    scene.add(bedBand())
    const waterline = new Mesh(new PlaneGeometry(REACH.to - REACH.from, 0.012), new MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.9 }))
    waterline.position.set((REACH.from + REACH.to) / 2, 0, FACE_Z + 0.005)
    waterline.renderOrder = 4
    scene.add(waterline)

    // ---------- Oxygen section (map beat) ----------
    const sectionWidth = SECTION.to - SECTION.from
    const sectionGeometry = new PlaneGeometry(sectionWidth, WATER_DEPTH)
    sectionGeometry.translate(sectionWidth / 2, -WATER_DEPTH / 2, 0) // anchored at its left edge so it can grow rightward
    const sectionMap = sectionTexture()
    const sectionMaterial = new MeshBasicMaterial({ map: sectionMap, transparent: true, opacity: 0, depthWrite: false })
    const section = new Mesh(sectionGeometry, sectionMaterial)
    section.position.set(SECTION.from, 0, FACE_Z + 0.004)
    section.renderOrder = 5
    scene.add(section)

    const casts = STATIONS.map((s) => {
      const geometry = new BufferGeometry().setFromPoints([new Vector3(s.x, 0, FACE_Z + 0.008), new Vector3(s.x, -bedDepth(s.x), FACE_Z + 0.008)])
      const line = new Line(geometry, new LineDashedMaterial({ color: '#ffffff', dashSize: 0.08, gapSize: 0.06, transparent: true, opacity: 0 }))
      line.computeLineDistances()
      line.renderOrder = 7
      const buoy = new Mesh(new SphereGeometry(0.06, 16, 12), new MeshBasicMaterial({ color: rgb(oxygenColor(s.oxygen)), transparent: true, opacity: 0 }))
      buoy.position.set(s.x, 0.02, FACE_Z + 0.02)
      buoy.renderOrder = 7
      scene.add(line, buoy)
      return { line, buoy }
    })

    // ---------- Wake ----------

    const wakeGeometry = new PlaneGeometry(1, 0.035)
    wakeGeometry.translate(-0.5, 0, 0) // grows backward from the stern
    const wake = new Mesh(wakeGeometry, new MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.85, depthWrite: false }))
    wake.renderOrder = 5
    scene.add(wake)

    // ---------- Boat, tether, probe ----------
    const rig = new Group()
    scene.add(rig)
    const boatHolder = new Group()
    rig.add(boatHolder)
    // Black marine cable from the spool to a shackle on the probe's tether mount.
    const cable = new MeshStandardMaterial({ color: '#0d0e10', roughness: 0.45 })
    const tether = new Mesh(new CylinderGeometry(0.007, 0.007, 1, 10), cable)
    rig.add(tether)
    const steel = new MeshStandardMaterial({ color: '#8d9299', roughness: 0.3, metalness: 0.9 })
    const shackle = new Mesh(new TorusGeometry(0.014, 0.0045, 10, 24), steel) // faces the camera, so it reads as a ring
    const ferrule = new Mesh(new CylinderGeometry(0.0095, 0.0095, 0.03, 12), steel) // crimped sleeve on the cable end
    rig.add(shackle, ferrule)
    const probeHolder = new Group()
    rig.add(probeHolder)
    // The top of the probe's tether mount, relative to the probe's centre (measured once the model loads).
    const mount = new Vector3(0, 0.05, 0)

    const charcoal = new MeshPhysicalMaterial({ color: '#1d1e21', roughness: 0.55, clearcoat: 0.2, clearcoatRoughness: 0.5 })
    const deck = new MeshStandardMaterial({ color: '#2a2c30', roughness: 0.6 })
    const strut = new MeshStandardMaterial({ color: '#3b3e43', roughness: 0.6 })
    const accent = new MeshPhysicalMaterial({ color: '#2f80ea', roughness: 0.4, clearcoat: 0.3 })
    const boatMaterial = (name: string) => ({ hull: charcoal, deck, frame: strut, blue: accent, spool: deck })[name] ?? null
    const probeBlack = new MeshPhysicalMaterial({ color: '#111214', roughness: 0.5, clearcoat: 0.25 })
    const probeCap = new MeshPhysicalMaterial({ color: '#eceeec', roughness: 0.3, clearcoat: 0.6 })

    let loaded = 0
    let disposed = false
    let needsRender = true
    const done = () => {
      loaded += 1
      needsRender = true
      if (loaded === 2) onReady()
    }
    const loader = new GLTFLoader()
    loader.setMeshoptDecoder(MeshoptDecoder)
    loader.load('/models/aquascan-boat.glb', (gltf) => {
      if (disposed) return
      gltf.scene.traverse((child) => {
        if (!(child instanceof Mesh)) return
        const material = boatMaterial((child.material as { name?: string }).name ?? '')
        if (material) child.material = material
      })
      boatHolder.add(gltf.scene)
      done()
    })
    loader.load('/models/aquascan-probe.glb', (gltf) => {
      if (disposed) return
      const root = gltf.scene
      root.traverse((child: Object3D) => {
        if (!(child instanceof Mesh)) return
        let node: Object3D | null = child
        while (node && node.parent && node.parent.name !== 'AquaScanProbe') node = node.parent
        const name = node?.name ?? ''
        if (name === 'pcb' || name === 'component_tray' || name === 'internal_brace') return
        child.material = name === 'nose_cone' ? probeCap : probeBlack
      })
      const box = new Box3().setFromObject(root)
      root.position.sub(box.getCenter(new Vector3()))
      root.updateMatrixWorld(true)
      const mountNode = root.getObjectByName('tether_mount')
      const mountBox = new Box3().setFromObject(mountNode ?? root)
      mount.set(mountBox.getCenter(new Vector3()).x, mountBox.max.y - (mountNode ? 0.004 : 0), 0)
      probeHolder.add(root)
      done()
    })

    // ---------- Sizing ----------
    // Where the canvas bleeds past the picture's panel it fades out at both ends (see .mission-canvas), so
    // centre the action on the middle of the water that stays fully visible, not the middle of the canvas.
    let width = 1
    let height = 1
    let waterCentre = 0.5
    const resize = () => {
      width = host.clientWidth
      height = host.clientHeight
      renderer.setSize(width, height, false)
      camera.aspect = width / Math.max(1, height)
      camera.updateProjectionMatrix()
      const panelWidth = host.parentElement?.clientWidth ?? width
      waterCentre = width > panelWidth + 1 ? (0.22 + 0.88) / 2 : 0.5
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

    const lookAt = new Vector3()
    let shown = -1
    let frameId = 0
    let last = performance.now()

    const tick = (now: number) => {
      frameId = requestAnimationFrame(tick)
      const dt = Math.min(0.05, (now - last) / 1000)
      last = now
      if (!visible) return

      // Glide toward the scroll position so wheel steps don't jump.
      const target = Math.min(1, Math.max(0, progress.current ?? 0))
      if (shown < 0 || reduceMotion || Math.abs(target - shown) < 0.0004) {
        if (shown !== target) needsRender = true
        shown = target
      } else {
        shown += (target - shown) * (1 - Math.exp(-dt * 8))
        needsRender = true
      }
      if (!needsRender) return
      needsRender = false

      const m = missionAt(shown)

      // Boat, in profile, bow to the right.
      rig.position.set(m.boatX, 0, 0)
      // The probe hangs with its tether mount directly under the spool, so the cable runs straight down.
      const probeY = PROBE_STOWED_Y - m.lowered
      probeHolder.position.set(TETHER_X - mount.x, probeY, 0)
      const shackleY = probeY + mount.y + 0.012
      shackle.position.set(TETHER_X, shackleY, 0)
      ferrule.position.set(TETHER_X, shackleY + 0.026, 0)
      const top = SPOOL.y
      const bottom = shackleY + 0.04
      tether.scale.y = Math.max(0.001, top - bottom)
      tether.position.set(TETHER_X, (top + bottom) / 2, 0)

      // Wake behind the stern while it moves.
      const moving = 1 - Math.min(1, Math.max(0, (m.travel - 0.85) / 0.15))
      wake.position.set(m.boatX - 0.48, 0.004, 0.32)
      wake.scale.x = 0.2 + 2.6 * m.travel * moving
      ;(wake.material as MeshBasicMaterial).opacity = 0.85 * moving
      wake.visible = moving > 0

      // Map: a cast at each station, then the oxygen section fills in from left to right.
      casts.forEach(({ line, buoy }, i) => {
        const k = Math.min(1, Math.max(0, m.map * (STATIONS.length + 1) - i))
        ;(line.material as LineDashedMaterial).opacity = k * 0.9
        ;(buoy.material as MeshBasicMaterial).opacity = k
      })
      const reveal = Math.min(1, Math.max(0.0001, (m.map - 0.15) / 0.85))
      section.scale.x = reveal
      sectionMap.repeat.x = reveal
      sectionMaterial.opacity = Math.min(1, m.map * 3) * 0.9

      // Camera: side-on throughout, easing between the three shots and following the probe down.
      const i = Math.min(1, Math.floor(m.view))
      const k = m.view - i
      const a = SHOTS[i]
      const b = SHOTS[i + 1]
      const follow = Math.max(0, 1 - Math.abs(m.view - 1)) * Math.min(1, m.depth / 2.5)
      const tx = a.x + (b.x - a.x) * k
      const ty = a.y + (b.y - a.y) * k - follow * 0.6
      let distance = a.distance + (b.distance - a.distance) * k
      const aspect = width / Math.max(1, height)
      if (aspect < 1.1) distance *= (1.1 / aspect) ** 0.8 // keep enough of the pond in a tall frame
      // Shift so the look-at point lands in the middle of the visible water.
      const halfWidth = Math.tan((camera.fov * Math.PI) / 360) * distance * aspect
      const shift = (0.5 - waterCentre) * 2 * halfWidth
      lookAt.set(tx + shift, ty, 0)
      camera.position.set(tx + shift, ty, distance) // level with the look point: a straight side elevation
      camera.lookAt(lookAt)

      renderer.render(scene, camera)
    }
    frameId = requestAnimationFrame(tick)

    return () => {
      disposed = true
      cancelAnimationFrame(frameId)
      resizeObserver.disconnect()
      visibility.disconnect()
      scene.traverse((object) => {
        if (object instanceof Mesh || object instanceof Line) {
          object.geometry.dispose()
          const materials = Array.isArray(object.material) ? object.material : [object.material]
          materials.forEach((material) => {
            ;(material as MeshBasicMaterial).map?.dispose()
            material.dispose()
          })
        }
      })
      environment.dispose()
      pmrem.dispose()
      renderer.dispose()
      canvas.remove()
    }
  }, [progress, onReady])

  return <div ref={hostRef} className="mission-canvas" />
}
