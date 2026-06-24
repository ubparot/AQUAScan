import { afterEach, describe, expect, it, vi } from 'vitest'

const firebaseEnv = {
  VITE_FIREBASE_API_KEY: 'test-api-key',
  VITE_FIREBASE_AUTH_DOMAIN: 'aquascan.test',
  VITE_FIREBASE_PROJECT_ID: 'aquascan-test',
  VITE_FIREBASE_APP_ID: 'test-app-id',
}

async function loadAuthWithEnv(env: Record<string, string | boolean | undefined>) {
  vi.resetModules()
  vi.unstubAllEnvs()

  for (const [key, value] of Object.entries({ ...firebaseEnv, ...env })) {
    vi.stubEnv(key, value)
  }

  return import('./firebaseAuth')
}

describe('control auth email access', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('allows every signed-in email in production builds', async () => {
    const auth = await loadAuthWithEnv({
      PROD: true,
      DEV: false,
      VITE_AQUASCAN_ALLOWED_EMAILS: '',
    })

    expect(auth.getControlAuthSetupIssues()).toEqual([])
    expect(auth.isEmailAllowed('operator@example.com')).toBe(true)
    expect(auth.isEmailAllowed('another.operator@school.edu')).toBe(true)
  })

  it('allows every signed-in email when the allowlist is wildcarded', async () => {
    const auth = await loadAuthWithEnv({
      PROD: false,
      DEV: true,
      VITE_AQUASCAN_ALLOWED_EMAILS: '*',
    })

    expect(auth.getControlAuthSetupIssues()).toEqual([])
    expect(auth.isEmailAllowed('operator@example.com')).toBe(true)
  })

  it('still reports a missing allowlist outside production without a wildcard', async () => {
    const auth = await loadAuthWithEnv({
      PROD: false,
      DEV: true,
      VITE_AQUASCAN_ALLOWED_EMAILS: '',
    })

    expect(auth.getControlAuthSetupIssues()).toContain('Missing VITE_AQUASCAN_ALLOWED_EMAILS allowlist')
    expect(auth.isEmailAllowed('operator@example.com')).toBe(false)
  })
})
