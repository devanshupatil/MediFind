import { useState, useRef, useCallback } from 'react'
import Groq from 'groq-sdk'

// ─── Groq Vision client ───────────────────────────────────────────────────────
const GROQ_API_KEY = import.meta.env.VITE_GROQ_API_KEY
const isKeyReady = GROQ_API_KEY && GROQ_API_KEY !== 'your_groq_api_key_here'

// Use llama-4-scout — Groq's fastest free multimodal model
const VISION_MODEL = 'meta-llama/llama-4-scout-17b-16e-instruct'

const PROMPT = `You are a pharmacist's assistant. Look at this medicine packaging image.

Extract the medicine information and return ONLY a JSON object in this exact format:
{
  "name": "Medicine name and dosage strength e.g. Paracetamol 500mg",
  "confidence": "high | medium | low",
  "details": "Brand name, manufacturer, tablet/syrup/gel, other info if visible"
}

Rules:
- "name" = primary generic name + dosage only (e.g. "Ibuprofen 400mg")
- If no medicine found, set name to empty string ""
- Return raw JSON only — no markdown, no explanation`

async function analyzeWithGroq(base64Data, mimeType = 'image/jpeg') {
  if (!isKeyReady) throw new Error('NO_API_KEY')

  const client = new Groq({
    apiKey: GROQ_API_KEY,
    dangerouslyAllowBrowser: true,   // required for browser usage
  })

  const response = await client.chat.completions.create({
    model: VISION_MODEL,
    max_tokens: 256,
    messages: [
      {
        role: 'user',
        content: [
          { type: 'text', text: PROMPT },
          {
            type: 'image_url',
            image_url: { url: `data:${mimeType};base64,${base64Data}` },
          },
        ],
      },
    ],
  })

  const raw = response.choices[0]?.message?.content?.trim() ?? ''
  // Strip accidental markdown fences
  const clean = raw.replace(/^```json\s*/i, '').replace(/```\s*$/, '').trim()

  try {
    return JSON.parse(clean)
  } catch {
    return { name: clean, confidence: 'low', details: '' }
  }
}

// ─── State machine ────────────────────────────────────────────────────────────
const S = { IDLE: 'idle', PREVIEW: 'preview', ANALYZING: 'analyzing', DONE: 'done', ERROR: 'error' }

// ─── Component ────────────────────────────────────────────────────────────────
export function CameraSearch({ onResult }) {
  const [state, setState] = useState(S.IDLE)
  const [isOpen, setIsOpen] = useState(false)
  const [imageSrc, setImageSrc] = useState(null)
  const [result, setResult] = useState(null)
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
    setResult(null)
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
    setResult(null)
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

  // ── send image to Groq Vision ───────────────────────────────────────────────
  const processImage = useCallback(async (dataUrl) => {
    setImageSrc(dataUrl)
    setState(S.ANALYZING)
    setResult(null)
    setError('')

    if (!isKeyReady) {
      setError('Groq API key not set. Add VITE_GROQ_API_KEY to your .env file, then restart the dev server.')
      setState(S.ERROR)
      return
    }

    try {
      const [meta, base64] = dataUrl.split(',')
      const mimeType = meta.match(/:(.*?);/)?.[1] ?? 'image/jpeg'
      const parsed = await analyzeWithGroq(base64, mimeType)
      setResult(parsed)
      setState(S.DONE)
      if (parsed.name) onResult(parsed.name)
    } catch (err) {
      setError(err.message.includes('NO_API_KEY')
        ? 'Groq API key not configured.'
        : `Analysis failed: ${err.message}`)
      setState(S.ERROR)
    }
  }, [onResult])

  const useThisResult = useCallback(() => {
    if (result?.name) onResult(result.name)
    close()
  }, [result, onResult, close])

  const confidenceBadge = {
    high:   'bg-green-100 text-green-700 border-green-200',
    medium: 'bg-yellow-100 text-yellow-700 border-yellow-200',
    low:    'bg-orange-100 text-orange-700 border-orange-200',
  }

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
        title="Scan medicine label with Groq AI"
        className="flex items-center gap-2 bg-blue-700 text-white px-4 py-2 rounded-lg font-medium hover:bg-blue-800 active:scale-95 transition-all duration-150 shadow-sm whitespace-nowrap"
      >
        <CameraIcon size={17} />
        <span className="hidden sm:inline text-sm">Scan</span>
      </button>

      {/* Modal */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">

            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <LightningIcon />
                <h2 className="font-semibold text-gray-800 text-sm">AI Medicine Scanner</h2>
                <span className="text-[10px] bg-orange-100 text-orange-700 border border-orange-200 px-1.5 py-0.5 rounded-full font-semibold tracking-wide">
                  Groq · Free
                </span>
              </div>
              <button
                onClick={close}
                className="text-gray-400 hover:text-gray-600 transition-colors p-1 rounded-lg hover:bg-gray-100"
              >
                <XIcon />
              </button>
            </div>

            <div className="p-5 space-y-4">

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

              {/* ── Captured image (ANALYZING / DONE / ERROR) ── */}
              {imageSrc && state !== S.PREVIEW && (
                <div className="space-y-3">
                  <div className="rounded-xl overflow-hidden border border-gray-200 aspect-video bg-gray-900 relative">
                    <img src={imageSrc} alt="Captured" className="w-full h-full object-contain" />

                    {/* Analyzing overlay */}
                    {state === S.ANALYZING && (
                      <div className="absolute inset-0 bg-black/55 flex flex-col items-center justify-center gap-3">
                        <div className="flex items-center gap-2.5 text-white">
                          <SpinnerIcon />
                          <span className="text-sm font-medium">Analysing with Groq Vision…</span>
                        </div>
                        {/* Groq speed indicator */}
                        <div className="flex items-center gap-1.5 text-orange-300 text-xs">
                          <LightningIcon size={12} />
                          <span>Llama 4 Scout · Ultra-fast inference</span>
                        </div>
                        <div className="w-44 h-1 bg-white/10 rounded-full overflow-hidden mt-1">
                          <div className="h-full bg-orange-400 rounded-full animate-shimmer" />
                        </div>
                      </div>
                    )}
                  </div>

                  {/* ── DONE ── */}
                  {state === S.DONE && result && (
                    <div className="space-y-3">
                      <div className="bg-gradient-to-br from-orange-50 to-amber-50 border border-orange-200 rounded-xl p-4 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-semibold text-orange-600 uppercase tracking-wide flex items-center gap-1">
                            <LightningIcon size={11} /> Groq Vision result
                          </span>
                          {result.confidence && (
                            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${confidenceBadge[result.confidence] ?? confidenceBadge.low}`}>
                              {result.confidence} confidence
                            </span>
                          )}
                        </div>
                        <p className="text-base font-bold text-gray-900 break-words leading-snug">
                          {result.name || <span className="italic text-gray-400 font-normal text-sm">No medicine name detected</span>}
                        </p>
                        {result.details && (
                          <p className="text-xs text-gray-500 leading-relaxed pt-0.5 border-t border-orange-100">{result.details}</p>
                        )}
                      </div>

                      <div className="flex gap-2">
                        <button
                          onClick={startCamera}
                          className="flex-1 border border-gray-200 text-gray-600 py-2.5 rounded-lg text-sm hover:bg-gray-50 transition-colors"
                        >
                          🔄 Retake
                        </button>
                        <button
                          onClick={useThisResult}
                          disabled={!result.name}
                          className="flex-1 bg-blue-700 text-white py-2.5 rounded-lg text-sm font-semibold hover:bg-blue-800 disabled:opacity-40 transition-colors flex items-center justify-center gap-1.5"
                        >
                          🔍 Search this
                        </button>
                      </div>
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
