import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App'

vi.mock('./components/BoatScene', () => ({
  BoatScene: () => <div data-testid="boat-scene" />,
}))

const demoCsv = `timestamp,latitude,longitude,temperature,ph,do,depth,heading,speed,battery
2025-01-01T12:00:00Z,37.425100,-122.084100,16.8,7.4,8.9,2.2,45,1.4,96
2025-01-01T12:00:10Z,37.425140,-122.084000,17.1,7.3,8.7,2.7,50,1.4,95`

describe('App dashboard', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        text: async () => demoCsv,
      })),
    )
  })

  it('loads the demo mission and switches tabs', async () => {
    render(<App />)
    fireEvent.click(await screen.findByRole('button', { name: /advanced/i }))
    await waitFor(() => expect(screen.getByText('demo-mission')).toBeInTheDocument())
    expect(screen.getByTestId('boat-scene')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /drive/i }))
    expect(screen.getByText('Live drive')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /^AI$/i }))
    expect(screen.getByText('AI inference')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /sensors/i }))
    expect(screen.getByText('Sensor data')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /plan/i }))
    expect(screen.getByText('Mission planner')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /setup/i }))
    expect(screen.getByText('Mission setup')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /^run$/i }))
    expect(screen.getByText('Run mode')).toBeInTheDocument()
    expect(screen.getByText('Run timeline')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /review/i }))
    expect(screen.getByText('Post-mission review')).toBeInTheDocument()
  })

  it('shows mission route tools and selects samples from the route list', async () => {
    render(<App />)
    fireEvent.click(await screen.findByRole('button', { name: /advanced/i }))
    await waitFor(() => expect(screen.getByText('Route tools')).toBeInTheDocument())

    expect(screen.getByText('Mission inspection')).toBeInTheDocument()
    expect(screen.getByText('Route length')).toBeInTheDocument()
    expect(screen.getByText('Sample 1 of 2')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /#2/i }))
    expect(screen.getByText('Sample 2 of 2')).toBeInTheDocument()
    expect(screen.getAllByText('17.10 deg C').length).toBeGreaterThan(0)
  })

  it('collapses and restores the playback bar', async () => {
    render(<App />)
    fireEvent.click(await screen.findByRole('button', { name: /advanced/i }))
    await waitFor(() => expect(screen.getByLabelText('Hide playback controls')).toBeInTheDocument())

    fireEvent.click(screen.getByLabelText('Hide playback controls'))
    expect(screen.getByLabelText('Show playback controls')).toBeInTheDocument()

    fireEvent.click(screen.getByLabelText('Show playback controls'))
    expect(screen.getByLabelText('Hide playback controls')).toBeInTheDocument()
  })

  it('uses light theme by default and can switch themes', async () => {
    const { container } = render(<App />)
    fireEvent.click(await screen.findByRole('button', { name: /advanced/i }))
    await waitFor(() => expect(screen.getByRole('button', { name: /dark/i })).toBeInTheDocument())

    expect(container.querySelector('.app-shell')).toHaveAttribute('data-theme', 'light')
    fireEvent.click(screen.getByRole('button', { name: /dark/i }))
    expect(container.querySelector('.app-shell')).toHaveAttribute('data-theme', 'dark')
  })

  it('adds and edits waypoints in the planner', async () => {
    render(<App />)
    fireEvent.click(await screen.findByRole('button', { name: /advanced/i }))
    fireEvent.click(await screen.findByRole('button', { name: /plan/i }))
    await waitFor(() => expect(screen.getByText('Waypoint 1')).toBeInTheDocument())

    fireEvent.click(screen.getByRole('button', { name: /add/i }))
    expect(screen.getByText('Waypoint 2')).toBeInTheDocument()
    expect(screen.getAllByText('3').length).toBeGreaterThan(0)

    const latitudeInput = screen.getByLabelText('Latitude')
    fireEvent.change(latitudeInput, { target: { value: '37.426000' } })
    expect(latitudeInput).toHaveValue(37.426)
  })

  it('saves local project files and shows hardware preflight status', async () => {
    render(<App />)
    fireEvent.click(await screen.findByRole('button', { name: /advanced/i }))
    fireEvent.click(await screen.findByRole('button', { name: /plan/i }))
    await waitFor(() => expect(screen.getByText('Project files')).toBeInTheDocument())

    fireEvent.change(screen.getByLabelText('Project name'), { target: { value: 'Harbor run' } })
    fireEvent.click(screen.getByRole('button', { name: /^save/i }))
    expect(screen.getByText('Harbor run')).toBeInTheDocument()
    expect(screen.getByText('Execution prep')).toBeInTheDocument()
    expect(screen.getByText('Mission blocked')).toBeInTheDocument()
    expect(screen.getByText('Boat link')).toBeInTheDocument()
  })

  it('shows simulator controls and upload protocol design', async () => {
    render(<App />)
    fireEvent.click(await screen.findByRole('button', { name: /advanced/i }))
    fireEvent.click(await screen.findByRole('button', { name: /drive/i }))
    expect(screen.getByText('Use simulator')).toBeInTheDocument()
    fireEvent.click(screen.getByLabelText(/use simulator/i))
    expect(screen.getByText('Control source')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /plan/i }))
    await waitFor(() => expect(screen.getByText('Upload protocol')).toBeInTheDocument())
    expect(screen.getByText(/Protocol preview only/i)).toBeInTheDocument()
    expect(screen.getByText(/mission_upload_begin/i)).toBeInTheDocument()
  })

  it('shows research analysis scaffolding in the AI tab', async () => {
    render(<App />)
    fireEvent.click(await screen.findByRole('button', { name: /advanced/i }))
    fireEvent.click(screen.getByRole('button', { name: /^AI$/i }))
    await waitFor(() => expect(screen.getByText('Research analysis')).toBeInTheDocument())
    expect(screen.getByText('Nighttime oxygen-trap mapping')).toBeInTheDocument()
    expect(screen.getByText('Stormwater fingerprint atlas')).toBeInTheDocument()
    expect(screen.getAllByText('AI/model plan').length).toBe(2)
    expect(screen.getByText('ONNX install controls')).toBeInTheDocument()
    expect(screen.getByLabelText('Metadata URL')).toBeInTheDocument()
  })

  it('starts in simple drive mode and can switch to advanced', async () => {
    render(<App />)
    await waitFor(() => expect(screen.getByText('Boat drive')).toBeInTheDocument())
    expect(screen.getByText('Driving enabled')).toBeInTheDocument()
    expect(screen.getByText('Advanced')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /advanced/i }))
    expect(screen.getByText('Mission control')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /simple/i })).toBeInTheDocument()
  })
})
