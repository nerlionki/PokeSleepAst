import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { ModuleKind, transpileModule } from 'typescript'

const source = readFileSync(new URL('../../../wxapp/src/platform/ocrEngine.ts', import.meta.url), 'utf8')
const metadata = JSON.parse(readFileSync(new URL('../../../wxapp/src/platform/ocr-models.json', import.meta.url), 'utf8'))

function runtime() {
  const files = new Map<string, number>()
  const loaded: string[] = [], sessions: Array<{ model: string; destroyed: boolean }> = []
  let fail = false
  const wx = {
    env: { USER_DATA_PATH: '/user' },
    getFileSystemManager: () => ({
      statSync(path: string) { if (!files.has(path)) throw Error('missing'); return { size: files.get(path) } },
      writeFileSync(path: string, bytes: ArrayBuffer) { files.set(path, bytes.byteLength) },
      readFileSync(path: string) {
        if (fail && path === 'ocr-pack1/model.bin') throw Error('download failed')
        const chunk = Object.values(metadata).flatMap((model: any) => model.chunks).find((chunk: any) => `${chunk.pack}/model.bin` === path)
        return new ArrayBuffer(chunk.size)
      },
      appendFileSync(path: string, bytes: ArrayBuffer) { files.set(path, files.get(path)! + bytes.byteLength) },
      renameSync(from: string, to: string) { files.set(to, files.get(from)!); files.delete(from) },
      unlinkSync(path: string) { files.delete(path) },
    }),
    createInferenceSession({ model }: { model: string }) {
      const entry = { model, destroyed: false }; sessions.push(entry)
      return { onLoad(cb: () => void) { queueMicrotask(cb) }, onError() {}, destroy() { entry.destroyed = true } }
    },
  }
  const exports: any = {}
  const code = transpileModule(source, { compilerOptions: { module: ModuleKind.CommonJS } }).outputText
  new Function('require', 'exports', 'wx', code)((id: string) => {
    if (id === '#image-loader') return { async loadModelChunk(pack: string) { loaded.push(pack); return { path: `${pack}/model.bin` } } }
    if (id.endsWith('ocr-models.json')) return metadata
    if (id.endsWith('ocr-dict.json')) return ['word']
    return { recognize() {} }
  }, exports, wx)
  return { files, loaded, sessions, load: exports.loadOcr as () => Promise<unknown>, fail(value: boolean) { fail = value } }
}

describe('bundled WeChat OCR models', () => {
  it('restores both original-sized models automatically and shares concurrent session loading', async () => {
    const run = runtime()
    const first = run.load(), second = run.load()
    expect(first).toBe(second)
    await first
    expect(run.loaded).toHaveLength(metadata.det.chunks.length + metadata.rec.chunks.length)
    for (const [name, info] of Object.entries<any>(metadata)) {
      expect(run.files.get(`/user/ocr-${name}-${info.hash}.onnx`)).toBe(info.size)
    }
    expect([...run.files.keys()].some(path => path.endsWith('.new'))).toBe(false)
    expect(run.sessions).toHaveLength(2)
  })
  it('removes partial files after failure, disposes the other session and retries using the intact cache', async () => {
    const run = runtime(); run.fail(true)
    await expect(run.load()).rejects.toThrow('download failed')
    expect(run.sessions[0]?.destroyed).toBe(true)
    expect([...run.files.keys()].some(path => path.endsWith('.new'))).toBe(false)
    run.fail(false); run.loaded.length = 0
    await run.load()
    expect(run.loaded).toEqual(metadata.det.chunks.map((chunk: any) => chunk.pack))
    expect(run.sessions).toHaveLength(3)
  })
})
