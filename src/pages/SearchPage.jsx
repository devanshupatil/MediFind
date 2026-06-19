import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

export function SearchPage() {
  const [medicines, setMedicines] = useState([])
  const [query, setQuery] = useState('')

  useEffect(() => {
    supabase.from('medicines').select('*').then(({ data }) => {
      if (data) setMedicines(data)
    })
  }, [])

  const filtered = medicines.filter(m =>
    m.name.toLowerCase().includes(query.toLowerCase())
  )

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-blue-700 text-white px-6 py-3 flex justify-between items-center">
        <span className="font-bold text-lg">💊 MediFind</span>
        <span className="text-sm text-blue-200">Sharma Medical Store</span>
      </nav>

      <div className="max-w-2xl mx-auto px-4 py-8">
        <div className="flex gap-2 mb-6">
          <input
            type="text"
            placeholder="Search medicine name..."
            value={query}
            onChange={e => setQuery(e.target.value)}
            className="flex-1 border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {filtered.length === 0 && query && (
          <p className="text-gray-500 text-center py-8">No medicines found for "{query}"</p>
        )}

        <ul className="space-y-2">
          {filtered.map(m => (
            <li key={m.id} className="bg-white rounded-lg px-4 py-3 flex justify-between items-center shadow-sm">
              <div>
                <p className="font-medium text-gray-900">{m.name}</p>
                <p className="text-sm text-gray-500">₹{m.price}</p>
              </div>
              {m.quantity > 0 ? (
                <span className="bg-green-100 text-green-700 text-xs font-medium px-2.5 py-1 rounded-full">
                  In Stock
                </span>
              ) : (
                <span className="bg-red-100 text-red-700 text-xs font-medium px-2.5 py-1 rounded-full">
                  Out of Stock
                </span>
              )}
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
