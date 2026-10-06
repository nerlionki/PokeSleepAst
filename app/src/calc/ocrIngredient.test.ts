import { createRequire } from 'node:module'
import { existsSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import * as vision from './ocrVision'
import type { OcrWord } from './ocrBox'

const require = createRequire(import.meta.url)

function hasSharp(): boolean {
  try {
    require.resolve('sharp')
    return true
  }
  catch {
    return false
  }
}

describe('ingredient screenshot matching', () => {
  it.skipIf(!hasSharp() || !existsSync('../ocrTest/微信图片_20261003140326_1_857.jpg'))('matches normal and faded icons after shifting left from the quantity label', async () => {
    const sharp = (await import('sharp')).default
    const api = vision as typeof vision & {
      ingredientIconCrop: (image: vision.PixelImage, mark: OcrWord, gap: number) => vision.PixelImage
      matchIngredientSprite: (shot: vision.PixelImage, refs: { id: number, image: vision.PixelImage }[]) => number | null
    }
    expect(api.ingredientIconCrop).toBeTypeOf('function')
    expect(api.matchIngredientSprite).toBeTypeOf('function')

    async function load(path: string): Promise<vision.PixelImage> {
      const { data, info } = await sharp(path).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
      return { data: new Uint8ClampedArray(data), width: info.width, height: info.height }
    }
    async function refs(ids: number[]) {
      return Promise.all(ids.map(async (id) => ({ id, image: vision.trimOpaque(await load(`../core/src/assets/imgs/ingredient/${id}.webp`)) })))
    }

    const cases = [
      {
        path: '../ocrTest/微信图片_20261003140326_1_857.jpg',
        mark: { text: '5', x: 757, y: 482, width: 20, height: 24 },
        gap: 178,
        ids: [2, 4, 7],
        expected: 2,
      },
      {
        path: '../ocrTest/微信图片_20261003140327_2_857.jpg',
        mark: { text: '×7', x: 1509, y: 365, width: 36, height: 24 },
        gap: 136,
        ids: [10, 4],
        expected: 10,
      },
      {
        path: '../ocrTest/微信图片_20261003140329_4_857.jpg',
        mark: { text: '×4', x: 924, y: 500, width: 36, height: 24 },
        gap: 169,
        ids: [7, 9],
        expected: 9,
      },
    ] satisfies Array<{ path: string, mark: OcrWord, gap: number, ids: number[], expected: number }>

    for (const item of cases) {
      const shot = api.ingredientIconCrop(await load(item.path), item.mark, item.gap)
      expect(api.matchIngredientSprite(shot, await refs(item.ids))).toBe(item.expected)
    }
  })
})
