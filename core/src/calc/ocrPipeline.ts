import type { OcrWord } from './ocrBox'
import type { PixelImage } from './ocrVision'
export type { PixelImage } from './ocrVision'
export interface OcrTensor { data: Float32Array; dims: readonly number[] }
export interface OcrModel { run(data: Float32Array, dims: number[]): Promise<OcrTensor>; dispose?(): void }
export interface OcrSessions { det: OcrModel; rec: OcrModel; dict: string[] }

function fitDet(width: number, height: number) {
  const limit = 1280
  const ratio = Math.min(1, limit / Math.max(width, height))
  let w = Math.max(32, Math.round(width * ratio))
  let h = Math.max(32, Math.round(height * ratio))
  w -= w % 32
  h -= h % 32
  return { width: Math.max(32, w), height: Math.max(32, h) }
}

function sampleTensor(image: PixelImage, width: number, height: number): Float32Array {
  const data = new Float32Array(3 * width * height)
  const plane = width * height
  for (let y = 0; y < height; y++) {
    const sy = Math.min(image.height - 1, (y + 0.5) * image.height / height - 0.5)
    const y0 = Math.max(0, Math.floor(sy))
    const y1 = Math.min(image.height - 1, y0 + 1)
    const fy = sy - y0
    for (let x = 0; x < width; x++) {
      const sx = Math.min(image.width - 1, (x + 0.5) * image.width / width - 0.5)
      const x0 = Math.max(0, Math.floor(sx))
      const x1 = Math.min(image.width - 1, x0 + 1)
      const fx = sx - x0
      const p00 = (y0 * image.width + x0) * 4
      const p10 = (y0 * image.width + x1) * 4
      const p01 = (y1 * image.width + x0) * 4
      const p11 = (y1 * image.width + x1) * 4
      for (let c = 0; c < 3; c++) {
        const v00 = image.data[p00 + c] ?? 0
        const v10 = image.data[p10 + c] ?? 0
        const v01 = image.data[p01 + c] ?? 0
        const v11 = image.data[p11 + c] ?? 0
        const value = v00 * (1 - fx) * (1 - fy) + v10 * fx * (1 - fy) + v01 * (1 - fx) * fy + v11 * fx * fy
        data[c * plane + y * width + x] = (value / 255 - 0.5) / 0.5
      }
    }
  }
  return data
}

function sigmoid(value: number): number {
  return 1 / (1 + Math.exp(-value))
}

interface RawBox {
  x: number
  y: number
  width: number
  height: number
}

function boxesFromMap(prob: Float32Array, mapW: number, mapH: number, srcW: number, srcH: number): RawBox[] {
  let min = Infinity
  let max = -Infinity
  for (let i = 0; i < prob.length; i++) {
    const value = prob[i] ?? 0
    if (value < min) min = value
    if (value > max) max = value
  }
  const scoreAt = (index: number) => {
    const value = prob[index] ?? 0
    return min < 0 || max > 1 ? sigmoid(value) : value
  }
  const seen = new Uint8Array(mapW * mapH)
  const boxes: RawBox[] = []
  const scaleX = srcW / mapW
  const scaleY = srcH / mapH
  for (let y = 0; y < mapH; y++) {
    for (let x = 0; x < mapW; x++) {
      const start = y * mapW + x
      if (seen[start] || scoreAt(start) < 0.3) continue
      const stack = [start]
      seen[start] = 1
      let minX = x
      let maxX = x
      let minY = y
      let maxY = y
      let count = 0
      let total = 0
      while (stack.length) {
        const cur = stack.pop()!
        const cx = cur % mapW
        const cy = (cur / mapW) | 0
        count += 1
        total += scoreAt(cur)
        if (cx < minX) minX = cx
        if (cx > maxX) maxX = cx
        if (cy < minY) minY = cy
        if (cy > maxY) maxY = cy
        const next = [cur - 1, cur + 1, cur - mapW, cur + mapW]
        for (const n of next) {
          if (n < 0 || n >= seen.length || seen[n]) continue
          const nx = n % mapW
          const ny = (n / mapW) | 0
          if (Math.abs(nx - cx) + Math.abs(ny - cy) !== 1) continue
          if (scoreAt(n) < 0.3) continue
          seen[n] = 1
          stack.push(n)
        }
      }
      if (count < 6 || total / count < 0.45) continue
      const padX = Math.max(1, (maxX - minX) * 0.12)
      const padY = Math.max(1, (maxY - minY) * 0.18)
      const left = Math.max(0, (minX - padX) * scaleX)
      const top = Math.max(0, (minY - padY) * scaleY)
      const right = Math.min(srcW, (maxX + 1 + padX) * scaleX)
      const bottom = Math.min(srcH, (maxY + 1 + padY) * scaleY)
      if (right - left < 6 || bottom - top < 6) continue
      boxes.push({ x: left, y: top, width: right - left, height: bottom - top })
    }
  }
  return boxes
}

function recTensor(image: PixelImage, box: RawBox): { data: Float32Array, width: number } {
  const height = 48
  const ratio = box.width / Math.max(1, box.height)
  let width = Math.min(320, Math.max(16, Math.ceil(height * ratio)))
  width += (8 - (width % 8)) % 8
  const data = new Float32Array(3 * height * width)
  const plane = height * width
  for (let y = 0; y < height; y++) {
    const sy = box.y + (y + 0.5) * box.height / height - 0.5
    const y0 = Math.max(0, Math.min(image.height - 1, Math.floor(sy)))
    const y1 = Math.max(0, Math.min(image.height - 1, y0 + 1))
    const fy = Math.min(1, Math.max(0, sy - y0))
    for (let x = 0; x < width; x++) {
      const sx = box.x + (x + 0.5) * box.width / width - 0.5
      const x0 = Math.max(0, Math.min(image.width - 1, Math.floor(sx)))
      const x1 = Math.max(0, Math.min(image.width - 1, x0 + 1))
      const fx = Math.min(1, Math.max(0, sx - x0))
      const p00 = (y0 * image.width + x0) * 4
      const p10 = (y0 * image.width + x1) * 4
      const p01 = (y1 * image.width + x0) * 4
      const p11 = (y1 * image.width + x1) * 4
      for (let c = 0; c < 3; c++) {
        const v00 = image.data[p00 + c] ?? 0
        const v10 = image.data[p10 + c] ?? 0
        const v01 = image.data[p01 + c] ?? 0
        const v11 = image.data[p11 + c] ?? 0
        const value = v00 * (1 - fx) * (1 - fy) + v10 * fx * (1 - fy) + v01 * (1 - fx) * fy + v11 * fx * fy
        data[c * plane + y * width + x] = (value / 255 - 0.5) / 0.5
      }
    }
  }
  return { data, width }
}

function decodeCtc(probs: Float32Array, time: number, classes: number, dict: string[]): string {
  let text = ''
  let prev = -1
  for (let t = 0; t < time; t++) {
    let best = 0
    let bestValue = -Infinity
    for (let c = 0; c < classes; c++) {
      const value = probs[t * classes + c] ?? -Infinity
      if (value > bestValue) {
        bestValue = value
        best = c
      }
    }
    if (best !== 0 && best !== prev) text += dict[best - 1] ?? ''
    prev = best
  }
  return text.trim()
}

export async function recognize(sessions: OcrSessions, image: PixelImage): Promise<OcrWord[]> {
  const fitted = fitDet(image.width, image.height)
  const detInput = sampleTensor(image, fitted.width, fitted.height)
  const detTensor = await sessions.det.run(detInput, [1, 3, fitted.height, fitted.width])
  const dims = detTensor.dims
  const mapH = Number(dims.at(-2))
  const mapW = Number(dims.at(-1))
  const boxes = boxesFromMap(detTensor.data as Float32Array, mapW, mapH, image.width, image.height)
  const words: OcrWord[] = []
  for (const box of boxes) {
    const rec = recTensor(image, box)
    const recTensorOut = await sessions.rec.run(rec.data, [1, 3, 48, rec.width])
    const recDims = recTensorOut.dims
    const time = Number(recDims.length === 3 ? recDims[1] : recDims[0])
    const classes = Number(recDims.at(-1))
    const text = decodeCtc(recTensorOut.data as Float32Array, time, classes, sessions.dict)
    if (text) words.push({ text, x: box.x, y: box.y, width: box.width, height: box.height })
  }
  return words
}
