import { readFileSync, writeFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { createOcrFromBuffers, recognize } from './ocrEngine'
import { parseCard, splitCards } from './ocrBox'

describe('ocr engine smoke', () => {
  it('reads a real screenshot', async () => {
    const det = readFileSync(new URL('../../../core/public/ocr/det.onnx', import.meta.url))
    const rec = readFileSync(new URL('../../../core/public/ocr/rec.onnx', import.meta.url))
    const dict = readFileSync(new URL('../../../core/public/ocr/keys.txt', import.meta.url), 'utf8')
    const raw = readFileSync(new URL('../../ocr-sample.raw', import.meta.url))
    const width = 1170
    const height = 2532
    const data = new Uint8ClampedArray(width * height * 4)
    for (let i = 0; i < width * height; i++) {
      data[i * 4] = raw[i * 4 + 2] ?? 0
      data[i * 4 + 1] = raw[i * 4 + 1] ?? 0
      data[i * 4 + 2] = raw[i * 4] ?? 0
      data[i * 4 + 3] = 255
    }
    const sessions = await createOcrFromBuffers(det.buffer.slice(det.byteOffset, det.byteOffset + det.byteLength), rec.buffer.slice(rec.byteOffset, rec.byteOffset + rec.byteLength), dict)
    const words = await recognize(sessions, { data, width, height })
    const groups = splitCards(words)
    const card = parseCard(groups[0] ?? [], { portraitId: null, slotLines: [null, null] })
    writeFileSync(new URL('../../ocr-sample.txt', import.meta.url), `${words.map((word) => `${word.text} @${Math.round(word.x)},${Math.round(word.y)}`).join('\n')}\n\n${JSON.stringify(card, null, 2)}`)
    expect(words.length).toBeGreaterThan(3)
  }, 120000)
})
