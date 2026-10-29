import { RESOURCE_ORIGIN, installSnapshot, type ResourceContext, type ResourceManifest, type ResourceSnapshot, type ResourceFile } from './runtime'
import { sha256, utf8 } from './sha256'
import { RESOURCE_FILES } from './files'
import type { LoadingProgress } from './loadingProgress'
import { validateActivityResource } from './validateActivities'
export interface ResourceTransport {
  readCache(): Promise<string | null>
  writeCache(value: string): Promise<void>
  fetchText(url: string, timeout: number, onProgress?: (loaded: number, total: number) => void, expectedBytes?: number): Promise<string>
}
const MAX_DATA_BYTES = 8_000_000
export function validManifest(value: unknown, context?: ResourceContext): value is ResourceManifest {
  if (!value || typeof value !== 'object') return false
  const m = value as ResourceManifest
  if (m.schemaVersion !== 1 || m.contract !== 'sleepast-data-v1' || m.clientMajor !== 2 || !/^\d+\.\d+\.\d+(?:\.\d+)?$/.test(m.version)) return false
  if (!Array.isArray(m.files) || m.files.slice().sort().join('\n') !== RESOURCE_FILES.join('\n')) return false
  const prefixes = (context ? [`/${context}`] : ['', '/prod', '/test']).map(base => `${base}/resources/v1/releases/${m.version}/`)
  const prefix = prefixes.find(prefix => m.data?.path?.startsWith(prefix)) ?? '!invalid!'
  const validFile = (f: ResourceFile) => f && typeof f.path === 'string' && f.path.startsWith(prefix) && !/[\\?#%]/.test(f.path) && !f.path.split('/').includes('..') && Number.isSafeInteger(f.bytes) && f.bytes > 0 && f.bytes <= MAX_DATA_BYTES && /^[a-f0-9]{64}$/.test(f.sha256)
  return Boolean(validFile(m.data) && m.assets && typeof m.assets === 'object' && !Array.isArray(m.assets) && Object.entries(m.assets).every(([key,file]) => /^(images|items|sprites)\/[\w/.-]+$/.test(key) && !key.split('/').includes('..') && validFile(file)))
}
export function decodeSnapshot(manifest: unknown, payload: string, context?: ResourceContext): ResourceSnapshot {
  if (!validManifest(manifest, context)) throw new Error('资料版本不兼容')
  const bytes = utf8(payload)
  if (bytes.length !== manifest.data.bytes || sha256(bytes) !== manifest.data.sha256) throw new Error('资料完整性校验失败')
  const data = JSON.parse(payload) as Record<string, unknown>
  if (!data || Array.isArray(data) || Object.keys(data).sort().join('\n') !== RESOURCE_FILES.join('\n') || Object.values(data).some(value => value === null || typeof value !== 'object')) throw new Error('资料包不完整')
  validateActivityResource(data)
  return { manifest, data }
}
export async function initializeResources(transport: ResourceTransport, budget = 8000, onProgress: (progress: LoadingProgress) => void = () => {}, context?: ResourceContext): Promise<'remote' | 'cache' | 'bundled'> {
  let finished = false
  const report = (percent: number, label: string) => { if (!finished) onProgress({ percent, label }) }
  report(0, '正在读取本地资料…')
  let cache: ResourceSnapshot | undefined
  let cachedPayload: string | undefined
  // Persistent cache is optional. Network failure must never prevent startup.
  try {
    let cacheTimer: ReturnType<typeof setTimeout> | undefined
    const value = await Promise.race([
      transport.readCache(),
      new Promise<null>(resolve => { cacheTimer = setTimeout(() => resolve(null), 1000) }),
    ]).finally(() => clearTimeout(cacheTimer))
    if (value) { const saved = JSON.parse(value); cache = decodeSnapshot(saved.manifest, saved.payload, context); cachedPayload = saved.payload }
  } catch { /* corrupted or unavailable storage falls back to bundled resources */ }
  let timer: ReturnType<typeof setTimeout> | undefined
  const deadline = Date.now() + budget
  report(0, '正在检查资料更新…')
  try {
    const result = await Promise.race([
      (async () => {
        const manifest = JSON.parse(await transport.fetchText(`${RESOURCE_ORIGIN}${context ? '/' + context : ''}/resources/v1/manifest.json`, budget))
        if (!validManifest(manifest, context)) throw new Error('资料版本不兼容')
        if (cache && manifest.data.sha256 === cache.manifest.data.sha256 && manifest.version === cache.manifest.version) return { snapshot: cache, payload: cachedPayload! }
        const remaining = deadline - Date.now()
        if (remaining <= 0) throw new Error('资料下载超时')
        const payload = await transport.fetchText(RESOURCE_ORIGIN + manifest.data.path, remaining, (loaded, total) => {
          if (total > 0) report(Math.min(99, Math.max(0, Math.floor(loaded / total * 100))), '正在下载资料…')
        }, manifest.data.bytes)
        report(99, '正在校验资料…')
        return { snapshot: decodeSnapshot(manifest, payload, context), payload }
      })(),
      new Promise<never>((_resolve, reject) => { timer = setTimeout(() => reject(new Error('资料下载超时')), budget) }),
    ])
    installSnapshot(result.snapshot)
    // Activate only after the whole bundle validates; a quota error is harmless.
    void transport.writeCache(JSON.stringify({ manifest: result.snapshot.manifest, payload: result.payload })).catch(() => {})
    report(100, '资料已就绪')
    return 'remote'
  } catch {
    installSnapshot(cache)
    report(100, cache ? '已加载缓存资料' : '已加载本地资料')
    return cache ? 'cache' : 'bundled'
  } finally { finished = true; clearTimeout(timer) }
}
