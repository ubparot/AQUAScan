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

vi.mock('./MarisLab', () => ({
  default: () => <div data-testid="maris-dashboard">Maris lab</div>,
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

    expect(await screen.findByRole('heading', { name: /sign in to live control/i })).toBeInTheDocument()
    expect(screen.queryByTestId('control-dashboard')).not.toBeInTheDocument()

    fireEvent.click(await screen.findByRole('button', { name: /continue with google/i }))
    expect(await screen.findByTestId('control-dashboard')).toBeInTheDocument()
    expect(screen.getByText('operator@example.com')).toBeInTheDocument()
  })

  it('renders the public Maris demo without authentication', async () => {
    window.history.pushState({}, '', '/maris')
    render(<Website />)

    expect(await screen.findByTestId('maris-dashboard')).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: /sign in to live control/i })).not.toBeInTheDocument()
    expect(screen.queryByTestId('control-dashboard')).not.toBeInTheDocument()
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

    fireEvent.change(await screen.findByLabelText(/^email$/i), { target: { value: 'operator@example.com' } })
    fireEvent.change(screen.getByLabelText(/^password$/i), { target: { value: 'secret123' } })
    fireEvent.click(screen.getByRole('button', { name: /sign in with email/i }))

    expect(await screen.findByTestId('control-dashboard')).toBeInTheDocument()
    expect(authMock.signInWithEmail).toHaveBeenCalledWith('operator@example.com', 'secret123')
  })

  it('supports email/password account creation', async () => {
    authMock.createEmailAccount.mockResolvedValue({ uid: 'operator-1', email: 'operator@example.com', name: 'Operator', providerId: 'password' })
    window.history.pushState({}, '', '/control')
    render(<Website />)

    fireEvent.click(await screen.findByRole('button', { name: /create account/i }))
    fireEvent.change(screen.getByLabelText(/^name$/i), { target: { value: 'Operator' } })
    fireEvent.change(await screen.findByLabelText(/^email$/i), { target: { value: 'operator@example.com' } })
    fireEvent.change(screen.getByLabelText(/^password$/i), { target: { value: 'secret123' } })
    fireEvent.click(screen.getAllByRole('button', { name: /^create account$/i })[1])

    expect(await screen.findByTestId('control-dashboard')).toBeInTheDocument()
    expect(authMock.createEmailAccount).toHaveBeenCalledWith('operator@example.com', 'secret123', 'Operator')
  })

  it('sends password reset emails', async () => {
    window.history.pushState({}, '', '/control')
    render(<Website />)

    fireEvent.change(await screen.findByLabelText(/^email$/i), { target: { value: 'operator@example.com' } })
    fireEvent.click(screen.getByRole('button', { name: /send password reset email/i }))

    expect(await screen.findByRole('status')).toHaveTextContent(/password reset email sent/i)
    expect(authMock.sendEmailPasswordReset).toHaveBeenCalledWith('operator@example.com')
  })

  it('can log out of the live control dashboard', async () => {
    authMock.authState = { ready: true, user: { uid: 'operator-1', email: 'operator@example.com', name: 'Operator', providerId: 'google.com' } }
    window.history.pushState({}, '', '/control')
    render(<Website />)

    expect(await screen.findByTestId('control-dashboard')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /log out/i }))

    await waitFor(() => expect(authMock.signOutOfGoogle).toHaveBeenCalled())
    expect(screen.getByRole('heading', { name: /sign in to live control/i })).toBeInTheDocument()
    expect(screen.queryByTestId('control-dashboard')).not.toBeInTheDocument()
  })

  it('keeps live control locked when Firebase auth is not configured', async () => {
    authMock.setupIssues = ['Missing Firebase env vars: VITE_FIREBASE_API_KEY']
    window.history.pushState({}, '', '/control')
    render(<Website />)

    expect(await screen.findByText(/firebase auth is not configured/i)).toBeInTheDocument()
    expect(screen.getByText(/VITE_FIREBASE_API_KEY/i)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /continue with google/i })).not.toBeInTheDocument()
    expect(screen.queryByTestId('control-dashboard')).not.toBeInTheDocument()
  })

  it('opens the AquaScan field film from the homepage hero', () => {
    render(<Website />)

    // The hero is about AquaLabs; AquaScan is introduced in the section after it.
    const hero = screen.getByRole('heading', { level: 1 })
    expect(hero).toHaveTextContent(/technology for understanding the water/i)
    expect(hero.closest('section')).not.toHaveTextContent(/aquascan/i)
    expect(screen.getByText('Introducing')).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 2, name: 'AquaScan' })).toBeInTheDocument()
    expect(screen.queryByLabelText(/aquascan vessel field video/i)).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /watch the film/i }))
    const video = screen.getByLabelText(/aquascan vessel field video/i)
    expect(video).toHaveAttribute('src', '/media/aquascan-hero.mp4')
    expect(video).toHaveAttribute('poster', '/media/aquascan-hero-poster.jpg')
    expect(video).toHaveAttribute('autoplay')
    expect(video).toHaveProperty('muted', false) // opened by a click, so it plays with sound

    fireEvent.keyDown(window, { key: 'Escape' })
    expect(screen.queryByRole('dialog', { name: /aquascan film/i })).not.toBeInTheDocument()
  })

  it('loops silent field footage behind the homepage hero, with the probe and survey', () => {
    render(<Website />)

    const loop = document.querySelector('.video-hero-media') as HTMLVideoElement
    expect(loop).toHaveAttribute('src', '/media/aquascan-field.mp4')
    expect(loop).toHaveProperty('muted', true)
    expect(screen.getByRole('button', { name: /pause background video|play background video/i })).toBeInTheDocument()
    expect(screen.queryByText('5th in the Nation')).not.toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'The probe' })).toBeInTheDocument()

    const survey = screen.getAllByRole('link', { name: /take the survey/i })[0]
    expect(survey).toHaveAttribute('href', 'https://forms.gle/CJHyLLHwWEMvw5T67')
    expect(survey).toHaveAttribute('target', '_blank')
    expect(survey).toHaveAttribute('rel', expect.stringContaining('noopener'))
  })

  it('routes between pages with real links and keeps legacy paths working', () => {
    window.history.pushState({}, '', '/products')
    render(<Website />)

    expect(screen.getByRole('heading', { level: 1, name: 'AquaScan' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /tech specs/i })).toBeInTheDocument()

    const companyLink = screen.getAllByRole('link', { name: 'About' })[0]
    expect(companyLink).toHaveAttribute('href', '/company')
    fireEvent.click(companyLink)

    expect(window.location.pathname).toBe('/company')
    expect(screen.getByRole('heading', { name: /the founding team/i })).toBeInTheDocument()
  })

  it.each([
    ['/newsroom', /fifth in the nation/i],
    ['/news', /fifth in the nation/i],
    ['/privacy', /privacy policy/i],
    ['/terms', /terms of use/i],
  ])('renders the public company page at %s', (path, heading) => {
    window.history.pushState({}, '', path)
    render(<Website />)

    expect(screen.getByRole('heading', { name: heading })).toBeInTheDocument()
  })

  it('lists the AquaLabs founding team and their roles', () => {
    window.history.pushState({}, '', '/company')
    render(<Website />)

    expect(screen.getByRole('heading', { name: 'Aven Mitchell' })).toBeInTheDocument()
    expect(screen.getByText('Lead Electronics & Software')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Aiden Russi' })).toBeInTheDocument()
    expect(screen.getByText('Co-Lead CAD and Probe Design')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Skylar Cauntay' })).toBeInTheDocument()
    expect(screen.getByText('Co-Lead CAD and Vessel Design')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Oliver Hathaway' })).toBeInTheDocument()
    expect(screen.getByText('Lead R&D')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Hayden Wells' })).toBeInTheDocument()
    expect(screen.getByText('Lead Organizational Outreach')).toBeInTheDocument()
  })
})
