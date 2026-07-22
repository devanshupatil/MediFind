import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { vi, describe, it, expect, beforeEach } from 'vitest'

vi.mock('../lib/supabase', () => ({
  supabase: {
    from: vi.fn(),
  },
}))
vi.mock('../hooks/useAuth', () => ({
  useAuth: vi.fn(),
}))

import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { AdminDashboardPage } from '../pages/AdminDashboardPage'

const mockMedicines = [
  { id: '1', name: 'Paracetamol', price: 12, quantity: 50 },
  { id: '2', name: 'Amoxicillin', price: 45, quantity: 0 },
]

function mockSupabase(data = mockMedicines) {
  const chain = {}
  chain.select = vi.fn().mockReturnValue(chain)
  chain.insert = vi.fn().mockReturnValue(chain)
  chain.update = vi.fn().mockReturnValue(chain)
  chain.delete = vi.fn().mockReturnValue(chain)
  chain.eq = vi.fn().mockReturnValue(chain)
  chain.gte = vi.fn().mockReturnValue(chain)
  chain.then = vi.fn().mockImplementation((resolve) => {
    resolve({ data, error: null })
  })
  supabase.from.mockReturnValue(chain)
  return chain
}


describe('AdminDashboardPage', () => {
  beforeEach(() => {
    useAuth.mockReturnValue({ logout: vi.fn(), session: { user: { id: '1' } } })
    mockSupabase()
  })

  it('shows medicine names after load', async () => {
    render(<MemoryRouter><AdminDashboardPage /></MemoryRouter>)
    expect(await screen.findByText('Paracetamol')).toBeInTheDocument()
    expect(await screen.findByText('Amoxicillin')).toBeInTheDocument()
  })

  it('filters table by search input', async () => {
    render(<MemoryRouter><AdminDashboardPage /></MemoryRouter>)
    await screen.findByText('Paracetamol')
    fireEvent.change(screen.getByPlaceholderText(/search/i), { target: { value: 'para' } })
    expect(screen.getByText('Paracetamol')).toBeInTheDocument()
    expect(screen.queryByText('Amoxicillin')).not.toBeInTheDocument()
  })

  it('shows the Add Medicine form when Add button is clicked', async () => {
    render(<MemoryRouter><AdminDashboardPage /></MemoryRouter>)
    await screen.findByText('Paracetamol')
    fireEvent.click(screen.getByRole('button', { name: /add medicine/i }))
    expect(screen.getByLabelText(/^name$/i)).toBeInTheDocument()
  })

  it('shows delete confirmation when Delete is clicked', async () => {
    render(<MemoryRouter><AdminDashboardPage /></MemoryRouter>)
    const deleteButtons = await screen.findAllByRole('button', { name: /delete/i })
    fireEvent.click(deleteButtons[0])
    expect(screen.getByText(/are you sure/i)).toBeInTheDocument()
  })
})
