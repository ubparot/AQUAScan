import { execSync } from 'node:child_process'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

const projectNumber = '754800118914'
const appDisplayName = 'AQUAScan'
const envPath = join(process.cwd(), '.env.local')
const firebasercPath = join(process.cwd(), '.firebaserc')
const npmCliPath = join(dirname(process.execPath), 'node_modules', 'npm', 'bin', 'npm-cli.js')

function runFirebase(args) {
  try {
    const command = [process.execPath, npmCliPath, 'exec', '--package', 'firebase-tools', '--', 'firebase', ...args, '--json'].map(shellQuote).join(' ')
    const output = execSync(command, {
      cwd: process.cwd(),
      encoding: 'utf8',
      env: cleanNpmScriptEnv(),
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    return JSON.parse(output)
  } catch (error) {
    const stderr = error.stderr?.toString() ?? ''
    const stdout = error.stdout?.toString() ?? ''
    const details = stderr || stdout || error.message
    throw new Error(details.trim())
  }
}

function cleanNpmScriptEnv() {
  const env = { ...process.env }
  delete env.npm_execpath
  delete env.npm_node_execpath
  return env
}

function shellQuote(value) {
  const text = String(value)
  if (process.platform === 'win32') {
    return `"${text.replace(/"/g, '\\"')}"`
  }
  return `'${text.replace(/'/g, "'\\''")}'`
}

function resolveProjectId() {
  const response = runFirebase(['projects:list'])
  const projects = response.result ?? response.results ?? []
  const project = projects.find((candidate) => String(candidate.projectNumber) === projectNumber)

  if (!project?.projectId) {
    throw new Error(`Could not find Firebase project number ${projectNumber}. Run "npx firebase-tools login" with the project owner account.`)
  }

  return project.projectId
}

function findExistingWebApp(projectId) {
  const response = runFirebase(['apps:list', '--project', projectId])
  const apps = response.result ?? []
  return apps.find((app) => app.platform === 'WEB' && app.displayName === appDisplayName) ??
    apps.find((app) => app.platform === 'WEB')
}

function createWebApp(projectId) {
  const response = runFirebase(['apps:create', 'WEB', appDisplayName, '--project', projectId])
  return response.result
}

function getSdkConfig(projectId, appId) {
  const response = runFirebase(['apps:sdkconfig', 'WEB', appId, '--project', projectId])
  return response.result?.sdkConfig ?? response.result ?? response
}

function mergeEnv(config) {
  const previous = existsSync(envPath) ? readFileSync(envPath, 'utf8') : ''
  const lines = previous
    .split(/\r?\n/)
    .filter((line) => line.trim() && !line.startsWith('VITE_FIREBASE_'))

  const nextLines = [
    ...lines,
    `VITE_FIREBASE_API_KEY=${config.apiKey ?? ''}`,
    `VITE_FIREBASE_AUTH_DOMAIN=${config.authDomain ?? ''}`,
    `VITE_FIREBASE_PROJECT_ID=${config.projectId ?? ''}`,
    `VITE_FIREBASE_STORAGE_BUCKET=${config.storageBucket ?? ''}`,
    `VITE_FIREBASE_MESSAGING_SENDER_ID=${config.messagingSenderId ?? ''}`,
    `VITE_FIREBASE_APP_ID=${config.appId ?? ''}`,
  ]

  if (!previous.includes('VITE_AQUASCAN_ALLOWED_EMAILS=')) {
    nextLines.push('VITE_AQUASCAN_ALLOWED_EMAILS=you@gmail.com')
  }

  writeFileSync(envPath, `${nextLines.join('\n')}\n`)
}

function writeFirebaseRc(projectId) {
  writeFileSync(
    firebasercPath,
    `${JSON.stringify({ projects: { default: projectId } }, null, 2)}\n`,
  )
}

const projectId = resolveProjectId()
const existingApp = findExistingWebApp(projectId)
const app = existingApp ?? createWebApp(projectId)
const appId = app.appId ?? app.app_id

if (!appId) {
  throw new Error('Firebase CLI did not return a Web app ID.')
}

const sdkConfig = getSdkConfig(projectId, appId)
mergeEnv(sdkConfig)
writeFirebaseRc(projectId)

console.log(`Firebase Web app ready: ${appDisplayName}`)
console.log(`Project ID: ${projectId}`)
console.log(`App ID: ${appId}`)
console.log('Wrote web/.env.local and web/.firebaserc')
console.log('Update VITE_AQUASCAN_ALLOWED_EMAILS in web/.env.local before running the app.')
