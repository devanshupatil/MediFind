import React, { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { StatsRow } from '../components/StatsRow'
import { MedicineForm } from '../components/MedicineForm'

export function AdminDashboardPage() {
  const { logout } = useAuth()
  const [medicines, setMedicines] = useState([])
  const [query, setQuery] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [editTarget, setEditTarget] = useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null)

  const loadMedicines = async () => {
    const { data } = await supabase.from('medicines').select('*')
    if (data) setMedicines(data)
  }

  useEffect(() => { loadMedicines() }, [])

  const filtered = medicines.filter(m =>
    m.name.toLowerCase().includes(query.toLowerCase())
  )

  const handleAdd = async (values) => {
    await supabase.from('medicines').insert(values).select()
    await loadMedicines()
    setShowForm(false)
  }

  const handleEdit = async (values) => {
    await supabase.from('medicines').update(values).eq('id', editTarget.id)
    await loadMedicines()
    setEditTarget(null)
  }

  const handleDelete = async () => {
    await supabase.from('medicines').delete().eq('id', deleteTarget.id)
    await loadMedicines()
    setDeleteTarget(null)
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-blue-700 text-white px-6 py-3 flex justify-between items-center">
        <span className="font-bold text-lg">💊 MediFind Admin</span>
        <button onClick={logout} className="text-sm text-blue-200 hover:text-white">Logout</button>
      </nav>

      <div className="max-w-4xl mx-auto px-4 py-8">
        <StatsRow medicines={medicines} />

        <div className="bg-white rounded-xl shadow-sm p-6">
          <div className="flex justify-between items-center mb-4">
            <input
              type="text"
              placeholder="Search medicines..."
              value={query}
              onChange={e => setQuery(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-56"
            />
            <button
              onClick={() => { setShowForm(true); setEditTarget(null) }}
              className="bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-800"
            >
              + Add Medicine
            </button>
          </div>

          {(showForm && !editTarget) && (
            <div className="mb-4">
              <MedicineForm onSubmit={handleAdd} onCancel={() => setShowForm(false)} />
            </div>
          )}

          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-gray-500 uppercase border-b">
                <th className="pb-2 font-semibold">Name</th>
                <th className="pb-2 font-semibold">Price</th>
                <th className="pb-2 font-semibold">Quantity</th>
                <th className="pb-2 font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(m => (
                <React.Fragment key={m.id}>
                  <tr className="border-b last:border-0">
                    <td className="py-3 font-medium text-gray-900">{m.name}</td>
                    <td className="py-3 text-gray-600">₹{m.price}</td>
                    <td className={`py-3 font-medium ${m.quantity === 0 ? 'text-red-600' : 'text-gray-900'}`}>
                      {m.quantity}
                    </td>
                    <td className="py-3 flex gap-2">
                      <button
                        onClick={() => { setEditTarget(m); setShowForm(false) }}
                        className="text-blue-600 hover:text-blue-800 text-xs font-medium"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => setDeleteTarget(m)}
                        className="text-red-500 hover:text-red-700 text-xs font-medium"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                  {editTarget?.id === m.id && (
                    <tr>
                      <td colSpan={4} className="py-2">
                        <MedicineForm medicine={editTarget} onSubmit={handleEdit} onCancel={() => setEditTarget(null)} />
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {deleteTarget && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 max-w-sm w-full mx-4 shadow-xl">
            <p className="text-gray-900 font-medium mb-1">Are you sure?</p>
            <p className="text-gray-500 text-sm mb-4">
              Delete <strong>{deleteTarget.name}</strong>? This cannot be undone.
            </p>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setDeleteTarget(null)} className="px-4 py-2 text-sm bg-gray-100 rounded-lg hover:bg-gray-200">
                Cancel
              </button>
              <button onClick={handleDelete} className="px-4 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700">
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
