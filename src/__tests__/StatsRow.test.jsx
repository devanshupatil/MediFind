import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { StatsRow } from '../components/StatsRow'

const medicines = [
  { id: '1', name: 'A', price: 10, quantity: 5 },
  { id: '2', name: 'B', price: 20, quantity: 0 },
  { id: '3', name: 'C', price: 30, quantity: 2 },
]

describe('StatsRow', () => {
  it('shows total count', () => {
    render(<StatsRow medicines={medicines} />)
    expect(screen.getByText('3')).toBeInTheDocument()
  })

  it('shows in stock count', () => {
    render(<StatsRow medicines={medicines} />)
    expect(screen.getByText('2')).toBeInTheDocument()
  })

  it('shows out of stock count', () => {
    render(<StatsRow medicines={medicines} />)
    expect(screen.getByText('1')).toBeInTheDocument()
  })
})
