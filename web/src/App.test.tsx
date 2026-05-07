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
    await waitFor(() => expect(screen.getByText('demo-mission')).toBeInTheDocument())
    expect(screen.getByTestId('boat-scene')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /drive/i }))
    expect(screen.getByText('Live drive')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /^AI$/i }))
    expect(screen.getByText('AI inference')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /sensors/i }))
    expect(screen.getByText('Sensor data')).toBeInTheDocument()
  })
})
