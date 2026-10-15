import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join, relative } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import sharp from 'sharp'
import { createOcrFromBuffers, type PixelImage } from './ocrEngine'
import { createScreenshotImporter } from '../../../core/src/calc/ocrImportCore'

const samples = '../ocrTest'
function imageFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const path = join(directory, entry.name)
    return entry.isDirectory() ? imageFiles(path) : /\.(jpe?g|png|webp|bmp)$/i.test(entry.name) ? [path] : []
  }).sort()
}
const files = imageFiles(samples)

// 人工对照原图的结果。已有文字漏识别必须明确留在 ocrMissing，不能悄悄当成成功。
const expected: Record<string, object> = {
  '40706B91346C4F34629C83F0E324D450.jpg': {
    pokeId: 252, level: 14, name: '木守宫', nature: '慎重', skillLevel: 1,
    ingredientSlots: [0, 1, 1], subskills: ['helpingBonus', 'berryS', 'skillS', 'energyRecover', 'ingS'],
  },
  'e3ae0c3fff61a8862f32ba4d0812218f.jpg': {
    pokeId: 914, level: 30, name: '狂舞大葱醬鸭', nature: '怕寂寞', skillLevel: 3,
    ingredientSlots: [0, 1, 1], subskills: ['ingM', 'ingS', 'invL', '', ''],
    ocrMissing: ['level', 'subskill3', 'subskill4'],
  },
  '49bf98c1bac49bdc67f175afe0fdd728.jpg': {
    pokeId: 81, level: 16, name: '小磁怪', nature: '急躁', skillLevel: 1,
    ingredientSlots: [0, 1, 0], subskills: ['helpingBonus', 'skillM', 'skillS', 'invS', 'invM'],
  },
  'ab97618f084672c22e4c145fe03d08bc.jpg': {
    pokeId: 395, level: 32, name: '搭檔小光', nature: '自大', skillLevel: 5,
    ingredientSlots: [0, 0, 0], subskills: ['berryS', '', 'skillS', '', 'ingM'],
    ocrMissing: ['subskill1', 'subskill3'],
  },
}

describe('all screenshot imports (including nested and untracked samples)', () => {
  let importer: ReturnType<typeof createScreenshotImporter>
  const reports: unknown[] = []
  beforeAll(async () => {
    async function loadImage(path: string): Promise<PixelImage> {
      const { data, info } = await sharp(path).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
      return { data: new Uint8ClampedArray(data), width: info.width, height: info.height }
    }
    const buffer = (file: string) => {
      const b = readFileSync(new URL(`../../../core/public/ocr/${file}`, import.meta.url))
      return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength)
    }
    const sessions = await createOcrFromBuffers(buffer('det.onnx'), buffer('rec.onnx'),
      readFileSync(new URL('../../../core/public/ocr/keys.txt', import.meta.url), 'utf8'))
    importer = createScreenshotImporter({
      fileToImage: file => loadImage(String(file)), loadOcr: async () => sessions,
      loadUrl: async path => existsSync(path) ? loadImage(path) : null,
      ingredientImageUrl: id => `../core/src/assets/imgs/ingredient/${id}.webp`,
      pokemonPortraitUrl: id => `../core/src/assets/imgs/pokemon/portrait/${id}.webp`,
      pokemonShinyPortraitUrl: id => `../core/src/assets/imgs/pokemon/portrait/shiny/${id}.webp`,
    })
  }, 120_000)

  afterAll(() => {
    if (process.env.OCR_REGRESSION_REPORT) writeFileSync(process.env.OCR_REGRESSION_REPORT,
      JSON.stringify({ total: files.length, reports }, null, 2))
  })

  it('has regression images to verify', () => expect(files.length).toBeGreaterThan(0))
  it.each(files)('checks full import against the reviewed screenshot: %s', async (file) => {
    const name = relative(samples, file).replaceAll('\\', '/')
    const result = await importer.importScreenshotFiles([file], [])
    reports.push({ file: name, result })
    expect(expected[name], `Review and add expectations for ${name}`).toBeDefined()
    expect(result.discarded).toBe(0)
    expect(result.accepted).toHaveLength(1)
    expect(result.accepted[0]).toMatchObject(expected[name]!)
    expect(result.accepted[0]?.shiny ?? false).toBe(false)
    if (name.startsWith('49bf') || name.startsWith('4070')) expect(result.accepted[0]?.ocrMissing ?? []).toEqual([])
  }, 120_000)
})
