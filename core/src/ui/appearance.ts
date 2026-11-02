import clientFactoryDefaults from '../data/client-defaults.resource'

import clientDefaults from '../data/client-defaults.resource'
import { cloneData } from '../calc/dataClone'
const ui_appearance_config_clientDefaults = clientDefaults.modules.ui_appearance
const factory_appearance_config_clientFactoryDefaults = clientFactoryDefaults.modules.factory_appearance

export const colorFields = ((cloneData(ui_appearance_config_clientDefaults["colorFields"]) as unknown as readonly [{readonly "key":"ink";readonly "label":"页面背景"},{readonly "key":"ink-2";readonly "label":"表单背景"},{readonly "key":"card";readonly "label":"卡片背景"},{readonly "key":"line";readonly "label":"边框"},{readonly "key":"text";readonly "label":"正文"},{readonly "key":"muted";readonly "label":"辅助文字"},{readonly "key":"amber";readonly "label":"主色"},{readonly "key":"sage";readonly "label":"强调色"},{readonly "key":"rose";readonly "label":"提醒色"}]))
export type ColorKey = typeof colorFields[number]['key']
export type Palette = Record<ColorKey, string>
export const themes = ((cloneData(ui_appearance_config_clientDefaults["themes"]) as unknown as readonly [{readonly "id":"night";readonly "name":"夜间营地";readonly "colors":{readonly "ink":"#081018";readonly "ink-2":"#101a26";readonly "card":"#152232";readonly "line":"#2a3d52";readonly "text":"#e7eef6";readonly "muted":"#93a4b5";readonly "amber":"#e4b15a";readonly "sage":"#7fcec0";readonly "rose":"#e0897a"}},{readonly "id":"day";readonly "name":"晴日营地";readonly "colors":{readonly "ink":"#f5f3ed";readonly "ink-2":"#eeebe2";readonly "card":"#ffffff";readonly "line":"#c9c8bf";readonly "text":"#25322e";readonly "muted":"#59665f";readonly "amber":"#81551a";readonly "sage":"#236d60";readonly "rose":"#a33d38"}},{readonly "id":"forest";readonly "name":"林间营地";readonly "colors":{readonly "ink":"#101c19";readonly "ink-2":"#172923";readonly "card":"#1d332b";readonly "line":"#3b5b4d";readonly "text":"#edf2df";readonly "muted":"#a9bdad";readonly "amber":"#e7c477";readonly "sage":"#93d4b1";readonly "rose":"#f0a59b"}}]))
export const fontSizes = ((cloneData(ui_appearance_config_clientDefaults["fontSizes"]) as unknown as readonly [{readonly "id":"small";readonly "name":"小";readonly "scale":0.9},{readonly "id":"standard";readonly "name":"标准";readonly "scale":1},{readonly "id":"large";readonly "name":"大";readonly "scale":1.15},{readonly "id":"extra";readonly "name":"特大";readonly "scale":1.3}]))
export const fontSteps = ((cloneData(ui_appearance_config_clientDefaults["fontSteps"]) as unknown as readonly [10,11,12,13,14,16,17,18,19,20,22,24,28,32,40]))
export interface Appearance { theme: typeof themes[number]['id']; fontSize: typeof fontSizes[number]['id']; colors: Partial<Palette> }
export function defaultAppearance(): Appearance { return (cloneData(factory_appearance_config_clientFactoryDefaults["defaultAppearance"]) as unknown as Appearance) }
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
  const vars: Record<string, string> = (cloneData(ui_appearance_config_clientDefaults["vars"]) as unknown as Record<string, string>)
  for (const { key } of colorFields) { vars['--' + key] = palette[key]; vars['--' + key + '-rgb'] = rgb(palette[key]).join(', ') }
  for (const size of fontSteps) vars['--font-' + size] = `${Math.round(size * scale * 100) / 100}px`
  vars['--on-accent'] = luminance(palette.amber) > 0.179 ? '#081018' : '#ffffff'
  vars['--on-sage'] = luminance(palette.sage) > 0.179 ? '#081018' : '#ffffff'
  vars['--color-scheme'] = luminance(palette.ink) > 0.179 ? 'light' : 'dark'
  return vars
}
