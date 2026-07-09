import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { StatsRow } from '../components/StatsRow'
import { MedicineForm } from '../components/MedicineForm'

// ── Icons ─────────────────────────────────────────────────────

function IconPill() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="m10.5 20.5 10-10a4.95 4.95 0 1 0-7-7l-10 10a4.95 4.95 0 1 0 7 7Z" />
      <path d="m8.5 8.5 7 7" />
    </svg>
  )
}

function IconPlus() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  )
}

function IconSearch() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.35-4.35" />
    </svg>
  )
}

function IconEdit() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
    </svg>
  )
}

function IconTrash() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
      <path d="M10 11v6M14 11v6" />
      <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
    </svg>
  )
}

function IconLogout() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <polyline points="16 17 21 12 16 7" />
      <line x1="21" y1="12" x2="9" y2="12" />
    </svg>
  )
}

// ── Stock Badge ───────────────────────────────────────────────

function StockBadge({ quantity }) {
  const qty = quantity ?? 0
  if (qty === 0)  return <span className="sp-badge sp-badge-danger">Out of Stock</span>
  if (qty <= 5)   return <span className="sp-badge sp-badge-warning"><span className="sp-dot" />Low Stock</span>
  return               <span className="sp-badge sp-badge-success"><span className="sp-dot" />In Stock</span>
}

// ── Delete Confirm Modal ──────────────────────────────────────

function DeleteConfirm({ medicine, onConfirm, onCancel }) {
  return (
    <AnimatePresence>
      <motion.div
        className="adm-modal-backdrop"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onCancel}
        aria-hidden="true"
      />
      <motion.div
        className="adm-modal adm-modal--sm"
        role="dialog"
        aria-modal="true"
        aria-labelledby="adm-del-title"
        initial={{ opacity: 0, scale: 0.96, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 20 }}
        transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
      >
        <div className="adm-modal-header">
          <h2 id="adm-del-title" className="adm-modal-title">Delete Medicine</h2>
        </div>
        <div className="adm-form-body">
          <p className="adm-del-msg">
            Are you sure you want to delete <strong>{medicine.name}</strong>? This cannot be undone.
          </p>
        </div>
        <div className="adm-modal-footer">
          <button type="button" className="adm-btn adm-btn-ghost" onClick={onCancel}>Cancel</button>
          <button type="button" className="adm-btn adm-btn-danger" onClick={onConfirm}>Delete</button>
        </div>
      </motion.div>
    </AnimatePresence>
  )
}

// ── Dashboard Page ────────────────────────────────────────────

export function AdminDashboardPage() {
  const { session, logout } = useAuth()
  const [medicines,    setMedicines]    = useState([])
  const [query,        setQuery]        = useState('')
  const [loading,      setLoading]      = useState(true)
  const [scrolled,     setScrolled]     = useState(false)
  const [showForm,     setShowForm]     = useState(false)
  const [editTarget,   setEditTarget]   = useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [toast,        setToast]        = useState('')

  const displayEmail = session?.user?.email ?? 'Admin'

  // ── Data ────────────────────────────────────────────────────

  const loadMedicines = async () => {
    const { data } = await supabase.from('medicines').select('*')
    if (data) setMedicines(data)
    setLoading(false)
  }

  useEffect(() => { loadMedicines() }, [])

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  const showToast = (msg) => {
    setToast(msg)
    setTimeout(() => setToast(''), 2800)
  }

  // ── CRUD ────────────────────────────────────────────────────

  const handleAdd = async (values) => {
    await supabase.from('medicines').insert(values).select()
    await loadMedicines()
    setShowForm(false)
    showToast('Medicine added successfully')
  }

  const handleEdit = async (values) => {
    await supabase.from('medicines').update(values).eq('id', editTarget.id)
    await loadMedicines()
    setEditTarget(null)
    showToast('Medicine updated successfully')
  }

  const handleDelete = async () => {
    await supabase.from('medicines').delete().eq('id', deleteTarget.id)
    await loadMedicines()
    setDeleteTarget(null)
    showToast('Medicine deleted')
  }

  // ── Filter ──────────────────────────────────────────────────

  const filtered = medicines.filter(m =>
    m.name.toLowerCase().includes(query.toLowerCase())
  )

  // ── Render ──────────────────────────────────────────────────

  return (
    <div className="adm-root">

      {/* ── Header ── */}
      <header className={`sp-header${scrolled ? ' sp-header--scrolled' : ''}`}>
        <div className="sp-header-inner">
          <div className="sp-logo" aria-label="MediFind Admin">
            <div className="sp-logo-icon">
              <IconPill />
            </div>
            <span className="sp-logo-text">MediFind</span>
            <span className="adm-header-badge">Admin</span>
          </div>

          <div className="adm-header-right">
            <span className="adm-header-email">{displayEmail}</span>
            <button
              type="button"
              className="adm-btn adm-btn-ghost adm-btn--sm"
              onClick={logout}
              aria-label="Sign out"
            >
              <IconLogout />
              Sign out
            </button>
          </div>
        </div>
      </header>

      {/* ── Main ── */}
      <main className="adm-main">

        {/* Page title + Add button */}
        <div className="adm-page-head">
          <div>
            <h1 className="adm-page-title">Inventory</h1>
            <p className="adm-page-sub">Manage your medicine stock and pricing</p>
          </div>
          <button
            type="button"
            className="adm-btn adm-btn-primary"
            onClick={() => setShowForm(true)}
            aria-label="Add Medicine"
          >
            <IconPlus />
            Add Medicine
          </button>
        </div>

        {/* Stats row */}
        <StatsRow medicines={medicines} />

        {/* Search bar */}
        <div className="adm-toolbar">
          <div className="adm-search-wrap">
            <span className="adm-search-icon"><IconSearch /></span>
            <input
              type="text"
              className="adm-search-input"
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Search medicines..."
              aria-label="Search medicines"
            />
          </div>
          <span className="adm-count">
            {filtered.length} of {medicines.length} medicines
          </span>
        </div>

        {/* Table */}
        <div className="adm-table-wrap">
          {loading ? (
            <div className="adm-table-loading" aria-label="Loading medicines">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="adm-skel-row">
                  <div className="adm-skel-cell adm-skel-cell--name" />
                  <div className="adm-skel-cell adm-skel-cell--sm" />
                  <div className="adm-skel-cell adm-skel-cell--sm" />
                  <div className="adm-skel-cell adm-skel-cell--badge" />
                  <div className="adm-skel-cell adm-skel-cell--actions" />
                </div>
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="adm-empty">
              <p className="adm-empty-msg">
                {query ? `No medicines match "${query}"` : 'No medicines yet. Add one above.'}
              </p>
            </div>
          ) : (
            <table className="adm-table" aria-label="Medicine inventory">
              <thead>
                <tr>
                  <th className="adm-th">Medicine</th>
                  <th className="adm-th adm-th--right">Price (₹)</th>
                  <th className="adm-th adm-th--right">Qty</th>
                  <th className="adm-th">Status</th>
                  <th className="adm-th adm-th--right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((med, i) => (
                  <motion.tr
                    key={med.id}
                    className="adm-tr"
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: Math.min(i * 0.03, 0.3), duration: 0.3 }}
                  >
                    <td className="adm-td adm-td--name">{med.name}</td>
                    <td className="adm-td adm-td--right adm-td--price">₹{med.price ?? '—'}</td>
                    <td className="adm-td adm-td--right">{med.quantity ?? 0}</td>
                    <td className="adm-td"><StockBadge quantity={med.quantity} /></td>
                    <td className="adm-td adm-td--right">
                      <div className="adm-actions">
                        <button
                          type="button"
                          className="adm-action-btn adm-action-btn--edit"
                          onClick={() => setEditTarget(med)}
                          aria-label={`Edit ${med.name}`}
                        >
                          <IconEdit />
                          Edit
                        </button>
                        <button
                          type="button"
                          className="adm-action-btn adm-action-btn--delete"
                          onClick={() => setDeleteTarget(med)}
                          aria-label={`Delete ${med.name}`}
                        >
                          <IconTrash />
                          Delete
                        </button>
                      </div>
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </main>

      {/* ── Modals ── */}
      {showForm && (
        <MedicineForm
          onSubmit={handleAdd}
          onCancel={() => setShowForm(false)}
        />
      )}
      {editTarget && (
        <MedicineForm
          medicine={editTarget}
          onSubmit={handleEdit}
          onCancel={() => setEditTarget(null)}
        />
      )}
      {deleteTarget && (
        <DeleteConfirm
          medicine={deleteTarget}
          onConfirm={handleDelete}
          onCancel={() => setDeleteTarget(null)}
        />
      )}

      {/* ── Toast ── */}
      <AnimatePresence>
        {toast && (
          <motion.div
            className="adm-toast"
            role="status"
            aria-live="polite"
            initial={{ opacity: 0, y: 16, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.96 }}
            transition={{ duration: 0.25 }}
          >
            {toast}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
