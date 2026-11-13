import { readonly, shallowRef } from 'vue'
import { activeSnapshot } from '../../../core/src/resources/runtime'
import { loadJson, saveJson } from '../../../core/src/storage'
import { gameLabel } from './gameLabelFacade'
import { i18nPack, loadI18nPack } from './i18nRuntime'

export const languages = [
  { id: 'zh-CN', label: '简体中文' },
  { id: 'zh-TW', label: '繁體中文' },
  { id: 'ja', label: '日本語' },
  { id: 'en', label: 'English' }
] as const
export type Language = (typeof languages)[number]['id']

const storageKey = 'language'
const selected = shallowRef<Language>('zh-CN')
export const language = readonly(selected)
let hydration: Promise<void> | undefined
let saving = Promise.resolve()

type Values = Readonly<Record<string, string | number>>
type Catalog = {
  schemaVersion?: number
  aliases?: Record<string, string>
  locales?: Record<string, { messages?: Record<string, unknown> }>
}

function catalog(): Catalog | undefined {
  const meta = activeSnapshot()?.data['meta.json'] as { i18n?: Catalog } | undefined
  return meta?.i18n?.schemaVersion === 1 ? meta.i18n : undefined
}

function fill(result: string, values?: Values) {
  return values
    ? result.replace(/\{(\w+)\}/g, (token, name: string) => Object.hasOwn(values, name) ? String(values[name]) : token)
    : result
}

export function hydrateLanguage() {
  return (hydration ??= loadI18nPack()
    .then(() => loadJson<unknown>(storageKey, 'zh-CN'))
    .then(saved => {
      if (languages.some(option => option.id === saved)) selected.value = saved as Language
    })
    .catch(() => {}))
}

export async function setLanguage(next: Language) {
  selected.value = next
  const write = saving.then(() => saveJson(storageKey, next))
  saving = write.catch(() => {})
  return write
}

export function hasInterfaceTranslations(next: Language) {
  const loaded = i18nPack()
  return loaded ? loaded.hasInterfaceTranslations(catalog(), next) : next === 'zh-CN'
}

export function t(key = '', values?: Values) {
  const current = selected.value
  const loaded = i18nPack()
  return loaded ? loaded.translate(catalog(), current, key, values) : fill(key, values)
}

export function gameText(name = '') {
  return t(gameLabel(name))
}

export function individualName(label: string | undefined, species: string | undefined) {
  const custom = label?.trim()
  if (custom && custom !== species) return custom
  return gameText(custom || species || '')
}

export function teamName(name: string) {
  const indexed = /^队伍 (\d+)$/.exec(name)
  if (indexed) return t('队伍 {n}', { n: indexed[1] })
  return t(name)
}

export function formatSleepLength(totalMinutes: number) {
  const minutes = Math.max(0, Math.round(totalMinutes))
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  if (hours <= 0) return t('{minutes}分钟', { minutes: rest })
  if (!rest) return t('{arg1}小时', { arg1: hours })
  return t('{hours}小时{minutes}分钟', { hours, minutes: rest })
}

export function catalogText(kind: '活动标题' | '活动礼包', id: string | undefined, name: string) {
  const key = kind + '#' + id
  const localized = id ? t(key) : key
  return localized === key ? gameText(name) : localized
}

export function sleepStyleText(style: { styleName: string; pokeId: number; stars: number }) {
  const current = selected.value
  const key = gameLabel(style.styleName)
  const loaded = i18nPack()
  return loaded ? loaded.translate(catalog(), current, key, undefined, `${style.pokeId}-${style.stars}`) : key
}
