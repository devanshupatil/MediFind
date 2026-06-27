import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { CameraSearch } from '../components/CameraSearch'
import { strings } from '../lib/strings'
import { BackgroundScene } from '../components/BackgroundScene'

const PHONE = import.meta.env.VITE_SHOP_PHONE

export function SearchPage() {
  const [medicines, setMedicines] = useState([])
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [lang, setLang] = useState('hi')
  const [voiceState, setVoiceState] = useState('idle')
  const [voiceError, setVoiceError] = useState('')
  const recognitionRef = useRef(null)

  const s = strings[lang]

  useEffect(() => {
    supabase.from('medicines').select('*').then(({ data }) => {
      if (data) setMedicines(data)
      setLoading(false)
    })
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

  return (
    <div className="min-h-screen bg-mesh relative overflow-x-hidden">
      <BackgroundScene />

      {/* ── GRADIENT HEADER ─────────────────────────────────────────────────── */}
      <div className="relative bg-gradient-to-br from-blue-600 via-blue-700 to-violet-700 pb-28 px-4 pt-5 overflow-hidden">
        {/* Depth orbs */}
        <div className="absolute -top-20 -right-20 w-72 h-72 bg-white/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-10 -left-10 w-56 h-56 bg-violet-500/20 rounded-full blur-3xl" />
        <div className="absolute top-1/2 left-1/3 w-32 h-32 bg-blue-300/10 rounded-full blur-2xl" />
        {/* Slow-shifting gradient overlay — creates breathing effect on header */}
        <div className="absolute inset-0 bg-gradient-to-tr from-blue-400/20 via-transparent to-violet-500/25 animate-gradient-breathe pointer-events-none" />

        {/* Topbar */}
        <div className="relative flex justify-between items-center max-w-lg mx-auto">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 bg-white/15 rounded-xl flex items-center justify-center border border-white/20 shadow-inner backdrop-blur-sm">
              <PillIcon />
            </div>
            <span className="font-display font-bold text-[1.3rem] text-white tracking-tight">
              MediFind
            </span>
          </div>
          <button
            onClick={() => setLang(l => l === 'hi' ? 'en' : 'hi')}
            aria-label="Toggle language"
            className="bg-white/15 text-white px-3.5 py-1.5 rounded-full text-sm font-semibold hover:bg-white/25 transition-all duration-200 border border-white/20 backdrop-blur-sm cursor-pointer active:scale-95"
          >
            {lang === 'hi' ? 'हिं → EN' : 'EN → हिं'}
          </button>
        </div>

        {/* Hero text */}
        <div className="relative max-w-lg mx-auto mt-7">
          <p className="text-white/60 text-sm font-medium tracking-wide">{s.greeting}</p>
          <h1 className="text-white font-display font-bold text-[1.9rem] mt-1 leading-tight">
            {s.tagline}
          </h1>
        </div>
      </div>

      {/* ── GLASS SEARCH CARD ───────────────────────────────────────────────── */}
      <div className="relative z-10 max-w-lg mx-auto px-4 -mt-16">
        <div className="glass rounded-3xl shadow-2xl shadow-slate-900/[0.10] p-5 border border-white/70 ring-1 ring-black/[0.04]">

          {/* Search input */}
          <div className="relative">
            <SearchInputIcon />
            <input
              type="text"
              placeholder={s.searchPlaceholder}
              value={query}
              onChange={e => setQuery(e.target.value)}
              className="w-full bg-slate-50/80 rounded-2xl pl-11 pr-4 py-3.5 text-base focus:outline-none focus:bg-white ring-1 ring-slate-200/70 focus:ring-2 focus:ring-blue-500/25 transition-all duration-200 placeholder:text-slate-400"
            />
          </div>

          {/* Action buttons */}
          <div className={`grid gap-2 mt-3 ${PHONE ? 'grid-cols-3' : 'grid-cols-2'}`}>
            {/* Voice */}
            <button
              onClick={voiceState === 'listening' ? stopVoice : startVoice}
              aria-label={voiceState === 'listening' ? 'Stop listening' : 'Start voice search'}
              className={`flex flex-col items-center justify-center gap-2 py-3.5 rounded-2xl text-xs font-bold transition-all duration-200 cursor-pointer active:scale-95 ${
                voiceState === 'listening'
                  ? 'bg-gradient-to-b from-red-500 to-red-600 text-white shadow-lg shadow-red-300/50 animate-pulse'
                  : 'bg-gradient-to-b from-red-50 to-red-100/80 text-red-600 border border-red-200/60 hover:from-red-100 hover:to-red-200/80 hover:shadow-sm hover:shadow-red-200/60'
              }`}
            >
              <MicIcon />
              <span className="leading-none">{voiceState === 'listening' ? s.voiceListening : s.voiceBtn}</span>
            </button>

            {/* Camera scan */}
            <div
              onClickCapture={() => voiceState === 'listening' && stopVoice()}
              className="flex flex-col items-center justify-center gap-2 py-3.5 rounded-2xl bg-gradient-to-b from-blue-50 to-blue-100/80 text-blue-700 border border-blue-200/60 cursor-pointer hover:from-blue-100 hover:to-blue-200/80 hover:shadow-sm hover:shadow-blue-200/60 active:scale-95 transition-all duration-200"
            >
              <CameraSearch onResult={name => setQuery(name)} iconOnly />
              <span className="text-xs font-bold leading-none">{s.scanBtn}</span>
            </div>

            {/* Call */}
            {PHONE && (
              <a
                href={`tel:${PHONE}`}
                aria-label="Call the store"
                className="flex flex-col items-center justify-center gap-2 py-3.5 rounded-2xl bg-gradient-to-b from-emerald-50 to-emerald-100/80 text-emerald-700 border border-emerald-200/60 cursor-pointer hover:from-emerald-100 hover:to-emerald-200/80 hover:shadow-sm hover:shadow-emerald-200/60 active:scale-95 transition-all duration-200"
              >
                <PhoneIcon />
                <span className="text-xs font-bold leading-none">{s.callBtn}</span>
              </a>
            )}
          </div>

          {voiceError && (
            <p className="text-red-500 text-xs text-center mt-2.5 font-medium">{voiceError}</p>
          )}
        </div>
      </div>

      {/* ── RESULTS ─────────────────────────────────────────────────────────── */}
      <div className="relative z-10 max-w-lg mx-auto px-4 mt-5 pb-14">
        {loading ? (
          <div className="space-y-2.5">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="bg-white/80 rounded-2xl px-5 py-4 shadow-sm border border-gray-100 animate-pulse flex justify-between items-center">
                <div>
                  <div className="h-4 bg-slate-200/80 rounded-lg w-40 mb-2" />
                  <div className="h-3 bg-slate-200/80 rounded-lg w-16" />
                </div>
                <div className="h-7 bg-slate-200/80 rounded-full w-22" />
              </div>
            ))}
          </div>
        ) : query && filtered.length === 0 ? (
          <div className="text-center py-16 animate-fade-up">
            <SearchEmptyIcon />
            <p className="text-gray-800 font-display font-bold text-xl mt-5">{s.noResults}</p>
            <p className="text-gray-400 text-sm mt-2 leading-relaxed">{s.noResultsHint}</p>
          </div>
        ) : (
          <>
            {filtered.length > 0 && (
              <div className="flex items-center gap-3 mb-3">
                <div className="flex-1 h-px bg-slate-200/60" />
                <span className="text-xs text-slate-400 font-semibold whitespace-nowrap">
                  {filtered.length} {lang === 'hi' ? 'दवाइयाँ' : 'medicines'}
                </span>
                <div className="flex-1 h-px bg-slate-200/60" />
              </div>
            )}
            <ul className="space-y-2.5">
              {filtered.map((m, i) => (
                <MedicineCard key={m.id} medicine={m} s={s} index={i} />
              ))}
            </ul>
          </>
        )}
      </div>
    </div>
  )
}

// ── Sub-components ─────────────────────────────────────────────────────────────
function MedicineCard({ medicine: m, s, index }) {
  return (
    <li
      className="relative bg-white rounded-2xl pl-5 pr-4 py-4 flex justify-between items-center border border-gray-100/80 shadow-sm hover:shadow-xl hover:shadow-slate-200/70 hover:-translate-y-0.5 hover:border-slate-200 transition-all duration-300 overflow-hidden animate-fade-up"
      style={{ animationDelay: `${index * 55}ms` }}
    >
      {/* Stock-status accent bar */}
      <div className={`absolute left-0 top-4 bottom-4 w-1 rounded-r-full ${m.quantity > 0 ? 'bg-emerald-400' : 'bg-red-400'}`} />

      <div className="ml-2">
        <p className="font-display font-semibold text-gray-900 text-base leading-tight">{m.name}</p>
        <p className="text-sm text-slate-400 mt-0.5 font-medium">₹{m.price}</p>
      </div>

      {m.quantity > 0 ? (
        <span className="flex items-center gap-1.5 bg-emerald-50 text-emerald-700 text-sm font-semibold px-3 py-1.5 rounded-full border border-emerald-100/80 whitespace-nowrap flex-shrink-0">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 flex-shrink-0" />
          {s.inStock}
        </span>
      ) : (
        <span className="flex items-center gap-1.5 bg-red-50 text-red-600 text-sm font-semibold px-3 py-1.5 rounded-full border border-red-100/80 whitespace-nowrap flex-shrink-0">
          <span className="w-1.5 h-1.5 rounded-full bg-red-400 flex-shrink-0" />
          {s.outOfStock}
        </span>
      )}
    </li>
  )
}

// ── Icons ──────────────────────────────────────────────────────────────────────
function PillIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={18} height={18} viewBox="0 0 24 24"
      fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"
      className="text-white flex-shrink-0">
      <path d="m10.5 20.5 10-10a4.95 4.95 0 1 0-7-7l-10 10a4.95 4.95 0 1 0 7 7Z" />
      <path d="M8.5 8.5 15.5 15.5" />
    </svg>
  )
}

function SearchInputIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={16} height={16} viewBox="0 0 24 24"
      fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
      className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
      <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  )
}

function MicIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={22} height={22} viewBox="0 0 24 24"
      fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="9" y="2" width="6" height="11" rx="3" />
      <path d="M5 10a7 7 0 0 0 14 0" />
      <line x1="12" y1="19" x2="12" y2="22" /><line x1="8" y1="22" x2="16" y2="22" />
    </svg>
  )
}

function PhoneIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={22} height={22} viewBox="0 0 24 24"
      fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.1 11.91 19.79 19.79 0 0 1 1.07 3.28 2 2 0 0 1 3 1h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L7.09 8.91a16 16 0 0 0 6.72 6.72l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
    </svg>
  )
}

function SearchEmptyIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={60} height={60} viewBox="0 0 24 24"
      fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"
      className="text-slate-300 mx-auto">
      <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
      <line x1="8" y1="11" x2="14" y2="11" />
    </svg>
  )
}
