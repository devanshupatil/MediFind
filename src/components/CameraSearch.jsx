import { useState, useRef, useCallback, useEffect } from 'react'
import { createPortal } from 'react-dom'
import Groq from 'groq-sdk'
import { supabase } from '../lib/supabase'

const GROQ_API_KEY = import.meta.env.VITE_GROQ_API_KEY
const isKeyReady = GROQ_API_KEY && GROQ_API_KEY !== 'your_groq_api_key_here'

const VISION_MODEL = 'meta-llama/llama-4-scout-17b-16e-instruct'

const SHARP_THRESHOLD = 180  // auto-capture fires
const READY_THRESHOLD = 100  // "Almost ready"
const BLUR_THRESHOLD  = 40   // "Hold still..."

const OCR_PROMPT = `You are a medicine identification expert. Examine this medicine packaging image and identify the medicine.
Return ONLY a JSON object in this exact format (no markdown, no explanation):
{
  "medicine_name": "brand or most prominent name on the pack",
  "strength": "dosage strength e.g. 500mg, 10mg/5ml — empty string if not visible",
  "form": "tablet, capsule, syrup, injection, cream, drops, or other — empty string if not visible",
  "confidence": 0.0,
  "all_names": ["every name, brand, generic, and dosage string visible — short phrases only"]
}
Rules:
- medicine_name: the single most prominent name on the packaging.
- confidence: your confidence that medicine_name is correct (0.0 to 1.0).
- all_names: include brand name, generic name, dosage strings (e.g. "Paracetamol 500mg"). Max 8 items.
- Return raw JSON only. No markdown fences.\``

async function extractTextFromImage(base64Data, mimeType = 'image/jpeg') {
  if (!isKeyReady) throw new Error('NO_API_KEY')

  const client = new Groq({ apiKey: GROQ_API_KEY, dangerouslyAllowBrowser: true })

  const response = await client.chat.completions.create({
    model: VISION_MODEL,
    max_tokens: 1024,
    messages: [{
      role: 'user',
      content: [
        { type: 'text', text: OCR_PROMPT },
        { type: 'image_url', image_url: { url: `data:${mimeType};base64,${base64Data}` } },
      ],
    }],
  })

  const raw = response.choices[0]?.message?.content?.trim() ?? ''
  const stripped = raw.replace(/^```json\s*/i, '').replace(/```\s*$/, '').trim()
  const jsonMatch = stripped.match(/\{[\s\S]*\}/)
  if (!jsonMatch) throw new Error('No JSON in AI response')
  const parsed = JSON.parse(jsonMatch[0])
  return {
    medicine_name: parsed.medicine_name ?? '',
    strength:      parsed.strength ?? '',
    form:          parsed.form ?? '',
    confidence:    typeof parsed.confidence === 'number' ? parsed.confidence : 0,
    all_names:     Array.isArray(parsed.all_names) ? parsed.all_names.filter(s => typeof s === 'string' && s.trim()) : [],
  }
}

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

function scoreMatch(medicineName, nameCandidates, allText) {
  const mLower = medicineName.toLowerCase().trim()
  const mWords = mLower.split(/\s+/).filter(w => w.length >= 3)
  let best = 0

  for (const token of nameCandidates) {
    const tLower = token.toLowerCase().trim()
    if (!tLower || tLower.length > 60) continue
    if (mLower === tLower) { best = 100; break }
    if (mLower.includes(tLower) || tLower.includes(mLower)) { best = Math.max(best, 95); continue }
    const tWords = tLower.split(/\s+/).filter(w => w.length >= 3)
    const matchedWords = mWords.filter(w => tLower.includes(w) || tWords.some(tw => tw.includes(w)))
    if (mWords.length > 0 && matchedWords.length === mWords.length) { best = Math.max(best, 90); continue }
    if (mWords.length > 0 && matchedWords.length >= Math.ceil(mWords.length * 0.6)) { best = Math.max(best, 75); continue }
    if (tLower.length <= 40) {
      const dist = levenshtein(mLower, tLower)
      const similarity = 1 - dist / Math.max(mLower.length, tLower.length)
      if (similarity >= 0.8) best = Math.max(best, Math.round(similarity * 88))
      else if (similarity >= 0.65) best = Math.max(best, Math.round(similarity * 70))
    }
    for (const word of mWords) {
      for (const tw of tWords) {
        const dist = levenshtein(word, tw)
        const sim = 1 - dist / Math.max(word.length, tw.length)
        if (sim >= 0.82) best = Math.max(best, Math.round(sim * 72))
      }
    }
  }

  if (best < 50) {
    for (const token of allText) {
      const tLower = token.toLowerCase().trim()
      if (!tLower || tLower.length > 40) continue
      if (mLower.includes(tLower) || tLower.includes(mLower)) { best = Math.max(best, 70); continue }
      for (const word of mWords) {
        if (tLower.includes(word)) best = Math.max(best, 55)
      }
    }
  }

  return best
}

// Laplacian variance — higher = sharper. Runs on a small offscreen canvas (160x90).
function computeSharpness({ data, width, height }) {
  let sum = 0, count = 0
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const idx = (y * width + x) * 4
      const gray   = data[idx]*0.299   + data[idx+1]*0.587   + data[idx+2]*0.114
      const top    = data[((y-1)*width+x)*4]*0.299 + data[((y-1)*width+x)*4+1]*0.587 + data[((y-1)*width+x)*4+2]*0.114
      const bottom = data[((y+1)*width+x)*4]*0.299 + data[((y+1)*width+x)*4+1]*0.587 + data[((y+1)*width+x)*4+2]*0.114
      const left   = data[(y*width+x-1)*4]*0.299   + data[(y*width+x-1)*4+1]*0.587   + data[(y*width+x-1)*4+2]*0.114
      const right  = data[(y*width+x+1)*4]*0.299   + data[(y*width+x+1)*4+1]*0.587   + data[(y*width+x+1)*4+2]*0.114
      const lap = 4*gray - top - bottom - left - right
      sum += lap * lap
      count++
    }
  }
  return count > 0 ? sum / count : 0
}

async function fetchMedicines() {
  const { data, error } = await supabase
    .from('medicines')
    .select('id,name,price,quantity')
  if (error) throw new Error(error.message)
  return data ?? []
}

function findMatchingMedicines({ nameCandidates, allText }, medicines, limit = 5) {
  if (!medicines.length) return []
  return medicines
    .map(med => ({ ...med, score: scoreMatch(med.name, nameCandidates, allText) }))
    .filter(m => m.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
}

const S = { IDLE: 'idle', PREVIEW: 'preview', ANALYZING: 'analyzing', MATCHING: 'matching', WARN: 'warn', DONE: 'done', ERROR: 'error' }

function IconCameraSVG() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z" />
      <circle cx="12" cy="13" r="3" />
    </svg>
  )
}

export function CameraSearch({ onScanComplete, iconOnly = false }) {
  const [state, setState] = useState(S.IDLE)
  const [isOpen, setIsOpen] = useState(false)
  const [imageSrc, setImageSrc] = useState(null)
  const [error, setError] = useState('')
  const [warnMsg, setWarnMsg] = useState('')

  const videoRef = useRef(null)
  const canvasRef = useRef(null)
  const fileRef = useRef(null)
  const streamRef = useRef(null)
  const onScanCompleteRef = useRef(onScanComplete)
  useEffect(() => { onScanCompleteRef.current = onScanComplete }, [onScanComplete])

  const rafRef = useRef(null)
  const lastSampleRef = useRef(0)
  const sharpnessRef = useRef(0)
  const sharpLabelRef = useRef('blur')
  const [sharpLabel, setSharpLabel] = useState('blur')

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => { document.body.style.overflow = '' }
  }, [isOpen])

  useEffect(() => {
    if (state !== S.PREVIEW) {
      setSharpLabel('blur')
      sharpLabelRef.current = 'blur'
      return
    }
    const offscreen = document.createElement('canvas')
    offscreen.width = 160
    offscreen.height = 90
    const offCtx = offscreen.getContext('2d')

    const loop = (ts) => {
      rafRef.current = requestAnimationFrame(loop)
      if (ts - lastSampleRef.current < 100) return
      lastSampleRef.current = ts
      const video = videoRef.current
      if (!video || video.readyState < 2) return
      offCtx.drawImage(video, 0, 0, 160, 90)
      const score = computeSharpness(offCtx.getImageData(0, 0, 160, 90))
      sharpnessRef.current = score
      const next = score >= SHARP_THRESHOLD ? 'sharp' : score >= BLUR_THRESHOLD ? 'almost' : 'blur'
      if (next !== sharpLabelRef.current) {
        sharpLabelRef.current = next
        setSharpLabel(next)
      }
    }
    rafRef.current = requestAnimationFrame(loop)
    return () => {
      cancelAnimationFrame(rafRef.current)
    }
  }, [state])

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach(t => t.stop())
    streamRef.current = null
    cancelAnimationFrame(rafRef.current)
    rafRef.current = null
  }, [])

  const startCamera = useCallback(async () => {
    setIsOpen(true)
    setState(S.PREVIEW)
    setImageSrc(null)
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
    setError('')
    setWarnMsg('')
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

  const toJpeg = useCallback((dataUrl) => new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => {
      const MAX = 1000
      let w = img.naturalWidth, h = img.naturalHeight
      if (w > MAX || h > MAX) {
        if (w > h) { h = Math.round(h * MAX / w); w = MAX }
        else       { w = Math.round(w * MAX / h); h = MAX }
      }
      const canvas = document.createElement('canvas')
      canvas.width = w; canvas.height = h
      canvas.getContext('2d').drawImage(img, 0, 0, w, h)
      preprocessImage(canvas)
      resolve(canvas.toDataURL('image/jpeg', 0.88))
    }
    img.onerror = reject
    img.src = dataUrl
  }), [])

  const processImage = useCallback(async (dataUrl) => {
    setImageSrc(dataUrl)
    setState(S.ANALYZING)
    setError('')

    if (!isKeyReady) {
      setError('Groq API key not set.')
      setState(S.ERROR)
      return
    }

    try {
      const jpegUrl = await toJpeg(dataUrl)
      const base64 = jpegUrl.split(',')[1]

      const [extracted, medicines] = await Promise.all([
        extractTextFromImage(base64, 'image/jpeg'),
        fetchMedicines(),
      ])

      if (!extracted.all_names.length || extracted.confidence < 0.2) {
        setError("Couldn't identify this medicine — try better lighting or move closer.")
        setState(S.ERROR)
        return
      }

      setState(S.MATCHING)
      const topMatches = findMatchingMedicines(
        { nameCandidates: extracted.all_names, allText: [] },
        medicines
      )

      if (extracted.confidence < 0.5) {
        setState(S.WARN)
        setWarnMsg('Low confidence — please verify this result manually.')
        await new Promise(r => setTimeout(r, 1800))
      }

      onScanCompleteRef.current(jpegUrl, topMatches, {
        medicine_name: extracted.medicine_name,
        strength: extracted.strength,
        form: extracted.form,
      })
      close()
    } catch (err) {
      setError(err.message.includes('NO_API_KEY')
        ? 'Groq API key not configured.'
        : `Analysis failed: ${err.message}`)
      setState(S.ERROR)
    }
  }, [close, toJpeg])

  const isProcessing = state === S.ANALYZING || state === S.MATCHING || state === S.WARN

  return (
    <>
      <input ref={fileRef} id="camera-file-input" type="file" accept="image/*" className="hidden" onChange={onFileChange} />
      <canvas ref={canvasRef} className="hidden" />

      <button id="camera-search-btn" onClick={startCamera} aria-label="Scan medicine label" type="button">
        <IconCameraSVG />
        <span>Scan</span>
      </button>

      {isOpen && createPortal(
        <div className="cs-backdrop" role="dialog" aria-modal="true" aria-label="Medicine scanner">

          <div className="cs-modal">

            {/* ── Header ── */}
            <div className="cs-header">
              <div className="cs-header-left">
                <div className="cs-logo-dot" aria-hidden="true" />
                <span className="cs-title">
                  {state === S.PREVIEW && 'Scan Label'}
                  {isProcessing        && 'Analysing…'}
                  {state === S.ERROR   && 'Try Again'}
                </span>
              </div>
              <button className="cs-close-btn" onClick={close} aria-label="Close scanner" type="button">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                  <path d="M18 6 6 18M6 6l12 12"/>
                </svg>
              </button>
            </div>

            {/* ── Viewfinder / Preview ── */}
            {state === S.PREVIEW && (
              <>
                <div className="cs-viewfinder">
                  <video ref={videoRef} autoPlay playsInline muted className="cs-video" />
                  {/* Corner scan frame */}
                  <div className="cs-frame" aria-hidden="true">
                    <span className="cs-corner cs-corner--tl" />
                    <span className="cs-corner cs-corner--tr" />
                    <span className="cs-corner cs-corner--bl" />
                    <span className="cs-corner cs-corner--br" />
                    <span className="cs-scanline" />
                  </div>
                </div>
                <div className="cs-sharp-indicator" aria-live="polite" aria-atomic="true">
                  <span className={`cs-sharp-dot cs-sharp-dot--${sharpLabel}`} aria-hidden="true" />
                  <span className="cs-sharp-label">
                    {sharpLabel === 'blur'   && 'Hold still...'}
                    {sharpLabel === 'almost' && 'Almost ready'}
                    {sharpLabel === 'sharp'  && 'Ready ✓'}
                  </span>
                </div>
                <div className="cs-toolbar">
                  <button className="cs-icon-btn" onClick={() => fileRef.current?.click()} aria-label="Upload image" type="button">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
                    </svg>
                    <span>Upload</span>
                  </button>
                  <button className="cs-capture-btn" onClick={capturePhoto} aria-label="Capture photo" type="button">
                    <span className="cs-capture-inner" />
                  </button>
                  <button className="cs-icon-btn" onClick={close} aria-label="Cancel" type="button">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                      <path d="M18 6 6 18M6 6l12 12"/>
                    </svg>
                    <span>Cancel</span>
                  </button>
                </div>
              </>
            )}

            {/* ── Processing ── */}
            {isProcessing && (
              <div className="cs-processing">
                {imageSrc && <img src={imageSrc} alt="Captured medicine" className="cs-thumb" />}
                <div className="cs-spinner" aria-hidden="true">
                  <span /><span /><span />
                </div>
                <p className="cs-processing-text">
                  {state === S.ANALYZING ? 'Reading label text…' : 'Matching medicines…'}
                </p>
              </div>
            )}


            {/* ── Confidence warning ── */}
            {state === S.WARN && (
              <div className="cs-analyzing">
                {imageSrc && <img src={imageSrc} alt="Captured medicine" className="cs-thumb" />}
                <div className="cs-confidence-warning" role="alert">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                    <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.4 0z" />
                    <line x1="12" y1="9" x2="12" y2="13" />
                    <line x1="12" y1="17" x2="12.01" y2="17" />
                  </svg>
                  {warnMsg}
                </div>
              </div>
            )}

            {/* ── Error ── */}
            {state === S.ERROR && (
              <div className="cs-error">
                <div className="cs-error-icon" aria-hidden="true">
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                    <circle cx="12" cy="12" r="10"/><path d="M12 8v4m0 4h.01"/>
                  </svg>
                </div>
                <p className="cs-error-title">Scan failed</p>
                <p className="cs-error-sub">{error}</p>
                <div className="cs-results-footer">
                  <button className="cs-retry-btn" onClick={startCamera} type="button">Try Again</button>
                </div>
              </div>
            )}

          </div>
        </div>,
        document.body
      )}
    </>
  )
}

// Named exports for testing
function preprocessImage(canvas) {
  const ctx = canvas.getContext('2d')
  const w = canvas.width, h = canvas.height
  const src = ctx.getImageData(0, 0, w, h)
  const d = new Uint8ClampedArray(src.data)

  // Pass 1: Contrast stretch — global min/max across all channels (preserves hue, boosts overall contrast)
  let min = 255, max = 0
  for (let i = 0; i < d.length; i += 4) {
    for (let c = 0; c < 3; c++) {
      if (d[i+c] < min) min = d[i+c]
      if (d[i+c] > max) max = d[i+c]
    }
  }
  if (max - min >= 10) {
    const range = max - min
    for (let i = 0; i < d.length; i += 4) {
      for (let c = 0; c < 3; c++) {
        d[i+c] = Math.round((d[i+c] - min) / range * 255)
      }
    }
  }

  // Pass 2: Unsharp mask — 3x3 kernel [0,-1,0; -1,5,-1; 0,-1,0]
  // Border pixels (row 0, row h-1, col 0, col w-1) are copied unchanged.
  const sharpened = new Uint8ClampedArray(d)
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = (y * w + x) * 4
      for (let c = 0; c < 3; c++) {
        const val = 5 * d[i+c]
          - d[((y-1)*w + x)*4 + c]
          - d[((y+1)*w + x)*4 + c]
          - d[(y*w + x-1)*4 + c]
          - d[(y*w + x+1)*4 + c]
        sharpened[i+c] = Math.min(255, Math.max(0, val))
      }
      sharpened[i+3] = d[i+3]
    }
  }

  const outData = (typeof ImageData !== 'undefined')
    ? new ImageData(sharpened, w, h)
    : { data: sharpened, width: w, height: h }
  ctx.putImageData(outData, 0, 0)
}
export { computeSharpness, preprocessImage }
