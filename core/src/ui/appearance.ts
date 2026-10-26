export const colorFields = [
  { key: 'ink', label: '页面背景' }, { key: 'ink-2', label: '表单背景' },
  { key: 'card', label: '卡片背景' }, { key: 'line', label: '边框' },
  { key: 'text', label: '正文' }, { key: 'muted', label: '辅助文字' },
  { key: 'amber', label: '主色' }, { key: 'sage', label: '强调色' },
  { key: 'rose', label: '提醒色' },
] as const
export type ColorKey = typeof colorFields[number]['key']
export type Palette = Record<ColorKey, string>
export const themes = [
  { id: 'night', name: '夜间营地', colors: { ink: '#081018', 'ink-2': '#101a26', card: '#152232', line: '#2a3d52', text: '#e7eef6', muted: '#93a4b5', amber: '#e4b15a', sage: '#7fcec0', rose: '#e0897a' } },
  { id: 'day', name: '晴日营地', colors: { ink: '#f5f3ed', 'ink-2': '#eeebe2', card: '#ffffff', line: '#c9c8bf', text: '#25322e', muted: '#59665f', amber: '#81551a', sage: '#236d60', rose: '#a33d38' } },
  { id: 'forest', name: '林间营地', colors: { ink: '#101c19', 'ink-2': '#172923', card: '#1d332b', line: '#3b5b4d', text: '#edf2df', muted: '#a9bdad', amber: '#e7c477', sage: '#93d4b1', rose: '#f0a59b' } },
] as const
export const fontSizes = [
  { id: 'small', name: '小', scale: 0.9 }, { id: 'standard', name: '标准', scale: 1 },
  { id: 'large', name: '大', scale: 1.15 }, { id: 'extra', name: '特大', scale: 1.3 },
] as const
export const fontSteps = [10, 11, 12, 13, 14, 16, 17, 18, 19, 20, 22, 24, 28, 32, 40] as const
export interface Appearance { theme: typeof themes[number]['id']; fontSize: typeof fontSizes[number]['id']; colors: Partial<Palette> }
export function defaultAppearance(): Appearance { return { theme: 'night', fontSize: 'standard', colors: {} } }
export function normalizeColor(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const hex = value.trim()
  if (/^#[\da-f]{6}$/i.test(hex)) return hex.toLowerCase()
  if (/^#[\da-f]{3}$/i.test(hex)) return '#' + [...hex.slice(1)].map(v => v + v).join('').toLowerCase()
  return null
}
export function normalizeAppearance(value: unknown): Appearance {
  const next = defaultAppearance()
  if (!value || typeof value !== 'object') return next
  const raw = value as Record<string, unknown>
  if (themes.some(t => t.id === raw.theme)) next.theme = raw.theme as Appearance['theme']
  if (fontSizes.some(t => t.id === raw.fontSize)) next.fontSize = raw.fontSize as Appearance['fontSize']
  if (raw.colors && typeof raw.colors === 'object') for (const { key } of colorFields) {
    const color = normalizeColor((raw.colors as Record<string, unknown>)[key])
    if (color) next.colors[key] = color
  }
  return next
}
export function appearancePalette(value: Appearance): Palette {
  return { ...(themes.find(t => t.id === value.theme) ?? themes[0]).colors, ...value.colors }
}
function rgb(hex: string): number[] { return [1, 3, 5].map(i => Number.parseInt(hex.slice(i, i + 2), 16)) }
export function luminance(hex: string): number {
  const [r = 0, g = 0, b = 0] = rgb(hex).map(c => c / 255).map(c => c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)
  return r * 0.2126 + g * 0.7152 + b * 0.0722
}
export function appearanceVariables(value: Appearance): Record<string, string> {
  const palette = appearancePalette(value)
  const scale = fontSizes.find(t => t.id === value.fontSize)?.scale ?? 1
  const vars: Record<string, string> = {}
  for (const { key } of colorFields) { vars['--' + key] = palette[key]; vars['--' + key + '-rgb'] = rgb(palette[key]).join(', ') }
  for (const size of fontSteps) vars['--font-' + size] = `${Math.round(size * scale * 100) / 100}px`
  vars['--on-accent'] = luminance(palette.amber) > 0.179 ? '#081018' : '#ffffff'
  vars['--on-sage'] = luminance(palette.sage) > 0.179 ? '#081018' : '#ffffff'
  vars['--color-scheme'] = luminance(palette.ink) > 0.179 ? 'light' : 'dark'
  return vars
}
