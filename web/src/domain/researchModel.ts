import type { InferenceSession } from 'onnxruntime-web'
import type { AquaMission, AquaSample } from '../types/aqua'
import type { ResearchPhenomenonId } from './researchPhenomena'
import { metricValue } from './metrics'

export const defaultResearchModelMetadataUrl = '/models/research/metadata.json'

export type ResearchModelState = 'loading' | 'disabled' | 'ready' | 'error'

export type ResearchModelDefinition = {
  id: ResearchPhenomenonId
  displayName: string
  enabled: boolean
  url: string
  inputName: string
  outputName?: string
  featureOrder: string[]
  outputLabels?: string[]
  mean?: number[]
  scale?: number[]
}

export type ResearchModelMetadata = {
  schemaVersion: 1
  runtime: 'onnxruntime-web'
  packageName: string
  packageVersion: string
  generatedUtc: string
  wasmPaths?: string
  models: Partial<Record<ResearchPhenomenonId, ResearchModelDefinition>>
}

export type ResearchModelBackendStatus = {
  state: ResearchModelState
  backendName: string
  message: string
  metadataUrl: string
  packageVersion?: string
  configuredModels: number
  enabledModels: number
  readyModels: number
  modelDefinitions: ResearchModelDefinition[]
  errors: string[]
}

export type ResearchModelPrediction = {
  id: ResearchPhenomenonId
  backendName: string
  status: 'ready' | 'disabled' | 'error'
  label?: string
  confidence?: number
  scores: Record<string, number>
  featureVector: number[]
}

export type LoadedResearchModel = {
  definition: ResearchModelDefinition
  session: InferenceSession
}

export type ResearchModelBackend = {
  metadata?: ResearchModelMetadata
  status: ResearchModelBackendStatus
  models: Partial<Record<ResearchPhenomenonId, LoadedResearchModel>>
  predict: (id: ResearchPhenomenonId, mission: AquaMission | undefined, sample: AquaSample | undefined) => Promise<ResearchModelPrediction>
}

export function loadingResearchModelStatus(metadataUrl = defaultResearchModelMetadataUrl): ResearchModelBackendStatus {
  return {
    state: 'loading',
    backendName: 'ONNX Runtime Web',
    message: 'Checking research model metadata...',
    metadataUrl,
    configuredModels: 0,
    enabledModels: 0,
    readyModels: 0,
    modelDefinitions: [],
    errors: [],
  }
}

export async function loadResearchModelBackend(metadataUrl = defaultResearchModelMetadataUrl): Promise<ResearchModelBackend> {
  try {
    const metadata = await fetchResearchModelMetadata(metadataUrl)
    const definitions = Object.values(metadata.models).filter(Boolean)
    const enabledDefinitions = definitions.filter((definition) => definition.enabled)

    if (enabledDefinitions.length === 0) {
      return backend(metadata, {
        state: 'disabled',
        backendName: 'Heuristic fallback',
        message: 'ONNX metadata found, but all research models are disabled.',
        metadataUrl,
        packageVersion: metadata.packageVersion,
        configuredModels: definitions.length,
        enabledModels: 0,
        readyModels: 0,
        modelDefinitions: definitions,
        errors: [],
      })
    }

    const ort = await import('onnxruntime-web')
    if (metadata.wasmPaths) ort.env.wasm.wasmPaths = metadata.wasmPaths

    const loaded: Partial<Record<ResearchPhenomenonId, LoadedResearchModel>> = {}
    const errors: string[] = []
    await Promise.all(
      enabledDefinitions.map(async (definition) => {
        try {
          loaded[definition.id] = {
            definition,
            session: await ort.InferenceSession.create(definition.url),
          }
        } catch (error) {
          errors.push(`${definition.displayName}: ${error instanceof Error ? error.message : 'failed to load model'}`)
        }
      }),
    )

    return backend(metadata, {
      state: Object.keys(loaded).length > 0 ? 'ready' : 'error',
      backendName: Object.keys(loaded).length > 0 ? 'ONNX Runtime Web' : 'Heuristic fallback',
      message:
        Object.keys(loaded).length > 0
          ? `${Object.keys(loaded).length} ONNX research model${Object.keys(loaded).length === 1 ? '' : 's'} ready.`
          : 'ONNX models are enabled but none loaded; heuristic analysis remains active.',
      metadataUrl,
      packageVersion: metadata.packageVersion,
      configuredModels: definitions.length,
      enabledModels: enabledDefinitions.length,
      readyModels: Object.keys(loaded).length,
      modelDefinitions: definitions,
      errors,
    }, loaded)
  } catch (error) {
    return backend(undefined, {
      state: 'error',
      backendName: 'Heuristic fallback',
      message: error instanceof Error ? error.message : 'Failed to load research model metadata.',
      metadataUrl,
      configuredModels: 0,
      enabledModels: 0,
      readyModels: 0,
      modelDefinitions: [],
      errors: [error instanceof Error ? error.message : 'Unknown research model loader error'],
    })
  }
}

export async function fetchResearchModelMetadata(metadataUrl = defaultResearchModelMetadataUrl): Promise<ResearchModelMetadata> {
  const response = await fetch(metadataUrl, { cache: 'no-store' })
  if (!response.ok) throw new Error(`Research model metadata not found at ${metadataUrl}`)
  return parseResearchModelMetadata(await response.json())
}

export function parseResearchModelMetadata(raw: unknown): ResearchModelMetadata {
  if (!isRecord(raw)) throw new Error('Research model metadata must be an object.')
  if (raw.schemaVersion !== 1) throw new Error('Unsupported research model metadata schema version.')
  if (raw.runtime !== 'onnxruntime-web') throw new Error('Research model metadata runtime must be onnxruntime-web.')
  if (!isRecord(raw.models)) throw new Error('Research model metadata must include a models object.')

  const models: Partial<Record<ResearchPhenomenonId, ResearchModelDefinition>> = {}
  Object.entries(raw.models).forEach(([key, value]) => {
    if (key !== 'nighttime_oxygen_trap' && key !== 'stormwater_fingerprint_atlas') return
    models[key] = parseModelDefinition(key, value)
  })

  return {
    schemaVersion: 1,
    runtime: 'onnxruntime-web',
    packageName: readString(raw.packageName, 'AQUAScan research models'),
    packageVersion: readString(raw.packageVersion, '0.0.0'),
    generatedUtc: readString(raw.generatedUtc, new Date(0).toISOString()),
    wasmPaths: typeof raw.wasmPaths === 'string' ? raw.wasmPaths : undefined,
    models,
  }
}

export function buildResearchFeatureVector(
  definition: Pick<ResearchModelDefinition, 'featureOrder' | 'mean' | 'scale'>,
  mission: AquaMission | undefined,
  sample: AquaSample | undefined,
) {
  const values = definition.featureOrder.map((feature) => readFeature(feature, mission, sample))
  return values.map((value, index) => {
    const mean = definition.mean?.[index] ?? 0
    const scale = definition.scale?.[index] ?? 1
    return scale === 0 ? value - mean : (value - mean) / scale
  })
}

function backend(
  metadata: ResearchModelMetadata | undefined,
  status: ResearchModelBackendStatus,
  models: Partial<Record<ResearchPhenomenonId, LoadedResearchModel>> = {},
): ResearchModelBackend {
  return {
    metadata,
    status,
    models,
    predict: async (id, mission, sample) => {
      const loaded = models[id]
      if (!loaded) {
        return {
          id,
          backendName: status.backendName,
          status: status.state === 'error' ? 'error' : 'disabled',
          scores: {},
          featureVector: [],
        }
      }

      const featureVector = buildResearchFeatureVector(loaded.definition, mission, sample)
      const ort = await import('onnxruntime-web')
      const tensor = new ort.Tensor('float32', Float32Array.from(featureVector), [1, featureVector.length])
      const feeds = { [loaded.definition.inputName]: tensor }
      const output = await loaded.session.run(feeds)
      const outputName = loaded.definition.outputName ?? Object.keys(output)[0]
      const data = Array.from(output[outputName].data as Iterable<number>)
      const scores = scoreOutputs(data, loaded.definition.outputLabels)
      const [label, confidence] = bestScore(scores)

      return {
        id,
        backendName: 'ONNX Runtime Web',
        status: 'ready',
        label,
        confidence,
        scores,
        featureVector,
      }
    },
  }
}

function parseModelDefinition(id: ResearchPhenomenonId, value: unknown): ResearchModelDefinition {
  if (!isRecord(value)) throw new Error(`Research model ${id} must be an object.`)
  const featureOrder = readStringArray(value.featureOrder)
  if (featureOrder.length === 0) throw new Error(`Research model ${id} must include featureOrder.`)
  return {
    id,
    displayName: readString(value.displayName, id),
    enabled: value.enabled === true,
    url: readString(value.url, `/models/research/${id}.onnx`),
    inputName: readString(value.inputName, 'features'),
    outputName: typeof value.outputName === 'string' ? value.outputName : undefined,
    featureOrder,
    outputLabels: readStringArray(value.outputLabels),
    mean: readNumberArray(value.mean),
    scale: readNumberArray(value.scale),
  }
}

function readFeature(feature: string, mission: AquaMission | undefined, sample: AquaSample | undefined) {
  if (!sample) return 0
  const hour = new Date(sample.timestamp).getUTCHours() + new Date(sample.timestamp).getUTCMinutes() / 60
  switch (feature) {
    case 'hour_sin':
      return Math.sin((hour / 24) * Math.PI * 2)
    case 'hour_cos':
      return Math.cos((hour / 24) * Math.PI * 2)
    case 'depth_m':
      return sample.depthMeters ?? metricValue(sample, 'depth') ?? 0
    case 'dissolved_oxygen_mg_l':
      return metricValue(sample, 'do') ?? 0
    case 'temperature_c':
      return metricValue(sample, 'temperature') ?? 0
    case 'conductivity_us_cm':
      return metricValue(sample, 'conductivity') ?? 0
    case 'turbidity_ntu':
      return metricValue(sample, 'turbidity') ?? 0
    case 'light_lux':
      return metricValue(sample, 'light') ?? 0
    case 'precipitation_mm_h':
      return metricValue(sample, 'precipitation') ?? 0
    case 'tds_ppm':
      return metricValue(sample, 'tds') ?? 0
    case 'salinity_psu':
      return metricValue(sample, 'salinity') ?? 0
    case 'uv_index':
      return metricValue(sample, 'uv') ?? 0
    case 'do_delta_prev':
      return previousDelta(mission, sample, 'do')
    case 'temperature_delta_prev':
      return previousDelta(mission, sample, 'temperature')
    default:
      return metricValue(sample, feature) ?? 0
  }
}

function previousDelta(mission: AquaMission | undefined, sample: AquaSample, metricId: string) {
  const current = metricValue(sample, metricId)
  if (current === undefined || !mission) return 0
  const index = mission.samples.indexOf(sample)
  if (index <= 0) return 0
  const previous = metricValue(mission.samples[index - 1], metricId)
  return previous === undefined ? 0 : current - previous
}

function scoreOutputs(values: number[], labels: string[] | undefined) {
  const scores: Record<string, number> = {}
  values.forEach((value, index) => {
    scores[labels?.[index] ?? `output_${index}`] = value
  })
  return scores
}

function bestScore(scores: Record<string, number>): [string | undefined, number | undefined] {
  return Object.entries(scores).sort((a, b) => b[1] - a[1])[0] ?? [undefined, undefined]
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function readString(value: unknown, fallback: string) {
  return typeof value === 'string' && value.trim().length > 0 ? value : fallback
}

function readStringArray(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string' && item.length > 0) : []
}

function readNumberArray(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is number => typeof item === 'number' && Number.isFinite(item)) : undefined
}
