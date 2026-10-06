import { describe, expect, it, vi } from 'vitest'
import { createImageResolver, type ImageManifest } from '../../../wxapp/src/platform/imageCache'
import { readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'

const url = '/asset-pack0/berry/1.png'
const manifest: ImageManifest = { [url]: { pack: 'asset-pack0', key: 'berry/1.png', file: 'berry-hash.png', size: 3 } }
function fixture() {
  const files = new Map<string, number>()
  const fs = {
    mkdirSync: vi.fn(),
    statSync: vi.fn((file: string) => { if (!files.has(file)) throw Error('missing'); return { size: files.get(file)! } }),
    writeFileSync: vi.fn((file: string, data: string) => { files.set(file, Buffer.from(data, 'base64').length) }),
    renameSync: vi.fn((from: string, to: string) => { files.set(to, files.get(from)!); files.delete(from) }),
  }
  const load = vi.fn(async () => ({ 'berry/1.png': 'YWJj', 'ingredient/1.png': 'ZGVm' }))
  return { files, fs, load }
}
describe('WeChat image resources', () => {
  it('loads the image module through the native relative asynchronous require', async () => {
    const load = vi.fn(async () => ({ 'berry/1.png': 'YWJj' }))
    const exports = {} as { loadImageModule: (name: string) => Promise<Record<string, string>> }
    runInNewContext(readFileSync(new URL('../../../wxapp/src/native/image-loader.js', import.meta.url), 'utf8'), { exports, require:{async:load}, Promise, Error })
    expect(await exports.loadImageModule('asset-pack0')).toEqual({ 'berry/1.png': 'YWJj' })
    expect(load).toHaveBeenCalledWith('./asset-pack0/images.js')
    await expect(exports.loadImageModule('../other')).rejects.toThrow('Invalid image package')
    expect(load).toHaveBeenCalledOnce()
  })
  it('returns a native cache path and deduplicates concurrent image requests', async () => {
    const f = fixture(), resolve = createImageResolver(manifest, '/user', f.fs, f.load)
    const result = await Promise.all([resolve(url), resolve(url)])
    expect(result).toEqual(['/user/pokesleep-images/berry-hash.png', '/user/pokesleep-images/berry-hash.png'])
    expect(f.load).toHaveBeenCalledOnce()
    expect(f.fs.writeFileSync).toHaveBeenCalledWith('/user/pokesleep-images/berry-hash.png.tmp', 'YWJj', 'base64')
    expect(f.fs.renameSync).toHaveBeenCalledOnce()
  })
  it('uses an existing intact file, and repairs a truncated file', async () => {
    const f = fixture(), path = '/user/pokesleep-images/berry-hash.png'
    f.files.set(path, 3)
    await createImageResolver(manifest, '/user', f.fs, f.load)(url)
    expect(f.load).not.toHaveBeenCalled()
    f.files.set(path, 1)
    await createImageResolver(manifest, '/user', f.fs, f.load)(url)
    expect(f.files.get(path)).toBe(3)
  })
  it('retries failed package downloads and shares a package across different pictures', async () => {
    const f = fixture()
    f.load.mockRejectedValueOnce(Error('offline'))
    const second = '/asset-pack0/ingredient/1.png'
    const resolve = createImageResolver({ ...manifest, [second]: { pack:'asset-pack0', key:'ingredient/1.png',file:'ingredient-hash.png',size:3 } }, '/user', f.fs, f.load)
    await expect(resolve(url)).rejects.toThrow('offline')
    await Promise.all([resolve(url), resolve(second)])
    expect(f.load).toHaveBeenCalledTimes(2)
  })
  it('does not cache failed writes and reports missing packaged data', async () => {
    const f = fixture(), resolve = createImageResolver(manifest, '/user', f.fs, f.load)
    f.fs.writeFileSync.mockImplementationOnce(() => { throw Error('disk full') })
    await expect(resolve(url)).rejects.toThrow('disk full')
    expect(await resolve(url)).toContain('berry-hash.png')
    await expect(createImageResolver(manifest, '/user', f.fs, async () => ({}))(url.replace('1.png', 'missing.png'))).rejects.toThrow('未打包')
    f.files.clear()
    await expect(createImageResolver(manifest, '/user', f.fs, async () => ({}))(url)).rejects.toThrow('分包缺少')
  })
  it('passes user-selected files through unchanged', async () => {
    const f = fixture(), resolve = createImageResolver(manifest, '/user', f.fs, f.load)
    expect(await resolve('wxfile://temp/screenshot.jpg')).toBe('wxfile://temp/screenshot.jpg')
    expect(f.load).not.toHaveBeenCalled()
  })
})
