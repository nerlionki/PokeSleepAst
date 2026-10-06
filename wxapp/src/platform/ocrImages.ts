import Taro from '@tarojs/taro'
import type { PixelImage } from '../../../core/src/calc/ocrVision'
import { loadAssetPackage } from './subpackage'
const cache = new Map<string, PixelImage>()
export async function fileToImage(file: File | string): Promise<PixelImage> {
  if (typeof file !== 'string') throw new Error('请选择微信中的截图文件')
  const info = await Taro.getImageInfo({ src: file })
  const canvas = wx.createOffscreenCanvas({ type: '2d', width: info.width, height: info.height })
  const context = canvas.getContext('2d')
  const image = canvas.createImage()
  await new Promise<void>((resolve, reject) => { image.onload = () => resolve(); image.onerror = () => reject(new Error('截图无法读取')); image.src = file })
  context.drawImage(image, 0, 0, info.width, info.height)
  const pixels = context.getImageData(0, 0, info.width, info.height)
  return { data: new Uint8ClampedArray(pixels.data), width: info.width, height: info.height }
}
export async function loadUrl(url: string): Promise<PixelImage | null> {
  if (cache.has(url)) return cache.get(url)!
  try {
    const pack = url.match(/^\/(asset-pack\d+)\//)?.[1]
    if (pack) await loadAssetPackage(pack)
    const pixels = await fileToImage(url)
    cache.set(url, pixels)
    return pixels
  } catch { return null }
}
