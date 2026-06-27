import { useState, useRef, useCallback } from 'react'
import Groq from 'groq-sdk'
import { supabase } from '../lib/supabase'

// ─── Groq Vision client ───────────────────────────────────────────────────────
const GROQ_API_KEY = import.meta.env.VITE_GROQ_API_KEY
const isKeyReady = GROQ_API_KEY && GROQ_API_KEY !== 'your_groq_api_key_here'

const VISION_MODEL = 'meta-llama/llama-4-scout-17b-16e-instruct'

// Prompt: extract text and separately flag name candidates
const OCR_PROMPT = `You are a medicine label OCR expert. Analyse this medicine packaging image.
Return ONLY a JSON object in this exact format (no markdown, no explanation):
{
  "name_candidates": ["list of likely brand/generic names and dosage strings — short phrases only, e.g. Crocin Advance, Paracetamol 500mg, Ibuprofen 400mg"],
  "all_text": ["every other text fragment visible — manufacturer, instructions, batch, etc."]
}
Rules:
- name_candidates: ONLY short (≤5 words) brand/generic/dosage fragments. These are the most prominent, largest text on the pack.
- all_text: everything else readable on the label.
- Return raw JSON only.`

/** Returns { nameCandidates: string[], allText: string[] } */
async function extractTextFromImage(base64Data, mimeType = 'image/jpeg') {
  if (!isKeyReady) throw new Error('NO_API_KEY')

  const client = new Groq({
    apiKey: GROQ_API_KEY,
    dangerouslyAllowBrowser: true,
  })

  const response = await client.chat.completions.create({
    model: VISION_MODEL,
    max_tokens: 600,
    messages: [
      {
        role: 'user',
        content: [
          { type: 'text', text: OCR_PROMPT },
          {
            type: 'image_url',
            image_url: { url: `data:${mimeType};base64,${base64Data}` },
          },
        ],
      },
    ],
  })

  const raw = response.choices[0]?.message?.content?.trim() ?? ''
  // Strip markdown fences
  const stripped = raw.replace(/^```json\s*/i, '').replace(/```\s*$/, '').trim()
  // Try to pull a JSON object out even if there's surrounding text
  const jsonMatch = stripped.match(/\{[\s\S]*\}/)
  const clean = jsonMatch ? jsonMatch[0] : stripped

  /** Filter out tokens that are clearly JSON structure artifacts */
  const isValidToken = (s) => {
    const t = s.trim()
    if (!t || t.length < 2 || t.length > 80) return false
    if (/^[{\[\]}",\\]/.test(t)) return false
    if (/^(name_candidates|all_text|:\s*\[)/.test(t)) return false
    return true
  }

  try {
    const parsed = JSON.parse(clean)
    return {
      nameCandidates: (Array.isArray(parsed.name_candidates) ? parsed.name_candidates : []).filter(isValidToken),
      allText: (Array.isArray(parsed.all_text) ? parsed.all_text : []).filter(isValidToken),
    }
  } catch {
    // Fallback: extract quoted strings from the raw output
    const quoted = [...stripped.matchAll(/"([^"]{2,60})"/g)].map(m => m[1]).filter(isValidToken)
    return { nameCandidates: quoted.slice(0, 8), allText: [] }
  }
}

// ─── Fuzzy matching helpers ───────────────────────────────────────────────────

/** Simple Levenshtein distance */
function levenshtein(a, b) {
  const m = a.length, n = b.length
  const dp = Array.from({ length: m + 1 }, (_, i) =>
    Array.from({ length: n + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0))
  )
  for (let i = 1; i <= m; i++)
    for (let j = 1; j <= n; j++)
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1])
  return dp[m][n]
}

/**
 * Score how well a medicine DB name matches extracted OCR data.
 * nameCandidates (brand/generic strings) get highest weight.
 * allText tokens are used only for secondary word-level matching.
 * Returns score 0–100.
 */
function scoreMatch(medicineName, nameCandidates, allText) {
  const mLower = medicineName.toLowerCase().trim()
  const mWords = mLower.split(/\s+/).filter(w => w.length >= 3)
  let best = 0

  // ── Priority 1: match against name candidates (short, high-confidence tokens) ──
  for (const token of nameCandidates) {
    const tLower = token.toLowerCase().trim()
    if (!tLower || tLower.length > 60) continue  // skip garbage

    // Exact full match
    if (mLower === tLower) { best = 100; break }

    // Medicine name fully contained in token or vice versa
    if (mLower.includes(tLower) || tLower.includes(mLower)) {
      best = Math.max(best, 95)
      continue
    }

    // Word-level: every word of medicine name found in this token
    const tWords = tLower.split(/\s+/).filter(w => w.length >= 3)
    const matchedWords = mWords.filter(w => tLower.includes(w) || tWords.some(tw => tw.includes(w)))
    if (mWords.length > 0 && matchedWords.length === mWords.length) {
      best = Math.max(best, 90)
      continue
    }
    if (mWords.length > 0 && matchedWords.length >= Math.ceil(mWords.length * 0.6)) {
      best = Math.max(best, 75)
      continue
    }

    // Levenshtein on the token itself vs medicine name
    if (tLower.length <= 40) {
      const dist = levenshtein(mLower, tLower)
      const similarity = 1 - dist / Math.max(mLower.length, tLower.length)
      if (similarity >= 0.8) best = Math.max(best, Math.round(similarity * 88))
      else if (similarity >= 0.65) best = Math.max(best, Math.round(similarity * 70))
    }

    // Per-word fuzzy against token words
    for (const word of mWords) {
      for (const tw of tWords) {
        const dist = levenshtein(word, tw)
        const sim = 1 - dist / Math.max(word.length, tw.length)
        if (sim >= 0.82) best = Math.max(best, Math.round(sim * 72))
      }
    }
  }

  // ── Priority 2: secondary check against all_text (lower ceiling) ──
  if (best < 50) {
    for (const token of allText) {
      const tLower = token.toLowerCase().trim()
      // Only use short all_text tokens (≤ 40 chars) to avoid false positives from instructions
      if (!tLower || tLower.length > 40) continue

      if (mLower.includes(tLower) || tLower.includes(mLower)) {
        best = Math.max(best, 70)  // capped lower than nameCandidates
        continue
      }
      for (const word of mWords) {
        if (tLower.includes(word)) best = Math.max(best, 55)
      }
    }
  }

  return best
}

/**
 * Fetch all medicines from Supabase and rank them against extracted OCR data.
 */
async function findMatchingMedicines({ nameCandidates, allText }, limit = 5) {
  const { data, error } = await supabase.from('medicines').select('*')
  if (error) throw new Error(error.message)
  if (!data || data.length === 0) return []

  const scored = data.map(med => ({
    ...med,
    score: scoreMatch(med.name, nameCandidates, allText),
  }))

  return scored
    .filter(m => m.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
}

// ─── State machine ────────────────────────────────────────────────────────────
const S = { IDLE: 'idle', PREVIEW: 'preview', ANALYZING: 'analyzing', MATCHING: 'matching', DONE: 'done', ERROR: 'error' }

// ─── Component ────────────────────────────────────────────────────────────────
export function CameraSearch({ onResult, iconOnly = false }) {
  const [state, setState] = useState(S.IDLE)
  const [isOpen, setIsOpen] = useState(false)
  const [imageSrc, setImageSrc] = useState(null)
  const [ocrData, setOcrData] = useState({ nameCandidates: [], allText: [] }) // structured OCR
  const [matches, setMatches] = useState([])          // top DB matches
  const [error, setError] = useState('')

  const videoRef = useRef(null)
  const canvasRef = useRef(null)
  const fileRef = useRef(null)
  const streamRef = useRef(null)

  // ── camera ──────────────────────────────────────────────────────────────────
  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach(t => t.stop())
    streamRef.current = null
  }, [])

  const startCamera = useCallback(async () => {
    setIsOpen(true)
    setState(S.PREVIEW)
    setImageSrc(null)
    setOcrData({ nameCandidates: [], allText: [] })
    setMatches([])
    setError('')
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
      })
      streamRef.current = stream
      if (videoRef.current) videoRef.current.srcObject = stream
    } catch {
      stopCamera()
      fileRef.current?.click()
    }
  }, [stopCamera])

  const close = useCallback(() => {
    stopCamera()
    setIsOpen(false)
    setState(S.IDLE)
    setImageSrc(null)
    setOcrData({ nameCandidates: [], allText: [] })
    setMatches([])
    setError('')
  }, [stopCamera])

  const capturePhoto = useCallback(() => {
    const video = videoRef.current
    const canvas = canvasRef.current
    if (!video || !canvas) return
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    canvas.getContext('2d').drawImage(video, 0, 0)
    const dataUrl = canvas.toDataURL('image/jpeg', 0.92)
    stopCamera()
    processImage(dataUrl)
  }, [stopCamera])

  // ── file / gallery picker ───────────────────────────────────────────────────
  const onFileChange = useCallback(e => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = ev => {
      setIsOpen(true)
      processImage(ev.target.result)
    }
    reader.readAsDataURL(file)
    e.target.value = ''
  }, [])

  // ── Main pipeline: OCR → DB match ──────────────────────────────────────────
  const processImage = useCallback(async (dataUrl) => {
    setImageSrc(dataUrl)
    setState(S.ANALYZING)
    setOcrData({ nameCandidates: [], allText: [] })
    setMatches([])
    setError('')

    if (!isKeyReady) {
      setError('Groq API key not set. Add VITE_GROQ_API_KEY to your .env file, then restart the dev server.')
      setState(S.ERROR)
      return
    }

    try {
      // Step 1: extract text — AI returns { nameCandidates, allText }
      const [meta, base64] = dataUrl.split(',')
      const mimeType = meta.match(/:(.*?);/)?.[1] ?? 'image/jpeg'
      const extracted = await extractTextFromImage(base64, mimeType)
      setOcrData(extracted)

      // Step 2: fuzzy-match name candidates + allText against the DB
      setState(S.MATCHING)
      const topMatches = await findMatchingMedicines(extracted)
      setMatches(topMatches)
      setState(S.DONE)

      // Auto-select if there is exactly one strong match
      if (topMatches.length === 1 && topMatches[0].score >= 80) {
        onResult(topMatches[0].name)
      }
    } catch (err) {
      setError(err.message.includes('NO_API_KEY')
        ? 'Groq API key not configured.'
        : `Analysis failed: ${err.message}`)
      setState(S.ERROR)
    }
  }, [onResult])

  const selectMatch = useCallback((name) => {
    onResult(name)
    close()
  }, [onResult, close])

  // ─── render ──────────────────────────────────────────────────────────────────
  return (
    <>
      {/* Hidden file input */}
      <input
        ref={fileRef}
        id="camera-file-input"
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={onFileChange}
      />

      {/* Trigger button */}
      <button
        id="camera-search-btn"
        onClick={startCamera}
        title="Scan medicine label"
        aria-label="Scan medicine label"
        className={iconOnly
          ? 'flex items-center justify-center cursor-pointer'
          : 'flex items-center gap-2 bg-blue-700 text-white px-4 py-2 rounded-lg font-medium hover:bg-blue-800 active:scale-95 transition-all duration-150 shadow-sm whitespace-nowrap cursor-pointer'
        }
      >
        <CameraIcon size={iconOnly ? 22 : 17} />
        {!iconOnly && <span className="hidden sm:inline text-sm">Scan</span>}
      </button>

      {/* Modal */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-3">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md flex flex-col" style={{maxHeight:'92vh'}}>

            {/* Header — fixed */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 flex-shrink-0">
              <div className="flex items-center gap-2">
                <ScanIcon />
                <h2 className="font-semibold text-gray-800 text-sm">Medicine Label Scanner</h2>
                <span className="text-[10px] bg-orange-100 text-orange-700 border border-orange-200 px-1.5 py-0.5 rounded-full font-semibold tracking-wide">
                  Groq · OCR
                </span>
              </div>
              <button
                onClick={close}
                className="text-gray-400 hover:text-gray-600 transition-colors p-1 rounded-lg hover:bg-gray-100"
              >
                <XIcon />
              </button>
            </div>

            {/* Scrollable body */}
            <div className="p-4 space-y-3 overflow-y-auto flex-1">

              {/* ── PREVIEW: live camera ── */}
              {state === S.PREVIEW && (
                <div className="space-y-3">
                  <div className="relative bg-black rounded-xl overflow-hidden aspect-video">
                    <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
                    {/* Viewfinder overlay */}
                    <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                      <div className="w-4/5 h-1/2 relative">
                        <span className="absolute -top-0.5 -left-0.5 w-5 h-5 border-t-2 border-l-2 border-orange-400 rounded-tl" />
                        <span className="absolute -top-0.5 -right-0.5 w-5 h-5 border-t-2 border-r-2 border-orange-400 rounded-tr" />
                        <span className="absolute -bottom-0.5 -left-0.5 w-5 h-5 border-b-2 border-l-2 border-orange-400 rounded-bl" />
                        <span className="absolute -bottom-0.5 -right-0.5 w-5 h-5 border-b-2 border-r-2 border-orange-400 rounded-br" />
                        <div className="absolute inset-0 border border-white/20 rounded-sm" />
                      </div>
                    </div>
                    {/* Animated scan line */}
                    <div className="animate-scan-line absolute left-[10%] right-[10%] h-0.5 bg-orange-400/80 rounded shadow-[0_0_6px_2px_rgba(251,146,60,0.5)]" />
                  </div>
                  <p className="text-xs text-gray-500 text-center">Align the medicine label inside the frame</p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => fileRef.current?.click()}
                      className="flex-1 border border-gray-200 text-gray-600 py-2.5 rounded-lg text-sm hover:bg-gray-50 transition-colors"
                    >
                      📁 Upload photo
                    </button>
                    <button
                      onClick={capturePhoto}
                      className="flex-1 bg-blue-700 text-white py-2.5 rounded-lg text-sm font-medium hover:bg-blue-800 transition-colors flex items-center justify-center gap-2"
                    >
                      <CameraIcon size={15} /> Capture
                    </button>
                  </div>
                </div>
              )}

              {/* ── Captured image (ANALYZING / MATCHING / DONE / ERROR) ── */}
              {imageSrc && state !== S.PREVIEW && (
                <div className="space-y-3">

                  {/* Compact image — full size only while loading, thumbnail after */}
                  <div className={`rounded-xl overflow-hidden border border-gray-200 bg-gray-900 relative ${
                    state === S.ANALYZING || state === S.MATCHING ? 'aspect-video' : 'h-24'
                  }`}>
                    <img src={imageSrc} alt="Captured" className="w-full h-full object-contain" />

                    {/* Step overlays */}
                    {(state === S.ANALYZING || state === S.MATCHING) && (
                      <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center gap-3">
                        <div className="flex items-center gap-2.5 text-white">
                          <SpinnerIcon />
                          <span className="text-sm font-medium">
                            {state === S.ANALYZING ? 'Reading text from image…' : 'Matching against database…'}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5 text-orange-300 text-xs">
                          <LightningIcon size={12} />
                          <span>
                            {state === S.ANALYZING ? 'Groq OCR · Extracting all text' : 'Fuzzy matching medicines'}
                          </span>
                        </div>
                        <div className="w-44 h-1 bg-white/10 rounded-full overflow-hidden mt-1">
                          <div className="h-full bg-orange-400 rounded-full animate-shimmer" />
                        </div>
                      </div>
                    )}
                  </div>

                  {/* ── DONE ── */}
                  {state === S.DONE && (
                    <div className="space-y-2">

                      {/* Section header */}
                      <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide flex items-center gap-1">
                        <LightningIcon size={10} />
                        {matches.length > 0 ? 'Best matches in your database — tap to select' : 'No matches found'}
                      </p>

                      {/* Match cards */}
                      {matches.length > 0 ? (
                        <div className="space-y-2">
                          {matches.map((med, idx) => (
                            <button
                              key={med.id}
                              onClick={() => selectMatch(med.name)}
                              className={`w-full flex items-center gap-3 rounded-xl px-3 py-3 border transition-all duration-150 group text-left ${
                                idx === 0
                                  ? 'bg-blue-50 border-blue-300 hover:bg-blue-100'
                                  : 'bg-white border-gray-200 hover:border-blue-300 hover:bg-blue-50'
                              }`}
                            >
                              {/* Rank badge */}
                              <span className={`flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold ${
                                idx === 0 ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-500'
                              }`}>
                                {idx + 1}
                              </span>

                              {/* Medicine info */}
                              <div className="flex-1 min-w-0">
                                <p className={`font-semibold text-sm truncate ${
                                  idx === 0 ? 'text-blue-800' : 'text-gray-900 group-hover:text-blue-700'
                                }`}>
                                  {med.name}
                                </p>
                                <p className="text-xs text-gray-400 mt-0.5">
                                  ₹{med.price}
                                  <span className={`ml-2 font-medium ${
                                    med.quantity > 0 ? 'text-green-600' : 'text-red-500'
                                  }`}>
                                    {med.quantity > 0 ? '● In Stock' : '○ Out of Stock'}
                                  </span>
                                </p>
                              </div>

                              {/* Score + arrow */}
                              <div className="flex-shrink-0 flex items-center gap-1.5">
                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                                  med.score >= 80 ? 'bg-green-100 text-green-700 border-green-200'
                                  : med.score >= 50 ? 'bg-yellow-100 text-yellow-700 border-yellow-200'
                                  : 'bg-gray-100 text-gray-500 border-gray-200'
                                }`}>
                                  {med.score}%
                                </span>
                                <ArrowRightIcon />
                              </div>
                            </button>
                          ))}
                        </div>
                      ) : (
                        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-center">
                          <p className="text-sm font-semibold text-amber-700">No matching medicines found</p>
                          <p className="text-xs text-amber-500 mt-1">Try retaking with a clearer photo of the label.</p>
                        </div>
                      )}

                      <button
                        onClick={startCamera}
                        className="w-full border border-gray-200 text-gray-500 py-2 rounded-lg text-sm hover:bg-gray-50 transition-colors"
                      >
                        🔄 Retake photo
                      </button>
                    </div>
                  )}

                  {/* ── ERROR ── */}
                  {state === S.ERROR && (
                    <div className="space-y-3">
                      <div className="bg-red-50 border border-red-200 rounded-xl p-4 space-y-1">
                        <p className="text-sm font-semibold text-red-700">⚠️ Analysis failed</p>
                        <p className="text-xs text-red-500 leading-relaxed">{error}</p>
                        {error.includes('API key') && (
                          <a
                            href="https://console.groq.com/keys"
                            target="_blank"
                            rel="noreferrer"
                            className="inline-block mt-1.5 text-xs text-orange-600 underline font-medium"
                          >
                            Get your free Groq API key →
                          </a>
                        )}
                      </div>
                      <div className="flex gap-2">
                        <button onClick={() => fileRef.current?.click()} className="flex-1 border border-gray-200 text-gray-600 py-2.5 rounded-lg text-sm hover:bg-gray-50">
                          📁 Upload photo
                        </button>
                        <button onClick={startCamera} className="flex-1 border border-gray-200 text-gray-600 py-2.5 rounded-lg text-sm hover:bg-gray-50">
                          🔄 Retake
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            <canvas ref={canvasRef} className="hidden" />
          </div>
        </div>
      )}

      <style>{`
        @keyframes scan-line {
          0%   { top: 12%; }
          50%  { top: 82%; }
          100% { top: 12%; }
        }
        .animate-scan-line { animation: scan-line 2s ease-in-out infinite; position: absolute; }
        @keyframes shimmer {
          0%   { transform: translateX(-100%); }
          100% { transform: translateX(400%); }
        }
        .animate-shimmer { animation: shimmer 1.2s ease-in-out infinite; }
      `}</style>
    </>
  )
}

// ─── Icons ────────────────────────────────────────────────────────────────────
function CameraIcon({ size = 18 }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24"
      fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z" />
      <circle cx="12" cy="13" r="3" />
    </svg>
  )
}

function ScanIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={16} height={16} viewBox="0 0 24 24"
      fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
      className="text-blue-600">
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <path d="M7 9h10M7 12h10M7 15h6" />
    </svg>
  )
}

function LightningIcon({ size = 14 }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24"
      fill="currentColor" className="text-orange-500">
      <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
    </svg>
  )
}

function XIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={18} height={18} viewBox="0 0 24 24"
      fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  )
}

function SpinnerIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={18} height={18} viewBox="0 0 24 24"
      fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"
      className="animate-spin">
      <path d="M21 12a9 9 0 1 1-6.219-8.56" />
    </svg>
  )
}

function ArrowRightIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={14} height={14} viewBox="0 0 24 24"
      fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
      className="text-gray-400 group-hover:text-blue-500 transition-colors">
      <path d="M5 12h14M12 5l7 7-7 7" />
    </svg>
  )
}
