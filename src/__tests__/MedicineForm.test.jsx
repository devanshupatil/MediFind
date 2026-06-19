import { render, screen, fireEvent } from '@testing-library/react'
import { vi, describe, it, expect } from 'vitest'
import { MedicineForm } from '../components/MedicineForm'

describe('MedicineForm', () => {
  it('renders empty form for adding', () => {
    render(<MedicineForm onSubmit={vi.fn()} onCancel={vi.fn()} />)
    expect(screen.getByLabelText(/name/i)).toHaveValue('')
    expect(screen.getByLabelText(/price/i)).toHaveValue(null)
    expect(screen.getByLabelText(/quantity/i)).toHaveValue(null)
  })

  it('pre-fills form when medicine prop is provided', () => {
    const medicine = { name: 'Paracetamol', price: 12, quantity: 50 }
    render(<MedicineForm medicine={medicine} onSubmit={vi.fn()} onCancel={vi.fn()} />)
    expect(screen.getByLabelText(/name/i)).toHaveValue('Paracetamol')
  })

  it('calls onSubmit with form values on submit', () => {
    const onSubmit = vi.fn()
    render(<MedicineForm onSubmit={onSubmit} onCancel={vi.fn()} />)
    fireEvent.change(screen.getByLabelText(/name/i), { target: { value: 'Aspirin' } })
    fireEvent.change(screen.getByLabelText(/price/i), { target: { value: '25' } })
    fireEvent.change(screen.getByLabelText(/quantity/i), { target: { value: '10' } })
    fireEvent.click(screen.getByRole('button', { name: /save/i }))
    expect(onSubmit).toHaveBeenCalledWith({ name: 'Aspirin', price: 25, quantity: 10 })
  })

  it('does not submit when name is empty', () => {
    const onSubmit = vi.fn()
    render(<MedicineForm onSubmit={onSubmit} onCancel={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: /save/i }))
    expect(onSubmit).not.toHaveBeenCalled()
  })
})
