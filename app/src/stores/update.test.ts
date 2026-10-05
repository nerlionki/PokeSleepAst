import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { assetUrl, localDate } from '../update/release'
import { useUpdateStore } from './update'

const mocks = vi.hoisted(() => ({
  get: vi.fn(), load: vi.fn(), save: vi.fn(), info: vi.fn(), download: vi.fn(), install: vi.fn(),
  listen: vi.fn(), remove: vi.fn(), supported: true,
}))
vi.mock('@capacitor/core', () => ({ CapacitorHttp: { get: mocks.get } }))
vi.mock('../storage', () => ({ loadJson: mocks.load, saveJson: mocks.save }))
vi.mock('../update/native', () => ({ supportsUpdates: () => mocks.supported,
  AppUpdater: { getInfo: mocks.info, download: mocks.download, install: mocks.install, addListener: mocks.listen } }))

const manifest = { version: '1.1.0', versionCode: 1001000, fileName: 'PokeSleepAst-1.1.0.apk', size: 1234, sha256: 'a'.repeat(64) }
const release = { tag_name: 'v1.1.0', draft: false, prerelease: false, body: '修复问题',
  assets: ['update.json', manifest.fileName].map((name) => ({ name, size: name === 'update.json' ? 200 : manifest.size,
    state: 'uploaded', browser_download_url: assetUrl('v1.1.0', name) })) }

beforeEach(() => {
  vi.resetAllMocks()
  mocks.supported = true
  setActivePinia(createPinia())
  mocks.load.mockResolvedValue({})
  mocks.save.mockResolvedValue(undefined)
  mocks.info.mockResolvedValue({ version: '1.0.0', versionCode: 1000000 })
  mocks.get.mockImplementation(({ url }) => Promise.resolve({ status: 200, data: url.endsWith('update.json') ? manifest : release }))
  mocks.listen.mockResolvedValue({ remove: mocks.remove })
  mocks.download.mockResolvedValue(undefined)
  mocks.install.mockResolvedValue({ permissionRequired: false })
})

describe('update flow', () => {
  it('checks once at startup, records prompt day and does not repeat the same day', async () => {
    const store = useUpdateStore()
    await store.initialize()
    expect(store.visible).toBe(true)
    expect(mocks.save).toHaveBeenCalledWith('app-update-reminders', { promptedVersion: '1.1.0', promptedDate: localDate() })
    const count = mocks.get.mock.calls.length
    await store.initialize()
    expect(mocks.get.mock.calls.length).toBe(count)
    mocks.load.mockResolvedValue({ promptedVersion: '1.1.0', promptedDate: localDate() })
    await store.dismiss()
    await store.check(false)
    expect(store.visible).toBe(false)
  })
  it('persists skip while manual checks bypass skip and daily reminder suppression', async () => {
    const store = useUpdateStore()
    await store.initialize()
    await store.dismiss(true)
    expect(mocks.save).toHaveBeenLastCalledWith('app-update-reminders', expect.objectContaining({ skippedVersion: '1.1.0' }))
    mocks.load.mockResolvedValue({ skippedVersion: '1.1.0' })
    await store.check(false)
    expect(store.visible).toBe(false)
    await store.check()
    expect(store.visible).toBe(true)
  })
  it('keeps automatic failures quiet and distinguishes no release from request failure', async () => {
    mocks.get.mockRejectedValue(new Error('网络不可用'))
    const store = useUpdateStore()
    await store.initialize()
    expect(store.visible).toBe(false)
    expect(store.message).toBe('')
    await store.check()
    expect(store.message).toBe('网络不可用')
    mocks.get.mockResolvedValue({ status: 404 })
    await store.check()
    expect(store.message).toBe('暂无已发布的正式版本')
    mocks.get.mockResolvedValue({ status: 429 })
    await store.check()
    expect(store.message).toContain('过于频繁')
  })
  it('does not offer downgrade or incomplete release', async () => {
    const store = useUpdateStore()
    mocks.info.mockResolvedValue({ version: '1.2.0', versionCode: 1002000 })
    await store.check()
    expect(store.message).toBe('当前已是最新版本')
    mocks.info.mockResolvedValue({ version: '1.0.0', versionCode: 1000000 })
    mocks.get.mockResolvedValue({ status: 200, data: { ...release, assets: [] } })
    await store.check()
    expect(store.visible).toBe(false)
    expect(store.message).toContain('完整')
  })
  it('downloads once and continues installation after permission settings or cancellation', async () => {
    const store = useUpdateStore()
    await store.check()
    mocks.install.mockResolvedValueOnce({ permissionRequired: true })
    await store.install()
    expect(store.phase).toBe('ready')
    expect(store.message).toContain('允许')
    expect(mocks.remove).toHaveBeenCalledOnce()
    await store.install()
    expect(mocks.download).toHaveBeenCalledOnce()
    expect(mocks.install).toHaveBeenCalledTimes(2)
    expect(store.message).toContain('取消后')
  })
  it('allows retry after download failure or invalid cached package', async () => {
    const store = useUpdateStore()
    await store.check()
    mocks.download.mockRejectedValueOnce(new Error('空间不足'))
    await store.install()
    expect(store.phase).toBe('available')
    expect(store.error).toBe('空间不足')
    await store.install()
    mocks.install.mockRejectedValueOnce(Object.assign(new Error('缓存丢失'), { code: 'FILE_INVALID' }))
    await store.install()
    expect(store.phase).toBe('available')
    await store.install()
    expect(mocks.download).toHaveBeenCalledTimes(3)
  })
  it('prevents overlapping checks and downloads, and cleans up progress listener', async () => {
    const store = useUpdateStore()
    await store.check()
    let finish: (() => void) | undefined
    mocks.download.mockImplementation(() => new Promise<void>((resolve) => { finish = resolve }))
    const installing = store.install()
    await vi.waitFor(() => expect(mocks.download).toHaveBeenCalledOnce())
    await store.install()
    await store.check()
    await store.dismiss()
    expect(mocks.download).toHaveBeenCalledOnce()
    expect(store.visible).toBe(true)
    finish?.()
    await installing
    expect(store.busy).toBe(false)
    expect(mocks.remove).toHaveBeenCalledOnce()
  })
  it('does not check or download on unsupported platforms', async () => {
    mocks.supported = false
    const store = useUpdateStore()
    await store.initialize()
    await store.check()
    expect(mocks.info).not.toHaveBeenCalled()
    expect(mocks.get).not.toHaveBeenCalled()
  })
})
