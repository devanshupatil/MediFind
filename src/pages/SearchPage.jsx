import { useState, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { useTranslation } from 'react-i18next'
import { supabase } from '../lib/supabase'
import { CameraSearch } from '../components/CameraSearch'
import { LanguageSwitcher } from '../components/LanguageSwitcher'
import { useTranslatedName, translationCache } from '../hooks/useTranslatedName'
import { trackSearch } from '../lib/analytics'

const PHONE = import.meta.env.VITE_SHOP_PHONE

// ── SVG Icons ────────────────────────────────────────────────

function IconSearch() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.35-4.35" />
    </svg>
  )
}

function IconMic({ active }) {
  return active ? (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 1a4 4 0 0 1 4 4v7a4 4 0 0 1-8 0V5a4 4 0 0 1 4-4z" />
      <path d="M19 10v2a7 7 0 0 1-14 0v-2" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <line x1="12" y1="19" x2="12" y2="22" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <line x1="8" y1="22" x2="16" y2="22" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  ) : (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 2a3 3 0 0 1 3 3v7a3 3 0 0 1-6 0V5a3 3 0 0 1 3-3z" />
      <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
      <line x1="12" y1="19" x2="12" y2="22" />
      <line x1="8" y1="22" x2="16" y2="22" />
    </svg>
  )
}

function IconPill({ size = 20 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="m10.5 20.5 10-10a4.95 4.95 0 1 0-7-7l-10 10a4.95 4.95 0 1 0 7 7Z" />
      <path d="m8.5 8.5 7 7" />
    </svg>
  )
}

function IconPhone() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 13a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.6 2.18h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 9.91a16 16 0 0 0 6.29 6.29l1.79-1.79a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z" />
    </svg>
  )
}

function IconEmpty() {
  return (
    <svg width="52" height="52" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.35-4.35" />
      <path d="M11 8v3" strokeWidth="1.5" />
      <circle cx="11" cy="14" r="0.5" fill="currentColor" stroke="none" />
    </svg>
  )
}

// ── Floating decorative pill definitions ─────────────────────

const FLOAT_PILLS = [
  { width: 80,  height: 28, top: '10%',  left:  '6%',   delay: '0s',   duration: '6.5s', rotate: -25, opacity: 0.045 },
  { width: 120, height: 38, top: '22%',  right: '8%',   delay: '1.8s', duration: '8.5s', rotate: 42,  opacity: 0.03  },
  { width: 60,  height: 22, top: '58%',  left:  '4%',   delay: '0.9s', duration: '7s',   rotate: 15,  opacity: 0.05  },
  { width: 100, height: 32, bottom:'18%',right: '5%',   delay: '2.2s', duration: '9s',   rotate: -38, opacity: 0.04  },
  { width: 72,  height: 26, top: '38%',  left:  '14%',  delay: '3.1s', duration: '6s',   rotate: 60,  opacity: 0.035 },
  { width: 90,  height: 30, bottom:'28%',right: '16%',  delay: '1.1s', duration: '7.8s', rotate: -52, opacity: 0.04  },
]

// ── Skeleton Card ─────────────────────────────────────────────

function SkeletonCard() {
  return (
    <div className="sp-card sp-skeleton" aria-hidden="true">
      <div className="sp-skel-line sp-skel-icon" />
      <div className="sp-skel-line sp-skel-title" />
      <div className="sp-skel-line sp-skel-sub" />
      <div className="sp-skel-line sp-skel-price" />
    </div>
  )
}

// ── Stock Badge ───────────────────────────────────────────────

function StockBadge({ quantity }) {
  const { t } = useTranslation()
  const qty = quantity ?? 0
  if (qty === 0) {
    return <span className="sp-badge sp-badge-danger">{t('outOfStock')}</span>
  }
  if (qty <= 5) {
    return (
      <span className="sp-badge sp-badge-warning">
        <span className="sp-dot" />
        {t('lowStock')}
      </span>
    )
  }
  return (
    <span className="sp-badge sp-badge-success">
      <span className="sp-dot" />
      {t('inStock')}
    </span>
  )
}

// ── Medicine Card ─────────────────────────────────────────────

function MedicineCard({ med, index }) {
  const { t, i18n } = useTranslation()
  const lang = i18n.language?.split('-')[0] ?? 'en'
  const translatedName = useTranslatedName(med.name)
  const isTranslating = translatedName === med.name && lang !== 'en'

  const expiryLabel = (() => {
    if (!med.expiry_date) return null
    const d = new Date(med.expiry_date)
    const now = new Date()
    const soon = new Date(); soon.setMonth(soon.getMonth() + 3)
    const past = d < now
    const close = d < soon
    const label = d.toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })
    return { label, past, close }
  })()

  return (
    <motion.article
      className="sp-card"
      role="listitem"
      initial={{ opacity: 0, y: 24 }}

      animate={{ opacity: 1, y: 0 }}
      transition={{
        delay: Math.min(index * 0.06, 0.42),
        duration: 0.4,
        ease: [0.22, 1, 0.36, 1],
      }}
    >
      <div className="sp-card-top">
        <div className="sp-card-pill-icon">
          <IconPill size={18} />
        </div>
        <StockBadge quantity={med.quantity} />
      </div>

      <h3 className={`sp-card-name${isTranslating ? ' sp-card-name--translating' : ''}`}>
        {translatedName}
      </h3>
      {lang !== 'en' && translatedName !== med.name && (
        <p className="sp-card-name-original">{med.name}</p>
      )}

      {/* Company + Composition */}
      <div className="sp-card-meta">
        {med.company_name && (
          <span className="sp-meta-item sp-meta-company">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/></svg>
            {med.company_name}
          </span>
        )}
        {med.composition && (
          <span className="sp-meta-item sp-meta-composition">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M9 3H5a2 2 0 0 0-2 2v4m6-6h10a2 2 0 0 1 2 2v4M9 3v18m0 0h10a2 2 0 0 0 2-2V9M9 21H5a2 2 0 0 1-2-2V9m0 0h18"/></svg>
            {med.composition}
          </span>
        )}
      </div>

      <div className="sp-card-bottom">
        <div className="sp-price-group">
          {med.mrp_per_strip != null && (
            <div className="sp-mrp">
              <span className="sp-mrp-label">MRP/Strip</span>
              <span className="sp-mrp-val">₹{med.mrp_per_strip}</span>
            </div>
          )}
        </div>
        <div className="sp-card-actions">
          {expiryLabel && (
            <span className={`sp-expiry${expiryLabel.past ? ' sp-expiry--expired' : expiryLabel.close ? ' sp-expiry--soon' : ''}`}>
              {expiryLabel.past ? '⚠️ Expired' : `Exp: ${expiryLabel.label}`}
            </span>
          )}
          {PHONE && (
            <a
              href={`tel:${PHONE}`}
              className="sp-call-link"
              aria-label={t('ariaCallStoreAbout', { name: med.name })}
            >
              <IconPhone />
            </a>
          )}
        </div>
      </div>
    </motion.article>
  )
}

// ── Empty State ───────────────────────────────────────────────

function EmptyState() {
  const { t } = useTranslation()
  return (
    <motion.div
      className="sp-empty"
      initial={{ opacity: 0, scale: 0.97 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.35 }}
    >
      <div className="sp-empty-icon">
        <IconEmpty />
      </div>
      <h3 className="sp-empty-heading">{t('noResults')}</h3>
      <p className="sp-empty-sub">{t('noResultsHint')}</p>
      {PHONE && (
        <a href={`tel:${PHONE}`} className="sp-btn sp-btn-primary" aria-label={t('ariaCallStore')}>
          <IconPhone />
          {t('callBtn')}
        </a>
      )}
    </motion.div>
  )
}

// ── Search Page ───────────────────────────────────────────────

export function SearchPage() {
  const { t, i18n } = useTranslation()
  const [medicines, setMedicines] = useState([])
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [voiceState, setVoiceState] = useState('idle')
  const [voiceError, setVoiceError] = useState('')
  const [searchFocused, setSearchFocused] = useState(false)
  const [scrolled, setScrolled] = useState(false)
  const [scanData, setScanData] = useState(null)
  const recognitionRef = useRef(null)

  useEffect(() => {
    supabase.from('medicines').select('*').then(({ data }) => {
      if (data) setMedicines(data)
      setLoading(false)
    })
  }, [])

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  // ── Debounced search tracking ── fire after 800 ms of inactivity
  const searchDebounceRef = useRef(null)
  useEffect(() => {
    if (!query.trim()) return
    clearTimeout(searchDebounceRef.current)
    searchDebounceRef.current = setTimeout(() => {
      trackSearch(query, filtered.length)
    }, 800)
    return () => clearTimeout(searchDebounceRef.current)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query])

  const lang = i18n.language?.split('-')[0] ?? 'en'
  const filtered = medicines.filter(m => {
    const q = query.toLowerCase()
    if (!q) return true
    // Always match on original English name
    if (m.name.toLowerCase().includes(q)) return true
    // Match on company name
    if (m.company_name?.toLowerCase().includes(q)) return true
    // Match on composition
    if (m.composition?.toLowerCase().includes(q)) return true
    // Also match on translated name if already cached
    if (lang !== 'en') {
      const cached = translationCache.get(`${lang}:${m.name}`)
      if (cached && cached.toLowerCase().includes(q)) return true
    }
    return false
  })

  const stopVoice = () => {
    recognitionRef.current?.abort()
    recognitionRef.current = null
    setVoiceState('idle')
  }

  const startVoice = () => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SR) {
      setVoiceError(t('voiceUnsupported'))
      setTimeout(() => setVoiceError(''), 3000)
      return
    }
    const recognition = new SR()
    const langCode = i18n.language?.split('-')[0] ?? 'en'
    recognition.lang = langCode === 'hi' ? 'hi-IN' : langCode === 'mr' ? 'mr-IN' : 'en-IN'
    recognition.interimResults = false
    recognitionRef.current = recognition
    setVoiceState('listening')
    recognition.start()
    recognition.onresult = (event) => {
      const transcript = [...event.results]
        .filter(r => r.isFinal)
        .map(r => r[0].transcript)
        .join('')
      if (transcript) setQuery(transcript)
      setVoiceState('idle')
    }
    recognition.onerror = () => {
      setVoiceState('idle')
      setVoiceError(t('voiceUnsupported'))
      setTimeout(() => setVoiceError(''), 3000)
    }
    recognition.onend = () => setVoiceState('idle')
  }

  const isListening = voiceState === 'listening'
  const showEmpty = !loading && query !== '' && filtered.length === 0

  return (
    <div className="sp-root">

      {/* ── Header ── */}
      <header className={`sp-header${scrolled ? ' sp-header--scrolled' : ''}`}>
        <div className="sp-header-inner">
          <div className="sp-logo" aria-label="MediFind">
            <div className="sp-logo-icon">
              <IconPill size={18} />
            </div>
            <span className="sp-logo-text">MediFind</span>
          </div>

          <LanguageSwitcher />
        </div>
      </header>

      {/* ── Main ── */}
      <main className="sp-main">

        {/* Hero */}
        <section className="sp-hero" aria-labelledby="sp-hero-title">
          <div className="sp-hero-glow" aria-hidden="true" />

          {/* Decorative floating pills */}
          <div className="sp-float-pills" aria-hidden="true">
            {FLOAT_PILLS.map((pill, i) => (
              <div
                key={i}
                className="sp-float-pill"
                style={{
                  width:    pill.width,
                  height:   pill.height,
                  top:      pill.top,
                  left:     pill.left,
                  right:    pill.right,
                  bottom:   pill.bottom,
                  opacity:  pill.opacity,
                  transform: `rotate(${pill.rotate}deg)`,
                  animationDelay:    pill.delay,
                  animationDuration: pill.duration,
                }}
              />
            ))}
          </div>

          {/* Headline */}
          <div className="sp-hero-content">
            <motion.h1
              id="sp-hero-title"
              className="sp-hero-title"
              initial={{ opacity: 0, y: 32 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.65, ease: [0.22, 1, 0.36, 1] }}
            >
              {t('heroTitle')}
            </motion.h1>
            <motion.p
              className="sp-hero-sub"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15, duration: 0.5 }}
            >
              {t('heroSub')}
            </motion.p>
          </div>

          {/* Search Bar */}
          <motion.div
            className="sp-search-outer"
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.28, duration: 0.5 }}
          >
            <div
              className={`sp-search-bar${searchFocused ? ' sp-search-bar--focused' : ''}`}
              role="search"
            >
              <span className="sp-search-icon">
                <IconSearch />
              </span>

              <input
                type="text"
                className="sp-search-input"
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder={t('searchPlaceholder')}
                onFocus={() => setSearchFocused(true)}
                onBlur={() => setSearchFocused(false)}
                aria-label={t('searchPlaceholder')}
                autoComplete="off"
                autoCorrect="off"
                spellCheck="false"
              />

              <button
                className={`sp-voice-btn${isListening ? ' sp-voice-btn--active' : ''}`}
                onClick={isListening ? stopVoice : startVoice}
                aria-label={isListening ? t('voiceListening') : t('voiceBtn')}
                aria-pressed={isListening}
                type="button"
              >
                {isListening && <span className="sp-voice-ring" aria-hidden="true" />}
                <IconMic active={isListening} />
              </button>

              <div className="sp-scan-wrap">
                <CameraSearch onScanComplete={(src, matches, info) => {
                  setScanData({ imageSrc: src, matches })
                  setQuery(info?.medicine_name || '')
                }} />
              </div>
            </div>

            <AnimatePresence>
              {voiceError && (
                <motion.p
                  className="sp-voice-error"
                  role="alert"
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                >
                  {voiceError}
                </motion.p>
              )}
            </AnimatePresence>
          </motion.div>
        </section>

        {/* Scan Results */}
        {scanData && (
          <section className="sp-scan-results" aria-label={t('scanBtn')}>
            <div className="sp-scan-header">
              <div className="sp-scan-image-wrap">
                <img src={scanData.imageSrc} alt={t('scanBasedOn')} className="sp-scan-image" />
              </div>
              <div className="sp-scan-meta">
                <p className="sp-scan-title">
                  {scanData.matches.length > 0
                    ? t('scanMatchesFound_other', { count: scanData.matches.length })
                    : t('scanNoMatch')}
                </p>
                <p className="sp-scan-sub">
                  {scanData.matches.length > 0
                    ? t('scanBasedOn')
                    : t('scanNoMatchHint')}
                </p>
                <button className="sp-scan-clear" onClick={() => setScanData(null)} type="button">
                  {t('scanClear')}
                </button>
              </div>
            </div>
            {scanData.matches.length > 0 && (
              <div className="sp-grid">
                {scanData.matches.map((med, i) => (
                  <MedicineCard key={med.id} med={med} index={i} />
                ))}
              </div>
            )}
          </section>
        )}

        {/* Search Results */}
        {!scanData && (
          <section className="sp-results" aria-label={t('ariaSearchResults')} aria-live="polite">
            {loading ? (
              <div className="sp-grid" aria-label={t('ariaLoadingMedicines')}>
                {Array.from({ length: 6 }).map((_, i) => (
                  <SkeletonCard key={i} />
                ))}
              </div>
            ) : showEmpty ? (
              <EmptyState />
            ) : (
              <div className="sp-grid">
                {filtered.map((med, i) => (
                  <MedicineCard key={med.id} med={med} index={i} />
                ))}
              </div>
            )}
          </section>
        )}
      </main>

      {/* ── Footer ── */}
      <footer className="sp-footer">
        <div className="sp-footer-inner">
          <span className="sp-footer-brand" aria-label="MediFind">
            <IconPill size={14} />
            MediFind
          </span>
          <span className="sp-footer-tagline">{t('footerTagline')}</span>
          <Link to="/admin" className="sp-footer-admin-link">
            {t('adminLink')}
          </Link>
        </div>
      </footer>

    </div>
  )
}
