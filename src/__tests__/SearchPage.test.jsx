import { render, screen, fireEvent } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach } from 'vitest'

vi.mock('../lib/supabase', () => ({
  supabase: {
    from: vi.fn(),
  },
}))

import { supabase } from '../lib/supabase'
import { SearchPage } from '../pages/SearchPage'

const mockMedicines = [
  { id: '1', name: 'Paracetamol', price: 12, quantity: 50 },
  { id: '2', name: 'Amoxicillin', price: 45, quantity: 0 },
]

describe('SearchPage', () => {
  beforeEach(() => {
    supabase.from.mockReturnValue({
      select: vi.fn().mockResolvedValue({ data: mockMedicines, error: null }),
    })
  })

  it('shows search input', () => {
    render(<SearchPage />)
    expect(screen.getByPlaceholderText(/search medicine/i)).toBeInTheDocument()
  })

  it('filters medicines by name', async () => {
    render(<SearchPage />)
    const medicines = await screen.findAllByRole('listitem')
    expect(medicines).toHaveLength(2)
    fireEvent.change(screen.getByPlaceholderText(/search medicine/i), {
      target: { value: 'para' },
    })
    expect(screen.getByText(/Paracetamol/i)).toBeInTheDocument()
    expect(screen.queryByText(/Amoxicillin/i)).not.toBeInTheDocument()
  })

  it('shows Out of Stock badge when quantity is 0', async () => {
    render(<SearchPage />)
    await screen.findAllByRole('listitem')
    expect(screen.getByText(/Out of Stock/i)).toBeInTheDocument()
  })

  it('shows In Stock badge when quantity > 0', async () => {
    render(<SearchPage />)
    await screen.findAllByRole('listitem')
    expect(screen.getByText(/In Stock/i)).toBeInTheDocument()
  })
})
