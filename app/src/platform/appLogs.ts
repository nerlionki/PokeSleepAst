import { Capacitor } from '@capacitor/core'
import { Directory, Encoding, Filesystem } from '@capacitor/filesystem'
import { Share } from '@capacitor/share'
import type { App } from 'vue'

const KEY = 'pokesleep-app-logs-v1'
const MAX_ENTRIES = 200
const MAX_STORAGE_CHARS = 500_000
export interface AppLog {
  time: string
  level: 'error' | 'warn'
  source: string
  appVersion: string
  route: string
  detail: string
  context?: string
}
let entries: AppLog[] = []
let loaded = false
let installed = false
let storageAvailable = true
const version = () => typeof __APP_VERSION__ === 'string' ? __APP_VERSION__ : 'unknown'

function describe(value: unknown, limit = 12_000): string {
  try {
    if (typeof value === 'string') return value.slice(0, limit)
    const seen = new WeakSet<object>()
    return (JSON.stringify(value, (_key, item: unknown) => {
      if (typeof item === 'bigint') return String(item)
      if (item && typeof item === 'object') {
        if (seen.has(item)) return '[Circular]'
        seen.add(item)
        if (item instanceof Error) return { name: item.name, message: item.message, stack: item.stack, cause: item.cause }
      }
      return item
    }) ?? String(value)).slice(0, limit)
  } catch { return '[无法序列化的错误信息]' }
}

function load() {
  if (loaded) return
  loaded = true
  try {
    const raw = localStorage.getItem(KEY)
    const saved: unknown = raw && raw.length <= MAX_STORAGE_CHARS ? JSON.parse(raw) : []
    if (Array.isArray(saved)) entries = saved.filter((item): item is AppLog => item && typeof item.time === 'string'
      && typeof item.detail === 'string' && typeof item.source === 'string' && ['error', 'warn'].includes(item.level)).slice(-MAX_ENTRIES)
  } catch { storageAvailable = false }
}

/** Logging must never throw back into an already failing application. */
export function recordAppLog(source: string, error: unknown, context?: unknown, level: AppLog['level'] = 'error') {
  try {
    load()
    entries.push({ time: new Date().toISOString(), level, source, appVersion: version(),
      route: typeof location === 'undefined' ? '' : location.hash,
      detail: describe(error), ...(context === undefined ? {} : { context: describe(context) }) })
    entries = entries.slice(-MAX_ENTRIES)
    let serialized = JSON.stringify(entries)
    while (serialized.length > MAX_STORAGE_CHARS && entries.length > 1) { entries.shift(); serialized = JSON.stringify(entries) }
    try { localStorage.setItem(KEY, serialized); storageAvailable = true }
    catch { storageAvailable = false }
  } catch { /* Diagnostics must not create a second application error. */ }
}

export function appLogSnapshot() {
  load()
  return { schemaVersion: 1, exportedAt: new Date().toISOString(), appVersion: version(),
    platform: Capacitor.getPlatform(), userAgent: typeof navigator === 'undefined' ? '' : navigator.userAgent,
    storageAvailable, logs: entries.map(entry => ({ ...entry })) }
}

export function installAppLogging(app: App) {
  if (installed) return
  installed = true
  const previous = app.config.errorHandler
  app.config.errorHandler = (error, instance, info) => {
    recordAppLog('vue', error, { info })
    if (previous) previous(error, instance, info)
    else console.error(error)
  }
  window.addEventListener('error', (event) => {
    recordAppLog('window.error', event.error ?? event.message ?? '资源加载失败', { filename: event.filename, line: event.lineno, column: event.colno })
  }, true)
  window.addEventListener('unhandledrejection', (event) => recordAppLog('unhandledrejection', event.reason))
}

export async function exportAppLogs(): Promise<string> {
  const snapshot = appLogSnapshot()
  const text = JSON.stringify(snapshot, null, 2)
  const name = `pokesleep-logs-${snapshot.exportedAt.replace(/[:.]/g, '-')}.json`
  if (Capacitor.isNativePlatform()) {
    const file = await Filesystem.writeFile({ path: `logs/${name}`, data: text, directory: Directory.Cache, encoding: Encoding.UTF8, recursive: true })
    await Share.share({ title: '宝睡助手应用日志', dialogTitle: '导出应用日志', files: [file.uri] })
    return '已调起系统分享，请选择保存或发送日志文件。'
  }
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json;charset=utf-8' }))
  const anchor = document.createElement('a')
  anchor.href = url; anchor.download = name
  document.body.append(anchor)
  try { anchor.click() } finally { anchor.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000) }
  return '已下载日志文件。'
}
