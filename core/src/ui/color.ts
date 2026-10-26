import { normalizeColor } from './appearance'

export interface HsvColor { hue: number; saturation: number; value: number }
export function colorToHsv(value: string): HsvColor {
  const hex = normalizeColor(value) ?? '#000000'
  const [r = 0, g = 0, b = 0] = [1, 3, 5].map(i => Number.parseInt(hex.slice(i, i + 2), 16) / 255)
  const max = Math.max(r, g, b), min = Math.min(r, g, b), delta = max - min
  const hue = !delta ? 0 : max === r ? ((g - b) / delta + (g < b ? 6 : 0)) * 60 : max === g ? ((b - r) / delta + 2) * 60 : ((r - g) / delta + 4) * 60
  return { hue, saturation: max ? delta / max * 100 : 0, value: max * 100 }
}
export function hsvToColor({ hue, saturation, value }: HsvColor): string {
  const h = ((hue % 360) + 360) % 360, s = Math.max(0, Math.min(100, saturation)) / 100, v = Math.max(0, Math.min(100, value)) / 100
  const c = v * s, x = c * (1 - Math.abs((h / 60) % 2 - 1)), m = v - c
  const channels = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x]
  return '#' + channels.map(channel => Math.round((channel + m) * 255).toString(16).padStart(2, '0')).join('')
}
export interface ColorPlaneRect { left: number; top: number; width: number; height: number }
export interface ColorPlanePosition { x: number; y: number }
export type ColorPlaneKind = 'sv' | 'hue'
export function colorPlanePosition(rect: ColorPlaneRect, point: { clientX: number; clientY: number }): ColorPlanePosition | null {
  if (rect.width <= 0 || rect.height <= 0 || ![rect.left, rect.top, rect.width, rect.height, point.clientX, point.clientY].every(Number.isFinite)) return null
  return { x: Math.max(0, Math.min(1, (point.clientX - rect.left) / rect.width)), y: Math.max(0, Math.min(1, (point.clientY - rect.top) / rect.height)) }
}
