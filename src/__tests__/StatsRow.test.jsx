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
    const card = screen.getByText('Total Medicines').closest('.adm-stat-card')
    expect(card.querySelector('.adm-stat-value')).toHaveTextContent('3')
  })

  it('shows in stock count', () => {
    render(<StatsRow medicines={medicines} />)
    const card = screen.getByText('In Stock').closest('.adm-stat-card')
    expect(card.querySelector('.adm-stat-value')).toHaveTextContent('2')
  })

  it('shows out of stock count', () => {
    render(<StatsRow medicines={medicines} />)
    const card = screen.getByText('Out of Stock').closest('.adm-stat-card')
    expect(card.querySelector('.adm-stat-value')).toHaveTextContent('1')
  })
})

