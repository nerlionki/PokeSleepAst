import { withResources } from '../../../core/src/resources/runtime'
import { runBagImportWorker, runImportWorker, type ImportWorker } from '../../../core/src/calc/ocrWorker'
import type { BagImportOptions } from '../../../core/src/calc/ocrIngredientBag'
import { importAssets } from '../../../core/src/calc/ocrAssets'
import type { ImportProgress } from '../../../core/src/calc/ocrImportCore'
import { fileToImage, loadUrl } from './ocrImages'
import type { BoxPokemon } from '../../../core/src/types'

async function withScreenshotSelection<T>(progress: (value: ImportProgress) => void, run: (worker: ImportWorker, files: File[]) => Promise<T>) {
  const files = await new Promise<File[]>((resolve) => {
    const input = document.createElement('input')
    input.type = 'file'; input.accept = 'image/*'; input.multiple = true
    input.onchange = () => resolve([...input.files ?? []])
    input.oncancel = () => resolve([])
    input.click()
  })
  if (!files.length) return null
  progress({ stage: '启动识别线程', completed: 0, total: files.length, percent: 0 })
  const native = new Worker(new URL('../calc/ocrImport.worker.ts', import.meta.url), { type: 'module' })
  let firstMessage = true, terminated = false
  const worker: ImportWorker = {
    onmessage: null, onerror: null,
    postMessage: value => { native.postMessage(firstMessage ? withResources(value) : value); firstMessage = false },
    terminate: () => { if (!terminated) { terminated = true; native.terminate() } },
  }
  native.onmessage = event => worker.onmessage?.({ data: event.data })
  native.onerror = () => worker.onerror?.()
  try { return await run(worker, files) }
  finally { worker.terminate() }
}

export function importScreenshotSelection(existing: BoxPokemon[], progress: (value: ImportProgress) => void = () => {}) {
  return withScreenshotSelection(progress, (worker, files) => runImportWorker(worker, files, existing, importAssets(), { fileToImage, loadUrl }, progress))
}

export function importBagScreenshotSelection(options: BagImportOptions, progress: (value: ImportProgress) => void) {
  return withScreenshotSelection(progress, (worker, files) => runBagImportWorker(worker, files, options, { fileToImage, loadUrl }, progress))
}
