import { describe, expect, it, vi } from 'vitest'
import { reactive } from 'vue'
import { installImportWorker, runImportWorker, type ImportPort, type ImportWorker } from '../../../core/src/calc/ocrWorker'
import type { ImportProgress } from '../../../core/src/calc/ocrImportCore'

function connectedWorker() {
  let handler: (value: Parameters<ImportPort['postMessage']>[0]) => void = () => {}
  const terminate = vi.fn()
  const worker: ImportWorker = {
    onmessage: null, onerror: null, terminate,
    postMessage: value => queueMicrotask(() => handler(structuredClone(value))),
  }
  installImportWorker({ postMessage: value => queueMicrotask(() => worker.onmessage?.({ data: structuredClone(value) })) }, callback => { handler = callback })
  return worker
}
const assets = { ingredients: {}, portraits: {}, shiny: {} }
const sessions = { dict: [], det: { run: async () => ({ data: new Float32Array(32 * 32), dims: [1, 1, 32, 32] }) }, rec: { run: async () => ({ data: new Float32Array(), dims: [1, 0, 0] }) } }

describe('screenshot import worker', () => {
  it('runs preprocessing via RPC and reports every image, including failed images', async () => {
    const worker = connectedWorker(), progress: ImportProgress[] = []
    const fileToImage = vi.fn(async (file: File | string) => {
      if (file === 'bad') throw new Error('decode failed')
      return { width: 1, height: 1, data: new Uint8ClampedArray([255, 255, 255, 255]) }
    })
    const result = await runImportWorker(worker, ['good', 'bad'], reactive([]), assets, {
      fileToImage, loadUrl: async () => null, loadOcr: async () => sessions,
    }, value => progress.push(value))
    expect(result.accepted).toEqual([])
    expect(result.discarded).toBe(2)
    expect(progress.at(-1)).toEqual({ stage: '识别完成', completed: 2, total: 2, percent: 100 })
    expect(progress.map(value => value.percent)).toEqual([...progress.map(value => value.percent)].sort((a, b) => a - b))
    expect(worker.terminate).toHaveBeenCalledOnce()
  })
  it('rejects model failure and cleans up the worker', async () => {
    const worker = connectedWorker()
    await expect(runImportWorker(worker, ['one'], [], assets, {
      fileToImage: async () => { throw new Error('unused') }, loadUrl: async () => null,
      loadOcr: async () => { throw new Error('模型加载失败') },
    }, () => {})).rejects.toThrow('模型加载失败')
    expect(worker.terminate).toHaveBeenCalledOnce()
    expect(worker.onmessage).toBeNull()
  })
  it('rejects thread interruption and ignores late results', async () => {
    const worker: ImportWorker = { onmessage: null, onerror: null, postMessage: vi.fn(), terminate: vi.fn() }
    const promise = runImportWorker(worker, [], [], assets, { fileToImage: vi.fn(), loadUrl: vi.fn() }, () => {})
    const late = worker.onmessage!
    worker.onerror!()
    late({ data: { type: 'result', result: { accepted: [], skipped: 0, discarded: 0 } } })
    await expect(promise).rejects.toThrow('线程中断')
    expect(worker.terminate).toHaveBeenCalledOnce()
  })
})
