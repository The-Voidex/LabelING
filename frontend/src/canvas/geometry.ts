export interface NormalizedBox {
  x1: number
  y1: number
  x2: number
  y2: number
}

export function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value))
}

export function normalizeBox(x1: number, y1: number, x2: number, y2: number): NormalizedBox {
  const left = Math.min(x1, x2)
  const right = Math.max(x1, x2)
  const top = Math.min(y1, y2)
  const bottom = Math.max(y1, y2)
  return {
    x1: clamp01(left),
    y1: clamp01(top),
    x2: clamp01(right),
    y2: clamp01(bottom),
  }
}

export function clampBox(box: NormalizedBox): NormalizedBox {
  return normalizeBox(
    clamp01(box.x1),
    clamp01(box.y1),
    clamp01(box.x2),
    clamp01(box.y2),
  )
}

export function fitScale(
  image: { width: number; height: number },
  container: { width: number; height: number },
  padding = 0.96,
): number {
  if (image.width <= 0 || image.height <= 0) return 1
  return Math.min(container.width / image.width, container.height / image.height) * padding
}

export function boxToPixels(
  box: NormalizedBox,
  imageWidth: number,
  imageHeight: number,
): { x: number; y: number; width: number; height: number } {
  return {
    x: box.x1 * imageWidth,
    y: box.y1 * imageHeight,
    width: (box.x2 - box.x1) * imageWidth,
    height: (box.y2 - box.y1) * imageHeight,
  }
}

export function pixelsToBox(
  x: number,
  y: number,
  width: number,
  height: number,
  imageWidth: number,
  imageHeight: number,
): NormalizedBox {
  if (imageWidth <= 0 || imageHeight <= 0) {
    return { x1: 0, y1: 0, x2: 0, y2: 0 }
  }
  return normalizeBox(
    x / imageWidth,
    y / imageHeight,
    (x + width) / imageWidth,
    (y + height) / imageHeight,
  )
}
