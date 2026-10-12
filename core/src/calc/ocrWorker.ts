import { createScreenshotImporter, type ImportProgress } from './ocrImportCore'
import type { OcrSessions, PixelImage } from './ocrPipeline'
import type { BoxPokemon } from '../types'

export interface ImportAssets { ingredients: Record<number, string>; portraits: Record<number, string>; shiny: Record<number, string> }
export type ImportResult = ReturnType<typeof import('./ocrBox').planImports>
type Request = { type: 'start'; files: Array<File | string>; existing: BoxPokemon[]; assets: ImportAssets }
type Rpc = { type: 'rpc'; id: number; method: string; args: unknown[] }
type Reply = { type: 'reply'; id: number; value?: unknown; error?: string }
type Message = Request | Rpc | Reply | { type: 'progress'; progress: ImportProgress } | { type: 'result'; result: ImportResult } | { type: 'error'; message: string }
interface WireImage { width: number; height: number; data: ArrayBuffer }
interface WireTensor { dims: readonly number[]; data: ArrayBuffer }
export interface ImportPort { postMessage(message: Message): void }

/** Pure CPU work runs here. WeChat's native inference and image APIs are bridged via RPC. */
export function installImportWorker(port: ImportPort, listen: (handler: (message: Message) => void) => void, localOcr?: () => Promise<OcrSessions>) {
  let nextId = 0, started = false
  const pending = new Map<number, { resolve(value: unknown): void; reject(error: Error): void }>()
  function rpc<T>(method: string, ...args: unknown[]): Promise<T> {
    return new Promise((resolve, reject) => {
      const id = ++nextId
      pending.set(id, { resolve: value => resolve(value as T), reject })
      port.postMessage({ type: 'rpc', id, method, args })
    })
  }
  listen(message => {
    if (message.type === 'reply') {
      const request = pending.get(message.id)
      pending.delete(message.id)
      if (message.error) request?.reject(new Error(message.error))
      else request?.resolve(message.value)
    } else if (message.type === 'start' && !started) {
      started = true
      const importer = createScreenshotImporter({
        fileToImage: async file => {
          const image = await rpc<WireImage>('file', file)
          return { width: image.width, height: image.height, data: new Uint8ClampedArray(image.data) }
        },
        loadUrl: async url => {
          const image = await rpc<WireImage | null>('image', url)
          return image ? { width: image.width, height: image.height, data: new Uint8ClampedArray(image.data) } : null
        },
        ingredientImageUrl: id => message.assets.ingredients[id] ?? '',
        pokemonPortraitUrl: id => message.assets.portraits[id] ?? '',
        pokemonShinyPortraitUrl: id => message.assets.shiny[id] ?? '',
        loadOcr: localOcr ?? (async () => {
          const dict = await rpc<string[]>('models')
          const model = (name: 'det' | 'rec') => ({ async run(data: Float32Array, dims: number[]) {
            const result = await rpc<WireTensor>('run', name, data.buffer, dims)
            return { ...result, data: new Float32Array(result.data) }
          } })
          return { dict, det: model('det'), rec: model('rec') }
        }),
      })
      void importer.importScreenshotFiles(message.files, message.existing, progress => port.postMessage({ type: 'progress', progress }))
        .then(result => port.postMessage({ type: 'result', result }))
        .catch(error => port.postMessage({ type: 'error', message: error instanceof Error ? error.message : '截图识别失败' }))
    }
  })
}

export interface ImportWorker extends ImportPort {
  onmessage: ((event: { data: Message }) => void) | null
  onerror: (() => void) | null
  terminate(): void
}
export interface ImportHost {
  fileToImage(file: File | string): Promise<PixelImage>
  loadUrl(url: string): Promise<PixelImage | null>
  loadOcr?(): Promise<OcrSessions>
}
export function runImportWorker(worker: ImportWorker, files: Array<File | string>, existing: BoxPokemon[], assets: ImportAssets,
  host: ImportHost, progress: (value: ImportProgress) => void): Promise<ImportResult> {
  return new Promise((resolve, reject) => {
    let finished = false
    const finish = (error?: Error, result?: ImportResult) => {
      if (finished) return
      finished = true
      clearTimeout(timer)
      worker.onmessage = null; worker.onerror = null
      try { worker.terminate() } catch { /* Termination may already have been performed by the platform. */ }
      if (error) reject(error)
      else resolve(result!)
    }
    // A killed or stalled worker must not leave navigation locked indefinitely.
    let timer = setTimeout(() => finish(new Error('截图识别没有响应，请重试')), 120_000)
    const heartbeat = () => { clearTimeout(timer); timer = setTimeout(() => finish(new Error('截图识别没有响应，请重试')), 120_000) }
    worker.onerror = () => finish(new Error('截图识别线程中断，请重试'))
    worker.onmessage = ({ data }) => {
      if (finished) return
      heartbeat()
      if (data.type === 'progress') progress(data.progress)
      else if (data.type === 'result') finish(undefined, data.result)
      else if (data.type === 'error') finish(new Error(data.message))
      else if (data.type === 'rpc') {
        const request = data
        const imagePayload = (image: PixelImage | null): WireImage | null => image ? {
          width: image.width, height: image.height, data: new Uint8ClampedArray(image.data).buffer,
        } : null
        const execute = async () => {
          if (request.method === 'file') return imagePayload(await host.fileToImage(request.args[0] as File | string))
          if (request.method === 'image') return imagePayload(await host.loadUrl(request.args[0] as string))
          const sessions = await host.loadOcr!()
          if (request.method === 'models') return sessions.dict
          if (request.method === 'run') {
            const result = await sessions[request.args[0] as 'det' | 'rec'].run(new Float32Array(request.args[1] as ArrayBuffer), request.args[2] as number[])
            return { dims: result.dims, data: new Float32Array(result.data).buffer }
          }
          throw new Error('未知识别请求')
        }
        void execute().then(value => {
          if (!finished) worker.postMessage({ type: 'reply', id: request.id, value })
        }).catch(error => {
          if (!finished) {
            try { worker.postMessage({ type: 'reply', id: request.id, error: error instanceof Error ? error.message : '读取失败' }) }
            catch { finish(new Error('截图识别线程中断，请重试')) }
          }
        })
      }
    }
    try {
      worker.postMessage({ type: 'start', files, existing: JSON.parse(JSON.stringify(existing)), assets })
    } catch (error) { finish(error instanceof Error ? error : new Error('无法启动截图识别')) }
  })
}
