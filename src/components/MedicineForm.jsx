/**
 * MedicineForm — Add / Edit medicine modal form.
 * Props:
 *   medicine  — pre-filled object for edit mode (null/undefined = add mode)
 *   onSubmit  — called with { name, price, quantity }
 *   onCancel  — called when user dismisses without saving
 */
import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

export function MedicineForm({ medicine, onSubmit, onCancel }) {
  const isEdit = Boolean(medicine)

  const [name,          setName]          = useState(medicine?.name          ?? '')
  const [price,         setPrice]         = useState(medicine?.price         ?? '')
  const [quantity,      setQuantity]      = useState(medicine?.quantity      ?? '')
  const [expiryDate,    setExpiryDate]    = useState(medicine?.expiry_date   ?? '')
  const [companyName,   setCompanyName]   = useState(medicine?.company_name  ?? '')
  const [composition,   setComposition]   = useState(medicine?.composition   ?? '')
  const [mrpPerStrip,   setMrpPerStrip]   = useState(medicine?.mrp_per_strip ?? '')
  const [errors,        setErrors]        = useState({})

  const validate = () => {
    const e = {}
    if (!name.trim())              e.name     = 'Name is required'
    if (price === '' || price < 0) e.price    = 'Enter a valid price'
    if (quantity === '' || quantity < 0) e.quantity = 'Enter a valid quantity'
    if (mrpPerStrip !== '' && Number(mrpPerStrip) < 0) {
      e.mrp_per_strip = 'MRP must be positive'
    }
    return e
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    const e2 = validate()
    if (Object.keys(e2).length) { setErrors(e2); return }
    onSubmit({
      name: name.trim(),
      price: Number(price),
      quantity: Number(quantity),
      expiry_date: expiryDate,
      company_name: companyName.trim(),
      composition: composition.trim(),
      mrp_per_strip: mrpPerStrip !== '' ? Number(mrpPerStrip) : null
    })
  }

  return (
    <AnimatePresence>
      {/* Backdrop */}
      <motion.div
        className="adm-modal-backdrop"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onCancel}
        aria-hidden="true"
      />

      {/* Panel */}
      <motion.div
        className="adm-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="adm-form-title"
        initial={{ opacity: 0, scale: 0.96, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 20 }}
        transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
      >
        {/* Header */}
        <div className="adm-modal-header">
          <h2 id="adm-form-title" className="adm-modal-title">
            {isEdit ? 'Edit Medicine' : 'Add Medicine'}
          </h2>
          <button
            type="button"
            className="adm-modal-close"
            onClick={onCancel}
            aria-label="Close"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} noValidate>
          <div className="adm-form-body">

            {/* Name */}
            <div className="adm-field">
              <label htmlFor="adm-name" className="adm-label">Name</label>
              <input
                id="adm-name"
                type="text"
                className={`adm-input${errors.name ? ' adm-input--error' : ''}`}
                value={name}
                onChange={e => { setName(e.target.value); setErrors(p => ({ ...p, name: '' })) }}
                placeholder="e.g. Paracetamol 500mg"
                autoFocus
              />
              {errors.name && <p className="adm-field-error">{errors.name}</p>}
            </div>

            {/* Company Name */}
            <div className="adm-field">
              <label htmlFor="adm-company" className="adm-label">Company Name</label>
              <input
                id="adm-company"
                type="text"
                className={`adm-input${errors.company_name ? ' adm-input--error' : ''}`}
                value={companyName}
                onChange={e => { setCompanyName(e.target.value); setErrors(p => ({ ...p, company_name: '' })) }}
                placeholder="e.g. GlaxoSmithKline"
              />
              {errors.company_name && <p className="adm-field-error">{errors.company_name}</p>}
            </div>

            {/* Composition */}
            <div className="adm-field">
              <label htmlFor="adm-composition" className="adm-label">Composition / Contains</label>
              <input
                id="adm-composition"
                type="text"
                className={`adm-input${errors.composition ? ' adm-input--error' : ''}`}
                value={composition}
                onChange={e => { setComposition(e.target.value); setErrors(p => ({ ...p, composition: '' })) }}
                placeholder="e.g. Paracetamol IP 500mg"
              />
              {errors.composition && <p className="adm-field-error">{errors.composition}</p>}
            </div>

            {/* Date & Quantity */}
            <div className="adm-field-row">
              <div className="adm-field">
                <label htmlFor="adm-expiry" className="adm-label">Expiry Date</label>
                <input
                  id="adm-expiry"
                  type="date"
                  className={`adm-input${errors.expiry_date ? ' adm-input--error' : ''}`}
                  value={expiryDate}
                  onChange={e => { setExpiryDate(e.target.value); setErrors(p => ({ ...p, expiry_date: '' })) }}
                />
                {errors.expiry_date && <p className="adm-field-error">{errors.expiry_date}</p>}
              </div>

              <div className="adm-field">
                <label htmlFor="adm-quantity" className="adm-label">Quantity</label>
                <input
                  id="adm-quantity"
                  type="number"
                  min="0"
                  step="1"
                  className={`adm-input${errors.quantity ? ' adm-input--error' : ''}`}
                  value={quantity}
                  onChange={e => { setQuantity(e.target.value); setErrors(p => ({ ...p, quantity: '' })) }}
                  placeholder="0"
                />
                {errors.quantity && <p className="adm-field-error">{errors.quantity}</p>}
              </div>
            </div>

            {/* Price & MRP per Strip */}
            <div className="adm-field-row">
              <div className="adm-field">
                <label htmlFor="adm-price" className="adm-label">Price (₹)</label>
                <input
                  id="adm-price"
                  type="number"
                  min="0"
                  step="0.01"
                  className={`adm-input${errors.price ? ' adm-input--error' : ''}`}
                  value={price}
                  onChange={e => { setPrice(e.target.value); setErrors(p => ({ ...p, price: '' })) }}
                  placeholder="0"
                />
                {errors.price && <p className="adm-field-error">{errors.price}</p>}
              </div>

              <div className="adm-field">
                <label htmlFor="adm-mrp-strip" className="adm-label">MRP per Strip (₹)</label>
                <input
                  id="adm-mrp-strip"
                  type="number"
                  min="0"
                  step="0.01"
                  className={`adm-input${errors.mrp_per_strip ? ' adm-input--error' : ''}`}
                  value={mrpPerStrip}
                  onChange={e => { setMrpPerStrip(e.target.value); setErrors(p => ({ ...p, mrp_per_strip: '' })) }}
                  placeholder="0"
                />
                {errors.mrp_per_strip && <p className="adm-field-error">{errors.mrp_per_strip}</p>}
              </div>
            </div>
          </div>

          {/* Footer actions */}
          <div className="adm-modal-footer">
            <button type="button" className="adm-btn adm-btn-ghost" onClick={onCancel}>
              Cancel
            </button>
            <button type="submit" className="adm-btn adm-btn-primary">
              {isEdit ? 'Save changes' : 'Save'}
            </button>
          </div>
        </form>
      </motion.div>
    </AnimatePresence>
  )
}

