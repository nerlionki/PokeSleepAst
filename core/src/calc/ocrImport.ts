import { fileToImage, loadUrl } from '#platform/ocrImages'
import { INGREDIENTS, POKEDEX, pokeById } from './data'
import { ingredientImageUrl, pokemonPortraitUrl, pokemonShinyPortraitUrl } from './raeImage'
import { loadOcr, recognize, type PixelImage } from './ocrEngine'
import { avatarBox, chooseSimilar, ingredientQuantityMarks, matchIngredientSlot, parseCard, planImports, readMainSkill, splitCards, type OcrWord } from './ocrBox'
import { bestPortraitVariant, crop, diskCrop, ingredientIconCrop, matchIngredientSprite, pickClosest, portraitScores, similarScores, speciesScores, trimOpaque } from './ocrVision'
import { slotDrop } from './ingredients'
import { isAllRounder } from './specialty'
import type { BoxPokemon } from '../types'

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

async function readSlotIngredientIds(image: PixelImage, words: OcrWord[]): Promise<[number | null, number | null]> {
  const marks = ingredientQuantityMarks(words)
  const urls = INGREDIENTS.flatMap((item) => {
    const url = ingredientImageUrl(item.id)
    return url ? [{ id: item.id, url }] : []
  })
  const present = marks.filter((mark) => mark != null)
  const gap = present.length > 1
    ? Math.abs(present[1]!.word.x - present[0]!.word.x)
    : (present[0]?.word.height ?? 24) * 7
  const lines: Array<number | null> = []
  for (const mark of marks) {
    if (!mark) {
      lines.push(null)
      continue
    }
    const shot = ingredientIconCrop(image, mark.word, gap)
    lines.push(await bestIngredient(shot, urls))
  }
  return [lines[0] ?? null, lines[1] ?? null]
}

async function matchPortrait(image: PixelImage, words: OcrWord[]): Promise<{ id: number, shiny: boolean } | null> {
  const box = avatarBox(words)
  if (!box) return null
  const shot = diskCrop(crop(image, box.x, box.y, box.size, box.size))
  const variants = portraitScores(shot, await portraitTemplates())
  const scores = speciesScores(variants)
  let id = pickClosest(scores)
  if (!id) {
    const close = similarScores(scores)
    if (close.length < 2) return null
    id = chooseSimilar(close, { skill: readMainSkill(words), ingredients: await readSlotIngredientIds(image, words) })
  }
  if (!id) return null
  const variant = bestPortraitVariant(variants, id)
  return variant ? { id, shiny: variant.shiny } : null
}

export async function matchSlotLines(image: PixelImage, words: OcrWord[], pokeId: number,
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

export async function importScreenshotFiles(files: Array<File | string>, existing: BoxPokemon[]) {
  const sessions = await loadOcr()
  const cards: Array<Omit<BoxPokemon, 'uid'> | null> = []
  for (const file of files) {
    try {
      const image = await fileToImage(file)
      const words = await recognize(sessions, image)
      const groups = splitCards(words)
      if (!groups.length) {
        cards.push(null)
        continue
      }
      for (const group of groups) {
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
  }
  return planImports(existing, cards)
}
