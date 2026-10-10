import { useEffect, useState, type FormEvent, type ReactNode } from 'react'
import {
  createEmailAccount,
  getControlAuthSetupIssues,
  sendEmailPasswordReset,
  signInWithEmail,
  signInWithGoogle,
  signOutOfGoogle,
  subscribeToControlAuth,
  type ControlAuthUser,
} from '../domain/firebaseAuth'
import { AquaLabsLogo } from './AquaLabsLogo'
import { SiteLink } from './primitives'

export function ControlAuthGate({ children }: { children: (logout: () => void, user: ControlAuthUser) => ReactNode }) {
  const [authReady, setAuthReady] = useState(false)
  const [user, setUser] = useState<ControlAuthUser | null>(null)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const [emailMode, setEmailMode] = useState<'signin' | 'create'>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [displayName, setDisplayName] = useState('')
  const setupIssues = getControlAuthSetupIssues()
  const configured = setupIssues.length === 0

  useEffect(() => subscribeToControlAuth((nextState) => {
    setAuthReady(nextState.ready)
    setUser(nextState.user)
    if (nextState.error) setError(nextState.error)
  }), [])

  const run = async (task: () => Promise<void>, fallback: string) => {
    setBusy(true)
    setError('')
    setMessage('')
    try {
      await task()
    } catch (taskError) {
      setError(taskError instanceof Error ? taskError.message : fallback)
    } finally {
      setBusy(false)
    }
  }

  const login = () => run(async () => setUser(await signInWithGoogle()), 'Google sign-in failed.')

  const loginWithEmail = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    return run(async () => {
      setUser(emailMode === 'create'
        ? await createEmailAccount(email, password, displayName)
        : await signInWithEmail(email, password))
    }, 'Email sign-in failed.')
  }

  const resetPassword = () => {
    if (!email.trim()) {
      setError('Enter your email address first.')
      return
    }
    return run(async () => {
      await sendEmailPasswordReset(email)
      setMessage('Password reset email sent.')
    }, 'Unable to send password reset email.')
  }

  const logout = async () => {
    setBusy(true)
    try {
      await signOutOfGoogle()
      setUser(null)
    } finally {
      setBusy(false)
    }
  }

  if (user) return <>{children(logout, user)}</>

  return (
    <div className="auth">
      <header className="auth-bar">
        <SiteLink to="home" className="globalnav-brand" aria-label="AquaLabs home">
          <AquaLabsLogo height={19} />
        </SiteLink>
        <SiteLink to="home" className="auth-bar-link">Back to site</SiteLink>
      </header>

      <main className="auth-main">
        <section className="auth-panel" aria-labelledby="control-auth-title">
          <h1 id="control-auth-title">Sign in to live control.</h1>
          <p className="auth-lede">The AquaScan operator dashboard is limited to approved team accounts.</p>

          {configured ? (
            <>
              <button className="auth-google" type="button" disabled={!authReady || busy} onClick={login}>
                <svg viewBox="0 0 18 18" width="18" height="18" aria-hidden="true">
                  <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62Z" />
                  <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.8.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.33A9 9 0 0 0 9 18Z" />
                  <path fill="#FBBC05" d="M3.97 10.72A5.4 5.4 0 0 1 3.68 9c0-.6.1-1.18.29-1.72V4.95H.96A9 9 0 0 0 0 9c0 1.45.35 2.83.96 4.05l3.01-2.33Z" />
                  <path fill="#EA4335" d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58A9 9 0 0 0 .96 4.95l3.01 2.33C4.68 5.16 6.66 3.58 9 3.58Z" />
                </svg>
                {busy ? 'Opening Google…' : authReady ? 'Continue with Google' : 'Checking session…'}
              </button>

              <div className="auth-divider" role="presentation"><span>or</span></div>

              <form onSubmit={loginWithEmail} className="auth-form">
                <div className="segmented" role="group" aria-label="Email authentication mode">
                  <button type="button" aria-pressed={emailMode === 'signin'} onClick={() => setEmailMode('signin')}>Sign in</button>
                  <button type="button" aria-pressed={emailMode === 'create'} onClick={() => setEmailMode('create')}>Create account</button>
                </div>
                {emailMode === 'create' && (
                  <label className="field">
                    <span>Name</span>
                    <input type="text" value={displayName} autoComplete="name" onChange={(event) => setDisplayName(event.target.value)} />
                  </label>
                )}
                <label className="field">
                  <span>Email</span>
                  <input type="email" value={email} autoComplete="email" required onChange={(event) => setEmail(event.target.value)} />
                </label>
                <label className="field">
                  <span>Password</span>
                  <input
                    type="password"
                    value={password}
                    autoComplete={emailMode === 'create' ? 'new-password' : 'current-password'}
                    required
                    minLength={6}
                    onChange={(event) => setPassword(event.target.value)}
                  />
                </label>
                <button className="button button-primary auth-submit" type="submit" disabled={!authReady || busy}>
                  {emailMode === 'create' ? 'Create account' : 'Sign in with email'}
                </button>
                <button className="auth-text-button" type="button" disabled={busy} onClick={resetPassword}>Send password reset email</button>
              </form>

              {message && <p className="auth-message" role="status">{message}</p>}
              {error && <p className="auth-message auth-message-error" role="alert">{error}</p>}
            </>
          ) : (
            <div className="auth-setup" role="status">
              <strong>Firebase auth is not configured yet.</strong>
              <ul>{setupIssues.map((issue) => <li key={issue}>{issue}</li>)}</ul>
            </div>
          )}
        </section>
        <p className="auth-footnote">
          Want to explore water-quality data? <SiteLink to="maris">Open Maris</SiteLink>, no account needed.
        </p>
      </main>
    </div>
  )
}
