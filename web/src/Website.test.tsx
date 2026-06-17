import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import Website from './Website'

const authMock = vi.hoisted(() => ({
  authState: {
    ready: true,
    user: null as null | { uid: string; email: string; name: string; photoURL?: string; providerId: string },
  },
  setupIssues: [] as string[],
  createEmailAccount: vi.fn(),
  sendEmailPasswordReset: vi.fn(),
  signInWithEmail: vi.fn(),
  signInWithGoogle: vi.fn(),
  signOutOfGoogle: vi.fn(),
}))

vi.mock('./App', () => ({
  default: () => <div data-testid="control-dashboard">Control dashboard</div>,
}))

vi.mock('./domain/firebaseAuth', () => ({
  createEmailAccount: authMock.createEmailAccount,
  getControlAuthSetupIssues: () => authMock.setupIssues,
  sendEmailPasswordReset: authMock.sendEmailPasswordReset,
  signInWithEmail: authMock.signInWithEmail,
  signInWithGoogle: authMock.signInWithGoogle,
  signOutOfGoogle: authMock.signOutOfGoogle,
  subscribeToControlAuth: (onChange: (state: typeof authMock.authState) => void) => {
    onChange(authMock.authState)
    return () => undefined
  },
}))

describe('Website control authentication', () => {
  beforeEach(() => {
    authMock.authState = { ready: true, user: null }
    authMock.setupIssues = []
    authMock.createEmailAccount.mockReset()
    authMock.sendEmailPasswordReset.mockReset()
    authMock.signInWithEmail.mockReset()
    authMock.signInWithGoogle.mockReset()
    authMock.signOutOfGoogle.mockReset()
    authMock.sendEmailPasswordReset.mockResolvedValue(undefined)
    authMock.signOutOfGoogle.mockResolvedValue(undefined)
    window.history.pushState({}, '', '/')
  })

  it('requires Google sign-in before rendering the live control dashboard', async () => {
    authMock.signInWithGoogle.mockResolvedValue({ uid: 'operator-1', email: 'operator@example.com', name: 'Operator', providerId: 'google.com' })
    window.history.pushState({}, '', '/control')
    render(<Website />)

    expect(screen.getByRole('heading', { name: /sign in to live control/i })).toBeInTheDocument()
    expect(screen.queryByTestId('control-dashboard')).not.toBeInTheDocument()

    fireEvent.click(await screen.findByRole('button', { name: /continue with google/i }))
    expect(await screen.findByTestId('control-dashboard')).toBeInTheDocument()
    expect(screen.getByText('operator@example.com')).toBeInTheDocument()
  })

  it('shows an error when the Google account is not allowed', async () => {
    authMock.signInWithGoogle.mockRejectedValue(new Error('This account is not allowed to use live control.'))
    window.history.pushState({}, '', '/control')
    render(<Website />)

    fireEvent.click(await screen.findByRole('button', { name: /continue with google/i }))

    expect(await screen.findByRole('alert')).toHaveTextContent(/not allowed/i)
    expect(screen.queryByTestId('control-dashboard')).not.toBeInTheDocument()
  })

  it('supports email/password sign-in', async () => {
    authMock.signInWithEmail.mockResolvedValue({ uid: 'operator-1', email: 'operator@example.com', name: 'Operator', providerId: 'password' })
    window.history.pushState({}, '', '/control')
    render(<Website />)

    fireEvent.change(screen.getByLabelText(/^email$/i), { target: { value: 'operator@example.com' } })
    fireEvent.change(screen.getByLabelText(/^password$/i), { target: { value: 'secret123' } })
    fireEvent.click(screen.getByRole('button', { name: /sign in with email/i }))

    expect(await screen.findByTestId('control-dashboard')).toBeInTheDocument()
    expect(authMock.signInWithEmail).toHaveBeenCalledWith('operator@example.com', 'secret123')
  })

  it('supports email/password account creation', async () => {
    authMock.createEmailAccount.mockResolvedValue({ uid: 'operator-1', email: 'operator@example.com', name: 'Operator', providerId: 'password' })
    window.history.pushState({}, '', '/control')
    render(<Website />)

    fireEvent.click(screen.getByRole('button', { name: /create account/i }))
    fireEvent.change(screen.getByLabelText(/^name$/i), { target: { value: 'Operator' } })
    fireEvent.change(screen.getByLabelText(/^email$/i), { target: { value: 'operator@example.com' } })
    fireEvent.change(screen.getByLabelText(/^password$/i), { target: { value: 'secret123' } })
    fireEvent.click(screen.getAllByRole('button', { name: /^create account$/i })[1])

    expect(await screen.findByTestId('control-dashboard')).toBeInTheDocument()
    expect(authMock.createEmailAccount).toHaveBeenCalledWith('operator@example.com', 'secret123', 'Operator')
  })

  it('sends password reset emails', async () => {
    window.history.pushState({}, '', '/control')
    render(<Website />)

    fireEvent.change(screen.getByLabelText(/^email$/i), { target: { value: 'operator@example.com' } })
    fireEvent.click(screen.getByRole('button', { name: /send password reset email/i }))

    expect(await screen.findByRole('status')).toHaveTextContent(/password reset email sent/i)
    expect(authMock.sendEmailPasswordReset).toHaveBeenCalledWith('operator@example.com')
  })

  it('can log out of the live control dashboard', async () => {
    authMock.authState = { ready: true, user: { uid: 'operator-1', email: 'operator@example.com', name: 'Operator', providerId: 'google.com' } }
    window.history.pushState({}, '', '/control')
    render(<Website />)

    expect(screen.getByTestId('control-dashboard')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /log out/i }))

    await waitFor(() => expect(authMock.signOutOfGoogle).toHaveBeenCalled())
    expect(screen.getByRole('heading', { name: /sign in to live control/i })).toBeInTheDocument()
    expect(screen.queryByTestId('control-dashboard')).not.toBeInTheDocument()
  })

  it('keeps live control locked when Firebase auth is not configured', () => {
    authMock.setupIssues = ['Missing Firebase env vars: VITE_FIREBASE_API_KEY']
    window.history.pushState({}, '', '/control')
    render(<Website />)

    expect(screen.getByText(/firebase auth is not configured/i)).toBeInTheDocument()
    expect(screen.getByText(/VITE_FIREBASE_API_KEY/i)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /continue with google/i })).not.toBeInTheDocument()
    expect(screen.queryByTestId('control-dashboard')).not.toBeInTheDocument()
  })
})
