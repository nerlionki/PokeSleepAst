import Taro from '@tarojs/taro'
import { importScreenshotFiles } from '../../../core/src/calc/ocrImport'
import type { BoxPokemon } from '../../../core/src/types'
export async function importScreenshotSelection(existing: BoxPokemon[]) {
  let files: string[]
  try {
    const result = await Taro.chooseMedia({ count: 9, mediaType: ['image'], sourceType: ['album'] })
    files = result.tempFiles.map(f => f.tempFilePath)
  } catch (error) { if (String((error as { errMsg?: string }).errMsg).includes('cancel')) return null; throw error }
  return importScreenshotFiles(files, existing)
}
