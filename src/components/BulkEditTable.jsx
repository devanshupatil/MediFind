/**
 * BulkEditTable — Excel-like inline editor for the Admin Dashboard.
 *
 * Props:
 *   medicines  — current medicine array from Supabase
 *   onSave(changes) — called with { inserts[], updates[], deletes[] }
 *   onCancel   — discard all edits and exit bulk mode
 */
import { useState, useRef, useCallback, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

// ── Icons ──────────────────────────────────────────────────

function IconSave() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
      <polyline points="17 21 17 13 7 13 7 21" />
      <polyline points="7 3 7 8 15 8" />
    </svg>
  )
}

function IconX() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  )
}

function IconPlus() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  )
}

function IconUndo() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="1 4 1 10 7 10" />
      <path d="M3.51 15a9 9 0 1 0 .49-3.93" />
    </svg>
  )
}

// ── Helpers ────────────────────────────────────────────────

let _nextId = -1
const newRowId = () => _nextId--

/**
 * Deep-clone medicine rows into draft state rows.
 * Each row gets a `_status` field: 'existing' | 'new' | 'deleted'
 * and a `_dirty` boolean.
 */
function toDraftRows(medicines) {
  return medicines.map(m => ({
    _rowKey:      m.id,
    _status:      'existing',
    _dirty:       false,
    id:           m.id,
    name:         m.name         ?? '',
    quantity:     String(m.quantity ?? ''),
    expiry_date:  m.expiry_date  ?? '',
    company_name: m.company_name ?? '',
    composition:  m.composition  ?? '',
    mrp_per_strip: String(m.mrp_per_strip ?? ''),
  }))
}

function validateRow(row) {
  const errs = {}
  if (!row.name.trim())                                           errs.name         = 'Required'
  if (row.quantity === '' || Number(row.quantity) < 0)            errs.quantity     = 'Invalid'
  if (row.mrp_per_strip !== '' && Number(row.mrp_per_strip) < 0)  errs.mrp_per_strip = 'Invalid'
  return errs
}

// ── Main Component ─────────────────────────────────────────

export function BulkEditTable({ medicines, onSave, onCancel }) {
  const [rows,    setRows]    = useState(() => toDraftRows(medicines))
  const [errors,  setErrors]  = useState({})   // { rowKey: { name?, price?, quantity? } }
  const [saving,  setSaving]  = useState(false)
  const tableRef  = useRef(null)

  // Re-sync if parent medicines change while bulk mode is open (rare, but safe)
  useEffect(() => {
    setRows(toDraftRows(medicines))
    setErrors({})
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [medicines.length])

  // ── Derived counts ──────────────────────────────────────

  const activeRows  = rows.filter(r => r._status !== 'deleted')
  const deletedRows = rows.filter(r => r._status === 'deleted')
  const dirtyCount  = rows.filter(r => r._dirty || r._status === 'new' || r._status === 'deleted').length

  // ── Cell update ─────────────────────────────────────────

  const updateCell = useCallback((rowKey, field, value) => {
    setRows(prev => prev.map(r => {
      if (r._rowKey !== rowKey) return r
      const updated = { ...r, [field]: value, _dirty: r._status === 'existing' ? true : r._dirty }
      return updated
    }))
    // Clear that cell's error
    setErrors(prev => {
      const rowErrs = { ...(prev[rowKey] || {}) }
      delete rowErrs[field]
      return { ...prev, [rowKey]: rowErrs }
    })
  }, [])

  // ── Add row ─────────────────────────────────────────────

  const addRow = () => {
    const key = newRowId()
    setRows(prev => [...prev, {
      _rowKey:      key,
      _status:      'new',
      _dirty:       true,
      id:           null,
      name:         '',
      quantity:     '',
      expiry_date:  '',
      company_name: '',
      composition:  '',
      mrp_per_strip: '',
    }])
    // Focus name cell of new row after render
    setTimeout(() => {
      const inputs = tableRef.current?.querySelectorAll(`[data-rowkey="${key}"]`)
      inputs?.[0]?.focus()
    }, 40)
  }

  // ── Delete / restore row ────────────────────────────────

  const toggleDelete = useCallback((rowKey) => {
    setRows(prev => prev.map(r => {
      if (r._rowKey !== rowKey) return r
      if (r._status === 'new')      return null // fully remove new rows
      return { ...r, _status: r._status === 'deleted' ? 'existing' : 'deleted', _dirty: true }
    }).filter(Boolean))
  }, [])

  // ── Keyboard nav (Tab across cells) ────────────────────

  const handleKeyDown = (e, rowKey, field) => {
    if (e.key !== 'Tab') return
    const COLS = ['name', 'company_name', 'composition', 'mrp_per_strip', 'quantity', 'expiry_date']
    const colIdx = COLS.indexOf(field)
    const visibleRows = rows.filter(r => r._status !== 'deleted')
    const rowIdx = visibleRows.findIndex(r => r._rowKey === rowKey)

    e.preventDefault()
    const direction = e.shiftKey ? -1 : 1

    let nextCol = colIdx + direction
    let nextRow = rowIdx
    if (nextCol >= COLS.length) { nextCol = 0; nextRow++ }
    if (nextCol < 0)            { nextCol = COLS.length - 1; nextRow-- }

    if (nextRow < 0 || nextRow >= visibleRows.length) return

    const nextKey  = visibleRows[nextRow]._rowKey
    const nextCell = tableRef.current?.querySelector(
      `[data-rowkey="${nextKey}"][data-field="${COLS[nextCol]}"]`
    )
    nextCell?.focus()
    nextCell?.select?.()
  }

  // ── Validate all ────────────────────────────────────────

  const validateAll = () => {
    const newErrors = {}
    let valid = true
    for (const r of activeRows) {
      const errs = validateRow(r)
      if (Object.keys(errs).length) {
        newErrors[r._rowKey] = errs
        valid = false
      }
    }
    setErrors(newErrors)
    return valid
  }

  // ── Save ────────────────────────────────────────────────

  const handleSave = async () => {
    if (!validateAll()) return
    setSaving(true)
    const toPayload = r => ({
      name:          r.name.trim(),
      quantity:      Number(r.quantity),
      expiry_date:   r.expiry_date  || null,
      company_name:  r.company_name.trim() || null,
      composition:   r.composition.trim()  || null,
      mrp_per_strip: r.mrp_per_strip !== '' ? Number(r.mrp_per_strip) : null,
    })
    const inserts = rows.filter(r => r._status === 'new').map(r => toPayload(r))
    const updates = rows.filter(r => r._status === 'existing' && r._dirty).map(r => ({
      id: r.id, ...toPayload(r),
    }))
    const deletes = deletedRows.filter(r => r._status === 'deleted' && r.id).map(r => r.id)
    await onSave({ inserts, updates, deletes })
    setSaving(false)
  }

  // ── Render ──────────────────────────────────────────────

  return (
    <motion.div
      className="bke-root"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 8 }}
      transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
    >
      {/* ── Bulk-edit toolbar ── */}
      <div className="bke-toolbar">
        <div className="bke-toolbar-left">
          <span className="bke-mode-label">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{flexShrink:0}}>
              <rect x="3" y="3" width="18" height="18" rx="2" />
              <path d="M3 9h18M3 15h18M9 3v18M15 3v18" />
            </svg>
            Bulk Edit Mode
          </span>
          {dirtyCount > 0 && (
            <AnimatePresence>
              <motion.span
                className="bke-dirty-badge"
                initial={{ scale: 0.7, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.7, opacity: 0 }}
                key="dirty"
              >
                {dirtyCount} unsaved {dirtyCount === 1 ? 'change' : 'changes'}
              </motion.span>
            </AnimatePresence>
          )}
        </div>

        <div className="bke-toolbar-right">
          <button
            type="button"
            className="bke-btn bke-btn-ghost"
            onClick={onCancel}
            disabled={saving}
            aria-label="Discard changes and exit bulk edit"
          >
            <IconUndo />
            Discard &amp; Exit
          </button>
          <button
            type="button"
            className="bke-btn bke-btn-primary"
            onClick={handleSave}
            disabled={saving || dirtyCount === 0}
            aria-label="Save all changes"
          >
            {saving ? (
              <span className="bke-spinner" aria-hidden="true" />
            ) : (
              <IconSave />
            )}
            {saving ? 'Saving…' : 'Save All Changes'}
          </button>
        </div>
      </div>

      {/* ── Instructions hint ── */}
      <div className="bke-hint">
        Click any cell to edit · <kbd>Tab</kbd> to move right · <kbd>Shift+Tab</kbd> to move left · rows highlighted in red are queued for deletion
      </div>

      {/* ── Scrollable grid ── */}
      <div className="bke-table-scroll">
        <table className="bke-table" ref={tableRef} aria-label="Bulk edit medicine inventory">
          <thead>
            <tr className="bke-thead-row">
              <th className="bke-th bke-th--num">#</th>
              <th className="bke-th bke-th--name">Medicine Name</th>
              <th className="bke-th bke-th--company">Company</th>
              <th className="bke-th bke-th--composition">Composition</th>
              <th className="bke-th bke-th--mrp">MRP/Strip (₹)</th>
              <th className="bke-th bke-th--qty">Qty</th>
              <th className="bke-th bke-th--expiry">Expiry</th>
              <th className="bke-th bke-th--status">Status</th>
              <th className="bke-th bke-th--del" aria-label="Delete row"></th>
            </tr>
          </thead>
          <tbody>
            {activeRows.map((row, idx) => {
              const rowErrs = errors[row._rowKey] || {}
              const isNew   = row._status === 'new'
              const isDirty = row._dirty && !isNew

              return (
                <tr
                  key={row._rowKey}
                  className={`bke-tr${isNew ? ' bke-tr--new' : ''}${isDirty ? ' bke-tr--dirty' : ''}`}
                >
                  {/* Row number */}
                  <td className="bke-td bke-td--num">
                    {isNew
                      ? <span className="bke-new-badge">NEW</span>
                      : <span className="bke-row-num">{idx + 1}</span>
                    }
                  </td>

                  {/* Name */}
                  <td className="bke-td bke-td--name">
                    <div className={`bke-cell-wrap${rowErrs.name ? ' bke-cell-wrap--err' : ''}`}>
                      <input
                        type="text"
                        className="bke-cell-input"
                        value={row.name}
                        data-rowkey={row._rowKey}
                        data-field="name"
                        onChange={e => updateCell(row._rowKey, 'name', e.target.value)}
                        onKeyDown={e => handleKeyDown(e, row._rowKey, 'name')}
                        placeholder="Medicine name"
                        aria-label={`Name for row ${idx + 1}`}
                        aria-invalid={Boolean(rowErrs.name)}
                      />
                      {rowErrs.name && <span className="bke-cell-err">{rowErrs.name}</span>}
                    </div>
                  </td>

                  {/* Company */}
                  <td className="bke-td bke-td--company">
                    <div className="bke-cell-wrap">
                      <input
                        type="text"
                        className="bke-cell-input"
                        value={row.company_name}
                        data-rowkey={row._rowKey}
                        data-field="company_name"
                        onChange={e => updateCell(row._rowKey, 'company_name', e.target.value)}
                        onKeyDown={e => handleKeyDown(e, row._rowKey, 'company_name')}
                        placeholder="Company"
                        aria-label={`Company for row ${idx + 1}`}
                      />
                    </div>
                  </td>

                  {/* Composition */}
                  <td className="bke-td bke-td--composition">
                    <div className="bke-cell-wrap">
                      <input
                        type="text"
                        className="bke-cell-input"
                        value={row.composition}
                        data-rowkey={row._rowKey}
                        data-field="composition"
                        onChange={e => updateCell(row._rowKey, 'composition', e.target.value)}
                        onKeyDown={e => handleKeyDown(e, row._rowKey, 'composition')}
                        placeholder="Contains…"
                        aria-label={`Composition for row ${idx + 1}`}
                      />
                    </div>
                  </td>

                  {/* MRP per Strip */}
                  <td className="bke-td bke-td--mrp">
                    <div className={`bke-cell-wrap bke-cell-wrap--num${rowErrs.mrp_per_strip ? ' bke-cell-wrap--err' : ''}`}>
                      <span className="bke-prefix">₹</span>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        className="bke-cell-input bke-cell-input--num"
                        value={row.mrp_per_strip}
                        data-rowkey={row._rowKey}
                        data-field="mrp_per_strip"
                        onChange={e => updateCell(row._rowKey, 'mrp_per_strip', e.target.value)}
                        onKeyDown={e => handleKeyDown(e, row._rowKey, 'mrp_per_strip')}
                        placeholder="0"
                        aria-label={`MRP per strip for row ${idx + 1}`}
                        aria-invalid={Boolean(rowErrs.mrp_per_strip)}
                      />
                      {rowErrs.mrp_per_strip && <span className="bke-cell-err">{rowErrs.mrp_per_strip}</span>}
                    </div>
                  </td>

                  {/* Quantity */}
                  <td className="bke-td bke-td--qty">
                    <div className={`bke-cell-wrap bke-cell-wrap--num${rowErrs.quantity ? ' bke-cell-wrap--err' : ''}`}>
                      <input
                        type="number"
                        min="0"
                        step="1"
                        className="bke-cell-input bke-cell-input--num"
                        value={row.quantity}
                        data-rowkey={row._rowKey}
                        data-field="quantity"
                        onChange={e => updateCell(row._rowKey, 'quantity', e.target.value)}
                        onKeyDown={e => handleKeyDown(e, row._rowKey, 'quantity')}
                        placeholder="0"
                        aria-label={`Quantity for row ${idx + 1}`}
                        aria-invalid={Boolean(rowErrs.quantity)}
                      />
                      {rowErrs.quantity && <span className="bke-cell-err">{rowErrs.quantity}</span>}
                    </div>
                  </td>

                  {/* Expiry Date */}
                  <td className="bke-td bke-td--expiry">
                    <div className="bke-cell-wrap">
                      <input
                        type="date"
                        className="bke-cell-input"
                        value={row.expiry_date}
                        data-rowkey={row._rowKey}
                        data-field="expiry_date"
                        onChange={e => updateCell(row._rowKey, 'expiry_date', e.target.value)}
                        onKeyDown={e => handleKeyDown(e, row._rowKey, 'expiry_date')}
                        aria-label={`Expiry date for row ${idx + 1}`}
                      />
                    </div>
                  </td>

                  {/* Stock status (computed, read-only) */}
                  <td className="bke-td bke-td--status">
                    {(() => {
                      const qty = Number(row.quantity) || 0
                      if (qty === 0)  return <span className="sp-badge sp-badge-danger">Out</span>
                      if (qty <= 5)   return <span className="sp-badge sp-badge-warning"><span className="sp-dot" />Low</span>
                      return               <span className="sp-badge sp-badge-success"><span className="sp-dot" />OK</span>
                    })()}
                  </td>

                  {/* Delete */}
                  <td className="bke-td bke-td--del">
                    <button
                      type="button"
                      className="bke-del-btn"
                      onClick={() => toggleDelete(row._rowKey)}
                      aria-label={`Remove row ${idx + 1}`}
                    >
                      <IconX />
                    </button>
                  </td>
                </tr>
              )
            })}

            {/* Deleted-rows tombstones */}
            {deletedRows.map((row, idx) => (
              <tr key={row._rowKey} className="bke-tr bke-tr--deleted">
                <td className="bke-td bke-td--num"><span className="bke-del-badge">DEL</span></td>
                <td className="bke-td bke-td--name bke-td--strike">{row.name || '—'}</td>
                <td className="bke-td bke-td--company bke-td--strike">{row.company_name || '—'}</td>
                <td className="bke-td bke-td--composition bke-td--strike">{row.composition || '—'}</td>
                <td className="bke-td bke-td--mrp bke-td--strike">₹{row.mrp_per_strip || '—'}</td>
                <td className="bke-td bke-td--qty bke-td--strike">{row.quantity || '—'}</td>
                <td className="bke-td bke-td--expiry bke-td--strike">{row.expiry_date || '—'}</td>
                <td className="bke-td bke-td--status" />
                <td className="bke-td bke-td--del">
                  <button
                    type="button"
                    className="bke-restore-btn"
                    onClick={() => toggleDelete(row._rowKey)}
                    aria-label={`Restore ${row.name}`}
                  >
                    <IconUndo />
                    Restore
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ── Add Row button ── */}
      <button
        type="button"
        className="bke-add-row-btn"
        onClick={addRow}
        disabled={saving}
        aria-label="Add new medicine row"
      >
        <IconPlus />
        Add Row
      </button>

      {/* ── Bottom action bar (mirrors top bar for long tables) ── */}
      {dirtyCount > 0 && (
        <div className="bke-bottom-bar">
          <span className="bke-dirty-badge bke-dirty-badge--lg">
            {dirtyCount} unsaved {dirtyCount === 1 ? 'change' : 'changes'}
          </span>
          <button
            type="button"
            className="bke-btn bke-btn-primary"
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? <span className="bke-spinner" aria-hidden="true" /> : <IconSave />}
            {saving ? 'Saving…' : 'Save All Changes'}
          </button>
        </div>
      )}
    </motion.div>
  )
}
