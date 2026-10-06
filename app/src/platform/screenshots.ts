import { importScreenshotFiles } from '../../../core/src/calc/ocrImport'
import type { BoxPokemon } from '../../../core/src/types'

export async function importScreenshotSelection(existing: BoxPokemon[]) {
  const files = await new Promise<File[]>((resolve) => {
    const input = document.createElement('input')
    input.type = 'file'; input.accept = 'image/*'; input.multiple = true
    input.onchange = () => resolve([...input.files ?? []])
    input.oncancel = () => resolve([])
    input.click()
  })
  return files.length ? importScreenshotFiles(files, existing) : null
}
