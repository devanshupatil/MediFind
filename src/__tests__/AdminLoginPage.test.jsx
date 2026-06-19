import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { vi, describe, it, expect } from 'vitest'

vi.mock('../hooks/useAuth', () => ({
  useAuth: vi.fn(),
}))

import { useAuth } from '../hooks/useAuth'
import { AdminLoginPage } from '../pages/AdminLoginPage'

describe('AdminLoginPage', () => {
  it('renders email and password fields', () => {
    useAuth.mockReturnValue({ login: vi.fn(), session: null })
    render(<MemoryRouter><AdminLoginPage /></MemoryRouter>)
    expect(screen.getByLabelText(/username/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument()
  })

  it('shows error on failed login', async () => {
    const login = vi.fn().mockResolvedValue({ error: { message: 'Invalid credentials' } })
    useAuth.mockReturnValue({ login, session: null })
    render(<MemoryRouter><AdminLoginPage /></MemoryRouter>)
    fireEvent.change(screen.getByLabelText(/username/i), { target: { value: 'wrong@email.com' } })
    fireEvent.change(screen.getByLabelText(/password/i), { target: { value: 'bad' } })
    fireEvent.click(screen.getByRole('button', { name: /login/i }))
    await waitFor(() => expect(screen.getByText(/Invalid credentials/i)).toBeInTheDocument())
  })
})
