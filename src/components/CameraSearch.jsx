import { useState, useRef, useCallback, useEffect } from 'react'
import { createPortal } from 'react-dom'
import Groq from 'groq-sdk'
import { supabase } from '../lib/supabase'

const GROQ_API_KEY = import.meta.env.VITE_GROQ_API_KEY
const isKeyReady = GROQ_API_KEY && GROQ_API_KEY !== 'your_groq_api_key_here'

const VISION_MODEL = 'meta-llama/llama-4-scout-17b-16e-instruct'

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

async function extractTextFromImage(base64Data, mimeType = 'image/jpeg') {
  if (!isKeyReady) throw new Error('NO_API_KEY')

  const client = new Groq({ apiKey: GROQ_API_KEY, dangerouslyAllowBrowser: true })

  const response = await client.chat.completions.create({
    model: VISION_MODEL,
    max_tokens: 600,
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
  const clean = jsonMatch ? jsonMatch[0] : stripped

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
    const quoted = [...stripped.matchAll(/"([^"]{2,60})"/g)].map(m => m[1]).filter(isValidToken)
    return { nameCandidates: quoted.slice(0, 8), allText: [] }
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

const S = { IDLE: 'idle', PREVIEW: 'preview', ANALYZING: 'analyzing', MATCHING: 'matching', DONE: 'done', ERROR: 'error' }

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
  const [ocrData, setOcrData] = useState({ nameCandidates: [], allText: [] })
  const [error, setError] = useState('')

  const videoRef = useRef(null)
  const canvasRef = useRef(null)
  const fileRef = useRef(null)
  const streamRef = useRef(null)
  const onScanCompleteRef = useRef(onScanComplete)
  useEffect(() => { onScanCompleteRef.current = onScanComplete }, [onScanComplete])

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => { document.body.style.overflow = '' }
  }, [isOpen])

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach(t => t.stop())
    streamRef.current = null
  }, [])

  const startCamera = useCallback(async () => {
    setIsOpen(true)
    setState(S.PREVIEW)
    setImageSrc(null)
    setOcrData({ nameCandidates: [], allText: [] })
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
      const canvas = document.createElement('canvas')
      canvas.width = img.naturalWidth
      canvas.height = img.naturalHeight
      canvas.getContext('2d').drawImage(img, 0, 0)
      resolve(canvas.toDataURL('image/jpeg', 0.92))
    }
    img.onerror = reject
    img.src = dataUrl
  }), [])

  const processImage = useCallback(async (dataUrl) => {
    setImageSrc(dataUrl)
    setState(S.ANALYZING)
    setOcrData({ nameCandidates: [], allText: [] })
    setError('')

    if (!isKeyReady) {
      setError('Groq API key not set.')
      setState(S.ERROR)
      return
    }

    try {
      const jpegUrl = await toJpeg(dataUrl)
      const base64 = jpegUrl.split(',')[1]
      const extracted = await extractTextFromImage(base64, 'image/jpeg')
      setOcrData(extracted)

      if (extracted.nameCandidates.length === 0 && extracted.allText.length === 0) {
        setError('No label text found. Point the camera at the medicine name on the box or strip — not the pill side.')
        setState(S.ERROR)
        return
      }

      setState(S.MATCHING)
      const topMatches = await findMatchingMedicines(extracted)
      onScanCompleteRef.current(jpegUrl, topMatches)
      close()
    } catch (err) {
      setError(err.message.includes('NO_API_KEY')
        ? 'Groq API key not configured.'
        : `Analysis failed: ${err.message}`)
      setState(S.ERROR)
    }
  }, [close, toJpeg])

  const isProcessing = state === S.ANALYZING || state === S.MATCHING

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
                <p className="cs-hint">Point at the medicine label and tap capture</p>
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
