import React, { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { StatsRow } from '../components/StatsRow'
import { MedicineForm } from '../components/MedicineForm'
import { BackgroundScene } from '../components/BackgroundScene'

export function AdminDashboardPage() {
  const { session, logout } = useAuth()
  const [medicines, setMedicines] = useState([])
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editTarget, setEditTarget] = useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null)

  const displayEmail = session?.user?.email ?? 'Admin'

  const loadMedicines = async () => {
    const { data } = await supabase.from('medicines').select('*')
    if (data) setMedicines(data)
    setLoading(false)
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

  function statusBadge(quantity) {
    if (quantity === 0)
      return (
        <span className="inline-flex items-center gap-1.5 bg-red-50 text-red-600 text-xs font-semibold px-2.5 py-1 rounded-full border border-red-100/80">
          <span className="w-1.5 h-1.5 rounded-full bg-red-400 flex-shrink-0" />
          Out of Stock
        </span>
      )
    if (quantity <= 10)
      return (
        <span className="inline-flex items-center gap-1.5 bg-amber-50 text-amber-700 text-xs font-semibold px-2.5 py-1 rounded-full border border-amber-100/80">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-400 flex-shrink-0" />
          Low Stock
        </span>
      )
    return (
      <span className="inline-flex items-center gap-1.5 bg-emerald-50 text-emerald-700 text-xs font-semibold px-2.5 py-1 rounded-full border border-emerald-100/80">
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 flex-shrink-0" />
        In Stock
      </span>
    )
  }

  return (
    <div className="min-h-screen bg-mesh relative">
      <BackgroundScene />
      {/* ── TOPBAR ──────────────────────────────────────────────────────────── */}
      <div className="relative z-10 bg-gradient-to-r from-[#1a3554] via-[#1e3a5f] to-blue-700 px-6 py-3.5 flex justify-between items-center shadow-xl shadow-blue-950/25">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-white/15 rounded-xl flex items-center justify-center border border-white/20 backdrop-blur-sm">
            <PillIcon />
          </div>
          <span className="font-display font-bold text-lg text-white tracking-tight">MediFind</span>
          <span className="hidden sm:inline bg-white/15 text-white/90 text-[11px] font-bold px-2.5 py-0.5 rounded-full border border-white/15 tracking-wide uppercase">
            Admin
          </span>
        </div>
        <div className="flex items-center gap-4">
          <div className="hidden sm:flex items-center gap-2 bg-white/10 px-3 py-1.5 rounded-full border border-white/10">
            <UserIcon />
            <span className="text-blue-100 text-sm truncate max-w-[160px] font-medium">{displayEmail}</span>
          </div>
          <button
            onClick={logout}
            className="flex items-center gap-1.5 text-sm text-blue-200 hover:text-white transition-colors cursor-pointer font-medium group"
          >
            <LogoutIcon />
            <span className="hidden sm:inline group-hover:text-white">Logout</span>
          </button>
        </div>
      </div>

      <div className="relative z-10 max-w-5xl mx-auto px-4 py-6">
        <StatsRow medicines={medicines} />

        {/* ── INVENTORY PANEL ─────────────────────────────────────────────── */}
        <div className="bg-white rounded-2xl shadow-sm shadow-slate-200/80 border border-gray-100/80 overflow-hidden">

          {/* Panel toolbar */}
          <div className="flex flex-wrap gap-3 justify-between items-center px-6 py-4 border-b border-gray-100/80 bg-gradient-to-r from-gray-50/80 to-white">
            <div className="relative">
              <SearchIcon />
              <input
                type="text"
                placeholder="Search medicines..."
                value={query}
                onChange={e => setQuery(e.target.value)}
                className="pl-9 pr-4 py-2 bg-white border border-gray-200/80 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400/40 w-56 transition-all duration-200"
              />
            </div>
            <button
              onClick={() => { setShowForm(true); setEditTarget(null) }}
              className="flex items-center gap-1.5 bg-gradient-to-b from-blue-600 to-blue-700 text-white px-4 py-2 rounded-xl text-sm font-semibold hover:from-blue-500 hover:to-blue-600 transition-all duration-200 cursor-pointer whitespace-nowrap shadow-md shadow-blue-500/25 active:scale-95"
            >
              <PlusIcon />
              Add Medicine
            </button>
          </div>

          {(showForm && !editTarget) && (
            <div className="border-b border-gray-100 p-5 bg-gradient-to-r from-blue-50/60 to-indigo-50/30">
              <MedicineForm onSubmit={handleAdd} onCancel={() => setShowForm(false)} />
            </div>
          )}

          {/* Table */}
          <div className="overflow-x-auto">
            {loading ? (
              <SkeletonTable />
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100/80 bg-gray-50/60">
                    {['Name', 'Price (₹)', 'Qty', 'Status', 'Actions'].map(h => (
                      <th key={h} className="px-6 py-3.5 text-left text-[11px] font-bold text-slate-500 uppercase tracking-widest">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((m, idx) => (
                    <React.Fragment key={m.id}>
                      <tr className={`border-b border-gray-50 hover:bg-blue-50/25 transition-colors duration-150 ${idx % 2 === 1 ? 'bg-slate-50/30' : 'bg-white'}`}>
                        <td className="px-6 py-4 font-semibold text-gray-900 font-display">{m.name}</td>
                        <td className="px-6 py-4 text-slate-600 font-medium">₹{m.price}</td>
                        <td className="px-6 py-4 text-slate-700 font-bold">{m.quantity}</td>
                        <td className="px-6 py-4">{statusBadge(m.quantity)}</td>
                        <td className="px-6 py-4">
                          <div className="flex gap-3">
                            <button
                              onClick={() => { setEditTarget(m); setShowForm(false) }}
                              className="text-blue-600 hover:text-blue-800 text-xs font-bold cursor-pointer transition-colors hover:underline underline-offset-2"
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => setDeleteTarget(m)}
                              className="text-red-500 hover:text-red-700 text-xs font-bold cursor-pointer transition-colors hover:underline underline-offset-2"
                            >
                              Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                      {editTarget?.id === m.id && (
                        <tr>
                          <td colSpan={5} className="px-6 py-5 bg-blue-50/50 border-l-4 border-blue-500">
                            <MedicineForm medicine={editTarget} onSubmit={handleEdit} onCancel={() => setEditTarget(null)} />
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  ))}
                  {filtered.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-6 py-16 text-center">
                        <EmptyTableIcon />
                        <p className="text-slate-400 text-sm font-medium mt-3">
                          {query ? `No medicines match "${query}"` : 'No medicines yet — add your first one above'}
                        </p>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            )}
          </div>

          {/* Footer */}
          {!loading && medicines.length > 0 && (
            <div className="px-6 py-3 border-t border-gray-100/80 bg-gray-50/40 flex items-center justify-between">
              <p className="text-xs text-slate-400 font-medium">
                Showing <span className="text-slate-600 font-semibold">{filtered.length}</span> of <span className="text-slate-600 font-semibold">{medicines.length}</span> medicines
              </p>
              {filtered.length < medicines.length && (
                <button
                  onClick={() => setQuery('')}
                  className="text-xs text-blue-500 hover:text-blue-700 font-semibold cursor-pointer transition-colors"
                >
                  Clear filter
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── DELETE MODAL ────────────────────────────────────────────────────── */}
      {deleteTarget && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-2xl border border-gray-100 animate-fade-up">
            <div className="w-12 h-12 bg-red-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <TrashIcon />
            </div>
            <p className="text-gray-900 font-display font-bold text-lg text-center mb-1">Delete medicine?</p>
            <p className="text-slate-500 text-sm text-center mb-6 leading-relaxed">
              Remove <strong className="text-gray-700">{deleteTarget.name}</strong> from inventory?<br />This cannot be undone.
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setDeleteTarget(null)}
                className="flex-1 px-4 py-2.5 text-sm bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl font-semibold cursor-pointer transition-colors active:scale-95"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                className="flex-1 px-4 py-2.5 text-sm bg-gradient-to-b from-red-500 to-red-600 hover:from-red-400 hover:to-red-500 text-white rounded-xl font-semibold cursor-pointer transition-all shadow-md shadow-red-200 active:scale-95"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function SkeletonTable() {
  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="border-b border-gray-100/80 bg-gray-50/60">
          {['Name', 'Price (₹)', 'Qty', 'Status', 'Actions'].map(h => (
            <th key={h} className="px-6 py-3.5 text-left text-[11px] font-bold text-slate-500 uppercase tracking-widest">{h}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {[1, 2, 3, 4, 5].map(i => (
          <tr key={i} className="border-b border-gray-50 animate-pulse">
            <td className="px-6 py-4"><div className="h-3.5 bg-slate-200/70 rounded-lg w-36" /></td>
            <td className="px-6 py-4"><div className="h-3.5 bg-slate-200/70 rounded-lg w-12" /></td>
            <td className="px-6 py-4"><div className="h-3.5 bg-slate-200/70 rounded-lg w-8" /></td>
            <td className="px-6 py-4"><div className="h-6 bg-slate-200/70 rounded-full w-20" /></td>
            <td className="px-6 py-4"><div className="h-3.5 bg-slate-200/70 rounded-lg w-16" /></td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

// ── Icons ──────────────────────────────────────────────────────────────────────
function PillIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={17} height={17} viewBox="0 0 24 24"
      fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"
      className="text-white flex-shrink-0">
      <path d="m10.5 20.5 10-10a4.95 4.95 0 1 0-7-7l-10 10a4.95 4.95 0 1 0 7 7Z" />
      <path d="M8.5 8.5 15.5 15.5" />
    </svg>
  )
}

function UserIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={12} height={12} viewBox="0 0 24 24"
      fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
      className="text-blue-200">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" />
    </svg>
  )
}

function LogoutIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={14} height={14} viewBox="0 0 24 24"
      fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" />
    </svg>
  )
}

function SearchIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={15} height={15} viewBox="0 0 24 24"
      fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
      className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none">
      <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  )
}

function PlusIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={14} height={14} viewBox="0 0 24 24"
      fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  )
}

function TrashIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={20} height={20} viewBox="0 0 24 24"
      fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
      className="text-red-500">
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
      <path d="M10 11v6M14 11v6" />
      <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
    </svg>
  )
}

function EmptyTableIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={44} height={44} viewBox="0 0 24 24"
      fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"
      className="text-slate-300 mx-auto">
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <path d="M3 9h18M9 21V9" />
    </svg>
  )
}
