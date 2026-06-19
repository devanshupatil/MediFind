import { useState } from 'react'

export function MedicineForm({ medicine, onSubmit, onCancel }) {
  const [name, setName] = useState(medicine?.name ?? '')
  const [price, setPrice] = useState(medicine?.price ?? '')
  const [quantity, setQuantity] = useState(medicine?.quantity ?? '')
  const [error, setError] = useState('')

  const handleSubmit = e => {
    e.preventDefault()
    if (!name.trim()) { setError('Name is required'); return }
    if (Number(price) <= 0) { setError('Price must be positive'); return }
    if (Number(quantity) < 0) { setError('Quantity cannot be negative'); return }
    onSubmit({ name: name.trim(), price: Number(price), quantity: Number(quantity) })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3 bg-blue-50 p-4 rounded-lg border border-blue-200">
      <div className="grid grid-cols-3 gap-3">
        <div>
          <label htmlFor="med-name" className="block text-xs font-medium text-gray-700 mb-1">Name</label>
          <input
            id="med-name"
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div>
          <label htmlFor="med-price" className="block text-xs font-medium text-gray-700 mb-1">Price (₹)</label>
          <input
            id="med-price"
            type="number"
            min="0"
            step="0.01"
            value={price}
            onChange={e => setPrice(e.target.value)}
            className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div>
          <label htmlFor="med-quantity" className="block text-xs font-medium text-gray-700 mb-1">Quantity</label>
          <input
            id="med-quantity"
            type="number"
            min="0"
            value={quantity}
            onChange={e => setQuantity(e.target.value)}
            className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>
      {error && <p className="text-red-600 text-xs">{error}</p>}
      <div className="flex gap-2">
        <button type="submit" className="bg-blue-700 text-white px-4 py-1.5 rounded text-sm font-medium hover:bg-blue-800">
          Save
        </button>
        <button type="button" onClick={onCancel} className="bg-gray-200 text-gray-700 px-4 py-1.5 rounded text-sm font-medium hover:bg-gray-300">
          Cancel
        </button>
      </div>
    </form>
  )
}
