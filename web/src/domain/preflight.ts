import type { AquaMission, DriveStatus, TelemetryHealth } from '../types/aqua'
import type { MissionPlanWarning } from './missionPlanner'

export type PreflightCheck = {
  id: string
  label: string
  detail: string
  status: 'pass' | 'warn' | 'fail'
}

export function buildPreflightChecks({
  mission,
  planWarnings,
  connected,
  telemetryHealth,
  status,
  armed,
  estop,
}: {
  mission: AquaMission | undefined
  planWarnings: MissionPlanWarning[]
  connected: boolean
  telemetryHealth: TelemetryHealth
  status: DriveStatus
  armed: boolean
  estop: boolean
}): PreflightCheck[] {
  const planErrors = planWarnings.filter((warning) => warning.severity === 'error')
  const planWarns = planWarnings.filter((warning) => warning.severity === 'warn')
  return [
    {
      id: 'mission',
      label: 'Mission loaded',
      detail: mission ? `${mission.samples.length} waypoints ready` : 'Load or create a mission plan',
      status: mission && mission.samples.length >= 2 ? 'pass' : 'fail',
    },
    {
      id: 'plan-validation',
      label: 'Plan validation',
      detail: planErrors.length > 0 ? `${planErrors.length} blocking issue(s)` : planWarns.length > 0 ? `${planWarns.length} warning(s) to review` : 'No route validation issues',
      status: planErrors.length > 0 ? 'fail' : planWarns.length > 0 ? 'warn' : 'pass',
    },
    {
      id: 'link',
      label: 'Boat link',
      detail: connected ? 'WebSocket connected' : 'Connect to the boat before execution',
      status: connected ? 'pass' : 'fail',
    },
    {
      id: 'telemetry',
      label: 'Telemetry freshness',
      detail: telemetryHealth === 'fresh' ? 'Recent status packet received' : `Telemetry is ${telemetryHealth}`,
      status: telemetryHealth === 'fresh' ? 'pass' : telemetryHealth === 'stale' ? 'warn' : 'fail',
    },
    {
      id: 'gps',
      label: 'Live GPS fix',
      detail: status.latitude !== undefined && status.longitude !== undefined ? `${status.latitude.toFixed(5)}, ${status.longitude.toFixed(5)}` : 'No live GPS in status packets',
      status: status.latitude !== undefined && status.longitude !== undefined ? 'pass' : 'warn',
    },
    {
      id: 'safety-state',
      label: 'Safety state',
      detail: estop ? 'E-stop is latched' : armed ? 'Boat is armed; disarm before mission prep' : 'Disarmed and e-stop clear',
      status: estop || armed ? 'fail' : 'pass',
    },
  ]
}

export function preflightReady(checks: PreflightCheck[]) {
  return checks.every((check) => check.status !== 'fail')
}
