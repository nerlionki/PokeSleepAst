import { INGREDIENTS, POKEDEX, pokeById } from './data'
import { recognize, type OcrSessions, type PixelImage } from './ocrPipeline'
import { avatarBox, chooseSimilar, headerTextInfo, ingredientQuantityMarks, ingredientRowMarks, matchIngredientSlot, parseCard, planImports, readCarry, readMainSkill, splitCards, type OcrWord, type SpeciesEvidence } from './ocrBox'
import { bestPortraitVariant, crop, diskCrop, ingredientIconCrop, ingredientSpriteScores, matchIngredientSprite, portraitScores, resizeRgba, speciesScores, trimOpaque } from './ocrVision'
import { ocrFold } from './text'
import { slotDrop } from './ingredients'
import { isAllRounder } from './specialty'
import type { BoxPokemon } from '../types'

export interface ImportProgress { stage: string; completed: number; total: number; percent: number }
export interface ScreenshotServices {
  fileToImage(file: File | string): Promise<PixelImage>
  loadUrl(url: string): Promise<PixelImage | null>
  loadOcr(): Promise<OcrSessions>
  ingredientImageUrl(id: number): string
  pokemonPortraitUrl(id: number): string
  pokemonShinyPortraitUrl(id: number): string
}
export function createScreenshotImporter(services: ScreenshotServices) {
const { fileToImage, loadUrl, loadOcr, ingredientImageUrl, pokemonPortraitUrl, pokemonShinyPortraitUrl } = services
const ingredientCache = new Map<string, PixelImage | null>()

async function cachedIngredient(url: string): Promise<PixelImage | null> {
  if (!url) return null
  if (ingredientCache.has(url)) return ingredientCache.get(url) ?? null
  const image = await loadUrl(url)
  const template = image ? trimOpaque(image) : null
  ingredientCache.set(url, template)
  return template
}

async function bestIngredient(shot: PixelImage, urls: { id: number, url: string }[]): Promise<number | null> {
  const refs = []
  for (const item of urls) {
    const image = await cachedIngredient(item.url)
    if (image) refs.push({ id: item.id, image })
  }
  return matchIngredientSprite(shot, refs)
}

const portraitCache: { id: number, shiny: boolean, image: PixelImage }[] = []

async function portraitTemplates(): Promise<{ id: number, shiny: boolean, image: PixelImage }[]> {
  if (portraitCache.length) return portraitCache
  for (const poke of POKEDEX) {
    const image = await loadUrl(pokemonPortraitUrl(poke.id))
    if (image) portraitCache.push({ id: poke.id, shiny: false, image: trimOpaque(image) })
    if (isAllRounder(poke)) continue
    const shiny = await loadUrl(pokemonShinyPortraitUrl(poke.id))
    if (shiny) portraitCache.push({ id: poke.id, shiny: true, image: trimOpaque(shiny) })
  }
  return portraitCache
}

async function readSpeciesEvidence(image: PixelImage, words: OcrWord[]): Promise<SpeciesEvidence> {
  const marks = ingredientRowMarks(words)
  const urls = INGREDIENTS.flatMap((item) => {
    const url = ingredientImageUrl(item.id)
    return url ? [{ id: item.id, url }] : []
  })
  const present = marks.filter((mark) => mark != null)
  const gap = present.length > 1
    ? Math.abs(present[1]!.word.x - present[0]!.word.x)
    : (present[0]?.word.height ?? 24) * 7
  const refs = []
  for (const item of urls) {
    const template = await cachedIngredient(item.url)
    if (template) refs.push({ id: item.id, image: template })
  }
  const lines: Array<number[] | null> = []
  for (const [index, mark] of marks.entries()) {
    // 信息浮层可遮住第一格图标；缺少食材行标题时不把浮层头像当作食材。
    if (!mark || (index === 0 && !words.some(word => word.text.trim() === '食材'))) {
      lines.push(null)
      continue
    }
    const shot = ingredientIconCrop(image, mark.word, gap)
    const ranked = ingredientSpriteScores(shot, refs)
    const top = ranked[0]
    // 灰色未解锁图标常有相近轮廓。低分不作为证据；相差 15 分内的候选交给组合/数量核对。
    lines.push(top && top.score >= 20 ? ranked.filter(row => top.score - row.score <= 15).map(row => row.id) : null)
  }
  return {
    skill: readMainSkill(words), carry: readCarry(words),
    ingredients: [null, null],
    ingredientCandidates: [lines[0] ?? null, lines[1] ?? null, lines[2] ?? null],
    quantities: marks.map(mark => mark?.quantity ?? null) as [number | null, number | null, number | null],
  }
}

async function matchPortrait(image: PixelImage, words: OcrWord[]): Promise<{ id: number, shiny: boolean } | null> {
  const box = avatarBox(words)
  if (!box) return null
  const shot = diskCrop(crop(image, box.x, box.y, box.size, box.size))
  const variants = portraitScores(shot, await portraitTemplates())
  const scores = speciesScores(variants)
  const best = scores[0]
  if (!best || best.score > 76) return null
  // 图片只提出合理候选，不能绕过主技能和食材校验；证据不能救回明显不相似的头像。
  const candidates = scores.filter(row => row.score <= 76 && row.score - best.score < 18)
  const evidence = await readSpeciesEvidence(image, words)
  const id = chooseSimilar(candidates, evidence)
  if (!id) return null
  const variant = bestPortraitVariant(variants, id)
  return variant ? { id, shiny: variant.shiny } : null
}

async function refineHeader(sessions: OcrSessions, image: PixelImage, words: OcrWord[]): Promise<void> {
  const header = headerTextInfo(words)
  if (!header) return
  const region = crop(image, header.box.x, header.box.y, header.box.width, header.box.height)
  const retryWords = await recognize(sessions, resizeRgba(region, region.width * 2, region.height * 2))
  const reread = headerTextInfo(retryWords)
  if (header.level == null && header.label) {
    let level = reread?.level ?? null
    if (level == null) {
      // 再用紧凑窗口定位等级；裁切留白不同会改变检测框，避免把粘连的末位读进数字。
      const compact = crop(image, header.levelBox.x, header.levelBox.y, header.levelBox.width, header.levelBox.height)
      level = headerTextInfo(await recognize(sessions, resizeRgba(compact, compact.width * 2, compact.height * 2)))?.level ?? null
    }
    if (level != null) header.label.text = header.label.text.replace(/^[Ll][Vv]\.?\s*\d+/, `Lv.${level}`)
  }
  // 昵称只能补回局部复读实际读到的漏字，不能按图鉴物种猜改昵称或覆盖原有字。
  const before = ocrFold(header.nameText)
  const originY = Math.max(0, Math.floor(header.box.y))
  const names = retryWords.filter(word => Math.abs(originY + (word.y + word.height / 2) / 2
    - (header.name.y + header.name.height / 2)) <= header.name.height)
    .map(word => word.text.replace(/^[Ll][Vv]\.?\s*\d+\s*/, '').trim()).filter(text => {
      const after = ocrFold(text)
      let index = 0
      for (const char of after) if (char === before[index]) index++
      return before.length >= 2 && after.length > before.length && after.length - before.length <= 2 && index === before.length
    })
  const distinct = [...new Set(names)]
  if (distinct.length === 1) {
    header.name.text = header.name.text.replace(header.nameText, distinct[0]!)
  }
}

async function matchSlotLines(image: PixelImage, words: OcrWord[], pokeId: number,
  match: (shot: PixelImage, ids: number[]) => Promise<number | null> = (shot, ids) => bestIngredient(shot, ids.map((id) => ({ id, url: ingredientImageUrl(id) }))),
): Promise<[number | null, number | null]> {
  const marks = ingredientQuantityMarks(words)
  const poke = pokeById(pokeId)
  if (!poke) return [null, null]
  const present = marks.filter((mark) => mark != null)
  const gap = present.length > 1
    ? Math.abs(present[1]!.word.x - present[0]!.word.x)
    : (present[0]?.word.height ?? 24) * 7
  const lines: Array<number | null> = []
  for (const [offset, mark] of marks.entries()) {
    const slot = (offset + 1) as 1 | 2
    if (!mark) {
      lines.push(null)
      continue
    }
    const allowed = poke.ingredients.length > 3
      ? poke.ingredients.map((_, index) => index)
      : poke.ingredients.map((_, index) => index).filter((index) => slot === 1 ? index <= 1 : index <= 2)
    const byQuantity = mark.quantity == null
      ? []
      : allowed.filter((index) => slotDrop(poke.ingredients, slot, index)?.amount === mark.quantity)
    const candidates = byQuantity.length ? byQuantity : allowed
    if (candidates.length === 1) {
      lines.push(candidates[0]!)
      continue
    }
    const shot = ingredientIconCrop(image, mark.word, gap)
    const unique = [...new Set(candidates.map((index) => poke.ingredients[index]!.id))]
    const ingredientId = await match(shot, unique)
    lines.push(
      matchIngredientSlot(pokeId, slot, ingredientId, mark.quantity)
      ?? matchIngredientSlot(pokeId, slot, null, mark.quantity),
    )
  }
  return [lines[0] ?? null, lines[1] ?? null]
}

async function importScreenshotFiles(files: Array<File | string>, existing: BoxPokemon[], progress: (value: ImportProgress) => void = () => {}) {
  let completed = 0
  const report = (stage: string, fraction = 0) => progress({ stage, completed, total: files.length, percent: Math.round(5 + 90 * (completed + fraction) / Math.max(1, files.length)) })
  progress({ stage: '加载识别模型', completed: 0, total: files.length, percent: 0 })
  const sessions = await loadOcr()
  report('模型已就绪')
  const cards: Array<Omit<BoxPokemon, 'uid'> | null> = []
  for (const file of files) {
    try {
      report('读取截图')
      const image = await fileToImage(file)
      report('识别文字', 0.15)
      const words = await recognize(sessions, image)
      report('匹配头像与食材', 0.65)
      const groups = splitCards(words)
      if (!groups.length) {
        cards.push(null)
        continue
      }
      for (const group of groups) {
        await refineHeader(sessions, image, group)
        const portrait = await matchPortrait(image, group)
        if (!portrait) {
          cards.push(null)
          continue
        }
        const slotLines = await matchSlotLines(image, group, portrait.id)
        cards.push(parseCard(group, { portraitId: portrait.id, shiny: portrait.shiny, slotLines }))
      }
    }
    catch {
      cards.push(null)
    }
    finally { completed++; report('截图处理完成') }
  }
  progress({ stage: '检查重复个体', completed, total: files.length, percent: 97 })
  const result = planImports(existing, cards)
  progress({ stage: '识别完成', completed, total: files.length, percent: 100 })
  return result
}

return { matchSlotLines, importScreenshotFiles }
}
