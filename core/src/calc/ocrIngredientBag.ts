import type { OcrWord } from './ocrBox'
import type { ImportProgress } from './ocrImportCore'
import { recognize, type OcrSessions, type PixelImage } from './ocrPipeline'
import { ingredientIconCrop, ingredientSpriteScores, trimOpaque } from './ocrVision'
import { ocrFold } from './text'

export interface BagIngredient { id: number; names: string[]; imageUrl?: string }
export interface BagImportOptions { ingredients: BagIngredient[]; maxCount: number }
export interface BagImportResult {
  counts: Record<number, number>
  conflicts: Array<{ id: number; counts: number[] }>
  unreadable: number[]
  skipped: number
}

const centerX = (word: OcrWord) => word.x + word.width / 2
const centerY = (word: OcrWord) => word.y + word.height / 2
const traditionalGlyphs: Record<string, string> = { 窩: '窝', 製: '制', 薑: '姜', 腦: '脑', 堅: '坚' }
const nameText = (text: string) => ocrFold(text).replace(/[窩製薑腦堅]/g, glyph => traditionalGlyphs[glyph]!)
  .replace(/[^\u3400-\u9fff]/g, '')
const imperfectNames: Record<string, string[]> = { 哞哞鲜奶: ['哗鲜奶', '鲜奶'], 特选苹果: ['特选果'] }

function oneEditApart(left: string, right: string) {
  if (Math.abs(left.length - right.length) > 1) return false
  if (left.length > right.length) [left, right] = [right, left]
  let index = 0
  while (index < left.length && left[index] === right[index]) index++
  return left.slice(index + Number(left.length === right.length)) === right.slice(index + 1)
}

function ingredientId(text: string, names: Map<string, number>, nearbyCount: boolean) {
  const normalized = nameText(text)
  const exact = names.get(normalized)
  if (exact != null || !nearbyCount || normalized.length < 3) return exact
  const candidates = new Set<number>()
  for (const [name, id] of names) {
    if (name.length >= 3 && oneEditApart(normalized, name)) candidates.add(id)
  }
  return candidates.size === 1 ? [...candidates][0] : undefined
}

/** Counts sit just above and to the right of each food name in the four-column bag. */
interface BagRow { id: number; count: number | undefined }
export function readIngredientBag(words: OcrWord[], width: number, options: BagImportOptions) {
  const names = new Map<string, number>()
  for (const { id, names: labels } of options.ingredients) {
    for (const label of labels) {
      const name = nameText(label)
      names.set(name, id)
      for (const imperfect of imperfectNames[name] ?? []) names.set(imperfect, id)
    }
  }
  const headers = words.map(word => nameText(word.text))
  if (headers.some(text => /研究[笔筆][记記]/.test(text))) return null
  const bagHeader = headers.includes('食材包包') || (headers.includes('包包') && headers.includes('食材'))
  const quantities = words.flatMap(word => {
    const match = /^([×x])?\s*(\d+)$/.exec(ocrFold(word.text))
    if (!match || (!match[1] && !bagHeader)) return []
    const value = Number(match[2])
    return Number.isSafeInteger(value) && value > 0 && value <= options.maxCount ? [{ word, value, marked: !!match[1] }] : []
  })
  const items = words.flatMap(word => {
    const candidates = quantities.flatMap(quantity => {
      const dx = (centerX(quantity.word) - centerX(word)) / width
      const dy = (centerY(word) - centerY(quantity.word)) / width
      if (dx < -0.025 || dx > 0.14 || dy < 0.025 || dy > 0.13) return []
      return [{ quantity, distance: Math.abs(dx - 0.052) + Math.abs(dy - 0.074) }]
    }).sort((a, b) => a.distance - b.distance)
    const id = ingredientId(word.text, names, candidates.length > 0)
    return id == null ? [] : [{ id, candidates }]
  }).sort((a, b) => (a.candidates[0]?.distance ?? Infinity) - (b.candidates[0]?.distance ?? Infinity))
  const used = new Set<OcrWord>()
  const rows: BagRow[] = items.map(({ id, candidates }) => {
    const match = candidates.find(({ quantity }) => !used.has(quantity.word))
    if (match) used.add(match.quantity.word)
    return { id, count: match?.quantity.value }
  })
  if (!bagHeader && !used.size) return null
  const unmatched = quantities.filter(quantity => quantity.marked && !used.has(quantity.word))
  return { rows, unmatched }
}

export async function importIngredientBag(
  files: Array<File | string>, options: BagImportOptions,
  fileToImage: (file: File | string) => Promise<PixelImage>, loadOcr: () => Promise<OcrSessions>,
  progress: (value: ImportProgress) => void,
  loadUrl: (url: string) => Promise<PixelImage | null> = async () => null,
): Promise<BagImportResult> {
  const countsByIngredient = new Map<number, Set<number>>()
  let templates: Array<{ id: number; image: PixelImage }> | undefined
  let skipped = 0
  const total = files.length
  for (const [index, file] of files.entries()) {
    const report = (fraction: number) => progress({ stage: '', completed: index, total, percent: 100 * (index + fraction) / total })
    report(0)
    try {
      const image = await fileToImage(file)
      const words = await recognize(await loadOcr(), image, (_stage, fraction) => report(fraction))
      const parsed = readIngredientBag(words, image.width, options)
      if (!parsed) { skipped++; continue }
      const { rows, unmatched } = parsed
      if (unmatched.length && !templates) {
        templates = []
        for (const { id, imageUrl } of options.ingredients) {
          if (!imageUrl) continue
          const template = await loadUrl(imageUrl).catch(() => null)
          if (template) templates.push({ id, image: trimOpaque(template) })
        }
      }
      if (templates?.length) {
        for (const { word, value } of unmatched) {
          const shot = ingredientIconCrop(image, word, image.width / 4, 0.52)
          const [best, runnerUp] = ingredientSpriteScores(shot, templates)
          if (best && best.score >= 75 && best.score - (runnerUp?.score ?? 0) >= 8
            && !rows.some(row => row.id === best.id && row.count != null)) {
            rows.push({ id: best.id, count: value })
          }
        }
      }
      if (!rows.length) { skipped++; continue }
      for (const { id, count } of rows) {
        const values = countsByIngredient.get(id) ?? new Set<number>()
        if (count != null) values.add(count)
        countsByIngredient.set(id, values)
      }
    } catch { skipped++ }
  }
  const result: BagImportResult = { counts: {}, conflicts: [], unreadable: [], skipped }
  for (const [id, values] of countsByIngredient) {
    const counts = [...values].sort((a, b) => a - b)
    if (counts.length > 1) result.conflicts.push({ id, counts })
    else if (counts[0] != null) result.counts[id] = counts[0]
    else result.unreadable.push(id)
  }
  progress({ stage: '', completed: total, total, percent: 100 })
  return result
}
