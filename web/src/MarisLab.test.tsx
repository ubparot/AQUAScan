import { readFileSync } from 'node:fs'
import { fireEvent, render, screen, within } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import MarisLab from './MarisLab'

vi.mock('recharts', async () => {
  const actual = await vi.importActual<typeof import('recharts')>('recharts')
  const MockResponsiveContainer = ({ children }: { children: ReactNode }) => <div data-testid="chart">{children}</div>
  return { ...actual, ResponsiveContainer: MockResponsiveContainer }
})

const originalUrl = globalThis.URL

describe('Maris', () => {
  beforeEach(() => {
    // Serve the real sample missions from public/.
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      const body = readFileSync(`public${url}`, 'utf8')
      return { ok: true, status: 200, statusText: 'OK', text: async () => body }
    }))
    vi.stubGlobal('URL', Object.assign(function URL() {}, {
      createObjectURL: vi.fn(() => 'blob:maris'),
      revokeObjectURL: vi.fn(),
    }))
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    globalThis.URL = originalUrl
  })

  it('opens on the pond profiles with real findings', async () => {
    render(<MarisLab />)

    expect(screen.getByRole('heading', { level: 1, name: 'Maris' })).toBeInTheDocument()
    expect(await screen.findByText(/Dissolved oxygen ranged from 0\.59 mg\/L/)).toBeInTheDocument()
    expect(screen.getByText(/Severely low oxygen/)).toBeInTheDocument()
    expect(screen.getByText('Readings').nextSibling).toHaveTextContent('67')
    expect(screen.queryByText(/congressional|app challenge|console/i)).not.toBeInTheDocument()
  })

  it('switches measurement and dataset', async () => {
    render(<MarisLab />)
    await screen.findByText(/Dissolved oxygen ranged from/)

    fireEvent.click(screen.getByRole('button', { name: 'Temperature' }))
    expect(screen.getByText(/^Temperature ranged from/)).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Pond transect' }))
    expect(await screen.findByText('Locations')).toBeInTheDocument()
    expect(screen.getByText('Readings').nextSibling).toHaveTextContent('20')
  })

  it('selects a location from the readings table', async () => {
    render(<MarisLab />)
    await screen.findByText(/Dissolved oxygen ranged from/)

    const table = screen.getByRole('table')
    fireEvent.click(within(table).getAllByText('Station 2')[0])
    expect(screen.getByRole('button', { name: /^Station 2:/, pressed: true })).toBeInTheDocument()
  })

  it('analyzes an uploaded CSV without sending it anywhere', async () => {
    render(<MarisLab />)
    await screen.findByText(/Dissolved oxygen ranged from/)

    const csv = 'timestamp,latitude,longitude,depth,do,temperature\n2026-01-01T00:00:00Z,37.0,-122.0,0.2,8.1,20\n2026-01-01T00:00:10Z,37.0,-122.0,1.5,4.2,18\n'
    const file = new File([csv], 'my-lake.csv', { type: 'text/csv' })
    fireEvent.change(screen.getByLabelText(/upload a mission csv or json file/i), { target: { files: [file] } })

    expect(await screen.findByRole('button', { name: 'my-lake', pressed: true })).toBeInTheDocument()
    expect(screen.getByText(/Below 5 mg\/L in 1 reading/)).toBeInTheDocument()
    expect(screen.getByText(/stays in this browser/)).toBeInTheDocument()
  })

  it('exports a summary file', async () => {
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined)
    render(<MarisLab />)
    await screen.findByText(/Dissolved oxygen ranged from/)

    fireEvent.click(screen.getByRole('button', { name: /export summary/i }))
    expect(URL.createObjectURL).toHaveBeenCalled()
    expect(click).toHaveBeenCalled()
  })
})
