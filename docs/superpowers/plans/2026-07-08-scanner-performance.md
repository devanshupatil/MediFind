# Scanner Performance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Improve medicine identification accuracy by adding real-time sharpness-gated auto-capture, canvas image preprocessing, and a direct-identification AI prompt to `CameraSearch.jsx`.

**Architecture:** A RAF loop scores live video frames for sharpness and auto-captures when the score is high enough. Before sending to Groq, the captured JPEG is preprocessed with contrast stretching and an unsharp mask. The OCR prompt is replaced with a direct medicine-identification prompt returning a structured JSON object.

**Tech Stack:** React 18, Vitest + jsdom + @testing-library/react, Canvas 2D API, Groq SDK (`meta-llama/llama-4-scout-17b-16e-instruct`)

**Spec:** `docs/superpowers/specs/2026-07-08-scanner-performance-design.md`

---

## File Map

| Action | File | Responsibility |
|--------|------|---------------|
| Modify | `src/components/CameraSearch.jsx` | All logic — sharpness loop, preprocessing, new prompt, confidence UI |
| Create | `src/__tests__/CameraSearch.test.jsx` | Unit tests for `computeSharpness` and `preprocessImage` |
| Modify | `src/index.css` | `cs-sharp-indicator` + `cs-confidence-warning` styles |

---

## Task 1: Add and test `computeSharpness`

**Files:**
- Create: `src/__tests__/CameraSearch.test.jsx`
- Modify: `src/components/CameraSearch.jsx` (add function + named export)

- [ ] **Step 1: Write the failing test**

Create `src/__tests__/CameraSearch.test.jsx`:

```jsx
import { describe, it, expect } from 'vitest'
import { computeSharpness, preprocessImage } from '../components/CameraSearch'

// helpers
function makeImageData(pixels, width, height) {
  // pixels: flat Uint8ClampedArray of RGBA values
  return { data: new Uint8ClampedArray(pixels), width, height }
}

describe('computeSharpness', () => {
  it('returns 0 for a 1x1 image (no interior pixels)', () => {
    const id = makeImageData([128, 128, 128, 255], 1, 1)
    expect(computeSharpness(id)).toBe(0)
  })

  it('returns higher score for a high-contrast checkerboard than a solid grey image', () => {
    // 4x4 checkerboard: alternating 0 and 255 pixels
    const w = 4, h = 4
    const checker = new Uint8ClampedArray(w * h * 4)
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const v = (x + y) % 2 === 0 ? 255 : 0
        const i = (y * w + x) * 4
        checker[i] = checker[i+1] = checker[i+2] = v
        checker[i+3] = 255
      }
    }
    const checkerData = makeImageData(checker, w, h)

    // Solid grey — no edges, should be nearly 0
    const grey = new Uint8ClampedArray(w * h * 4).fill(128)
    for (let i = 3; i < grey.length; i += 4) grey[i] = 255
    const greyData = makeImageData(grey, w, h)

    expect(computeSharpness(checkerData)).toBeGreaterThan(computeSharpness(greyData))
  })
})
```

- [ ] **Step 2: Run test — expect FAIL ("computeSharpness is not a function")**

```bash
npx vitest run src/__tests__/CameraSearch.test.jsx
```

- [ ] **Step 3: Add `computeSharpness` to `CameraSearch.jsx`**

Add at module level (before `fetchMedicines`), and add a named export at the bottom of the file:

```js
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
```

At the very bottom of the file, add named exports for testing:

```js
export { computeSharpness, preprocessImage }
```

- [ ] **Step 4: Run test — expect PASS**

```bash
npx vitest run src/__tests__/CameraSearch.test.jsx
```

- [ ] **Step 5: Commit**

```bash
git add src/components/CameraSearch.jsx src/__tests__/CameraSearch.test.jsx
git commit -m "feat(scanner): add computeSharpness utility with tests"
```

---

## Task 2: Add and test `preprocessImage`

**Files:**
- Modify: `src/__tests__/CameraSearch.test.jsx` (add tests)
- Modify: `src/components/CameraSearch.jsx` (add function)

- [ ] **Step 1: Add failing tests to `CameraSearch.test.jsx`**

Append after the existing `computeSharpness` describe block:

```jsx
describe('preprocessImage', () => {
  function makeCanvas(pixels, width, height) {
    const canvas = {
      width,
      height,
      _data: new Uint8ClampedArray(pixels),
      getContext() {
        return {
          getImageData: (x, y, w, h) => ({
            data: new Uint8ClampedArray(canvas._data),
            width: w,
            height: h,
          }),
          putImageData: (imgData) => { canvas._data.set(imgData.data) },
        }
      },
    }
    return canvas
  }

  it('contrast stretch: maps pixel range to 0-255', () => {
    // 2x2 canvas, pixels are 50 and 200 (range = 150)
    // After stretch: 50 → 0, 200 → 255
    const w = 2, h = 2
    const pixels = new Uint8ClampedArray(w * h * 4)
    pixels[0] = pixels[1] = pixels[2] = 50;  pixels[3] = 255  // pixel 0: dark
    pixels[4] = pixels[5] = pixels[6] = 200; pixels[7] = 255  // pixel 1: bright
    pixels[8] = pixels[9] = pixels[10] = 50; pixels[11] = 255
    pixels[12]= pixels[13]= pixels[14]= 200; pixels[15]= 255
    const canvas = makeCanvas(pixels, w, h)
    preprocessImage(canvas)
    expect(canvas._data[0]).toBe(0)   // 50 → 0
    expect(canvas._data[4]).toBe(255) // 200 → 255
  })

  it('skips contrast stretch when range < 10 (solid colour guard)', () => {
    const w = 2, h = 2
    const pixels = new Uint8ClampedArray(w * h * 4)
    // All pixels = 128 (range = 0 → guard triggers)
    for (let i = 0; i < pixels.length; i += 4) {
      pixels[i] = pixels[i+1] = pixels[i+2] = 128; pixels[i+3] = 255
    }
    const canvas = makeCanvas(pixels, w, h)
    preprocessImage(canvas)
    // Pixels unchanged
    expect(canvas._data[0]).toBe(128)
  })

  it('border pixels are unchanged after unsharp mask', () => {
    // 3x3 canvas — interior is one pixel (1,1), corners are border
    const w = 3, h = 3
    const pixels = new Uint8ClampedArray(w * h * 4)
    for (let i = 0; i < pixels.length; i += 4) {
      pixels[i] = 100; pixels[i+1] = 100; pixels[i+2] = 100; pixels[i+3] = 255
    }
    const canvas = makeCanvas(pixels, w, h)
    const originalCorner = pixels[0]
    preprocessImage(canvas)
    expect(canvas._data[0]).toBe(originalCorner) // top-left border pixel unchanged
  })
})
```

- [ ] **Step 2: Run test — expect FAIL ("preprocessImage is not a function")**

```bash
npx vitest run src/__tests__/CameraSearch.test.jsx
```

- [ ] **Step 3: Add `preprocessImage` to `CameraSearch.jsx`**

Add at module level, after `computeSharpness`:

```js
function preprocessImage(canvas) {
  const ctx = canvas.getContext('2d')
  const w = canvas.width, h = canvas.height
  const src = ctx.getImageData(0, 0, w, h)
  const d = new Uint8ClampedArray(src.data)

  // Pass 1: Contrast stretch (per-channel min/max)
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

  ctx.putImageData(new ImageData(sharpened, w, h), 0, 0)
}
```

- [ ] **Step 4: Run all tests — expect PASS**

```bash
npx vitest run src/__tests__/CameraSearch.test.jsx
```

- [ ] **Step 5: Commit**

```bash
git add src/components/CameraSearch.jsx src/__tests__/CameraSearch.test.jsx
git commit -m "feat(scanner): add preprocessImage (contrast stretch + unsharp mask) with tests"
```

---

## Task 3: Wire `preprocessImage` into `toJpeg` and raise JPEG quality

**Files:**
- Modify: `src/components/CameraSearch.jsx`

- [ ] **Step 1: Update `toJpeg` inside the component**

Find this block (inside the `toJpeg` useCallback):
```js
      canvas.getContext('2d').drawImage(img, 0, 0, w, h)
      resolve(canvas.toDataURL('image/jpeg', 0.80))
```

Replace with:
```js
      canvas.getContext('2d').drawImage(img, 0, 0, w, h)
      preprocessImage(canvas)
      resolve(canvas.toDataURL('image/jpeg', 0.88))
```

- [ ] **Step 2: Run full test suite — expect PASS (no regressions)**

```bash
npx vitest run
```

- [ ] **Step 3: Commit**

```bash
git add src/components/CameraSearch.jsx
git commit -m "feat(scanner): preprocess image in toJpeg before AI — contrast + sharpness, quality 0.88"
```

---

## Task 4: Add sharpness RAF loop and `sharpLabel` state

**Files:**
- Modify: `src/components/CameraSearch.jsx`

- [ ] **Step 1: Add sharpness constants at the top of the file**

After the existing `VISION_MODEL` constant, add all three constants:

```js
const SHARP_THRESHOLD = 180  // auto-capture fires
const READY_THRESHOLD = 100  // "Almost ready"
const BLUR_THRESHOLD  = 40   // "Hold still..."
```

- [ ] **Step 2: Add new refs and state inside the component**

Inside `CameraSearch`, after the existing refs block, add:

```js
  const rafRef = useRef(null)
  const lastSampleRef = useRef(0)
  const debounceTimerRef = useRef(null)
  const sharpnessRef = useRef(0)
  const sharpLabelRef = useRef('blur')
  const capturePhotoRef = useRef(null)
  const [sharpLabel, setSharpLabel] = useState('blur')
```

- [ ] **Step 3: Update `stopCamera` to clean up RAF and debounce timer**

Find the current `stopCamera`:
```js
  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach(t => t.stop())
    streamRef.current = null
  }, [])
```

Replace with:
```js
  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach(t => t.stop())
    streamRef.current = null
    cancelAnimationFrame(rafRef.current)
    rafRef.current = null
    clearTimeout(debounceTimerRef.current)
    debounceTimerRef.current = null
  }, [])
```

- [ ] **Step 4: Keep `capturePhotoRef` in sync**

After the `capturePhoto` useCallback definition (not before it — the ref sync must come after the value it tracks), add:

```js
  useEffect(() => { capturePhotoRef.current = capturePhoto }, [capturePhoto])
```

This useEffect should appear immediately after `capturePhoto`'s `useCallback` in the file, before the sharpness RAF `useEffect`.

- [ ] **Step 5: Add the sharpness RAF loop `useEffect`**

Add after the scroll-lock `useEffect`:

```js
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
      if (next === 'sharp') {
        if (!debounceTimerRef.current) {
          debounceTimerRef.current = setTimeout(() => {
            debounceTimerRef.current = null
            capturePhotoRef.current?.()
          }, 400)
        }
      } else {
        clearTimeout(debounceTimerRef.current)
        debounceTimerRef.current = null
      }
    }
    rafRef.current = requestAnimationFrame(loop)
    return () => {
      cancelAnimationFrame(rafRef.current)
      clearTimeout(debounceTimerRef.current)
      debounceTimerRef.current = null
    }
  }, [state])
```

- [ ] **Step 6: Run full test suite — expect PASS**

```bash
npx vitest run
```

- [ ] **Step 7: Commit**

```bash
git add src/components/CameraSearch.jsx
git commit -m "feat(scanner): add RAF sharpness loop with auto-capture debounce"
```

---

## Task 5: Add sharpness indicator UI to the viewfinder

**Files:**
- Modify: `src/components/CameraSearch.jsx`
- Modify: `src/index.css`

- [ ] **Step 1: Add indicator element inside the viewfinder JSX**

Find this block in the JSX:
```jsx
                <p className="cs-hint">Point at the medicine label and tap capture</p>
```

Replace with:
```jsx
                <div className="cs-sharp-indicator" aria-live="polite" aria-atomic="true">
                  <span className={`cs-sharp-dot cs-sharp-dot--${sharpLabel}`} aria-hidden="true" />
                  <span className="cs-sharp-label">
                    {sharpLabel === 'blur'   && 'Hold still...'}
                    {sharpLabel === 'almost' && 'Almost ready'}
                    {sharpLabel === 'sharp'  && 'Ready ✓'}
                  </span>
                </div>
```

- [ ] **Step 2: Add CSS for the indicator to `src/index.css`**

Append to the end of `src/index.css`:

```css
/* ── Scanner: sharpness indicator ── */
.cs-sharp-indicator {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  border-radius: 20px;
  background: rgba(0,0,0,0.45);
  backdrop-filter: blur(4px);
  font-size: 13px;
  font-weight: 500;
  color: #fff;
  width: fit-content;
  margin: 8px auto 0;
}
.cs-sharp-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}
.cs-sharp-dot--blur   { background: #f59e0b; opacity: 0.5; }
.cs-sharp-dot--almost { background: #f59e0b; animation: cs-pulse 1s ease-in-out infinite; }
.cs-sharp-dot--sharp  { background: #22c55e; }
@keyframes cs-pulse {
  0%, 100% { opacity: 1; }
  50%       { opacity: 0.4; }
}

/* ── Scanner: confidence warning ── */
.cs-confidence-warning {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 10px;
  border-radius: 8px;
  background: #fef3c7;
  border: 1px solid #f59e0b;
  color: #92400e;
  font-size: 12px;
  font-weight: 500;
  margin-top: 8px;
}
```

- [ ] **Step 3: Run full test suite — expect PASS**

```bash
npx vitest run
```

- [ ] **Step 4: Commit**

```bash
git add src/components/CameraSearch.jsx src/index.css
git commit -m "feat(scanner): add live sharpness indicator in viewfinder"
```

---

## Task 6: Update `OCR_PROMPT` and `extractTextFromImage` for new schema

**Files:**
- Modify: `src/components/CameraSearch.jsx`

- [ ] **Step 1: Replace `OCR_PROMPT` constant**

Find the entire `const OCR_PROMPT = \`...\`` block and replace it with:

```js
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
- Return raw JSON only. No markdown fences.`
```

- [ ] **Step 2: Update `extractTextFromImage` — new schema, `max_tokens` 1024, remove regex fallback**

Find the full `extractTextFromImage` function. Replace the `max_tokens` value and the return/catch block:

Change `max_tokens: 600` → `max_tokens: 1024`

Replace the entire `try { ... } catch { ... }` parsing block at the end with:

```js
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
```

Note: the old regex fallback catch block (`return { nameCandidates: quoted.slice(0,8), allText: [] }`) is **removed**. Malformed JSON now throws and is caught by `processImage`'s error handler.

- [ ] **Step 3: Run full test suite — expect PASS**

```bash
npx vitest run
```

- [ ] **Step 4: Commit**

```bash
git add src/components/CameraSearch.jsx
git commit -m "feat(scanner): direct medicine identification prompt, new schema, max_tokens 1024"
```

---

## Task 7: Update `processImage` for new schema + confidence handling

**Files:**
- Modify: `src/components/CameraSearch.jsx`

- [ ] **Step 1: Add `S.WARN` to the state machine**

Find:
```js
const S = { IDLE: 'idle', PREVIEW: 'preview', ANALYZING: 'analyzing', MATCHING: 'matching', DONE: 'done', ERROR: 'error' }
```

Replace with:
```js
const S = { IDLE: 'idle', PREVIEW: 'preview', ANALYZING: 'analyzing', MATCHING: 'matching', WARN: 'warn', DONE: 'done', ERROR: 'error' }
```

- [ ] **Step 2: Add `warnMsg` state to the component**

Inside the component, after the existing `const [error, setError] = useState('')` line, add:

```js
  const [warnMsg, setWarnMsg] = useState('')
```

- [ ] **Step 3: Remove stale `setOcrData` calls outside the try/catch**

`processImage` currently has these two lines **above** its try/catch block:

```js
    setOcrData({ nameCandidates: [], allText: [] })
    setError('')
```

And `startCamera` contains:

```js
    setOcrData({ nameCandidates: [], allText: [] })
```

Remove **both** `setOcrData(...)` calls now (the state will be deleted in Step 7 — these calls must go first or Step 7 will leave `ReferenceError`s at runtime). Keep the `setError('')` line in `processImage`.

- [ ] **Step 4: Replace the `processImage` try/catch body**

Find the try/catch block inside `processImage` and replace it with:

```js
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

      // Pass medicine_name/strength/form as 3rd arg — SearchPage's callback
      // only destructures (imageSrc, matches) so this is backward-compatible.
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
```

- [ ] **Step 5: Also update the `isProcessing` line to include S.WARN**

Find:
```js
  const isProcessing = state === S.ANALYZING || state === S.MATCHING
```

Replace with:
```js
  const isProcessing = state === S.ANALYZING || state === S.MATCHING || state === S.WARN
```

- [ ] **Step 6: Add `S.WARN` UI block in the JSX**

In the JSX, after the `isProcessing && (...)` block, add:

```jsx
            {/* ── Confidence warning ── */}
            {state === S.WARN && (
              <div className="cs-analyzing">
                {imageSrc && <img src={imageSrc} alt="Captured medicine" className="cs-thumb" />}
                <div className="cs-confidence-warning" role="alert">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                    <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
                  </svg>
                  {warnMsg}
                </div>
              </div>
            )}
```

Also update the modal header title to include S.WARN:

Find:
```jsx
                  {isProcessing        && 'Analysing…'}
```

Replace with:
```jsx
                  {(isProcessing || state === S.WARN) && 'Analysing…'}
```

- [ ] **Step 7: Update `close()` to reset `warnMsg`**

Find:
```js
  const close = useCallback(() => {
    stopCamera()
    setIsOpen(false)
    setState(S.IDLE)
    setImageSrc(null)
    setOcrData({ nameCandidates: [], allText: [] })
    setError('')
  }, [stopCamera])
```

Replace with:
```js
  const close = useCallback(() => {
    stopCamera()
    setIsOpen(false)
    setState(S.IDLE)
    setImageSrc(null)
    setError('')
    setWarnMsg('')
  }, [stopCamera])
```

(Remove `setOcrData` — `ocrData` state is no longer used after this task.)

- [ ] **Step 8: Remove the now-unused `ocrData` state**

Remove:
```js
  const [ocrData, setOcrData] = useState({ nameCandidates: [], allText: [] })
```

All `setOcrData` call sites were already removed in Step 3. This step only deletes the state declaration.

- [ ] **Step 9: Run full test suite — expect PASS**

```bash
npx vitest run
```

- [ ] **Step 10: Commit**

```bash
git add src/components/CameraSearch.jsx
git commit -m "feat(scanner): confidence-gated results with S.WARN state and low-confidence warning UI"
```

---

## Task 8: Smoke test the full scanner flow

- [ ] **Step 1: Start the dev server**

```bash
npm run dev
```

- [ ] **Step 2: Open the app in a browser and click "Scan"**

Verify:
- Camera viewfinder opens
- Sharpness indicator appears below the viewfinder (amber dot → yellow pulsing → green)
- Auto-capture fires within 400ms of the indicator turning green
- "Analysing…" spinner appears
- On a real medicine label: results appear in the scan results panel
- On a blurry/covered image: appropriate error message appears

- [ ] **Step 3: Test confidence warning path**

Cover the lens partially to produce a low-confidence scan. Verify the `cs-confidence-warning` badge appears briefly before results are shown.

- [ ] **Step 4: Run full test suite one final time**

```bash
npx vitest run
```

Expected: all tests pass.

- [ ] **Step 5: Final commit**

```bash
git add -A
git commit -m "feat(scanner): complete scanner performance improvement — sharpness detection, preprocessing, direct AI identification"
```
