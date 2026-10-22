import { describe, expect, test } from 'vitest'
import { boxToPixels, clampBox, fitScale, normalizeBox, pixelsToBox } from './geometry.ts'

describe('geometry', () => {
  test('fitScale 按容器等比适配', () => {
    expect(fitScale({ width: 1920, height: 1080 }, { width: 800, height: 600 }, 1)).toBeCloseTo(
      800 / 1920,
    )
    expect(fitScale({ width: 100, height: 100 }, { width: 800, height: 600 }, 1)).toBe(6)
  })

  test('clampBox 限制在 0-1', () => {
    expect(clampBox({ x1: -0.2, y1: 0.1, x2: 1.4, y2: 0.9 })).toEqual({
      x1: 0,
      y1: 0.1,
      x2: 1,
      y2: 0.9,
    })
  })

  test('normalizeBox 交换反序坐标', () => {
    expect(normalizeBox(0.8, 0.9, 0.2, 0.1)).toEqual({
      x1: 0.2,
      y1: 0.1,
      x2: 0.8,
      y2: 0.9,
    })
  })

  test('像素与归一化坐标互转', () => {
    const pixels = boxToPixels({ x1: 0.1, y1: 0.2, x2: 0.6, y2: 0.8 }, 1000, 500)
    expect(pixels.x).toBeCloseTo(100)
    expect(pixels.y).toBeCloseTo(100)
    expect(pixels.width).toBeCloseTo(500)
    expect(pixels.height).toBeCloseTo(300)
    const normalized = pixelsToBox(100, 100, 500, 300, 1000, 500)
    expect(normalized.x1).toBeCloseTo(0.1)
    expect(normalized.y1).toBeCloseTo(0.2)
    expect(normalized.x2).toBeCloseTo(0.6)
    expect(normalized.y2).toBeCloseTo(0.8)
  })
})
