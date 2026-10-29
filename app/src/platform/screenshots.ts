import { withResources } from '../../../core/src/resources/runtime'
import { runImportWorker, type ImportWorker } from '../../../core/src/calc/ocrWorker'
import { importAssets } from '../../../core/src/calc/ocrAssets'
import type { ImportProgress } from '../../../core/src/calc/ocrImportCore'
import { fileToImage, loadUrl } from './ocrImages'
import type { BoxPokemon } from '../../../core/src/types'

export async function importScreenshotSelection(existing: BoxPokemon[], progress: (value: ImportProgress) => void = () => {}) {
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
  let firstMessage = true
  const worker: ImportWorker = { onmessage: null, onerror: null, postMessage: value => { native.postMessage(firstMessage ? withResources(value) : value); firstMessage = false }, terminate: () => native.terminate() }
  native.onmessage = event => worker.onmessage?.({ data: event.data })
  native.onerror = () => worker.onerror?.()
  return runImportWorker(worker, files, existing, importAssets(), { fileToImage, loadUrl }, progress)
}
