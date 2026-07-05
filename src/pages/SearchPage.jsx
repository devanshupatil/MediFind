import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '../lib/supabase'
import { strings } from '../lib/strings'
import { CameraSearch } from '../components/CameraSearch'

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

function StockBadge({ quantity, s }) {
  const qty = quantity ?? 0
  if (qty === 0) {
    return <span className="sp-badge sp-badge-danger">{s.outOfStock}</span>
  }
  if (qty <= 5) {
    return (
      <span className="sp-badge sp-badge-warning">
        <span className="sp-dot" />
        Low Stock
      </span>
    )
  }
  return (
    <span className="sp-badge sp-badge-success">
      <span className="sp-dot" />
      {s.inStock}
    </span>
  )
}

// ── Medicine Card ─────────────────────────────────────────────

function MedicineCard({ med, index, lang }) {
  const s = strings[lang]
  return (
    <motion.article
      className="sp-card"
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
        <StockBadge quantity={med.quantity} s={s} />
      </div>

      <h3 className="sp-card-name">{med.name}</h3>

      <div className="sp-card-bottom">
        <div className="sp-price">
          <span className="sp-price-sym">₹</span>
          <span className="sp-price-val">{med.price ?? '—'}</span>
        </div>
        {PHONE && (
          <a
            href={`tel:${PHONE}`}
            className="sp-call-link"
            aria-label={`Call store about ${med.name}`}
          >
            <IconPhone />
          </a>
        )}
      </div>
    </motion.article>
  )
}

// ── Empty State ───────────────────────────────────────────────

function EmptyState({ s }) {
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
      <h3 className="sp-empty-heading">{s.noResults}</h3>
      <p className="sp-empty-sub">{s.noResultsHint}</p>
      {PHONE && (
        <a href={`tel:${PHONE}`} className="sp-btn sp-btn-primary" aria-label="Call store">
          <IconPhone />
          {s.callBtn}
        </a>
      )}
    </motion.div>
  )
}

// ── Search Page ───────────────────────────────────────────────

export function SearchPage() {
  const [medicines, setMedicines] = useState([])
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [lang, setLang] = useState('hi')
  const [voiceState, setVoiceState] = useState('idle')
  const [voiceError, setVoiceError] = useState('')
  const [searchFocused, setSearchFocused] = useState(false)
  const [scrolled, setScrolled] = useState(false)
  const recognitionRef = useRef(null)

  const s = strings[lang]

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

  const filtered = medicines.filter(m =>
    m.name.toLowerCase().includes(query.toLowerCase())
  )

  const stopVoice = () => {
    recognitionRef.current?.abort()
    recognitionRef.current = null
    setVoiceState('idle')
  }

  const startVoice = () => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SR) {
      setVoiceError(s.voiceUnsupported)
      setTimeout(() => setVoiceError(''), 3000)
      return
    }
    const recognition = new SR()
    recognition.lang = lang === 'hi' ? 'hi-IN' : 'en-IN'
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
      setVoiceError(s.voiceUnsupported)
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

          <button
            className="sp-lang-btn"
            onClick={() => setLang(l => l === 'hi' ? 'en' : 'hi')}
            aria-label="Switch language between Hindi and English"
            type="button"
          >
            <span className={lang === 'hi' ? 'sp-lang-active' : 'sp-lang-dim'}>हिन्दी</span>
            <span className="sp-lang-sep">/</span>
            <span className={lang === 'en' ? 'sp-lang-active' : 'sp-lang-dim'}>EN</span>
          </button>
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
              Find Any Medicine,<br />Instantly
            </motion.h1>
            <motion.p
              className="sp-hero-sub"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15, duration: 0.5 }}
            >
              AI-powered search &amp; live inventory — speak, scan, or type
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
                placeholder={s.searchPlaceholder}
                onFocus={() => setSearchFocused(true)}
                onBlur={() => setSearchFocused(false)}
                aria-label={s.searchPlaceholder}
                autoComplete="off"
                autoCorrect="off"
                spellCheck="false"
              />

              <button
                className={`sp-voice-btn${isListening ? ' sp-voice-btn--active' : ''}`}
                onClick={isListening ? stopVoice : startVoice}
                aria-label={isListening ? s.voiceListening : s.voiceBtn}
                aria-pressed={isListening}
                type="button"
              >
                {isListening && <span className="sp-voice-ring" aria-hidden="true" />}
                <IconMic active={isListening} />
              </button>

              <div className="sp-scan-wrap">
                <CameraSearch onResult={name => setQuery(name)} />
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

        {/* Results */}
        <section className="sp-results" aria-label="Medicine search results" aria-live="polite">
          {loading ? (
            <div className="sp-grid" aria-label="Loading medicines">
              {Array.from({ length: 6 }).map((_, i) => (
                <SkeletonCard key={i} />
              ))}
            </div>
          ) : showEmpty ? (
            <EmptyState s={s} />
          ) : (
            <div className="sp-grid">
              {filtered.map((med, i) => (
                <MedicineCard key={med.id} med={med} index={i} lang={lang} />
              ))}
            </div>
          )}
        </section>
      </main>

      {/* ── Footer ── */}
      <footer className="sp-footer">
        <div className="sp-footer-inner">
          <span className="sp-footer-brand" aria-label="MediFind">
            <IconPill size={14} />
            MediFind
          </span>
          <span className="sp-footer-tagline">AI-powered · Real-time inventory</span>
        </div>
      </footer>

    </div>
  )
}
