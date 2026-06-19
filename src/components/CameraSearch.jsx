import { useState, useRef, useCallback } from 'react'
import { GoogleGenerativeAI } from '@google/generative-ai'

// ─── Gemini Vision client ────────────────────────────────────────────────────
const API_KEY = import.meta.env.VITE_GEMINI_API_KEY
const genAI = API_KEY && API_KEY !== 'your_gemini_api_key_here'
  ? new GoogleGenerativeAI(API_KEY)
  : null

const MODEL = 'gemini-1.5-flash'

const SYSTEM_PROMPT = `You are a pharmacist's assistant specialising in reading medicine packaging.

Look at this image and identify the medicine.

Return a JSON object with this exact shape:
{
  "name": "medicine name and dosage, e.g. Paracetamol 500mg",
  "confidence": "high | medium | low",
  "details": "any extra info: manufacturer, form (tablet/syrup/gel), etc."
}

Rules:
- "name" must be the primary medicine name + strength only (e.g. "Ibuprofen 400mg")
- If you cannot read any medicine name, set name to ""
- Respond with raw JSON only, no markdown fences`

async function analyzeWithGemini(base64Data, mimeType = 'image/jpeg') {
  if (!genAI) throw new Error('NO_API_KEY')

  const model = genAI.getGenerativeModel({ model: MODEL })

  const result = await model.generateContent([
    SYSTEM_PROMPT,
    { inlineData: { data: base64Data, mimeType } },
  ])

  const text = result.response.text().trim()

  // Strip markdown fences if model added them anyway
  const clean = text.replace(/^```json\s*/i, '').replace(/```\s*$/, '').trim()

  try {
    return JSON.parse(clean)
  } catch {
    // Fallback: treat whole response as the name
    return { name: clean, confidence: 'low', details: '' }
  }
}

// ─── State machine ───────────────────────────────────────────────────────────
const S = { IDLE: 'idle', PREVIEW: 'preview', ANALYZING: 'analyzing', DONE: 'done', ERROR: 'error' }

// ─── Component ───────────────────────────────────────────────────────────────
export function CameraSearch({ onResult }) {
  const [state, setState] = useState(S.IDLE)
  const [isOpen, setIsOpen] = useState(false)
  const [imageSrc, setImageSrc] = useState(null)
  const [result, setResult] = useState(null)   // { name, confidence, details }
  const [error, setError] = useState('')

  const videoRef = useRef(null)
  const canvasRef = useRef(null)
  const fileRef = useRef(null)
  const streamRef = useRef(null)

  // ── camera helpers ──────────────────────────────────────────────────────────
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

  // ── capture photo from live feed ────────────────────────────────────────────
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

  // ── send to Gemini Vision ───────────────────────────────────────────────────
  const processImage = useCallback(async (dataUrl) => {
    setImageSrc(dataUrl)
    setState(S.ANALYZING)
    setResult(null)
    setError('')

    if (!genAI) {
      setError('Gemini API key not configured. Please add VITE_GEMINI_API_KEY to your .env file.')
      setState(S.ERROR)
      return
    }

    try {
      // dataUrl → base64 (strip the "data:image/jpeg;base64," prefix)
      const [meta, base64] = dataUrl.split(',')
      const mimeType = meta.match(/:(.*?);/)?.[1] ?? 'image/jpeg'
      const parsed = await analyzeWithGemini(base64, mimeType)
      setResult(parsed)
      setState(S.DONE)
      if (parsed.name) onResult(parsed.name)
    } catch (err) {
      const msg = err.message === 'NO_API_KEY'
        ? 'Gemini API key not configured.'
        : `Analysis failed: ${err.message}`
      setError(msg)
      setState(S.ERROR)
    }
  }, [onResult])

  const useThisResult = useCallback(() => {
    if (result?.name) onResult(result.name)
    close()
  }, [result, onResult, close])

  const confidenceBadge = {
    high:   'bg-green-100 text-green-700',
    medium: 'bg-yellow-100 text-yellow-700',
    low:    'bg-orange-100 text-orange-700',
  }

  // ─── render ─────────────────────────────────────────────────────────────────
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
        title="Scan medicine label with AI"
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
                <SparkleIcon />
                <h2 className="font-semibold text-gray-800 text-sm">AI Medicine Scanner</h2>
                <span className="text-[10px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded font-medium">
                  Gemini Vision
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
                    {/* Viewfinder */}
                    <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                      <div className="w-4/5 h-1/2 relative">
                        <span className="absolute -top-0.5 -left-0.5 w-5 h-5 border-t-2 border-l-2 border-blue-400 rounded-tl" />
                        <span className="absolute -top-0.5 -right-0.5 w-5 h-5 border-t-2 border-r-2 border-blue-400 rounded-tr" />
                        <span className="absolute -bottom-0.5 -left-0.5 w-5 h-5 border-b-2 border-l-2 border-blue-400 rounded-bl" />
                        <span className="absolute -bottom-0.5 -right-0.5 w-5 h-5 border-b-2 border-r-2 border-blue-400 rounded-br" />
                        <div className="absolute inset-0 border border-white/25 rounded-sm" />
                      </div>
                    </div>
                    {/* Scan line animation */}
                    <div className="absolute left-[10%] right-[10%] h-0.5 bg-blue-400/70 animate-scan-line rounded" />
                  </div>
                  <p className="text-xs text-gray-500 text-center">
                    Align the medicine label inside the frame
                  </p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => fileRef.current?.click()}
                      className="flex-1 border border-gray-300 text-gray-700 py-2.5 rounded-lg text-sm hover:bg-gray-50 transition-colors"
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

              {/* ── ANALYZING / DONE / ERROR: show captured image ── */}
              {imageSrc && state !== S.PREVIEW && (
                <div className="space-y-3">
                  {/* Captured image */}
                  <div className="rounded-xl overflow-hidden border border-gray-200 aspect-video bg-gray-900 relative">
                    <img src={imageSrc} alt="Captured" className="w-full h-full object-contain" />
                    {state === S.ANALYZING && (
                      <div className="absolute inset-0 bg-black/50 flex flex-col items-center justify-center gap-3">
                        <div className="flex items-center gap-2 text-white">
                          <SpinnerIcon />
                          <span className="text-sm font-medium">Analysing with Gemini Vision…</span>
                        </div>
                        {/* Shimmer bar */}
                        <div className="w-48 h-1.5 bg-white/20 rounded-full overflow-hidden">
                          <div className="h-full bg-blue-400 rounded-full animate-shimmer" />
                        </div>
                      </div>
                    )}
                  </div>

                  {/* ── DONE ── */}
                  {state === S.DONE && result && (
                    <div className="space-y-3">
                      <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-200 rounded-xl p-4 space-y-2">
                        <div className="flex items-center justify-between">
                          <p className="text-xs font-semibold text-blue-600 uppercase tracking-wide">
                            ✨ AI Detected
                          </p>
                          {result.confidence && (
                            <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${confidenceBadge[result.confidence] ?? confidenceBadge.low}`}>
                              {result.confidence} confidence
                            </span>
                          )}
                        </div>
                        <p className="text-base font-bold text-gray-900 break-words">
                          {result.name || <span className="italic text-gray-400 font-normal">No medicine name detected</span>}
                        </p>
                        {result.details && (
                          <p className="text-xs text-gray-500 leading-relaxed">{result.details}</p>
                        )}
                      </div>

                      <div className="flex gap-2">
                        <button
                          onClick={startCamera}
                          className="flex-1 border border-gray-300 text-gray-700 py-2.5 rounded-lg text-sm hover:bg-gray-50 transition-colors"
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
                      <div className="bg-red-50 border border-red-200 rounded-xl p-4">
                        <p className="text-sm font-medium text-red-700 mb-1">⚠️ Analysis failed</p>
                        <p className="text-xs text-red-500">{error}</p>
                        {error.includes('API key') && (
                          <a
                            href="https://aistudio.google.com/app/apikey"
                            target="_blank"
                            rel="noreferrer"
                            className="inline-block mt-2 text-xs text-blue-600 underline"
                          >
                            Get a free Gemini API key →
                          </a>
                        )}
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => fileRef.current?.click()}
                          className="flex-1 border border-gray-300 text-gray-700 py-2.5 rounded-lg text-sm hover:bg-gray-50"
                        >
                          📁 Upload different photo
                        </button>
                        <button
                          onClick={startCamera}
                          className="flex-1 border border-gray-300 text-gray-700 py-2.5 rounded-lg text-sm hover:bg-gray-50"
                        >
                          🔄 Retake
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Hidden canvas for frame capture */}
            <canvas ref={canvasRef} className="hidden" />
          </div>
        </div>
      )}

      {/* Inline CSS for animations not supported by Tailwind out-of-box */}
      <style>{`
        @keyframes scan-line {
          0%   { top: 15%; }
          50%  { top: 80%; }
          100% { top: 15%; }
        }
        .animate-scan-line { animation: scan-line 2s ease-in-out infinite; position: absolute; }

        @keyframes shimmer {
          0%   { transform: translateX(-100%); }
          100% { transform: translateX(300%); }
        }
        .animate-shimmer { animation: shimmer 1.4s ease-in-out infinite; }
      `}</style>
    </>
  )
}

// ─── Icons ───────────────────────────────────────────────────────────────────
function CameraIcon({ size = 18 }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24"
      fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z" />
      <circle cx="12" cy="13" r="3" />
    </svg>
  )
}

function SparkleIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={16} height={16} viewBox="0 0 24 24"
      fill="none" stroke="#3b82f6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z" />
      <path d="M5 3l.9 2.4L8 6.3l-2.4.9L5 9.6l-.9-2.4L2 6.3l2.4-.9z" />
      <path d="M19 14l.9 2.4 2.4.9-2.4.9-.9 2.4-.9-2.4-2.4-.9 2.4-.9z" />
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
      fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
      className="animate-spin">
      <path d="M21 12a9 9 0 1 1-6.219-8.56" />
    </svg>
  )
}
