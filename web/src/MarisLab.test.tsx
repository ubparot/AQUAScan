import { fireEvent, render, screen } from '@testing-library/react'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import MarisLab from './MarisLab'

vi.mock('recharts', async () => {
  const actual = await vi.importActual<typeof import('recharts')>('recharts')
  const MockResponsiveContainer = ({ children }: { children: ReactNode }) => <div data-testid="chart">{children}</div>
  return { ...actual, ResponsiveContainer: MockResponsiveContainer }
})

describe('MarisLab', () => {
  beforeEach(() => {
    vi.stubGlobal('URL', {
      createObjectURL: vi.fn(() => 'blob:maris'),
      revokeObjectURL: vi.fn(),
    })
  })

  it('renders as a standalone tech console without map controls', () => {
    render(<MarisLab />)

    expect(screen.getByRole('heading', { name: 'Maris' })).toBeInTheDocument()
    expect(screen.getByText('Graph generator')).toBeInTheDocument()
    expect(screen.getByText('Sensor cascade graph generator')).toBeInTheDocument()
    expect(screen.getByText('Correlation matrix')).toBeInTheDocument()
    expect(screen.getByText('Packet waterfall')).toBeInTheDocument()
    expect(screen.queryByText(/mission control/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/map/i)).not.toBeInTheDocument()
  })

  it('switches graph modes and generates new graph packets', () => {
    render(<MarisLab />)

    fireEvent.click(screen.getByRole('button', { name: /spectral/i }))
    expect(screen.getByText('Spectral decomposition graph')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /generate/i }))
    expect(screen.getByText(/Generated spectral graph packet/i)).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /risk/i }))
    expect(screen.getByText('Risk-vector scatter synthesis')).toBeInTheDocument()
  })

  it('exports a synthetic report packet', () => {
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined)
    render(<MarisLab />)

    fireEvent.click(screen.getByRole('button', { name: /export/i }))

    expect(URL.createObjectURL).toHaveBeenCalled()
    expect(click).toHaveBeenCalled()
    expect(screen.getByText('Exported graph snapshot JSON')).toBeInTheDocument()
  })
})
