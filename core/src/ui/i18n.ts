import { readonly, shallowRef } from 'vue'
import { activeSnapshot } from '../resources/runtime'
import { loadJson, saveJson } from '../storage'
import { gameLabel } from './gameLabels'

export const languages = [
  { id: 'zh-CN', label: '简体中文' },
  { id: 'en', label: 'English' },
] as const
export type Language = typeof languages[number]['id']

const storageKey = 'language'
const selected = shallowRef<Language>('zh-CN')
export const language = readonly(selected)
let hydration: Promise<void> | undefined
let saving = Promise.resolve()

export function hydrateLanguage() {
  return hydration ??= loadJson<unknown>(storageKey, 'zh-CN').then(saved => {
    if (languages.some(option => option.id === saved)) selected.value = saved as Language
  }).catch(() => {})
}

export async function setLanguage(next: Language) {
  selected.value = next
  const write = saving.then(() => saveJson(storageKey, next))
  saving = write.catch(() => {})
  return write
}

type Values = Readonly<Record<string, string | number>>

function catalog() {
  const meta = activeSnapshot()?.data['meta.json'] as {
    i18n?: { schemaVersion?: number; aliases?: Record<string, string>; locales?: Record<string, { messages?: Record<string, unknown> }> }
  } | undefined
  return meta?.i18n?.schemaVersion === 1 ? meta.i18n : undefined
}

export function t(key = '', values?: Values): string {
  const data = catalog()
  const aliases = data?.aliases
  const alias = aliases && Object.hasOwn(aliases, key) ? aliases[key] : undefined
  const source = typeof alias === 'string' ? alias : key
  const messages = selected.value !== 'zh-CN' ? data?.locales?.[selected.value]?.messages : undefined
  const lookup = source.includes('\n') ? source.replace(/\s+/g, ' ').trim() : source
  const entry = messages && Object.hasOwn(messages, lookup) ? messages[lookup] : undefined
  const result = typeof entry === 'string' && entry.trim() ? entry : source
  return values
    ? result.replace(/\{(\w+)\}/g, (token, name: string) => Object.hasOwn(values, name) ? String(values[name]) : token)
    : result
}

export function gameText(name = ''): string {
  return t(gameLabel(name))
}
