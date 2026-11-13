import type { PixelImage } from '../../../core/src/calc/ocrVision'
import { bundledImage } from './images'
export async function fileToImage(file: File | string): Promise<PixelImage> {
  const bitmap = await createImageBitmap(file as File)
  const canvas = document.createElement('canvas')
  canvas.width = bitmap.width
  canvas.height = bitmap.height
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) throw new Error('canvas')
  ctx.drawImage(bitmap, 0, 0)
  const image = ctx.getImageData(0, 0, bitmap.width, bitmap.height)
  bitmap.close()
  return image
}

async function readImage(url: string): Promise<PixelImage | null> {
  if (!url) return null
  return new Promise((resolve) => {
    const img = new Image()
    const finish = (pixels: PixelImage | null) => {
      clearTimeout(timer)
      img.onload = null
      img.onerror = null
      resolve(pixels)
    }
    const timer = setTimeout(() => finish(null), 5000)
    if (/^https?:\/\//.test(url)) img.crossOrigin = 'anonymous'
    img.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width = img.naturalWidth || 1
      canvas.height = img.naturalHeight || 1
      const ctx = canvas.getContext('2d')
      if (!ctx) return finish(null)
      try {
        ctx.drawImage(img, 0, 0)
        finish(ctx.getImageData(0, 0, canvas.width, canvas.height))
      } catch { finish(null) }
    }
    img.onerror = () => finish(null)
    img.src = url
  })
}

export async function loadUrl(url: string): Promise<PixelImage | null> {
  const pixels = await readImage(url)
  if (pixels) return pixels
  const fallback = bundledImage(url)
  return fallback && fallback !== url ? readImage(fallback) : null
}

