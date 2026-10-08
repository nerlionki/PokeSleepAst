import { beforeEach, describe, expect, it, vi } from 'vitest'
import { requestJson } from './request'
const { get } = vi.hoisted(() => ({ get: vi.fn() }))
vi.mock('@capacitor/core', () => ({ CapacitorHttp: { get } }))
beforeEach(() => vi.resetAllMocks())
describe('Android update transport', () => {
  it('recovers from the reported truncated stream using a fresh connection', async () => {
    get.mockRejectedValueOnce(new Error('unexpected end of stream on com.android.okhttp.Address@dd450a6c'))
      .mockResolvedValueOnce({ status: 200, data: '{"version":"1.0.4"}' })
    expect(await requestJson('https://example.test/update.json')).toEqual({ version: '1.0.4' })
    expect(get).toHaveBeenCalledTimes(2)
    expect(get.mock.calls[1]![0].headers).toMatchObject({ Connection: 'close', 'Accept-Encoding': 'identity' })
  })
  it('retries truncated JSON and temporary server errors', async () => {
    get.mockResolvedValueOnce({ status: 502 }).mockResolvedValueOnce({ status: 200, data: '{"version":' })
      .mockResolvedValueOnce({ status: 200, data: '{"version":"1.0.4"}' })
    expect(await requestJson('https://example.test/update.json')).toEqual({ version: '1.0.4' })
  })
  it('bounds retries and never leaks the Java exception to the user', async () => {
    get.mockRejectedValue({ message: 'unexpected end of stream on com.android.okhttp.Address@123' })
    await expect(requestJson('https://example.test')).rejects.toThrow('检查网络')
    expect(get).toHaveBeenCalledTimes(3)
  })
  it('does not retry rate limits or treat network failures as no release', async () => {
    get.mockResolvedValue({ status: 429 })
    await expect(requestJson('https://example.test', true)).rejects.toThrow('过于频繁')
    expect(get).toHaveBeenCalledTimes(1)
    get.mockResolvedValue({ status: 404 })
    expect(await requestJson('https://example.test', true)).toBeNull()
  })
})
