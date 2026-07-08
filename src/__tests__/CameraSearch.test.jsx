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
