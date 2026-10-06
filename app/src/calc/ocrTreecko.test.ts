import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import sharp from 'sharp'
import { createOcrFromBuffers, recognize } from './ocrEngine'
import { ingredientQuantityMarks, parseCard } from './ocrBox'
import { matchIngredientSprite, trimOpaque } from './ocrVision'
import { matchSlotLines } from './ocrImport'

describe('Treecko ABB screenshot regression', () => {
  it('locates the occluded ingredient row and preserves ABB through the real import pipeline', async () => {
    const { data, info } = await sharp(fileURLToPath(new URL('../../../ocrTest/40706B91346C4F34629C83F0E324D450.jpg', import.meta.url))).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
    const image = { data: new Uint8ClampedArray(data), width: info.width, height: info.height }
    const buffer = (file: string) => {
      const b = readFileSync(new URL(`../../../core/public/ocr/${file}`, import.meta.url))
      return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength)
    }
    const sessions = await createOcrFromBuffers(buffer('det.onnx'), buffer('rec.onnx'), readFileSync(new URL('../../../core/public/ocr/keys.txt', import.meta.url), 'utf8'))
    const words = await recognize(sessions, image)
    const marks = ingredientQuantityMarks(words)
    expect(marks.map(mark => mark?.quantity)).toEqual([2, 3])
    const refs = await Promise.all([3, 17, 1].map(async id => {
      const { data, info } = await sharp(`../core/src/assets/imgs/ingredient/${id}.webp`).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
      return { id, image: trimOpaque({ data: new Uint8ClampedArray(data), width: info.width, height: info.height }) }
    }))
    const slots = await matchSlotLines(image, words, 252, async (shot, ids) => matchIngredientSprite(shot, refs.filter(ref => ids.includes(ref.id))))
    expect(slots).toEqual([1, 1])
    expect(parseCard(words, { portraitId: 252, slotLines: slots })?.ingredientSlots).toEqual([0, 1, 1])
  }, 120_000)
})
