import {
  Activity,
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  BrainCircuit,
  ChevronDown,
  ChevronUp,
  Download,
  FileDown,
  FolderOpen,
  Gauge,
  LocateFixed,
  MapPin,
  Moon,
  Plus,
  Power,
  Radio,
  RotateCcw,
  Route,
  ShieldAlert,
  ShipWheel,
  SlidersHorizontal,
  Sun,
  Trash2,
  Upload,
} from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties, ReactNode, RefObject } from 'react'
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import './App.css'
import { BoatScene } from './components/BoatScene'
import { Joystick } from './components/Joystick'
import { predictWaterQuality } from './domain/ai'
import { localToGeo, offsetToLocal } from './domain/geo'
import { defaultLiveSettings } from './domain/liveSettings'
import { formatMetricValue, getMetricDescriptor, gradientCss, listMissionMetrics, metricValue } from './domain/metrics'
import { loadMissionFromFile, loadMissionFromUrl } from './domain/missionLoader'
import {
  cloneMissionForPlanning,
  deleteWaypoint,
  exportMissionPlanCsv,
  exportMissionPlanJson,
  insertWaypointAfter,
  legDistanceMeters,
  legHeadingDeg,
  moveWaypoint,
  updateWaypoint,
  validateMissionPlan,
  type MissionPlanWarning,
} from './domain/missionPlanner'
import { exportMissionRoutePayload, nearestSampleIndex, normalizedTimeForSample, summarizeMetricRoute, summarizeMissionRoute } from './domain/missionTools'
import { abortUploadMessage, buildMissionUploadPlan } from './domain/missionUploadProtocol'
import { getPlaybackSegment, missionDurationSeconds } from './domain/playback'
import { buildPreflightChecks, preflightReady } from './domain/preflight'
import { createProjectFile, parseProjectFile, serializeProjectFile, type AquaProjectFile } from './domain/projectFiles'
import { defaultResearchModelMetadataUrl, loadResearchModelBackend, loadingResearchModelStatus, type ResearchModelBackendStatus, type ResearchModelDefinition } from './domain/researchModel'
import { analyzeResearchPhenomena, type ResearchPhenomenonAnalysis } from './domain/researchPhenomena'
import { useLiveBoat } from './hooks/useLiveBoat'
import { useLocalStorageState } from './hooks/useLocalStorageState'
import type { AquaMission, DriveStatus, LayerVisibility, TabId, TelemetryHealth } from './types/aqua'

type RunState = 'draft' | 'prepared' | 'armed' | 'running' | 'paused' | 'completed' | 'aborted'

type RunEvent = {
  id: string
  timestampUtc: string
  state: RunState
  message: string
}

type OperatorAlertSeverity = 'ok' | 'notice' | 'warning' | 'critical'

type OperatorAlert = {
  id: string
  severity: OperatorAlertSeverity
  title: string
  detail: string
}

const defaultLayers: LayerVisibility = {
  track: true,
  points: true,
  heatmap: true,
}

function App() {
  const [mission, setMission] = useState<AquaMission>()
  const [loadedMission, setLoadedMission] = useState<AquaMission>()
  const [missionError, setMissionError] = useState('')
  const [projectName, setProjectName] = useState('AQUAScan Mission')
  const [activeProjectId, setActiveProjectId] = useState<string>()
  const [isDirty, setIsDirty] = useState(false)
  const [autosavedAt, setAutosavedAt] = useState('')
  const [executionPreparedAt, setExecutionPreparedAt] = useState('')
  const [runState, setRunState] = useState<RunState>('draft')
  const [runEvents, setRunEvents] = useState<RunEvent[]>([])
  const [metricId, setMetricId] = useState('temperature')
  const [normalizedTime, setNormalizedTime] = useState(0)
  const [isPlaying, setIsPlaying] = useState(true)
  const [activeTab, setActiveTab] = useState<TabId>('sensors')
  const [setupStep, setSetupStep] = useState(0)
  const [liveMode, setLiveMode] = useState(true)
  const [simulatorEnabled, setSimulatorEnabled] = useLocalStorageState('aquascan.simulatorEnabled', false)
  const [interfaceMode, setInterfaceMode] = useLocalStorageState<'simple' | 'advanced'>('aquascan.interfaceMode', 'simple')
  const [joystick, setJoystick] = useState<[number, number]>([0, 0])
  const [probeSpeed, setProbeSpeed] = useState(160)
  const [selectedSampleIndex, setSelectedSampleIndex] = useState<number>()
  const [timelineCollapsed, setTimelineCollapsed] = useState(false)
  const [theme, setTheme] = useLocalStorageState<'light' | 'dark'>('aquascan.theme', 'light')
  const [layers, setLayers] = useLocalStorageState('aquascan.layers', defaultLayers)
  const [settings, setSettings] = useLocalStorageState('aquascan.liveSettings', defaultLiveSettings)
  const [savedProjects, setSavedProjects] = useLocalStorageState<AquaProjectFile[]>('aquascan.projects', [])
  const [controlPanelWidth, setControlPanelWidth] = useLocalStorageState('aquascan.controlPanelWidth', 430)
  const [infoPanelWidth, setInfoPanelWidth] = useLocalStorageState('aquascan.infoPanelWidth', 340)
  const [researchModelMetadataUrl, setResearchModelMetadataUrl] = useLocalStorageState('aquascan.researchModelMetadataUrl', defaultResearchModelMetadataUrl)
  const [researchModelRefreshKey, setResearchModelRefreshKey] = useState(0)
  const [researchModelStatus, setResearchModelStatus] = useState<ResearchModelBackendStatus>(() => loadingResearchModelStatus())
  const workspaceRef = useRef<HTMLElement>(null)
  const controlPanelRef = useRef<HTMLElement>(null)
  const infoPanelRef = useRef<HTMLElement>(null)
  const controlHandleRef = useRef<HTMLButtonElement>(null)
  const infoHandleRef = useRef<HTMLButtonElement>(null)
  const probeHoldTimerRef = useRef<number | undefined>(undefined)
  const live = useLiveBoat(settings, liveMode, joystick, { enabled: simulatorEnabled, mission })

  const segment = useMemo(() => getPlaybackSegment(mission, normalizedTime), [mission, normalizedTime])
  const liveLocalPosition = useMemo(() => {
    if (!mission || live.status.latitude === undefined || live.status.longitude === undefined) return undefined
    return offsetToLocal(mission.geoReference, live.status.latitude, live.status.longitude, live.status.altitude)
  }, [live.status.altitude, live.status.latitude, live.status.longitude, mission])
  const boatHeadingRad = useMemo(() => {
    if (liveMode && live.status.headingDeg !== undefined) return (live.status.headingDeg * Math.PI) / 180
    if (!segment) return 0
    const dx = segment.to.localPosition[0] - segment.from.localPosition[0]
    const dz = segment.to.localPosition[2] - segment.from.localPosition[2]
    return Math.hypot(dx, dz) > 0.001 ? Math.atan2(dx, dz) : 0
  }, [live.status.headingDeg, liveMode, segment])
  const metrics = useMemo(() => listMissionMetrics(mission), [mission])
  const descriptor = useMemo(() => getMetricDescriptor(metricId), [metricId])
  const selectedSample = selectedSampleIndex !== undefined ? mission?.samples[selectedSampleIndex] : undefined
  const routeSummary = useMemo(() => summarizeMissionRoute(mission), [mission])
  const metricSummary = useMemo(() => summarizeMetricRoute(mission, metricId), [mission, metricId])
  const planWarnings = useMemo(() => validateMissionPlan(mission), [mission])
  const uploadPlan = useMemo(() => (mission ? buildMissionUploadPlan(mission, live.status.lastSeq + 1) : undefined), [live.status.lastSeq, mission])
  const preflightChecks = useMemo(
    () =>
      buildPreflightChecks({
        mission,
        planWarnings,
        connected: live.socketState === 'connected',
        telemetryHealth: live.health,
        status: live.status,
        armed: live.armed,
        estop: live.estop,
      }),
    [live.armed, live.estop, live.health, live.socketState, live.status, mission, planWarnings],
  )
  const isPreflightReady = preflightReady(preflightChecks)
  const currentValue = metricValue(segment?.sample, metricId)
  const selectedValue = metricValue(selectedSample, metricId)
  const prediction = useMemo(() => predictWaterQuality(mission, segment?.sample), [mission, segment?.sample])
  const researchAnalyses = useMemo(() => analyzeResearchPhenomena(mission), [mission])
  const planHasBlockingErrors = planWarnings.some((warning) => warning.severity === 'error')
  const setupSteps = useMemo(
    () => [
      { label: 'Mission', complete: Boolean(mission), detail: mission ? mission.missionName : 'Load a mission' },
      { label: 'Target', complete: Boolean(metricId), detail: descriptor.displayName },
      { label: 'Plan', complete: Boolean(mission) && !planHasBlockingErrors, detail: planWarnings.length === 0 ? 'Plan valid' : `${planWarnings.length} issue${planWarnings.length === 1 ? '' : 's'}` },
      { label: 'Mode', complete: simulatorEnabled || liveMode, detail: simulatorEnabled ? 'Simulator' : liveMode ? 'Hardware' : 'Choose mode' },
      { label: 'Prepare', complete: Boolean(executionPreparedAt), detail: executionPreparedAt ? 'Prepared' : isPreflightReady ? 'Ready' : 'Blocked' },
    ],
    [descriptor.displayName, executionPreparedAt, isPreflightReady, liveMode, metricId, mission, planHasBlockingErrors, planWarnings.length, simulatorEnabled],
  )
  const activeSetupStep = setupSteps[Math.min(setupStep, setupSteps.length - 1)]
  const modelFeatureReports = useMemo(() => researchModelStatus.modelDefinitions.map((definition) => buildModelFeatureReport(definition, mission)), [mission, researchModelStatus.modelDefinitions])
  const reviewProgressPercent = mission ? Math.round(normalizedTime * 100) : 0
  const researchCandidateCount = researchAnalyses.filter((analysis) => analysis.readinessPercent >= 50).length
  const durationSeconds = missionDurationSeconds(mission)
  const runProgress = useMemo(() => summarizeRunProgress(mission, normalizedTime), [mission, normalizedTime])
  const telemetrySource = liveMode && liveLocalPosition ? 'Live telemetry' : liveMode ? 'Live control' : 'Playback'
  const boatPosition = liveMode && liveLocalPosition ? liveLocalPosition : (segment?.position ?? [0, 0, 0])
  const packetAgeLabel = live.packetAgeMs === undefined ? '--' : live.packetAgeMs < 1000 ? `${Math.round(live.packetAgeMs)} ms` : `${(live.packetAgeMs / 1000).toFixed(1)} s`
  const healthLabel = live.health === 'fresh' ? 'Telemetry fresh' : live.health === 'stale' ? 'Telemetry stale' : live.health === 'connecting' ? 'Connecting telemetry' : live.health === 'error' ? 'Telemetry error' : 'Telemetry offline'
  const healthTone = live.health === 'fresh' ? 'good' : live.health === 'stale' || live.health === 'connecting' ? 'warn' : live.health === 'error' ? 'bad' : 'neutral'
  const operatorAlerts = useMemo(
    () =>
      buildOperatorAlerts({
        mission,
        planWarnings,
        liveMode,
        simulatorEnabled,
        socketState: live.socketState,
        telemetryHealth: live.health,
        status: live.status,
        packetAgeMs: live.packetAgeMs,
        armed: live.armed,
        estop: live.estop,
        joystick,
        runState,
        isDirty,
      }),
    [isDirty, joystick, live.armed, live.estop, live.health, live.packetAgeMs, live.socketState, live.status, liveMode, mission, planWarnings, runState, simulatorEnabled],
  )
  const activeOperatorAlerts = operatorAlerts.filter((alert) => alert.severity !== 'ok')
  const primaryOperatorAlert = operatorAlerts[0]
  const alertTone = primaryOperatorAlert.severity === 'critical' ? 'bad' : primaryOperatorAlert.severity === 'warning' ? 'warn' : primaryOperatorAlert.severity === 'ok' ? 'good' : 'neutral'
  const chartData = useMemo(
    () =>
      mission?.samples.map((sample, index) => ({
        index,
        label: new Date(sample.timestamp).toLocaleTimeString([], { minute: '2-digit', second: '2-digit' }),
        value: metricValue(sample, metricId) ?? null,
      })) ?? [],
    [mission, metricId],
  )
  const workspaceStyle = {
    '--control-panel-width': `${controlPanelWidth}px`,
    '--info-panel-width': `${infoPanelWidth}px`,
  } as CSSProperties

  const getPanelElement = useCallback((panel: 'control' | 'info') => (panel === 'control' ? controlPanelRef.current : infoPanelRef.current), [])
  const getHandleElement = useCallback((panel: 'control' | 'info') => (panel === 'control' ? controlHandleRef.current : infoHandleRef.current), [])

  const updatePanelHandle = useCallback(
    (panel: 'control' | 'info') => {
      const panelElement = getPanelElement(panel)
      const handleElement = getHandleElement(panel)
      if (!panelElement || !handleElement) return

      const { scrollableDistance, thumbHeight, thumbOffset } = getPanelHandleMetrics(panelElement, handleElement)

      handleElement.style.setProperty('--scroll-thumb-height', `${thumbHeight}px`)
      handleElement.style.setProperty('--scroll-thumb-y', `${thumbOffset}px`)
      handleElement.dataset.scrollable = scrollableDistance > 1 ? 'true' : 'false'
    },
    [getHandleElement, getPanelElement],
  )

  const updateAllPanelHandles = useCallback(() => {
    updatePanelHandle('control')
    updatePanelHandle('info')
  }, [updatePanelHandle])

  const scrollPanelFromHandle = useCallback(
    (panel: 'control' | 'info', deltaY: number) => {
      const panelElement = getPanelElement(panel)
      if (!panelElement) return
      panelElement.scrollTop = clamp(panelElement.scrollTop + deltaY, 0, panelElement.scrollHeight - panelElement.clientHeight)
      updatePanelHandle(panel)
    },
    [getPanelElement, updatePanelHandle],
  )

  const startPanelInteraction = (panel: 'control' | 'info', event: React.PointerEvent<HTMLButtonElement>) => {
    event.preventDefault()
    const bounds = workspaceRef.current?.getBoundingClientRect()
    const panelElement = getPanelElement(panel)
    if (!bounds || !panelElement) return
    const handleBounds = event.currentTarget.getBoundingClientRect()
    const { scrollableDistance: startScrollableDistance, thumbHeight, thumbOffset } = getPanelHandleMetrics(panelElement, event.currentTarget)
    const trackHeight = Math.max(0, event.currentTarget.clientHeight - 16)
    const maxThumbOffset = Math.max(0, trackHeight - thumbHeight)
    const pointerTrackY = event.clientY - handleBounds.top - 8
    const isPointerOnThumb = pointerTrackY >= thumbOffset && pointerTrackY <= thumbOffset + thumbHeight
    const thumbGrabOffset = isPointerOnThumb ? pointerTrackY - thumbOffset : thumbHeight / 2
    const startX = event.clientX
    const startY = event.clientY
    let mode: 'pending' | 'resize' | 'scroll' = 'pending'

    const handleMove = (moveEvent: PointerEvent) => {
      const deltaX = moveEvent.clientX - startX
      const deltaY = moveEvent.clientY - startY

      if (mode === 'pending') {
        if (Math.abs(deltaY) > 4 && Math.abs(deltaY) > Math.abs(deltaX)) mode = 'scroll'
        if (Math.abs(deltaX) > 4 && Math.abs(deltaX) >= Math.abs(deltaY)) mode = 'resize'
      }

      if (mode === 'scroll') {
        const nextPointerTrackY = moveEvent.clientY - handleBounds.top - 8
        const nextThumbOffset = clamp(nextPointerTrackY - thumbGrabOffset, 0, maxThumbOffset)
        const scrollRatio = maxThumbOffset > 0 ? nextThumbOffset / maxThumbOffset : 0
        panelElement.scrollTop = scrollRatio * startScrollableDistance
        updatePanelHandle(panel)
        return
      }

      if (mode !== 'resize') return
      if (panel === 'control') {
        const maxWidth = Math.max(300, Math.min(620, bounds.width - infoPanelWidth - 460))
        setControlPanelWidth(clamp(moveEvent.clientX - bounds.left, 300, maxWidth))
        return
      }
      const maxWidth = Math.max(260, Math.min(540, bounds.width - controlPanelWidth - 460))
      setInfoPanelWidth(clamp(bounds.right - moveEvent.clientX, 260, maxWidth))
    }
    const stopMove = () => {
      window.removeEventListener('pointermove', handleMove)
      window.removeEventListener('pointerup', stopMove)
      window.setTimeout(updateAllPanelHandles, 0)
    }
    window.addEventListener('pointermove', handleMove)
    window.addEventListener('pointerup', stopMove)
  }

  const selectSample = (index: number) => {
    if (!mission) return
    const clampedIndex = Math.max(0, Math.min(index, mission.samples.length - 1))
    setSelectedSampleIndex(clampedIndex)
    setNormalizedTime(normalizedTimeForSample(mission, clampedIndex))
    setIsPlaying(false)
  }

  const selectNearestPlaybackSample = () => {
    const nearest = nearestSampleIndex(mission, normalizedTime)
    if (nearest !== undefined) selectSample(nearest)
  }

  const sendProbeMotion = (direction: 'raise' | 'lower' | 'stop') => {
    live.sendProbeCommand(direction, direction === 'stop' ? 0 : probeSpeed)
  }

  const stopProbeMotion = () => {
    if (probeHoldTimerRef.current !== undefined) {
      window.clearInterval(probeHoldTimerRef.current)
      probeHoldTimerRef.current = undefined
    }
    sendProbeMotion('stop')
  }

  const startProbeMotion = (direction: 'raise' | 'lower') => {
    stopProbeMotion()
    sendProbeMotion(direction)
    probeHoldTimerRef.current = window.setInterval(() => sendProbeMotion(direction), 250)
  }

  useEffect(() => () => {
    if (probeHoldTimerRef.current !== undefined) window.clearInterval(probeHoldTimerRef.current)
  }, [])

  const exportMissionRoute = () => {
    if (!mission) return
    const payload = exportMissionRoutePayload(mission, metricId)
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `${slugify(mission.missionName)}-route.json`
    anchor.click()
    URL.revokeObjectURL(url)
  }

  const appendRunEvent = (state: RunState, message: string) => {
    const timestampUtc = new Date().toISOString()
    setRunEvents((events) => [
      {
        id: `${timestampUtc}-${events.length}`,
        timestampUtc,
        state,
        message,
      },
      ...events,
    ])
  }

  const resetRun = (message = 'Run reset') => {
    setRunState('draft')
    setRunEvents([])
    appendRunEvent('draft', message)
  }

  const markRunPrepared = () => {
    if (!mission || !isPreflightReady) return
    setExecutionPreparedAt(new Date().toISOString())
    setRunState('prepared')
    appendRunEvent('prepared', 'Mission prepared for frontend run mode')
  }

  const armRunMode = () => {
    if (runState !== 'prepared' && runState !== 'paused') return
    setRunState('armed')
    appendRunEvent('armed', 'Run mode armed')
  }

  const startRunMode = () => {
    if (!mission || (runState !== 'armed' && runState !== 'paused')) return
    setRunState('running')
    setIsPlaying(false)
    appendRunEvent('running', simulatorEnabled ? 'Browser simulator run started' : 'Frontend run tracking started')
  }

  const pauseRunMode = () => {
    if (runState !== 'running') return
    setRunState('paused')
    appendRunEvent('paused', 'Run paused')
  }

  const abortRunMode = () => {
    if (runState === 'completed' || runState === 'aborted' || runState === 'draft') return
    setRunState('aborted')
    setJoystick([0, 0])
    appendRunEvent('aborted', 'Run aborted; frontend commands forced neutral')
  }

  const completeRunMode = () => {
    if (!mission) return
    setRunState('completed')
    setNormalizedTime(1)
    setSelectedSampleIndex(Math.max(0, mission.samples.length - 1))
    appendRunEvent('completed', 'Run marked complete')
  }

  const exportRunSummary = () => {
    if (!mission) return
    downloadText(
      `${slugify(mission.missionName)}-run.json`,
      JSON.stringify(buildRunSummaryPayload(), null, 2),
      'application/json',
    )
  }

  const applyProject = (project: AquaProjectFile, dirty = false) => {
    const cloned = cloneMissionForPlanning(project.mission)
    setProjectName(project.name)
    setActiveProjectId(project.id)
    setLoadedMission(cloneMissionForPlanning(project.mission))
    setMission(cloned)
    setMetricId(project.selectedMetricId)
    setLayers(project.layers)
    setSettings({ ...defaultLiveSettings, ...project.liveSettings })
    setSelectedSampleIndex(0)
    setNormalizedTime(0)
    setIsPlaying(false)
    setIsDirty(dirty)
    setExecutionPreparedAt('')
    resetRun('Project loaded')
  }

  const markMissionChanged = (nextMission: AquaMission) => {
    setMission(nextMission)
    setIsDirty(true)
    setExecutionPreparedAt('')
    resetRun('Mission plan changed')
  }

  const saveProject = () => {
    if (!mission) return
    const project = createProjectFile({
      id: activeProjectId,
      name: projectName,
      mission,
      selectedMetricId: metricId,
      layers,
      liveSettings: settings,
    })
    setSavedProjects([project, ...savedProjects.filter((saved) => saved.id !== project.id)].slice(0, 8))
    setActiveProjectId(project.id)
    setProjectName(project.name)
    setIsDirty(false)
  }

  const loadProject = (projectId: string) => {
    const project = savedProjects.find((saved) => saved.id === projectId)
    if (project) applyProject(project)
  }

  const deleteProject = (projectId: string) => {
    setSavedProjects(savedProjects.filter((project) => project.id !== projectId))
    if (activeProjectId === projectId) {
      setActiveProjectId(undefined)
      setIsDirty(true)
    }
  }

  const exportProjectBundle = () => {
    if (!mission) return
    const project = createProjectFile({
      id: activeProjectId,
      name: projectName,
      mission,
      selectedMetricId: metricId,
      layers,
      liveSettings: settings,
    })
    downloadText(`${slugify(project.name)}.aquascan.json`, serializeProjectFile(project), 'application/json')
  }

  const loadProjectFile = async (file: File | undefined) => {
    if (!file) return
    try {
      const project = parseProjectFile(await file.text())
      setSavedProjects([project, ...savedProjects.filter((saved) => saved.id !== project.id)].slice(0, 8))
      applyProject(project)
      setMissionError('')
    } catch (error) {
      setMissionError(error instanceof Error ? error.message : 'Failed to load project file')
    }
  }

  const resetMissionPlan = () => {
    if (!loadedMission) return
    const cloned = cloneMissionForPlanning(loadedMission)
    markMissionChanged(cloned)
    setSelectedSampleIndex(0)
    setNormalizedTime(0)
    setIsPlaying(false)
  }

  const addWaypoint = () => {
    if (!mission) return
    const index = selectedSampleIndex ?? Math.max(0, mission.samples.length - 1)
    const nextMission = insertWaypointAfter(mission, index)
    markMissionChanged(nextMission)
    setSelectedSampleIndex(Math.min(index + 1, nextMission.samples.length - 1))
    setIsPlaying(false)
  }

  const removeWaypoint = () => {
    if (!mission || selectedSampleIndex === undefined) return
    const nextMission = deleteWaypoint(mission, selectedSampleIndex)
    markMissionChanged(nextMission)
    setSelectedSampleIndex(Math.min(selectedSampleIndex, nextMission.samples.length - 1))
    setIsPlaying(false)
  }

  const reorderWaypoint = (direction: -1 | 1) => {
    if (!mission || selectedSampleIndex === undefined) return
    const nextMission = moveWaypoint(mission, selectedSampleIndex, direction)
    const nextIndex = Math.max(0, Math.min(selectedSampleIndex + direction, nextMission.samples.length - 1))
    markMissionChanged(nextMission)
    setSelectedSampleIndex(nextIndex)
    setIsPlaying(false)
  }

  const editSelectedWaypoint = (patch: Parameters<typeof updateWaypoint>[2]) => {
    if (!mission || selectedSampleIndex === undefined) return
    markMissionChanged(updateWaypoint(mission, selectedSampleIndex, patch))
    setIsPlaying(false)
  }

  const moveWaypointLocal = (index: number, localX: number, localZ: number) => {
    if (!mission) return
    const sample = mission.samples[index]
    if (!sample) return
    const nextGeo = localToGeo(mission.geoReference, localX, localZ, sample.altitude)
    markMissionChanged(updateWaypoint(mission, index, { latitude: nextGeo.latitude, longitude: nextGeo.longitude, altitude: nextGeo.altitude }))
    setSelectedSampleIndex(index)
    setIsPlaying(false)
  }

  const exportMissionPlan = (format: 'json' | 'csv') => {
    if (!mission) return
    const contents = format === 'json' ? exportMissionPlanJson(mission) : exportMissionPlanCsv(mission)
    const blob = new Blob([contents], { type: format === 'json' ? 'application/json' : 'text/csv' })
    downloadBlob(`${slugify(mission.missionName)}-planned.${format}`, blob)
  }

  const prepareExecution = () => {
    markRunPrepared()
  }

  const loadDemoMission = async () => {
    try {
      const loaded = await loadMissionFromUrl('/missions/demo-mission.csv')
      const cloned = cloneMissionForPlanning(loaded)
      setLoadedMission(cloneMissionForPlanning(loaded))
      setMission(cloned)
      setProjectName(loaded.missionName)
      setActiveProjectId(undefined)
      setMetricId('temperature')
      setNormalizedTime(0)
      setSelectedSampleIndex(0)
      setIsPlaying(false)
      setIsDirty(false)
      setExecutionPreparedAt('')
      resetRun('Demo mission loaded')
      setMissionError('')
    } catch (error) {
      setMissionError(error instanceof Error ? error.message : 'Failed to load demo mission')
    }
  }

  const reloadResearchModels = () => {
    setResearchModelStatus(loadingResearchModelStatus(researchModelMetadataUrl))
    setResearchModelRefreshKey((value) => value + 1)
  }

  const buildRunSummaryPayload = () => ({
    generatedAtUtc: new Date().toISOString(),
    missionName: mission?.missionName,
    state: runState,
    progressPercent: reviewProgressPercent,
    currentWaypoint: runProgress.currentWaypointNumber,
    nextWaypoint: runProgress.nextWaypointNumber,
    distanceRemainingMeters: runProgress.distanceRemainingMeters,
    etaSeconds: runProgress.etaSeconds,
    executionPreparedAt,
    mode: simulatorEnabled ? 'simulator' : liveMode ? 'hardware-tracking' : 'playback',
    hardwareSafe: true,
    note: 'Frontend run mode does not upload, start, or command autonomous mission execution.',
    events: runEvents,
  })

  const exportReviewReport = () => {
    if (!mission) return
    downloadText(
      `${slugify(mission.missionName)}-review.json`,
      JSON.stringify(
        {
          generatedAtUtc: new Date().toISOString(),
          missionName: mission.missionName,
          sourceFile: mission.sourceFile,
          progressPercent: reviewProgressPercent,
          run: buildRunSummaryPayload(),
          route: routeSummary,
          selectedMetric: {
            id: metricId,
            displayName: descriptor.displayName,
            summary: metricSummary,
          },
          telemetry: {
            source: telemetrySource,
            health: live.health,
            packetCount: live.history.length,
            latestStatus: live.status,
          },
          prediction,
          research: researchAnalyses.map((analysis) => ({
            id: analysis.id,
            title: analysis.title,
            readinessPercent: analysis.readinessPercent,
            currentStatus: analysis.currentStatus,
            missingFields: analysis.missingFields,
          })),
          preflight: preflightChecks,
        },
        null,
        2,
      ),
      'application/json',
    )
  }

  useEffect(() => {
    loadMissionFromUrl('/missions/demo-mission.csv')
      .then((loaded) => {
        const cloned = cloneMissionForPlanning(loaded)
        setLoadedMission(cloneMissionForPlanning(loaded))
        setMission(cloned)
        setProjectName(loaded.missionName)
        setMetricId('temperature')
        setSelectedSampleIndex(0)
        setIsDirty(false)
        setMissionError('')
      })
      .catch((error: unknown) => setMissionError(error instanceof Error ? error.message : 'Failed to load demo mission'))
  }, [])

  useEffect(() => {
    let cancelled = false
    void loadResearchModelBackend(researchModelMetadataUrl).then((backend) => {
      if (!cancelled) setResearchModelStatus(backend.status)
    })
    return () => {
      cancelled = true
    }
  }, [researchModelMetadataUrl, researchModelRefreshKey])

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

  useEffect(() => {
    if (runState !== 'running' || !mission || durationSeconds <= 0) return
    const timer = window.setInterval(() => {
      setNormalizedTime((value) => Math.min(1, value + 1 / durationSeconds / 4))
    }, 250)
    return () => window.clearInterval(timer)
  }, [durationSeconds, mission, runState])

  useEffect(() => {
    if (runState !== 'running' || normalizedTime < 1 || !mission) return
    const timer = window.setTimeout(() => {
      const timestampUtc = new Date().toISOString()
      setRunState('completed')
      setSelectedSampleIndex(Math.max(0, mission.samples.length - 1))
      setRunEvents((events) => [
        {
          id: `${timestampUtc}-${events.length}`,
          timestampUtc,
          state: 'completed',
          message: 'Run marked complete',
        },
        ...events,
      ])
    }, 0)
    return () => window.clearTimeout(timer)
  }, [mission, normalizedTime, runState])

  useEffect(() => {
    if (typeof ResizeObserver === 'undefined') {
      const timer = window.setTimeout(updateAllPanelHandles, 0)
      return () => window.clearTimeout(timer)
    }
    const resizeObserver = new ResizeObserver(updateAllPanelHandles)
    const controlPanel = controlPanelRef.current
    const infoPanel = infoPanelRef.current
    if (controlPanel) resizeObserver.observe(controlPanel)
    if (infoPanel) resizeObserver.observe(infoPanel)
    const timer = window.setTimeout(updateAllPanelHandles, 0)
    return () => {
      window.clearTimeout(timer)
      resizeObserver.disconnect()
    }
  }, [activeTab, controlPanelWidth, infoPanelWidth, mission, runEvents.length, selectedSampleIndex, updateAllPanelHandles])

  useEffect(() => {
    if (!mission) return
    const project = createProjectFile({
      id: activeProjectId,
      name: projectName,
      mission,
      selectedMetricId: metricId,
      layers,
      liveSettings: settings,
    })
    localStorage.setItem('aquascan.autosave', serializeProjectFile(project))
    const timer = window.setTimeout(() => setAutosavedAt(project.savedAtUtc), 0)
    return () => window.clearTimeout(timer)
  }, [activeProjectId, layers, metricId, mission, projectName, settings])

  const loadFile = async (file: File | undefined) => {
    if (!file) return
    try {
      const loaded = await loadMissionFromFile(file)
      const cloned = cloneMissionForPlanning(loaded)
      setLoadedMission(cloneMissionForPlanning(loaded))
      setMission(cloned)
      setProjectName(loaded.missionName)
      setActiveProjectId(undefined)
      setMetricId(listMissionMetrics(loaded)[0]?.id ?? 'temperature')
      setNormalizedTime(0)
      setSelectedSampleIndex(0)
      setIsDirty(true)
      resetRun('Mission imported')
      setMissionError('')
    } catch (error) {
      setMissionError(error instanceof Error ? error.message : 'Failed to load mission')
    }
  }

  const liveEndpointLabel = settings.relayUrl?.trim() || `${settings.host}:${settings.port}`
  const connectionLabel =
    simulatorEnabled && live.socketState === 'connected'
      ? 'Simulator connected'
      : live.socketState === 'connected'
        ? `Connected ${liveEndpointLabel}`
      : live.socketState === 'connecting'
        ? `Connecting ${liveEndpointLabel}`
        : live.socketState === 'error'
          ? 'Connection error'
          : simulatorEnabled
            ? 'Simulator ready'
            : liveMode
              ? 'Live mode ready'
              : 'Playback mode'

  if (interfaceMode === 'simple') {
    return (
      <main className="app-shell simple-shell" data-theme={theme}>
        <header className="simple-topbar">
          <div>
            <p className="eyebrow">AQUAScan Simple</p>
            <h1>Boat drive</h1>
          </div>
          <div className="simple-top-actions">
            <StatusPill icon={<Radio size={16} />} label={connectionLabel} tone={live.socketState === 'connected' ? 'good' : live.socketState === 'error' ? 'bad' : 'neutral'} />
            <StatusPill icon={<AlertTriangle size={16} />} label={formatAlertStatus(activeOperatorAlerts, primaryOperatorAlert)} tone={alertTone} />
            <button className="theme-toggle" type="button" onClick={() => setInterfaceMode('advanced')}>
              <SlidersHorizontal size={16} />
              Advanced
            </button>
          </div>
        </header>

        <section className="simple-feed">
          <section className="simple-scene">
            <BoatScene
              mission={mission}
              metricId={metricId}
              boatPosition={boatPosition}
              boatHeadingRad={boatHeadingRad}
              layers={{ track: true, points: false, heatmap: false }}
              selectedSampleIndex={selectedSampleIndex}
              onSelectSample={selectSample}
            />
          </section>

          <aside className="simple-drive-panel">
            <div className="simple-status-grid">
              <Readout label="Speed" value={live.status.speedMps !== undefined ? `${live.status.speedMps.toFixed(1)} m/s` : '--'} />
              <Readout label="Heading" value={live.status.headingDeg !== undefined ? `${live.status.headingDeg.toFixed(0)} deg` : '--'} />
              <Readout label="Battery" value={live.status.batteryPercent !== undefined ? `${live.status.batteryPercent.toFixed(0)}%` : segment?.sample.batteryPercent !== undefined ? `${segment.sample.batteryPercent.toFixed(0)}%` : '--'} />
              <Readout label="Mode" value={simulatorEnabled ? 'Simulator' : 'Boat'} />
            </div>

            <OperatorAlertBanner alert={primaryOperatorAlert} />

            <div className="simple-switches">
              <label className="simulator-toggle">
                <input type="checkbox" checked={simulatorEnabled} onChange={(event) => setSimulatorEnabled(event.target.checked)} />
                <span>
                  <strong>Simulator</strong>
                  <small>Practice without hardware.</small>
                </span>
              </label>
              <label className="simulator-toggle">
                <input type="checkbox" checked={liveMode} onChange={(event) => setLiveMode(event.target.checked)} />
                <span>
                  <strong>Driving enabled</strong>
                  <small>Required before connecting controls.</small>
                </span>
              </label>
            </div>

            <div className="simple-button-row">
              <button className="primary-button" disabled={!liveMode || live.socketState === 'connecting'} onClick={() => (live.socketState === 'connected' ? live.disconnect('Operator disconnected') : live.connect())}>
                <Power size={18} />
                {live.socketState === 'connected' ? 'Disconnect' : 'Connect'}
              </button>
              <button className="secondary-button" disabled={!liveMode || live.socketState !== 'connected' || live.estop} onClick={live.toggleArm}>
                {live.armed ? 'Disarm' : 'Arm'}
              </button>
              <button className="danger-button" disabled={!liveMode} onClick={live.estop ? live.resetEstop : live.triggerEstop}>
                {live.estop ? 'Reset stop' : 'E-stop'}
              </button>
            </div>

            <div className="simple-joystick-wrap">
              <Joystick value={joystick} disabled={!liveMode || live.socketState !== 'connected' || live.estop} onChange={setJoystick} />
            </div>

            <div className="simple-safety-line" data-state={live.estop ? 'bad' : live.armed ? 'warn' : 'safe'}>
              {live.estop ? 'Emergency stop is latched' : live.armed ? 'Boat is armed' : 'Safe and disarmed'}
            </div>
          </aside>
        </section>
      </main>
    )
  }

  return (
    <main className="app-shell" data-theme={theme}>
      <header className="top-bar">
        <div>
          <p className="eyebrow">AQUAScan Web</p>
          <h1>Mission control</h1>
        </div>
        <div className="status-strip">
          <button className="theme-toggle" type="button" onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}>
            {theme === 'light' ? <Moon size={16} /> : <Sun size={16} />}
            {theme === 'light' ? 'Dark' : 'Light'}
          </button>
          <button className="theme-toggle" type="button" onClick={() => setInterfaceMode('simple')}>
            <ShipWheel size={16} />
            Simple
          </button>
          <StatusPill icon={<Radio size={16} />} label={connectionLabel} tone={live.socketState === 'connected' ? 'good' : live.socketState === 'error' ? 'bad' : 'neutral'} />
          <StatusPill icon={<Activity size={16} />} label={healthLabel} tone={healthTone} />
          <StatusPill icon={<AlertTriangle size={16} />} label={formatAlertStatus(activeOperatorAlerts, primaryOperatorAlert)} tone={alertTone} />
          <StatusPill icon={<Gauge size={16} />} label={`Run ${runState}`} tone={runState === 'running' || runState === 'completed' ? 'good' : runState === 'paused' || runState === 'armed' ? 'warn' : runState === 'aborted' ? 'bad' : 'neutral'} />
          <StatusPill icon={<FolderOpen size={16} />} label={isDirty ? 'Unsaved changes' : 'Project saved'} tone={isDirty ? 'warn' : 'good'} />
          <StatusPill icon={<Gauge size={16} />} label={`L ${live.status.leftMicros} / R ${live.status.rightMicros} us`} tone={live.armed ? 'good' : 'neutral'} />
          <StatusPill icon={<ShieldAlert size={16} />} label={live.estop ? 'E-stop latched' : live.armed ? 'Armed' : 'Safe'} tone={live.estop ? 'bad' : live.armed ? 'warn' : 'neutral'} />
        </div>
      </header>

      <section className="workspace" ref={workspaceRef} style={workspaceStyle}>
        <aside className="control-panel" ref={controlPanelRef} onScroll={() => updatePanelHandle('control')}>
          <nav className="tab-rail">
            <TabButton id="setup" label="Setup" icon={<ShieldAlert size={17} />} active={activeTab === 'setup'} onClick={setActiveTab} />
            <TabButton id="run" label="Run" icon={<Gauge size={17} />} active={activeTab === 'run'} onClick={setActiveTab} />
            <TabButton id="drive" label="Drive" icon={<ShipWheel size={17} />} active={activeTab === 'drive'} onClick={setActiveTab} />
            <TabButton id="ai" label="AI" icon={<BrainCircuit size={17} />} active={activeTab === 'ai'} onClick={setActiveTab} />
            <TabButton id="sensors" label="Sensors" icon={<Activity size={17} />} active={activeTab === 'sensors'} onClick={setActiveTab} />
            <TabButton id="planner" label="Plan" icon={<Route size={17} />} active={activeTab === 'planner'} onClick={setActiveTab} />
            <TabButton id="review" label="Review" icon={<FileDown size={17} />} active={activeTab === 'review'} onClick={setActiveTab} />
          </nav>

          {activeTab === 'setup' && (
            <section className="panel-section">
              <div className="section-heading">
                <h2>Mission setup</h2>
                <span className="muted">{activeSetupStep.detail}</span>
              </div>

              <div className="wizard-stepper">
                {setupSteps.map((step, index) => (
                  <button key={step.label} className="wizard-step" data-active={setupStep === index} data-complete={step.complete} onClick={() => setSetupStep(index)}>
                    <span>{index + 1}</span>
                    <strong>{step.label}</strong>
                  </button>
                ))}
              </div>

              <article className="wizard-panel">
                {setupStep === 0 && (
                  <>
                    <p className="eyebrow">Mission source</p>
                    <h3>{mission ? mission.missionName : 'Load mission data'}</h3>
                    <p className="status-copy">Start from the demo path, import CSV/JSON sensor data, or jump to the planner to build waypoints manually.</p>
                    {missionError && <p className="error-copy">{missionError}</p>}
                    <div className="button-row wizard-actions">
                      <button className="primary-button" onClick={() => void loadDemoMission()}>
                        <Route size={16} />
                        Demo
                      </button>
                      <label className="upload-button">
                        <Upload size={15} />
                        Import
                        <input type="file" accept=".csv,.json" onChange={(event) => void loadFile(event.target.files?.[0])} />
                      </label>
                      <button className="secondary-button" onClick={() => setActiveTab('planner')}>
                        <Plus size={16} />
                        Create
                      </button>
                    </div>
                    <div className="route-stat-grid">
                      <Readout label="Samples" value={mission ? String(mission.samples.length) : '--'} />
                      <Readout label="Route" value={routeSummary ? `${routeSummary.routeDistanceMeters.toFixed(1)} m` : '--'} />
                    </div>
                  </>
                )}

                {setupStep === 1 && (
                  <>
                    <p className="eyebrow">Sensor target</p>
                    <h3>{descriptor.displayName}</h3>
                    <label className="field-stack">
                      <span>Primary metric</span>
                      <select value={metricId} onChange={(event) => setMetricId(event.target.value)}>
                        {metrics.map((metric) => (
                          <option key={metric.id} value={metric.id}>
                            {metric.displayName}
                          </option>
                        ))}
                      </select>
                    </label>
                    <div className="layer-list compact-layer-list">
                      <LayerToggle label="Track" checked={layers.track} onChange={(track) => setLayers({ ...layers, track })} />
                      <LayerToggle label="Sample points" checked={layers.points} onChange={(points) => setLayers({ ...layers, points })} />
                      <LayerToggle label="Heatmap" checked={layers.heatmap} onChange={(heatmap) => setLayers({ ...layers, heatmap })} />
                    </div>
                    <div className="route-stat-grid">
                      <Readout label="Metric min" value={formatMetricValue(metricSummary.min, descriptor)} />
                      <Readout label="Metric max" value={formatMetricValue(metricSummary.max, descriptor)} />
                    </div>
                  </>
                )}

                {setupStep === 2 && (
                  <>
                    <p className="eyebrow">Route validation</p>
                    <h3>{planHasBlockingErrors ? 'Plan needs edits' : 'Plan can run'}</h3>
                    <div className="route-stat-grid">
                      <Readout label="Waypoints" value={mission ? String(mission.samples.length) : '--'} />
                      <Readout label="Duration" value={durationSeconds > 0 ? `${Math.round(durationSeconds)} s` : '--'} />
                    </div>
                    <div className="plan-warning-list">
                      {planWarnings.length === 0 ? (
                        <p className="plan-warning" data-severity="ok">Plan validation passed.</p>
                      ) : (
                        planWarnings.map((warning, index) => (
                          <p key={`${warning.message}-${index}`} className="plan-warning" data-severity={warning.severity}>
                            {warning.message}
                          </p>
                        ))
                      )}
                    </div>
                    <button className="secondary-button compact-button" onClick={() => setActiveTab('planner')}>
                      Edit waypoints
                    </button>
                  </>
                )}

                {setupStep === 3 && (
                  <>
                    <p className="eyebrow">Execution mode</p>
                    <h3>{simulatorEnabled ? 'Simulator selected' : liveMode ? 'Hardware selected' : 'Choose control mode'}</h3>
                    <label className="simulator-toggle">
                      <input type="checkbox" checked={simulatorEnabled} onChange={(event) => setSimulatorEnabled(event.target.checked)} />
                      <span>
                        <strong>Simulator</strong>
                        <small>Use browser-side telemetry and route following.</small>
                      </span>
                    </label>
                    <label className="simulator-toggle">
                      <input type="checkbox" checked={liveMode} onChange={(event) => setLiveMode(event.target.checked)} />
                      <span>
                        <strong>Hardware controls</strong>
                        <small>Enable direct WebSocket connection controls.</small>
                      </span>
                    </label>
                    <div className="form-grid">
                      <Field label="Relay URL" value={settings.relayUrl ?? ''} onChange={(value) => setSettings({ ...settings, relayUrl: value })} />
                      <Field label="Boat host" value={settings.host} onChange={(value) => setSettings({ ...settings, host: value })} />
                      <Field label="Port" type="number" value={settings.port} onChange={(value) => setSettings({ ...settings, port: Number(value) || 81 })} />
                    </div>
                  </>
                )}

                {setupStep === 4 && (
                  <>
                    <p className="eyebrow">Preflight</p>
                    <h3>{isPreflightReady ? 'Ready to prepare' : 'Blocked'}</h3>
                    <div className="preflight-list">
                      {preflightChecks.map((check) => (
                        <div className="preflight-row" key={check.id} data-status={check.status}>
                          <strong>{check.label}</strong>
                          <span>{check.detail}</span>
                        </div>
                      ))}
                    </div>
                    <button className="primary-button prep-button" disabled={!isPreflightReady} onClick={prepareExecution}>
                      Prepare mission
                    </button>
                    <p className="muted">{executionPreparedAt ? `Prepared ${new Date(executionPreparedAt).toLocaleTimeString()}` : 'Preparation validates state only. It does not start the boat.'}</p>
                  </>
                )}
              </article>

              <div className="button-row wizard-actions">
                <button className="secondary-button" disabled={setupStep <= 0} onClick={() => setSetupStep((value) => Math.max(0, value - 1))}>
                  Back
                </button>
                <button className="primary-button" disabled={setupStep >= setupSteps.length - 1} onClick={() => setSetupStep((value) => Math.min(setupSteps.length - 1, value + 1))}>
                  Next
                </button>
              </div>
            </section>
          )}

          {activeTab === 'run' && (
            <section className="panel-section">
              <div className="section-heading">
                <h2>Run mode</h2>
                <span className="model-state">{runState}</span>
              </div>

              <article className="run-panel">
                <div className="mission-tools-header">
                  <div>
                    <p className="eyebrow">Mission execution</p>
                    <h3>{mission?.missionName ?? 'No mission loaded'}</h3>
                  </div>
                  <StatusPill
                    icon={<ShieldAlert size={15} />}
                    label={runState === 'running' ? 'Running' : runState === 'aborted' ? 'Aborted' : runState === 'completed' ? 'Complete' : runState === 'paused' ? 'Paused' : 'Standby'}
                    tone={runState === 'running' || runState === 'completed' ? 'good' : runState === 'paused' || runState === 'armed' ? 'warn' : runState === 'aborted' ? 'bad' : 'neutral'}
                  />
                </div>
                <div className="run-progress-bar" aria-label="Run progress">
                  <span style={{ width: `${reviewProgressPercent}%` }} />
                </div>
                <div className="route-stat-grid">
                  <Readout label="Progress" value={`${reviewProgressPercent}%`} />
                  <Readout label="Waypoint" value={runProgress.currentWaypointNumber ? `${runProgress.currentWaypointNumber}/${mission?.samples.length ?? 0}` : '--'} />
                  <Readout label="Next waypoint" value={runProgress.nextWaypointNumber ? `#${runProgress.nextWaypointNumber}` : '--'} />
                  <Readout label="ETA" value={runProgress.etaSeconds !== undefined ? `${Math.ceil(runProgress.etaSeconds)} s` : '--'} />
                  <Readout label="Remaining" value={runProgress.distanceRemainingMeters !== undefined ? `${runProgress.distanceRemainingMeters.toFixed(1)} m` : '--'} />
                  <Readout label="Takeover" value={liveMode && live.armed ? 'Manual armed' : joystick[0] !== 0 || joystick[1] !== 0 ? 'Joystick active' : 'None'} />
                </div>
              </article>

              <div className="button-row run-actions">
                <button className="secondary-button" disabled={!isPreflightReady || runState === 'running'} onClick={markRunPrepared}>
                  Prepare
                </button>
                <button className="secondary-button" disabled={runState !== 'prepared' && runState !== 'paused'} onClick={armRunMode}>
                  Arm run
                </button>
                <button className="primary-button" disabled={!mission || (runState !== 'armed' && runState !== 'paused')} onClick={startRunMode}>
                  {runState === 'paused' ? 'Resume' : 'Start'}
                </button>
                <button className="secondary-button" disabled={runState !== 'running'} onClick={pauseRunMode}>
                  Pause
                </button>
                <button className="danger-button" disabled={runState === 'draft' || runState === 'completed' || runState === 'aborted'} onClick={abortRunMode}>
                  Abort
                </button>
                <button className="secondary-button" disabled={!mission || runState === 'draft' || runState === 'running' || runState === 'completed'} onClick={completeRunMode}>
                  Complete
                </button>
                <button className="secondary-button" disabled={!mission || runState === 'running'} onClick={exportRunSummary}>
                  Export
                </button>
              </div>

              <article className="run-panel">
                <div className="mission-tools-header">
                  <div>
                    <p className="eyebrow">Run timeline</p>
                    <h3>{runEvents.length} event{runEvents.length === 1 ? '' : 's'}</h3>
                  </div>
                  <button className="secondary-button compact-button" disabled={runState === 'running'} onClick={() => resetRun('Operator reset run mode')}>
                    Reset
                  </button>
                </div>
                <div className="run-event-list">
                  {runEvents.length === 0 ? (
                    <p className="muted">No run events yet.</p>
                  ) : (
                    runEvents.map((event) => (
                      <div className="run-event" key={event.id} data-state={event.state}>
                        <strong>{event.state}</strong>
                        <span>{event.message}</span>
                        <small>{new Date(event.timestampUtc).toLocaleTimeString()}</small>
                      </div>
                    ))
                  )}
                </div>
              </article>

              <p className="status-copy">Frontend run mode simulates/tracks mission execution only. It does not upload waypoints or start autonomous hardware execution.</p>
            </section>
          )}

          {activeTab === 'drive' && (
            <section className="panel-section">
              <div className="section-heading">
                <h2>Live drive</h2>
                <label className="switch-row">
                  <input type="checkbox" checked={liveMode} onChange={(event) => setLiveMode(event.target.checked)} />
                  <span>Live control mode</span>
                </label>
              </div>
              <label className="simulator-toggle">
                <input type="checkbox" checked={simulatorEnabled} onChange={(event) => setSimulatorEnabled(event.target.checked)} />
                <span>
                  <strong>Use simulator</strong>
                  <small>Runs GPS, telemetry, drive, arm, and e-stop without real hardware.</small>
                </span>
              </label>

              <div className="form-grid">
                <Field label="Relay URL" value={settings.relayUrl ?? ''} onChange={(value) => setSettings({ ...settings, relayUrl: value })} />
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
                <Readout label="Packet age" value={packetAgeLabel} />
                <Readout label="Last seq" value={live.status.lastSeq > 0 ? String(live.status.lastSeq) : '--'} />
                <Readout label="Live speed" value={live.status.speedMps !== undefined ? `${live.status.speedMps.toFixed(2)} m/s` : '--'} />
                <Readout label="Live heading" value={live.status.headingDeg !== undefined ? `${live.status.headingDeg.toFixed(0)} deg` : '--'} />
                <Readout label="Control source" value={simulatorEnabled ? 'Simulator' : 'Boat'} />
              </div>

              <article className="run-panel">
                <div className="mission-tools-header">
                  <div>
                    <p className="eyebrow">Probe winch</p>
                    <h3>Manual depth adjustment</h3>
                  </div>
                  <span className="muted">Arduino pins 7 / 6</span>
                </div>
                <label className="field-stack">
                  <span>Winch speed</span>
                  <input type="range" min={60} max={255} step={5} value={probeSpeed} onChange={(event) => setProbeSpeed(Number(event.target.value))} />
                </label>
                <div className="button-row">
                  <button
                    className="secondary-button"
                    disabled={!liveMode || live.socketState !== 'connected' || live.estop}
                    onPointerDown={() => startProbeMotion('lower')}
                    onPointerUp={stopProbeMotion}
                    onPointerCancel={stopProbeMotion}
                    onPointerLeave={stopProbeMotion}
                    onBlur={stopProbeMotion}
                  >
                    <ArrowDown size={16} />
                    Lower
                  </button>
                  <button
                    className="secondary-button"
                    disabled={!liveMode || live.socketState !== 'connected' || live.estop}
                    onPointerDown={() => startProbeMotion('raise')}
                    onPointerUp={stopProbeMotion}
                    onPointerCancel={stopProbeMotion}
                    onPointerLeave={stopProbeMotion}
                    onBlur={stopProbeMotion}
                  >
                    <ArrowUp size={16} />
                    Raise
                  </button>
                  <button className="danger-button" disabled={!liveMode || live.socketState !== 'connected'} onClick={stopProbeMotion}>
                    Stop
                  </button>
                </div>
                <div className="telemetry-grid">
                  <Readout label="Winch speed" value={`${probeSpeed}/255`} />
                  <Readout label="Winch state" value={live.status.probeDirection ?? 'stop'} />
                  <Readout label="Applied speed" value={live.status.probeSpeed !== undefined ? `${live.status.probeSpeed}/255` : '--'} />
                  <Readout label="Depth" value={live.status.depthMeters !== undefined ? `${live.status.depthMeters.toFixed(2)} m` : '--'} />
                </div>
              </article>
              <TelemetryHistory history={live.history} />
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
              <ResearchModelStatusCard status={researchModelStatus} />
              <ModelIntegrationControls
                metadataUrl={researchModelMetadataUrl}
                onMetadataUrlChange={setResearchModelMetadataUrl}
                onReload={reloadResearchModels}
                status={researchModelStatus}
                featureReports={modelFeatureReports}
              />
              <div className="research-stack">
                <div className="mission-tools-header">
                  <div>
                    <p className="eyebrow">Research analysis</p>
                    <h3>Publishable phenomena</h3>
                  </div>
                  <span className="muted">AI-ready scaffolding</span>
                </div>
                {researchAnalyses.map((analysis) => (
                  <ResearchPhenomenonCard key={analysis.id} analysis={analysis} />
                ))}
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
              <article className="run-panel">
                <div className="mission-tools-header">
                  <div>
                    <p className="eyebrow">Live probe telemetry</p>
                    <h3>RS-485 sensor stream</h3>
                  </div>
                  <span className="muted">
                    {live.status.sensorFresh === undefined ? 'No packets' : live.status.sensorFresh ? 'Fresh' : 'Stale'}
                  </span>
                </div>
                <div className="telemetry-grid">
                  <Readout label="Sensor seq" value={live.status.sensorSeq !== undefined ? String(live.status.sensorSeq) : '--'} />
                  <Readout label="Sensor age" value={live.status.sensorAgeMs !== undefined ? formatAge(live.status.sensorAgeMs) : '--'} />
                  <Readout label="Temperature" value={formatLiveSensorValue(live.status.temperatureC, 2, 'deg C')} />
                  <Readout label="Distance" value={formatLiveSensorValue(live.status.distanceCm, 1, 'cm')} />
                  <Readout label="Turbidity voltage" value={formatLiveSensorValue(live.status.turbidityVoltage, 3, 'V')} />
                  <Readout label="Turbidity raw" value={formatLiveSensorValue(live.status.turbidityRaw, 0)} />
                  <Readout label="pH voltage" value={formatLiveSensorValue(live.status.phVoltage, 3, 'V')} />
                  <Readout label="pH raw" value={formatLiveSensorValue(live.status.phRaw, 0)} />
                  <Readout label="DO voltage" value={formatLiveSensorValue(live.status.dissolvedOxygenVoltage, 3, 'V')} />
                  <Readout label="DO raw" value={formatLiveSensorValue(live.status.dissolvedOxygenRaw, 0)} />
                  <Readout label="TDS voltage" value={formatLiveSensorValue(live.status.tdsVoltage, 3, 'V')} />
                  <Readout label="TDS raw" value={formatLiveSensorValue(live.status.tdsRaw, 0)} />
                  <Readout label="UV voltage" value={formatLiveSensorValue(live.status.uvVoltage, 3, 'V')} />
                  <Readout label="UV raw" value={formatLiveSensorValue(live.status.uvRaw, 0)} />
                  <Readout label="Light voltage" value={formatLiveSensorValue(live.status.lightVoltage, 3, 'V')} />
                  <Readout label="Light raw" value={formatLiveSensorValue(live.status.lightRaw, 0)} />
                </div>
                <p className="status-copy">Raw and voltage readings are shown directly from the probe stream. Calibrate them before treating them as pH, DO, TDS, turbidity, UV, or light measurements.</p>
              </article>
              <article className="run-panel">
                <div className="mission-tools-header">
                  <div>
                    <p className="eyebrow">Collected RS-485 data</p>
                    <h3>RS-485 averages</h3>
                  </div>
                  <button className="secondary-button compact-button" type="button" disabled={live.sensorAverages.packetCount === 0} onClick={live.resetSensorAverages}>
                    <RotateCcw size={14} />
                    Reset averages
                  </button>
                </div>
                <div className="telemetry-grid">
                  <Readout label="Packets averaged" value={String(live.sensorAverages.packetCount)} />
                  <Readout label="Average temperature" value={formatLiveSensorValue(live.sensorAverages.values.temperatureC, 2, 'deg C')} />
                  <Readout label="Average distance" value={formatLiveSensorValue(live.sensorAverages.values.distanceCm, 1, 'cm')} />
                  <Readout label="Average turbidity voltage" value={formatLiveSensorValue(live.sensorAverages.values.turbidityVoltage, 3, 'V')} />
                  <Readout label="Average turbidity raw" value={formatLiveSensorValue(live.sensorAverages.values.turbidityRaw, 1)} />
                  <Readout label="Average pH voltage" value={formatLiveSensorValue(live.sensorAverages.values.phVoltage, 3, 'V')} />
                  <Readout label="Average pH raw" value={formatLiveSensorValue(live.sensorAverages.values.phRaw, 1)} />
                  <Readout label="Average DO voltage" value={formatLiveSensorValue(live.sensorAverages.values.dissolvedOxygenVoltage, 3, 'V')} />
                  <Readout label="Average DO raw" value={formatLiveSensorValue(live.sensorAverages.values.dissolvedOxygenRaw, 1)} />
                  <Readout label="Average TDS voltage" value={formatLiveSensorValue(live.sensorAverages.values.tdsVoltage, 3, 'V')} />
                  <Readout label="Average TDS raw" value={formatLiveSensorValue(live.sensorAverages.values.tdsRaw, 1)} />
                  <Readout label="Average UV voltage" value={formatLiveSensorValue(live.sensorAverages.values.uvVoltage, 3, 'V')} />
                  <Readout label="Average UV raw" value={formatLiveSensorValue(live.sensorAverages.values.uvRaw, 1)} />
                  <Readout label="Average light voltage" value={formatLiveSensorValue(live.sensorAverages.values.lightVoltage, 3, 'V')} />
                  <Readout label="Average light raw" value={formatLiveSensorValue(live.sensorAverages.values.lightRaw, 1)} />
                </div>
                <p className="status-copy">Each unique sensor sequence is counted once. Reset averages before placing the probe into a new sample or calibration solution.</p>
              </article>
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
              <div className="mission-tools">
                <div className="mission-tools-header">
                  <div>
                    <p className="eyebrow">Route tools</p>
                    <h3>Mission inspection</h3>
                  </div>
                  <div className="compact-actions">
                    <button className="icon-button" title="Select nearest playback sample" disabled={!mission} onClick={selectNearestPlaybackSample}>
                      <LocateFixed size={16} />
                    </button>
                    <button className="icon-button" title="Export route JSON" disabled={!mission} onClick={exportMissionRoute}>
                      <Download size={16} />
                    </button>
                  </div>
                </div>

                <div className="route-stat-grid">
                  <Readout label="Route length" value={routeSummary ? `${routeSummary.routeDistanceMeters.toFixed(1)} m` : '--'} />
                  <Readout label="Avg speed" value={routeSummary ? `${routeSummary.averageSpeedMps.toFixed(2)} m/s` : '--'} />
                  <Readout label="Metric min" value={formatMetricValue(metricSummary.min, descriptor)} />
                  <Readout label="Metric max" value={formatMetricValue(metricSummary.max, descriptor)} />
                </div>

                <div className="sample-inspector">
                  <div className="sample-inspector-heading">
                    <MapPin size={16} />
                    <strong>{selectedSample ? `Sample ${selectedSampleIndex! + 1} of ${mission?.samples.length}` : 'No sample selected'}</strong>
                  </div>
                  <div className="sample-detail-grid">
                    <Readout label="Time" value={selectedSample ? new Date(selectedSample.timestamp).toLocaleTimeString() : '--'} />
                    <Readout label={descriptor.displayName} value={formatMetricValue(selectedValue, descriptor)} />
                    <Readout label="Latitude" value={selectedSample ? selectedSample.latitude.toFixed(6) : '--'} />
                    <Readout label="Longitude" value={selectedSample ? selectedSample.longitude.toFixed(6) : '--'} />
                    <Readout label="Heading" value={selectedSample?.headingDeg !== undefined ? `${selectedSample.headingDeg.toFixed(0)} deg` : '--'} />
                    <Readout label="Depth" value={selectedSample?.depthMeters !== undefined ? `${selectedSample.depthMeters.toFixed(2)} m` : '--'} />
                  </div>
                </div>

                <div className="sample-list" aria-label="Mission samples">
                  {mission?.samples.map((sample, index) => (
                    <button key={`${sample.timestamp}-${index}`} className="sample-row" data-active={selectedSampleIndex === index} onClick={() => selectSample(index)}>
                      <span>#{index + 1}</span>
                      <span>{new Date(sample.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
                      <strong>{formatMetricValue(metricValue(sample, metricId), descriptor)}</strong>
                    </button>
                  ))}
                </div>
              </div>
            </section>
          )}

          {activeTab === 'planner' && (
            <section className="panel-section">
              <div className="section-heading">
                <h2>Mission planner</h2>
                <button className="secondary-button compact-button" disabled={!loadedMission} onClick={resetMissionPlan}>
                  <RotateCcw size={15} />
                  Reset
                </button>
              </div>

              <div className="project-panel">
                <div className="mission-tools-header">
                  <div>
                    <p className="eyebrow">Project files</p>
                    <h3>{isDirty ? 'Unsaved plan' : 'Saved plan'}</h3>
                  </div>
                  <span className="muted">{autosavedAt ? `Auto ${new Date(autosavedAt).toLocaleTimeString()}` : 'No autosave yet'}</span>
                </div>
                <Field label="Project name" value={projectName} onChange={(value) => { setProjectName(value); setIsDirty(true) }} />
                <div className="button-row project-actions">
                  <button className="primary-button" disabled={!mission} onClick={saveProject}>
                    <FolderOpen size={16} />
                    Save
                  </button>
                  <button className="secondary-button" disabled={!mission} onClick={exportProjectBundle}>
                    <FileDown size={16} />
                    Bundle
                  </button>
                  <label className="upload-button">
                    <Upload size={15} />
                    Project
                    <input type="file" accept=".json,.aquascan.json" onChange={(event) => void loadProjectFile(event.target.files?.[0])} />
                  </label>
                </div>
                <div className="project-list">
                  {savedProjects.length === 0 ? (
                    <p className="muted">No saved local projects.</p>
                  ) : (
                    savedProjects.map((project) => (
                      <div className="project-row" key={project.id} data-active={activeProjectId === project.id}>
                        <button onClick={() => loadProject(project.id)}>
                          <strong>{project.name}</strong>
                          <span>{project.mission.samples.length} waypoints - {new Date(project.savedAtUtc).toLocaleString()}</span>
                        </button>
                        <button className="icon-button" title="Delete project" onClick={() => deleteProject(project.id)}>
                          <Trash2 size={15} />
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div className="button-row planner-actions">
                <button className="primary-button" disabled={!mission} onClick={addWaypoint}>
                  <Plus size={16} />
                  Add
                </button>
                <button className="secondary-button" disabled={!mission || selectedSampleIndex === undefined || selectedSampleIndex <= 0} onClick={() => reorderWaypoint(-1)}>
                  <ArrowUp size={16} />
                  Up
                </button>
                <button className="secondary-button" disabled={!mission || selectedSampleIndex === undefined || selectedSampleIndex >= mission.samples.length - 1} onClick={() => reorderWaypoint(1)}>
                  <ArrowDown size={16} />
                  Down
                </button>
                <button className="danger-button" disabled={!mission || selectedSampleIndex === undefined || mission.samples.length <= 2} onClick={removeWaypoint}>
                  <Trash2 size={16} />
                  Delete
                </button>
              </div>

              <div className="route-stat-grid">
                <Readout label="Waypoints" value={mission ? String(mission.samples.length) : '--'} />
                <Readout label="Planned route" value={routeSummary ? `${routeSummary.routeDistanceMeters.toFixed(1)} m` : '--'} />
                <Readout label="Plan duration" value={durationSeconds > 0 ? `${Math.round(durationSeconds)} s` : '--'} />
                <Readout label="Validation" value={`${planWarnings.length} issue${planWarnings.length === 1 ? '' : 's'}`} />
              </div>

              <div className="planner-editor">
                <div className="mission-tools-header">
                  <div>
                    <p className="eyebrow">Selected waypoint</p>
                    <h3>{selectedSample ? `Waypoint ${selectedSampleIndex! + 1}` : 'No waypoint selected'}</h3>
                  </div>
                  <div className="compact-actions">
                    <button className="icon-button" title="Export planned mission JSON" disabled={!mission} onClick={() => exportMissionPlan('json')}>
                      <Download size={16} />
                    </button>
                    <button className="icon-button" title="Export planned mission CSV" disabled={!mission} onClick={() => exportMissionPlan('csv')}>
                      CSV
                    </button>
                  </div>
                </div>

                <div className="planner-form">
                  <Field label="Timestamp" value={selectedSample?.timestamp ?? ''} onChange={(value) => editSelectedWaypoint({ timestamp: value })} />
                  <Field label="Latitude" type="number" step="0.000001" value={selectedSample?.latitude ?? ''} onChange={(value) => editSelectedWaypoint({ latitude: Number(value) })} />
                  <Field label="Longitude" type="number" step="0.000001" value={selectedSample?.longitude ?? ''} onChange={(value) => editSelectedWaypoint({ longitude: Number(value) })} />
                  <Field label="Altitude" type="number" step="0.1" value={selectedSample?.altitude ?? ''} onChange={(value) => editSelectedWaypoint({ altitude: optionalNumber(value) })} />
                  <Field label="Heading" type="number" step="1" value={selectedSample?.headingDeg ?? ''} onChange={(value) => editSelectedWaypoint({ headingDeg: optionalNumber(value) })} />
                  <Field label="Speed" type="number" step="0.1" value={selectedSample?.speedMps ?? ''} onChange={(value) => editSelectedWaypoint({ speedMps: optionalNumber(value) })} />
                  <Field label="Depth" type="number" step="0.1" value={selectedSample?.depthMeters ?? ''} onChange={(value) => editSelectedWaypoint({ depthMeters: optionalNumber(value) })} />
                </div>
              </div>

              <div className="plan-warning-list">
                {planWarnings.length === 0 ? (
                  <p className="plan-warning" data-severity="ok">Plan validation passed.</p>
                ) : (
                  planWarnings.map((warning, index) => (
                    <p key={`${warning.message}-${index}`} className="plan-warning" data-severity={warning.severity}>
                      {warning.message}
                    </p>
                  ))
                )}
              </div>

              <div className="sample-list planner-list" aria-label="Planned waypoints">
                {mission?.samples.map((sample, index) => {
                  const next = mission.samples[index + 1]
                  return (
                    <button key={`${sample.timestamp}-${index}`} className="sample-row waypoint-row" data-active={selectedSampleIndex === index} onClick={() => selectSample(index)}>
                      <span>#{index + 1}</span>
                      <span>{sample.latitude.toFixed(5)}, {sample.longitude.toFixed(5)}</span>
                      <strong>{next ? `${legDistanceMeters(sample, next).toFixed(1)} m / ${legHeadingDeg(sample, next).toFixed(0)} deg` : 'End'}</strong>
                    </button>
                  )
                })}
              </div>
            </section>
          )}

          {activeTab === 'review' && (
            <section className="panel-section">
              <div className="section-heading">
                <h2>Post-mission review</h2>
                <button className="secondary-button compact-button" disabled={!mission} onClick={exportReviewReport}>
                  <Download size={15} />
                  Export
                </button>
              </div>

              <div className="review-hero">
                <Readout label="Playback progress" value={`${reviewProgressPercent}%`} />
                <Readout label="Telemetry packets" value={String(live.history.length)} />
                <Readout label="Research candidates" value={String(researchCandidateCount)} />
                <Readout label="Anomaly risk" value={`${Math.round(prediction.anomalyRisk * 100)}%`} />
              </div>

              <article className="review-panel">
                <div className="mission-tools-header">
                  <div>
                    <p className="eyebrow">Mission summary</p>
                    <h3>{mission?.missionName ?? 'No mission loaded'}</h3>
                  </div>
                  <span className="muted">{telemetrySource}</span>
                </div>
                <div className="route-stat-grid">
                  <Readout label="Route length" value={routeSummary ? `${routeSummary.routeDistanceMeters.toFixed(1)} m` : '--'} />
                  <Readout label="Samples" value={mission ? String(mission.samples.length) : '--'} />
                  <Readout label="Metric min" value={formatMetricValue(metricSummary.min, descriptor)} />
                  <Readout label="Metric max" value={formatMetricValue(metricSummary.max, descriptor)} />
                </div>
              </article>

              <article className="review-panel">
                <div className="mission-tools-header">
                  <div>
                    <p className="eyebrow">Telemetry quality</p>
                    <h3>{healthLabel}</h3>
                  </div>
                  <StatusPill icon={<Activity size={15} />} label={packetAgeLabel} tone={healthTone} />
                </div>
                <TelemetryHistory history={live.history} />
              </article>

              <article className="review-panel">
                <div className="mission-tools-header">
                  <div>
                    <p className="eyebrow">AI findings</p>
                    <h3>Review candidates</h3>
                  </div>
                  <span className="muted">{researchCandidateCount} ready</span>
                </div>
                <div className="review-finding-list">
                  {researchAnalyses.map((analysis) => (
                    <div className="review-finding" key={analysis.id}>
                      <strong>{analysis.title}</strong>
                      <span>{analysis.currentStatus}</span>
                      <small>{analysis.readinessPercent}% ready</small>
                    </div>
                  ))}
                </div>
              </article>
            </section>
          )}
        </aside>

        <ResizeHandle
          label="Resize or scroll control panel"
          panel="control"
          handleRef={controlHandleRef}
          onPointerDown={startPanelInteraction}
          onWheel={(event) => scrollPanelFromHandle('control', event.deltaY)}
        />

        <section className="scene-panel">
          <BoatScene
            mission={mission}
            metricId={metricId}
            boatPosition={boatPosition}
            boatHeadingRad={boatHeadingRad}
            layers={layers}
            selectedSampleIndex={selectedSampleIndex}
            onSelectSample={selectSample}
            editableWaypoints={activeTab === 'planner'}
            onMoveSampleLocal={moveWaypointLocal}
          />
        </section>

        <ResizeHandle
          label="Resize or scroll info panel"
          panel="info"
          handleRef={infoHandleRef}
          onPointerDown={startPanelInteraction}
          onWheel={(event) => scrollPanelFromHandle('info', event.deltaY)}
        />

        <aside className="info-panel" ref={infoPanelRef} onScroll={() => updatePanelHandle('info')}>
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
            <Readout label="Scene source" value={telemetrySource} />
            <Readout label="Samples" value={mission ? String(mission.samples.length) : '--'} />
            <Readout label="Battery" value={live.status.batteryPercent !== undefined ? `${live.status.batteryPercent.toFixed(0)}%` : segment?.sample.batteryPercent !== undefined ? `${segment.sample.batteryPercent.toFixed(0)}%` : '--'} />
            <Readout label="Depth" value={live.status.depthMeters !== undefined ? `${live.status.depthMeters.toFixed(2)} m` : segment?.sample.depthMeters !== undefined ? `${segment.sample.depthMeters.toFixed(2)} m` : '--'} />
            <Readout label="RSSI" value={live.status.rssi !== undefined ? `${live.status.rssi} dBm` : '--'} />
            <Readout label="Packet age" value={packetAgeLabel} />
          </div>
          <OperatorAlertPanel alerts={operatorAlerts} />
          <div className="preflight-panel">
            <div className="mission-tools-header">
              <div>
                <p className="eyebrow">Execution prep</p>
                <h3>{isPreflightReady ? 'Mission ready' : 'Mission blocked'}</h3>
              </div>
              <StatusPill icon={<ShieldAlert size={15} />} label={isPreflightReady ? 'Ready' : 'Blocked'} tone={isPreflightReady ? 'good' : 'bad'} />
            </div>
            <div className="preflight-list">
              {preflightChecks.map((check) => (
                <div className="preflight-row" key={check.id} data-status={check.status}>
                  <strong>{check.label}</strong>
                  <span>{check.detail}</span>
                </div>
              ))}
            </div>
            <button className="primary-button prep-button" disabled={!isPreflightReady} onClick={prepareExecution}>
              Prepare mission
            </button>
            <p className="muted">{executionPreparedAt ? `Prepared ${new Date(executionPreparedAt).toLocaleTimeString()}` : 'Preparation does not upload or start the boat.'}</p>
            {uploadPlan && (
              <div className="upload-protocol-panel">
                <div className="mission-tools-header">
                  <div>
                    <p className="eyebrow">Upload protocol</p>
                    <h3>{uploadPlan.missionId}</h3>
                  </div>
                  <span className="muted">{uploadPlan.messages.length} messages</span>
                </div>
                <div className="protocol-grid">
                  <Readout label="Checksum" value={uploadPlan.checksum} />
                  <Readout label="Distance" value={`${uploadPlan.totalDistanceMeters.toFixed(1)} m`} />
                </div>
                <pre className="protocol-preview">
{JSON.stringify(
  {
    send: [...uploadPlan.messages.slice(0, 3), uploadPlan.messages.at(-1)],
    expected: uploadPlan.expectedResponses,
    abort: abortUploadMessage(uploadPlan.missionId, (live.status.lastSeq || 0) + uploadPlan.messages.length + 1, 'operator_cancelled'),
  },
  null,
  2,
)}
                </pre>
                <p className="muted">Protocol preview only. No waypoint upload is sent to hardware in this build.</p>
              </div>
            )}
          </div>
        </aside>
      </section>

      <footer className="timeline-panel" data-collapsed={timelineCollapsed}>
        <button className="timeline-grip" type="button" aria-label={timelineCollapsed ? 'Show playback controls' : 'Hide playback controls'} onClick={() => setTimelineCollapsed((value) => !value)}>
          {timelineCollapsed ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
        </button>
        <div className="timeline-controls">
          <button className="primary-button" disabled={liveMode || !mission} onClick={() => setIsPlaying((value) => !value)}>
            {isPlaying ? 'Pause' : 'Play'}
          </button>
          <input type="range" min={0} max={1} step={0.001} value={normalizedTime} onChange={(event) => setNormalizedTime(Number(event.target.value))} />
          <span>{durationSeconds > 0 ? `${Math.round(normalizedTime * durationSeconds)}s / ${Math.round(durationSeconds)}s` : '0s / 0s'}</span>
        </div>
      </footer>
    </main>
  )
}

function slugify(value: string) {
  const slug = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
  return slug || 'aquascan-mission'
}

function optionalNumber(value: string) {
  if (value.trim() === '') return undefined
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : undefined
}

function downloadText(filename: string, contents: string, type: string) {
  downloadBlob(filename, new Blob([contents], { type }))
}

function downloadBlob(filename: string, blob: Blob) {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.click()
  URL.revokeObjectURL(url)
}

function summarizeRunProgress(mission: AquaMission | undefined, normalizedTime: number) {
  if (!mission || mission.samples.length === 0) {
    return {
      currentWaypointNumber: undefined,
      nextWaypointNumber: undefined,
      distanceRemainingMeters: undefined,
      etaSeconds: undefined,
    }
  }
  const nearestIndex = nearestSampleIndex(mission, normalizedTime) ?? 0
  const currentIndex = Math.min(nearestIndex, mission.samples.length - 1)
  const remainingFromIndex = mission.samples.slice(currentIndex + 1).reduce((distance, sample, index) => {
    const previous = mission.samples[currentIndex + index]
    return distance + waypointDistance(previous, sample)
  }, 0)
  const totalDuration = missionDurationSeconds(mission)
  return {
    currentWaypointNumber: currentIndex + 1,
    nextWaypointNumber: currentIndex < mission.samples.length - 1 ? currentIndex + 2 : undefined,
    distanceRemainingMeters: remainingFromIndex,
    etaSeconds: totalDuration > 0 ? Math.max(0, (1 - normalizedTime) * totalDuration) : undefined,
  }
}

function waypointDistance(a: { localPosition: [number, number, number] }, b: { localPosition: [number, number, number] }) {
  const dx = b.localPosition[0] - a.localPosition[0]
  const dz = b.localPosition[2] - a.localPosition[2]
  return Math.hypot(dx, dz)
}

function buildModelFeatureReport(definition: ResearchModelDefinition, mission: AquaMission | undefined): ModelFeatureReport {
  const availableFeatures = definition.featureOrder.filter((feature) => isModelFeatureAvailable(feature, mission))
  const missingFeatures = definition.featureOrder.filter((feature) => !availableFeatures.includes(feature))
  return {
    definition,
    availableFeatures,
    missingFeatures,
    coveragePercent: definition.featureOrder.length > 0 ? Math.round((availableFeatures.length / definition.featureOrder.length) * 100) : 0,
  }
}

function isModelFeatureAvailable(feature: string, mission: AquaMission | undefined) {
  if (!mission || mission.samples.length === 0) return false
  if (feature === 'hour_sin' || feature === 'hour_cos') return mission.samples.some((sample) => Boolean(sample.timestamp))
  if (feature === 'depth_m') return mission.samples.some((sample) => sample.depthMeters !== undefined || metricValue(sample, 'depth') !== undefined)
  if (feature === 'do_delta_prev') return mission.samples.some((sample) => metricValue(sample, 'do') !== undefined)
  if (feature === 'temperature_delta_prev') return mission.samples.some((sample) => metricValue(sample, 'temperature') !== undefined)
  const metricId = modelFeatureMetricId(feature)
  return mission.samples.some((sample) => metricValue(sample, metricId) !== undefined)
}

function modelFeatureMetricId(feature: string) {
  const map: Record<string, string> = {
    dissolved_oxygen_mg_l: 'do',
    temperature_c: 'temperature',
    conductivity_us_cm: 'conductivity',
    turbidity_ntu: 'turbidity',
    light_lux: 'light',
    precipitation_mm_h: 'precipitation',
    tds_ppm: 'tds',
    salinity_psu: 'salinity',
    uv_index: 'uv',
  }
  return map[feature] ?? feature
}

function friendlyFeatureName(feature: string) {
  return feature
    .replace(/_/g, ' ')
    .replace('mg l', 'mg/L')
    .replace('us cm', 'uS/cm')
    .replace('mm h', 'mm/h')
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value))
}

function getPanelHandleMetrics(panelElement: HTMLElement, handleElement: HTMLElement) {
  const scrollableDistance = Math.max(0, panelElement.scrollHeight - panelElement.clientHeight)
  const trackHeight = Math.max(0, handleElement.clientHeight - 16)
  const thumbHeight = scrollableDistance > 1 && panelElement.scrollHeight > 0 ? clamp((panelElement.clientHeight / panelElement.scrollHeight) * trackHeight, 44, 118) : trackHeight
  const thumbOffset = scrollableDistance > 1 ? (panelElement.scrollTop / scrollableDistance) * Math.max(0, trackHeight - thumbHeight) : 0
  return { scrollableDistance, thumbHeight, thumbOffset }
}

function buildOperatorAlerts({
  mission,
  planWarnings,
  liveMode,
  simulatorEnabled,
  socketState,
  telemetryHealth,
  status,
  packetAgeMs,
  armed,
  estop,
  joystick,
  runState,
  isDirty,
}: {
  mission: AquaMission | undefined
  planWarnings: MissionPlanWarning[]
  liveMode: boolean
  simulatorEnabled: boolean
  socketState: 'idle' | 'connecting' | 'connected' | 'error'
  telemetryHealth: TelemetryHealth
  status: DriveStatus
  packetAgeMs: number | undefined
  armed: boolean
  estop: boolean
  joystick: [number, number]
  runState: RunState
  isDirty: boolean
}): OperatorAlert[] {
  const alerts: OperatorAlert[] = []
  const planErrors = planWarnings.filter((warning) => warning.severity === 'error')
  const planWarns = planWarnings.filter((warning) => warning.severity === 'warn')
  const joystickActive = Math.hypot(joystick[0], joystick[1]) > 0.05
  const liveExecution = liveMode || runState === 'running' || runState === 'armed' || runState === 'paused'

  if (estop) {
    alerts.push({
      id: 'estop',
      severity: 'critical',
      title: 'Emergency stop latched',
      detail: 'Drive commands are forced neutral until the latch is reset.',
    })
  }

  if (runState === 'aborted') {
    alerts.push({
      id: 'run-aborted',
      severity: 'critical',
      title: 'Run aborted',
      detail: 'Review the event timeline before preparing another run.',
    })
  }

  if (liveMode && socketState === 'error') {
    alerts.push({
      id: 'socket-error',
      severity: 'critical',
      title: 'Boat connection error',
      detail: 'The WebSocket link reported an error. Disconnect, verify host settings, then reconnect.',
    })
  }

  if (runState === 'running' && liveMode && !simulatorEnabled && socketState !== 'connected') {
    alerts.push({
      id: 'run-link-lost',
      severity: 'critical',
      title: 'Run tracking without boat link',
      detail: 'Mission run mode is active but the hardware link is not connected.',
    })
  }

  if (planErrors.length > 0) {
    alerts.push({
      id: 'plan-errors',
      severity: 'critical',
      title: 'Mission has blocking route issues',
      detail: `${planErrors.length} route issue${planErrors.length === 1 ? '' : 's'} must be fixed before execution.`,
    })
  }

  if (!mission) {
    alerts.push({
      id: 'no-mission',
      severity: liveExecution ? 'warning' : 'notice',
      title: 'No mission loaded',
      detail: 'Load, create, or import a mission before planning or run prep.',
    })
  }

  if (liveMode && socketState !== 'connected' && socketState !== 'error') {
    alerts.push({
      id: 'boat-link-offline',
      severity: armed || runState === 'running' ? 'critical' : 'warning',
      title: 'Boat link offline',
      detail: simulatorEnabled ? 'Simulator is selected but not connected.' : 'Connect to the boat before live driving.',
    })
  }

  if (liveMode && telemetryHealth === 'stale') {
    alerts.push({
      id: 'telemetry-stale',
      severity: armed || runState === 'running' ? 'critical' : 'warning',
      title: 'Telemetry is stale',
      detail: packetAgeMs === undefined ? 'No recent status packet has been received.' : `Last packet was ${formatAge(packetAgeMs)} ago.`,
    })
  }

  if (liveMode && telemetryHealth === 'connecting') {
    alerts.push({
      id: 'telemetry-connecting',
      severity: 'notice',
      title: 'Waiting for telemetry',
      detail: 'Connection is in progress and status packets have not stabilized yet.',
    })
  }

  if (liveMode && status.lastNeutralizeReason && status.lastNeutralizeReason !== 'boot') {
    alerts.push({
      id: 'safety-neutralized',
      severity: 'warning',
      title: 'Boat was safety-neutralized',
      detail: `${status.lastNeutralizeReason} (event ${status.neutralizeCount ?? 'unknown'}). Disarm and inspect the link before rearming.`,
    })
  }

  if (liveMode && socketState === 'connected' && (status.latitude === undefined || status.longitude === undefined)) {
    alerts.push({
      id: 'gps-missing',
      severity: 'warning',
      title: 'No live GPS fix',
      detail: 'The boat is connected but status packets do not include latitude and longitude.',
    })
  }

  if (status.batteryPercent !== undefined && status.batteryPercent <= 15) {
    alerts.push({
      id: 'battery-critical',
      severity: 'critical',
      title: 'Battery critically low',
      detail: `Battery is ${status.batteryPercent.toFixed(0)}%. Return to shore or stop the mission.`,
    })
  } else if (status.batteryPercent !== undefined && status.batteryPercent <= 25) {
    alerts.push({
      id: 'battery-low',
      severity: 'warning',
      title: 'Battery low',
      detail: `Battery is ${status.batteryPercent.toFixed(0)}%. Avoid starting long routes.`,
    })
  }

  if (status.rssi !== undefined && status.rssi <= -95) {
    alerts.push({
      id: 'rssi-critical',
      severity: 'critical',
      title: 'Radio signal critically weak',
      detail: `RSSI is ${status.rssi} dBm. Control link may drop.`,
    })
  } else if (status.rssi !== undefined && status.rssi <= -85) {
    alerts.push({
      id: 'rssi-weak',
      severity: 'warning',
      title: 'Radio signal weak',
      detail: `RSSI is ${status.rssi} dBm. Keep the boat closer or improve line of sight.`,
    })
  }

  if (armed) {
    alerts.push({
      id: 'armed',
      severity: 'warning',
      title: 'Boat is armed',
      detail: 'Thruster commands can move the vessel. Keep hands clear and monitor joystick input.',
    })
  }

  if (joystickActive && (!liveMode || socketState !== 'connected' || !armed)) {
    alerts.push({
      id: 'joystick-ignored',
      severity: 'notice',
      title: 'Joystick input is not driving',
      detail: 'Live mode, connection, and arm state are required before joystick commands affect output.',
    })
  }

  if (planWarns.length > 0) {
    alerts.push({
      id: 'plan-warnings',
      severity: 'warning',
      title: 'Mission has route warnings',
      detail: `${planWarns.length} route warning${planWarns.length === 1 ? '' : 's'} should be reviewed before execution.`,
    })
  }

  if (isDirty) {
    alerts.push({
      id: 'unsaved-project',
      severity: 'notice',
      title: 'Project has unsaved changes',
      detail: 'Save the project if this mission plan should be reused later.',
    })
  }

  if (alerts.length === 0) {
    return [
      {
        id: 'clear',
        severity: 'ok',
        title: 'No active operator alerts',
        detail: 'Mission, telemetry, safety, and control state are nominal for the current mode.',
      },
    ]
  }

  return alerts.sort((a, b) => alertSeverityRank(b.severity) - alertSeverityRank(a.severity))
}

function alertSeverityRank(severity: OperatorAlertSeverity) {
  if (severity === 'critical') return 3
  if (severity === 'warning') return 2
  if (severity === 'notice') return 1
  return 0
}

function formatAge(ageMs: number) {
  return ageMs < 1000 ? `${Math.round(ageMs)} ms` : `${(ageMs / 1000).toFixed(1)} s`
}

function formatLiveSensorValue(value: number | undefined, decimals: number, unit = '') {
  if (value === undefined || !Number.isFinite(value)) return '--'
  return `${value.toFixed(decimals)}${unit ? ` ${unit}` : ''}`
}

function formatAlertStatus(activeAlerts: OperatorAlert[], primaryAlert: OperatorAlert) {
  if (primaryAlert.severity === 'ok') return 'No alerts'
  const criticalCount = activeAlerts.filter((alert) => alert.severity === 'critical').length
  if (criticalCount > 0) return `${criticalCount} critical`
  return `${activeAlerts.length} alert${activeAlerts.length === 1 ? '' : 's'}`
}

function OperatorAlertBanner({ alert }: { alert: OperatorAlert }) {
  return (
    <section className="operator-alert-banner" data-severity={alert.severity}>
      <AlertTriangle size={18} />
      <div>
        <strong>{alert.title}</strong>
        <span>{alert.detail}</span>
      </div>
    </section>
  )
}

function OperatorAlertPanel({ alerts }: { alerts: OperatorAlert[] }) {
  const activeAlerts = alerts.filter((alert) => alert.severity !== 'ok')
  const criticalCount = activeAlerts.filter((alert) => alert.severity === 'critical').length
  return (
    <section className="operator-alert-panel" data-severity={alerts[0].severity}>
      <div className="mission-tools-header">
        <div>
          <p className="eyebrow">Operator alerts</p>
          <h3>{alerts[0].severity === 'ok' ? 'All clear' : `${activeAlerts.length} active`}</h3>
        </div>
        <StatusPill
          icon={<AlertTriangle size={15} />}
          label={criticalCount > 0 ? `${criticalCount} critical` : alerts[0].severity === 'ok' ? 'Clear' : 'Review'}
          tone={alerts[0].severity === 'critical' ? 'bad' : alerts[0].severity === 'warning' ? 'warn' : alerts[0].severity === 'ok' ? 'good' : 'neutral'}
        />
      </div>
      <div className="operator-alert-list">
        {alerts.slice(0, 5).map((alert) => (
          <article className="operator-alert-row" data-severity={alert.severity} key={alert.id}>
            <AlertTriangle size={16} />
            <div>
              <strong>{alert.title}</strong>
              <span>{alert.detail}</span>
            </div>
          </article>
        ))}
      </div>
    </section>
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

function ResizeHandle({
  label,
  panel,
  handleRef,
  onPointerDown,
  onWheel,
}: {
  label: string
  panel: 'control' | 'info'
  handleRef: RefObject<HTMLButtonElement | null>
  onPointerDown: (panel: 'control' | 'info', event: React.PointerEvent<HTMLButtonElement>) => void
  onWheel: (event: React.WheelEvent<HTMLButtonElement>) => void
}) {
  return (
    <button
      ref={handleRef}
      className="resize-handle"
      data-panel={panel}
      data-scrollable="false"
      type="button"
      aria-label={label}
      onPointerDown={(event) => onPointerDown(panel, event)}
      onWheel={(event) => {
        event.preventDefault()
        onWheel(event)
      }}
    />
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

function ResearchModelStatusCard({ status }: { status: ResearchModelBackendStatus }) {
  const tone = status.state === 'ready' ? 'good' : status.state === 'loading' ? 'warn' : status.state === 'error' ? 'bad' : 'neutral'
  return (
    <article className="research-model-card" data-tone={tone}>
      <div className="research-card-heading">
        <div>
          <h3>ONNX model backend</h3>
          <p>{status.message}</p>
        </div>
        <span className="model-state">{status.state}</span>
      </div>
      <div className="model-status-grid">
        <Readout label="Backend" value={status.backendName} />
        <Readout label="Models ready" value={`${status.readyModels}/${status.configuredModels}`} />
        <Readout label="Enabled" value={String(status.enabledModels)} />
        <Readout label="Version" value={status.packageVersion ?? '--'} />
      </div>
      <p className="model-path">{status.metadataUrl}</p>
      {status.errors.length > 0 && (
        <div className="model-error-list">
          {status.errors.map((error) => (
            <span key={error}>{error}</span>
          ))}
        </div>
      )}
    </article>
  )
}

type ModelFeatureReport = {
  definition: ResearchModelDefinition
  availableFeatures: string[]
  missingFeatures: string[]
  coveragePercent: number
}

function ModelIntegrationControls({
  metadataUrl,
  onMetadataUrlChange,
  onReload,
  status,
  featureReports,
}: {
  metadataUrl: string
  onMetadataUrlChange: (value: string) => void
  onReload: () => void
  status: ResearchModelBackendStatus
  featureReports: ModelFeatureReport[]
}) {
  return (
    <article className="model-controls-card">
      <div className="mission-tools-header">
        <div>
          <p className="eyebrow">Model integration</p>
          <h3>ONNX install controls</h3>
        </div>
        <button className="secondary-button compact-button" onClick={onReload}>
          Reload
        </button>
      </div>
      <Field label="Metadata URL" value={metadataUrl} onChange={onMetadataUrlChange} />
      <p className="status-copy">Drop ONNX files in web/public/models/research, point metadata at them, then enable each model in metadata.json.</p>
      <div className="model-integration-grid">
        {featureReports.length === 0 ? (
          <p className="muted">No model definitions loaded yet.</p>
        ) : (
          featureReports.map((report) => (
            <div className="model-definition-card" key={report.definition.id} data-enabled={report.definition.enabled}>
              <div className="mission-tools-header">
                <div>
                  <strong>{report.definition.displayName}</strong>
                  <span>{report.definition.enabled ? 'Enabled' : 'Disabled'}</span>
                </div>
                <b>{report.coveragePercent}%</b>
              </div>
              <p className="model-path">{report.definition.url}</p>
              <div className="model-schema-grid">
                <Readout label="Input" value={report.definition.inputName} />
                <Readout label="Output" value={report.definition.outputName ?? 'auto'} />
              </div>
              <div className="feature-chip-list">
                {report.definition.featureOrder.map((feature) => (
                  <span key={feature} data-ready={report.availableFeatures.includes(feature)}>
                    {friendlyFeatureName(feature)}
                  </span>
                ))}
              </div>
              <p className="muted">
                {report.missingFeatures.length > 0 ? `Missing: ${report.missingFeatures.map(friendlyFeatureName).join(', ')}` : 'Mission has every configured feature.'}
              </p>
            </div>
          ))
        )}
      </div>
      <p className="muted">{status.state === 'ready' ? 'Real ONNX inference is available for enabled models.' : 'Heuristic analysis remains active until enabled ONNX models load.'}</p>
    </article>
  )
}

function ResearchPhenomenonCard({ analysis }: { analysis: ResearchPhenomenonAnalysis }) {
  return (
    <article className="research-card">
      <div className="research-card-heading">
        <div>
          <h3>{analysis.title}</h3>
          <p>{analysis.currentStatus}</p>
        </div>
        <strong>{analysis.readinessPercent}%</strong>
      </div>
      <p className="research-hypothesis">{analysis.hypothesis}</p>
      <div className="research-signal-grid">
        {analysis.signals.map((signal) => (
          <div className="research-signal" data-tone={signal.tone} key={signal.label}>
            <span>{signal.label}</span>
            <strong>{signal.value}</strong>
          </div>
        ))}
      </div>
      <div className="research-detail-grid">
        <ResearchList title="Survey design" items={analysis.recommendedSurvey} />
        <ResearchList title="AI/model plan" items={analysis.aiPlan} />
      </div>
      <div className="research-missing">
        <span>Missing/useful fields</span>
        <strong>{analysis.missingFields.length > 0 ? analysis.missingFields.join(', ') : 'Ready'}</strong>
      </div>
    </article>
  )
}

function ResearchList({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="research-list">
      <strong>{title}</strong>
      {items.map((item) => (
        <span key={item}>{item}</span>
      ))}
    </div>
  )
}

function TelemetryHistory({ history }: { history: Array<{ receivedAtMs: number; packetAgeMs: number; lastSeq: number; leftMicros: number; rightMicros: number; rssi?: number }> }) {
  const recent = history.slice(0, 5)
  return (
    <div className="telemetry-history">
      <div className="history-heading">
        <span>Telemetry packets</span>
        <strong>{history.length}</strong>
      </div>
      {recent.length === 0 ? (
        <p className="muted">No status packets received.</p>
      ) : (
        recent.map((packet) => (
          <div className="packet-row" key={`${packet.receivedAtMs}-${packet.lastSeq}`}>
            <span>#{packet.lastSeq || '--'}</span>
            <span>{packet.packetAgeMs < 1000 ? `${Math.round(packet.packetAgeMs)} ms` : `${(packet.packetAgeMs / 1000).toFixed(1)} s`}</span>
            <span>
              {packet.leftMicros}/{packet.rightMicros} us
            </span>
            <span>{packet.rssi !== undefined ? `${packet.rssi} dBm` : '--'}</span>
          </div>
        ))
      )}
    </div>
  )
}

export default App
