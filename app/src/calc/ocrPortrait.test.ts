import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import * as vision from './ocrVision'
import { INGREDIENTS, POKEDEX } from './data'
import { avatarBox, chooseSimilar, ingredientQuantityMarks, parseCard, planImports, readMainSkill, splitCards } from './ocrBox'
import { createOcrFromBuffers, recognize, type PixelImage } from './ocrEngine'
import { crop, diskCrop, ingredientIconCrop, matchIngredientSprite, pickClosest, similarScores, trimOpaque } from './ocrVision'
import { isAllRounder } from './specialty'

const require = createRequire(import.meta.url)
const samples = 'D:/PokeSleepAst/ocrTest'

function hasSharp(): boolean {
  try {
    require.resolve('sharp')
    return true
  }
  catch {
    return false
  }
}

describe('ocr portrait', () => {
  it.skipIf(!hasSharp() || !existsSync(samples))('reads the species from the circular sprite', async () => {
    type PortraitScore = { id: number, shiny: boolean, score: number }
    const api = vision as typeof vision & {
      portraitScores: (shot: PixelImage, portraits: { id: number, shiny: boolean, image: PixelImage }[]) => PortraitScore[]
      speciesScores: (scores: PortraitScore[]) => { id: number, score: number }[]
      bestPortraitVariant: (scores: PortraitScore[], id: number) => PortraitScore | null
    }
    expect(api.portraitScores).toBeTypeOf('function')
    expect(api.speciesScores).toBeTypeOf('function')
    expect(api.bestPortraitVariant).toBeTypeOf('function')

    const sharp = (await import('sharp')).default
    async function loadImage(path: string): Promise<PixelImage> {
      const { data, info } = await sharp(path).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
      return { data: new Uint8ClampedArray(data), width: info.width, height: info.height }
    }
    const det = readFileSync(new URL('../../public/ocr/det.onnx', import.meta.url))
    const rec = readFileSync(new URL('../../public/ocr/rec.onnx', import.meta.url))
    const dict = readFileSync(new URL('../../public/ocr/keys.txt', import.meta.url), 'utf8')
    const sessions = await createOcrFromBuffers(
      det.buffer.slice(det.byteOffset, det.byteOffset + det.byteLength),
      rec.buffer.slice(rec.byteOffset, rec.byteOffset + rec.byteLength),
      dict,
    )
    const portraits: { id: number, shiny: boolean, image: PixelImage }[] = []
    for (const poke of POKEDEX) {
      try {
        portraits.push({ id: poke.id, shiny: false, image: trimOpaque(await loadImage(`src/assets/imgs/pokemon/portrait/${poke.id}.webp`)) })
        if (!isAllRounder(poke)) {
          portraits.push({ id: poke.id, shiny: true, image: trimOpaque(await loadImage(`src/assets/imgs/pokemon/portrait/shiny/${poke.id}.webp`)) })
        }
      }
      catch {
        // this species has no portrait file
      }
    }
    const ingredientRefs: { id: number, image: PixelImage }[] = []
    for (const ingredient of INGREDIENTS) {
      ingredientRefs.push({ id: ingredient.id, image: trimOpaque(await loadImage(`src/assets/imgs/ingredient/${ingredient.id}.webp`)) })
    }
    const files = readdirSync(samples).filter((name) => name.endsWith('.jpg'))
    const found: number[][] = []
    const shinyFound: boolean[][] = []
    for (const [fileIndex, name] of files.entries()) {
      const image = await loadImage(join(samples, name))
      const words = await recognize(sessions, image)
      const ids = []
      const shiny = []
      for (const group of splitCards(words)) {
        const box = avatarBox(group)
        const shot = box ? diskCrop(crop(image, box.x, box.y, box.size, box.size)) : null
        let id: number | null = null
        let variant: PortraitScore | null = null
        if (shot) {
          const variants = api.portraitScores(shot, portraits)
          const scores = api.speciesScores(variants)
          id = pickClosest(scores)
          if (!id) {
            const marks = ingredientQuantityMarks(group)
            const present = marks.filter(mark => mark != null)
            const gap = present.length > 1
              ? Math.abs(present[1]!.word.x - present[0]!.word.x)
              : (present[0]?.word.height ?? 24) * 7
            const ingredients = marks.map((mark) => {
              if (!mark) return null
              return matchIngredientSprite(ingredientIconCrop(image, mark.word, gap), ingredientRefs)
            }) as [number | null, number | null]
            const candidates = similarScores(scores)
            const skill = readMainSkill(group)
            id = chooseSimilar(candidates, { skill, ingredients })
          }
          if (id) variant = api.bestPortraitVariant(variants, id)
        }
        ids.push(id ?? 0)
        shiny.push(variant?.shiny ?? false)
        if (fileIndex === 9 && id === 491) {
          const card = parseCard(group, { portraitId: id, slotLines: [null, null] })
          expect(planImports([], [card]).accepted[0]).toMatchObject({
            pokeId: 491,
            level: 40,
            ingredientSlots: [0, null, null],
          })
        }
        if (fileIndex === 10 && id === 906) {
          const card = parseCard(group, {
            portraitId: id,
            slotLines: [0, 0],
            shiny: variant?.shiny,
          } as Parameters<typeof parseCard>[1] & { shiny?: boolean })
          expect(planImports([], [card]).accepted[0]).toMatchObject({
            pokeId: 906,
            shiny: true,
          })
        }
      }
      found.push(ids)
      shinyFound.push(shiny)
    }
    expect(found).toEqual([
      [195],
      [454, 845, 845],
      [845],
      [57],
      [154],
      [923],
      [922],
      [381, 380],
      [9006],
      [491],
      [906],
    ])
    expect(shinyFound).toEqual([
      [false],
      [false, false, false],
      [false],
      [false],
      [false],
      [false],
      [false],
      [false, false],
      [false],
      [false],
      [true],
    ])
  }, 180000)
})
