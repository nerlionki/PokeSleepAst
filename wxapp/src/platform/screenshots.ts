import { withResources } from '../../../core/src/resources/runtime'
import Taro from '@tarojs/taro'
import { runBagImportWorker, runImportWorker, type ImportWorker } from '../../../core/src/calc/ocrWorker'
import type { BagImportOptions } from '../../../core/src/calc/ocrIngredientBag'
import { importAssets } from '../../../core/src/calc/ocrAssets'
import type { ImportProgress } from '../../../core/src/calc/ocrImportCore'
import { fileToImage, loadUrl } from './ocrImages'
import { loadOcr } from './ocrEngine'
import { requireWorkerSupport } from './compatibility'
import type { BoxPokemon } from '../../../core/src/types'
async function withScreenshotSelection<T>(progress: (value: ImportProgress) => void, run: (worker: ImportWorker, files: string[]) => Promise<T>) {
  let files: string[]
  try {
    const result = await Taro.chooseMedia({ count: 9, mediaType: ['image'], sourceType: ['album'] })
    files = result.tempFiles.map(f => f.tempFilePath)
  } catch (error) { if (String((error as { errMsg?: string }).errMsg).includes('cancel')) return null; throw error }
  if (!files.length) return null
  requireWorkerSupport()
  progress({ stage: '下载识别线程资源', completed: 0, total: files.length, percent: 0 })
  await new Promise<void>((resolve, reject) => wx.preDownloadSubpackage({ packageType: 'workers', success: () => resolve(), fail: () => reject(new Error('识别资源下载失败，请重试')) }))
  const native = wx.createWorker('workers/ocr.js', { useExperimentalWorker: true })
  let terminated = false
  let firstMessage = true
  const worker: ImportWorker = {
    onmessage: null, onerror: null,
    postMessage: message => { native.postMessage(firstMessage ? withResources(message) : message); firstMessage = false },
    terminate: () => { if (!terminated) { terminated = true; native.terminate() } },
  }
  native.onMessage(data => worker.onmessage?.({ data: data as unknown as Parameters<NonNullable<ImportWorker['onmessage']>>[0]['data'] }))
  native.onProcessKilled(() => worker.onerror?.())
  try {
    return await run(worker, files) }
  finally { worker.terminate() }
}

export function importScreenshotSelection(existing: BoxPokemon[], progress: (value: ImportProgress) => void = () => {}) {
  return withScreenshotSelection(progress, (worker, files) => runImportWorker(worker, files, existing, importAssets(), { fileToImage, loadUrl, loadOcr }, progress))
}

export function importBagScreenshotSelection(options: BagImportOptions, progress: (value: ImportProgress) => void) {
  return withScreenshotSelection(progress, (worker, files) => runBagImportWorker(worker, files, options, { fileToImage, loadUrl, loadOcr }, progress))
}
