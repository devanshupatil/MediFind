import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { StatsRow } from '../components/StatsRow'
import { MedicineForm } from '../components/MedicineForm'
import { BulkEditTable } from '../components/BulkEditTable'

// ── Analytics Chart Component ──────────────────────────────

function BarChart({ items, colorClass }) {
  if (!items.length) {
    return (
      <div className="ga-empty">
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden="true">
          <path d="M3 3v18h18" /><path d="M18 9l-5 5-4-4-3 3" />
        </svg>
        <span>No data yet — events will appear here once users start searching or scanning.</span>
      </div>
    )
  }
  const max = items[0]?.count || 1
  return (
    <ol className="ga-bar-list">
      {items.map((item, i) => (
        <li key={i} className="ga-bar-item">
          <span className="ga-bar-label" title={item.name}>{item.name}</span>
          <div className="ga-bar-track">
            <motion.div
              className={`ga-bar-fill ${colorClass}`}
              initial={{ width: 0 }}
              animate={{ width: `${(item.count / max) * 100}%` }}
              transition={{ delay: i * 0.04, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
            />
          </div>
          <span className="ga-bar-count">{item.count}</span>
        </li>
      ))}
    </ol>
  )
}

function AnalyticsSection() {
  const [range,        setRange]        = useState('7d')
  const [searchData,   setSearchData]   = useState([])
  const [scanData,     setScanData]     = useState([])
  const [loading,      setLoading]      = useState(true)

  const load = useCallback(async (r) => {
    setLoading(true)
    const since = r === '7d'
      ? new Date(Date.now() - 7  * 86400000).toISOString()
      : r === '30d'
      ? new Date(Date.now() - 30 * 86400000).toISOString()
      : null

    const [{ data: sData }, { data: cData }] = await Promise.all([
      since
        ? supabase.from('search_logs').select('query').gte('created_at', since)
        : supabase.from('search_logs').select('query'),
      since
        ? supabase.from('scan_logs').select('medicine_name').gte('created_at', since)
        : supabase.from('scan_logs').select('medicine_name'),
    ])

    // Aggregate client-side (avoids needing a DB function)
    const agg = (rows, key) => {
      const map = {}
      for (const row of rows ?? []) {
        const k = (row[key] ?? '').trim().toLowerCase()
        if (!k) continue
        map[k] = (map[k] || 0) + 1
      }
      return Object.entries(map)
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10)
    }

    setSearchData(agg(sData, 'query'))
    setScanData(agg(cData, 'medicine_name'))
    setLoading(false)
  }, [])

  useEffect(() => { load(range) }, [range, load])

  const RANGES = [{ v: '7d', l: '7 days' }, { v: '30d', l: '30 days' }, { v: 'all', l: 'All time' }]

  return (
    <section className="ga-section" aria-labelledby="ga-title">
      <div className="ga-header">
        <div className="ga-header-left">
          <div className="ga-icon-wrap" aria-hidden="true">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 3v18h18" /><path d="M18 9l-5 5-4-4-3 3" />
            </svg>
          </div>
          <div>
            <h2 id="ga-title" className="ga-title">Analytics</h2>
            <p className="ga-subtitle">Most searched &amp; scanned medicines</p>
          </div>
        </div>
        <div className="ga-header-right">
          <div className="ga-range-tabs" role="group" aria-label="Time range">
            {RANGES.map(({ v, l }) => (
              <button
                key={v}
                type="button"
                className={`ga-range-tab${range === v ? ' ga-range-tab--active' : ''}`}
                onClick={() => setRange(v)}
                aria-pressed={range === v}
              >
                {l}
              </button>
            ))}
          </div>
          <a
            href="https://analytics.google.com/analytics/web/#/p$(G-018C52JKTJ)/reports/"
            target="_blank"
            rel="noopener noreferrer"
            className="ga-ga4-link"
            aria-label="Open Google Analytics dashboard"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
              <polyline points="15 3 21 3 21 9" />
              <line x1="10" y1="14" x2="21" y2="3" />
            </svg>
            View in GA4
          </a>
        </div>
      </div>

      {loading ? (
        <div className="ga-charts-grid ga-loading">
          {[0, 1].map(i => (
            <div key={i} className="ga-card">
              <div className="ga-card-header"><div className="ga-skel ga-skel--title" /></div>
              {Array.from({ length: 5 }).map((_, j) => (
                <div key={j} className="ga-skel-row">
                  <div className="ga-skel ga-skel--label" />
                  <div className="ga-skel ga-skel--bar" />
                </div>
              ))}
            </div>
          ))}
        </div>
      ) : (
        <div className="ga-charts-grid">
          {/* Top Searches */}
          <div className="ga-card">
            <div className="ga-card-header">
              <span className="ga-card-dot ga-card-dot--search" aria-hidden="true" />
              <h3 className="ga-card-title">Top Searches</h3>
              <span className="ga-card-count">{searchData.length} terms</span>
            </div>
            <BarChart items={searchData} colorClass="ga-bar-fill--search" />
          </div>

          {/* Top Scans */}
          <div className="ga-card">
            <div className="ga-card-header">
              <span className="ga-card-dot ga-card-dot--scan" aria-hidden="true" />
              <h3 className="ga-card-title">Top Scanned Medicines</h3>
              <span className="ga-card-count">{scanData.length} medicines</span>
            </div>
            <BarChart items={scanData} colorClass="ga-bar-fill--scan" />
          </div>
        </div>
      )}
    </section>
  )
}


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
  const [bulkMode,     setBulkMode]     = useState(false)

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

  // ── Bulk Save ───────────────────────────────────────────

  const handleBulkSave = async ({ inserts, updates, deletes }) => {
    const ops = []

    if (inserts.length > 0)
      ops.push(supabase.from('medicines').insert(inserts))

    for (const u of updates)
      ops.push(supabase.from('medicines').update({ name: u.name, price: u.price, quantity: u.quantity }).eq('id', u.id))

    for (const id of deletes)
      ops.push(supabase.from('medicines').delete().eq('id', id))

    await Promise.all(ops)
    await loadMedicines()
    setBulkMode(false)
    const parts = []
    if (inserts.length) parts.push(`${inserts.length} added`)
    if (updates.length) parts.push(`${updates.length} updated`)
    if (deletes.length) parts.push(`${deletes.length} deleted`)
    showToast(parts.length ? `Saved — ${parts.join(', ')}` : 'No changes')
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

        {/* Page title + action buttons */}
        <div className="adm-page-head">
          <div>
            <h1 className="adm-page-title">Inventory</h1>
            <p className="adm-page-sub">Manage your medicine stock and pricing</p>
          </div>
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            {!bulkMode && (
              <>
                <button
                  type="button"
                  className="adm-btn adm-btn-bulk"
                  onClick={() => setBulkMode(true)}
                  aria-label="Bulk Edit"
                  title="Edit multiple items at once"
                >
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <rect x="3" y="3" width="18" height="18" rx="2" />
                    <path d="M3 9h18M3 15h18M9 3v18M15 3v18" />
                  </svg>
                  Bulk Edit
                </button>
                <button
                  type="button"
                  className="adm-btn adm-btn-primary"
                  onClick={() => setShowForm(true)}
                  aria-label="Add Medicine"
                >
                  <IconPlus />
                  Add Medicine
                </button>
              </>
            )}
          </div>
        </div>

        {/* Stats row */}
        <StatsRow medicines={medicines} />

        {/* Analytics section */}
        <AnalyticsSection />

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

        {/* Table / Bulk editor */}
        <AnimatePresence mode="wait">
          {bulkMode ? (
            <BulkEditTable
              key="bulk"
              medicines={medicines}
              onSave={handleBulkSave}
              onCancel={() => setBulkMode(false)}
            />
          ) : (
            <motion.div
              key="table"
              className="adm-table-wrap"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
            >
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
            </motion.div>
          )}
        </AnimatePresence>
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
