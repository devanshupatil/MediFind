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
- During `S.PREVIEW`, a `requestAnimationFrame` loop samples the live video every ~100ms
- Each frame is drawn into a tiny offscreen canvas (160×90px) for performance
- Laplacian variance is computed on the pixel data — high variance = sharp, low = blurry
- A debounced auto-capture fires after 400ms of sustained sharpness above threshold

**Thresholds (tunable constants at top of file):**
```js
const SHARP_THRESHOLD = 180  // auto-capture fires
const READY_THRESHOLD = 100  // shows "Ready ✓"
const BLUR_THRESHOLD  = 40   // shows "Hold still..."
```

**UI states in viewfinder:**
| Score | Indicator dot | Message |
|-------|--------------|---------|
| < 40 | dim amber | "Hold still..." |
| 40–180 | pulsing yellow | "Almost ready" |
| > 180 | solid green | "Ready ✓" → auto-capture after 400ms |

**State management:**
- `sharpness` lives in a `useRef` (avoids re-renders on every frame)
- `isSharp` boolean state drives UI — only updates when crossing a threshold boundary
- RAF loop cancelled in existing `stopCamera()` via `cancelAnimationFrame`

**Manual capture remains available** — user can tap "Capture" at any time regardless of sharpness score.

---

## Section 2: Image Preprocessing

A new pure function `preprocessImage(canvas): string` runs before `extractTextFromImage()` inside `processImage()`.

**Three passes, all via native Canvas 2D API:**

**Pass 1 — Contrast & Brightness Normalization**
- Read all pixels, find actual min/max luminance
- Stretch values to fill 0–255 range
- Recovers washed-out or underexposed labels

**Pass 2 — Color preserved**
- Image stays in color (medicine packaging uses colored logos and text)
- Grayscale not applied — AI handles color variation

**Pass 3 — Unsharp Mask**
- 3×3 sharpening kernel applied via pixel convolution:
  ```
  [ 0, -1,  0]
  [-1,  5, -1]
  [ 0, -1,  0]
  ```
- Enhances printed text edges without amplifying noise

**Output settings:**
- Max dimension: 1000px (unchanged)
- JPEG quality: `0.88` (up from `0.80`) — recovers fine-print detail lost by current compression

---

## Section 3: Enhanced AI Prompt

**Current prompt:** Extract raw text into `name_candidates` + `all_text`  
**New prompt:** Directly identify the medicine and return structured data

**New response schema:**
```json
{
  "medicine_name": "Crocin Advance",
  "generic_name": "Paracetamol",
  "strength": "500mg",
  "form": "tablet",
  "manufacturer": "GSK",
  "confidence": 0.85,
  "all_names": ["Crocin", "Crocin Advance", "Paracetamol 500mg"]
}
```

**Field mapping to existing pipeline:**
- `all_names` → replaces `nameCandidates` fed into `findMatchingMedicines()`
- `medicine_name` + `strength` + `form` → passed through `onScanComplete` for display in results panel
- `confidence` → shown in UI when below 0.5 as a warning badge

**Failure handling:**
- Malformed JSON or `confidence < 0.2` → scan failure with message: `"Couldn't identify this medicine — try better lighting or move closer."`
- Existing `NO_API_KEY` error path unchanged

**Downstream compatibility:**
`findMatchingMedicines()` signature unchanged — receives richer `extracted` object, uses `all_names` where it previously used `nameCandidates`.

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
