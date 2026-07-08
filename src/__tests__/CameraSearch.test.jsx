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
