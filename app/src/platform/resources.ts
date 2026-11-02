import { selectedDataSource } from './dataSource'
import { setResourceContext, resourceContext } from '../../../core/src/resources/runtime'
import { Capacitor } from '@capacitor/core'
import { Directory, Encoding, Filesystem } from '@capacitor/filesystem'
import { initializeResources } from '../../../core/src/resources/loader'
import { updateLoadingProgress } from '../../../core/src/resources/loadingProgress'
const cacheName = () => 'sleepast-resources-v1-' + resourceContext()
async function database(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(cacheName(), 1)
    request.onupgradeneeded = () => request.result.createObjectStore('resources')
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}
async function webCache(value?: string): Promise<string | null> {
  const db = await database()
  try {
    return await new Promise((resolve, reject) => {
      const transaction = db.transaction('resources', value === undefined ? 'readonly' : 'readwrite')
      const store = transaction.objectStore('resources')
      const request = value === undefined ? store.get('current') : store.put(value, 'current')
      transaction.oncomplete = () => resolve(value === undefined ? request.result ?? null : null)
      transaction.onerror = () => reject(transaction.error)
      transaction.onabort = () => reject(transaction.error)
    })
  } finally { db.close() }
}
export const resourcesReady = selectedDataSource().then(context => {
setResourceContext(context)
return initializeResources({
  async readCache() {
    if (!Capacitor.isNativePlatform()) return webCache()
    const result = await Filesystem.readFile({ path: cacheName() + '.json', directory: Directory.Data, encoding: Encoding.UTF8 })
    return typeof result.data === 'string' ? result.data : null
  },
  async writeCache(value) {
    if (!Capacitor.isNativePlatform()) { await webCache(value); return }
    await Filesystem.writeFile({ path: cacheName() + '.tmp', directory: Directory.Data, encoding: Encoding.UTF8, data: value })
    await Filesystem.rename({ from: cacheName() + '.tmp', to: cacheName() + '.json', directory: Directory.Data, toDirectory: Directory.Data })
  },
  async fetchText(url, timeout, onProgress, expectedBytes) {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeout)
    try {
      const response = await fetch(url, { cache: 'no-store', signal: controller.signal })
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      let value: string
      if (onProgress && response.body) {
        const reader = response.body.getReader()
        const decoder = new TextDecoder()
        const chunks: string[] = []
        let loaded = 0
        while (true) {
          const next = await reader.read()
          if (next.done) break
          loaded += next.value.byteLength
          if (loaded > 8_000_000) { await reader.cancel(); throw new Error('资料过大') }
          chunks.push(decoder.decode(next.value, { stream: true }))
          onProgress(loaded, expectedBytes ?? 0)
        }
        chunks.push(decoder.decode())
        value = chunks.join('')
      } else value = await response.text()
      if (value.length > 8_000_000) throw new Error('资料过大')
      return value
    } finally { clearTimeout(timer) }
  },
}, 8000, updateLoadingProgress, context)
})
