import { afterEach, describe, expect, it, vi } from 'vitest'
const mocks = vi.hoisted(() => ({ platform: 'android', start: vi.fn(), cancel: vi.fn(), status: vi.fn(), addListener: vi.fn() }))
vi.mock('@capacitor/core', () => ({ Capacitor: { getPlatform: () => mocks.platform }, registerPlugin: () => mocks }))
import { createCalculationWorker } from './calculationWorker'
afterEach(() => { vi.unstubAllGlobals(); vi.resetAllMocks() })
describe('native background calculation bridge', () => {
  it('replays missed results on resume, ignores duplicate and stale events, and cancels on termination', async () => {
    vi.stubGlobal('window', new EventTarget())
    let emit: (event: unknown) => void = () => {}
    const remove = vi.fn(); mocks.addListener.mockImplementation((_name, callback) => { emit = callback; return Promise.resolve({ remove }) })
    mocks.status.mockResolvedValue({ id: 'none' }); mocks.start.mockResolvedValue(undefined); mocks.cancel.mockResolvedValue(undefined)
    const worker = createCalculationWorker<object, { type: string }>('baby', () => { throw Error('unexpected browser worker') })
    const message = vi.fn(); worker.onmessage = message; worker.postMessage({})
    await vi.waitFor(() => expect(mocks.start).toHaveBeenCalledOnce())
    const { id } = mocks.start.mock.calls[0]![0]
    const result = { id, sequence: 2, message: { type: 'result' } }
    mocks.status.mockResolvedValue(result)
    window.dispatchEvent(new Event('appCalculationResume'))
    await vi.waitFor(() => expect(message).toHaveBeenCalledOnce())
    emit(result); emit({ id: 'old', sequence: 3, message: { type: 'result' } })
    expect(message).toHaveBeenCalledOnce()
    worker.terminate(); emit({ ...result, sequence: 4 })
    expect(message).toHaveBeenCalledOnce(); expect(remove).toHaveBeenCalledOnce(); expect(mocks.cancel).toHaveBeenCalledWith({ id })
  })
  it('cancels a service that finishes starting after the UI has cancelled', async () => {
    vi.stubGlobal('window', new EventTarget())
    let finish!: () => void
    mocks.addListener.mockResolvedValue({ remove: vi.fn() }); mocks.start.mockImplementation(() => new Promise<void>((resolve) => { finish = resolve }))
    mocks.cancel.mockResolvedValue(undefined)
    const worker = createCalculationWorker('sleep', () => { throw Error('unexpected browser worker') })
    worker.postMessage({}); await vi.waitFor(() => expect(mocks.start).toHaveBeenCalledOnce())
    worker.terminate(); finish()
    await vi.waitFor(() => expect(mocks.cancel).toHaveBeenCalledTimes(2))
  })
})


it('keeps foreground calculation available when native startup is unsupported', async () => {
  vi.stubGlobal('window', new EventTarget())
  mocks.addListener.mockResolvedValue({ remove: vi.fn() }); mocks.start.mockRejectedValue(Error('unsupported')); mocks.cancel.mockResolvedValue(undefined)
  const fallback = { onmessage: null, onerror: null, postMessage: vi.fn(), terminate: vi.fn() }
  const notice = vi.fn()
  const worker = createCalculationWorker('baby', () => fallback as unknown as Worker, notice)
  worker.postMessage({ options: {} })
  await vi.waitFor(() => expect(fallback.postMessage).toHaveBeenCalledOnce())
  expect(notice).toHaveBeenCalledOnce(); worker.terminate(); expect(fallback.terminate).toHaveBeenCalledOnce()
})
