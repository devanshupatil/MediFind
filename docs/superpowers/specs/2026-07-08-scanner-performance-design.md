# Scanner Performance — Design Spec
**Date:** 2026-07-08  
**Status:** Approved  
**Scope:** `src/components/CameraSearch.jsx`

---

## Problem

The scanner's OCR step (Groq Llama 4 Scout vision model) frequently misses or misreads the medicine name. Root causes:
- Single-shot capture with no image quality validation — blurry frames go straight to AI
- Raw image sent with no preprocessing — poor contrast and soft edges hurt OCR accuracy
- The prompt asks for raw text extraction, not medicine identification — adds a weak fuzzy-matching step downstream

## Goal

Improve medicine identification accuracy from the camera scan by:
1. Preventing blurry images from being sent to AI
2. Sending a preprocessed, high-contrast sharpened image
3. Having the AI directly identify the medicine rather than just extract text

No new npm dependencies. No barcode scanning. Pure AI vision pipeline improvement.

---

## Architecture

```
Live viewfinder
  └─ RAF sharpness loop → "Hold still" / "Ready ✓" indicator → auto-capture
        └─ Canvas preprocessing (contrast stretch + unsharp mask)
              └─ Groq AI: direct medicine identification (structured JSON)
                    └─ Fuzzy match against Supabase medicines
```

All changes confined to `CameraSearch.jsx`. No interface changes to `SearchPage.jsx` or downstream consumers.

---

## Section 1: Real-time Sharpness Detection

**How it works:**
- During `S.PREVIEW`, a `requestAnimationFrame` loop runs continuously but throttled — a `lastSampleRef` timestamp is checked each frame; only frames at least 100ms apart are processed (others are skipped with `requestAnimationFrame(loop)` immediately)
- Each sampled frame is drawn into a tiny offscreen canvas (160×90px) for performance
- Laplacian variance is computed on the pixel data — high variance = sharp, low = blurry
- When score crosses `SHARP_THRESHOLD`, a `debounceTimerRef` (a `useRef`) is set to `setTimeout(capturePhoto, 400)` — auto-capture fires after 400ms of sustained sharpness

**Thresholds (tunable constants at top of file):**
```js
const SHARP_THRESHOLD = 180  // auto-capture fires
const READY_THRESHOLD = 100  // shows "Almost ready"
const BLUR_THRESHOLD  = 40   // shows "Hold still..."
```

**UI states in viewfinder:**
| Score | Indicator dot | Label |
|-------|--------------|-------|
| < 40 | dim amber | "Hold still..." |
| 40–179 | pulsing yellow | "Almost ready" |
| ≥ 180 | solid green | "Ready ✓" → auto-capture after 400ms |

**State management:**
- `sharpnessRef` (`useRef<number>`) stores raw score — no re-render on every frame
- `sharpLabel` (`useState<'blur'|'almost'|'sharp'>`) drives UI — updated only when score crosses a threshold boundary. Mapping: `'blur'` = score < 40 → "Hold still...", `'almost'` = score 40–179 → "Almost ready", `'sharp'` = score ≥ 180 → "Ready ✓" + auto-capture
- RAF loop ID stored in `rafRef` (`useRef`); cancelled via `cancelAnimationFrame(rafRef.current)` inside `stopCamera()`
- Debounce timer ID stored in `debounceTimerRef` (`useRef`); cleared via `clearTimeout(debounceTimerRef.current)` inside `stopCamera()` to prevent auto-capture firing after stream is stopped

**Manual capture remains available** — user can tap "Capture" at any time regardless of sharpness score.

---

## Section 2: Image Preprocessing

**Pipeline insertion point:** `preprocessImage` is called inside the existing `toJpeg()` function, on the canvas that already exists there, before `canvas.toDataURL()` is called. This avoids a second data-URL round-trip. `toJpeg` also has its JPEG quality raised from `0.80` to `0.88` at this same point.

A new pure function `preprocessImage(canvas: HTMLCanvasElement): void` mutates the canvas in-place via two passes, all using the native Canvas 2D API — no return value needed.

**Pass 1 — Contrast Stretch**
- Read all pixels via `getImageData`
- Find actual min and max values across R, G, B channels
- Guard: if `max - min < 10` (near-solid colour or covered lens), skip this pass entirely to avoid divide-by-zero
- Otherwise stretch each channel: `out = (in - min) / (max - min) * 255`
- Recovers washed-out or underexposed labels

**Pass 2 — Unsharp Mask**
- 3×3 sharpening kernel applied via pixel convolution on the contrast-stretched result:
  ```
  [ 0, -1,  0]
  [-1,  5, -1]
  [ 0, -1,  0]
  ```
- Border pixels (row 0, row h-1, col 0, col w-1) are **skipped** — copied unchanged from the source — to avoid out-of-bounds reads
- Enhances printed text edges without amplifying noise
- Color channels preserved (R, G, B processed identically); alpha channel untouched

**Output settings:**
- Max dimension: 1000px (unchanged)
- JPEG quality: `0.88` (up from `0.80`) — set in `toJpeg()` alongside the preprocessing call

---

## Section 3: Enhanced AI Prompt

**Current prompt:** Extract raw text into `name_candidates` + `all_text`  
**New prompt:** Directly identify the medicine and return structured data

**New response schema** (`max_tokens` raised from 600 → 1024 to accommodate the richer output):
```json
{
  "medicine_name": "Crocin Advance",
  "strength": "500mg",
  "form": "tablet",
  "confidence": 0.85,
  "all_names": ["Crocin", "Crocin Advance", "Paracetamol 500mg"]
}
```

`manufacturer` and `generic_name` are dropped from the schema — they have no consumer in the current pipeline and would add hallucination surface and token cost.

**Field mapping to existing pipeline:**
- `all_names` → passed to `findMatchingMedicines()` as `nameCandidates` via explicit remap at call site: `findMatchingMedicines({ nameCandidates: extracted.all_names, allText: [] }, medicines)` — `findMatchingMedicines` signature is **not** changed
- `medicine_name` + `strength` + `form` → included in the object passed to `onScanComplete` for display in the results panel
- `confidence` → shown as a warning badge (CSS class `cs-confidence-warning`) in the scan results header when `confidence < 0.5`. Values 0.2–0.5 show the badge but still display results. This is intentional — low-confidence results are surfaced, not suppressed.

**Failure handling:**
- `confidence < 0.2` → treated as scan failure with message: `"Couldn't identify this medicine — try better lighting or move closer."`
- Malformed JSON → same failure message (no fallback extraction — the existing regex fallback in `extractTextFromImage` is **removed** since it cannot populate the new schema meaningfully)
- Existing `NO_API_KEY` error path unchanged

---

## Files Changed

| File | Change |
|------|--------|
| `src/components/CameraSearch.jsx` | All changes — sharpness loop, preprocessing, new prompt, confidence UI |

## Files Unchanged

| File | Reason |
|------|--------|
| `src/pages/SearchPage.jsx` | `onScanComplete` interface unchanged |
| `src/lib/supabase.js` | No DB schema changes |
| `package.json` | No new dependencies |
