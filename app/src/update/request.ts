import { CapacitorHttp } from '@capacitor/core'

/** Retry interrupted Android HttpURLConnection streams with a fresh connection. */
export async function requestJson(url: string, allowMissing = false): Promise<unknown> {
  for (let attempt = 0; attempt < 3; attempt++) {
    let response
    try {
      response = await CapacitorHttp.get({ url,
        headers: { Accept: 'application/json', 'Accept-Encoding': 'identity', Connection: 'close', 'User-Agent': 'PokeSleepAst-Updater' },
        connectTimeout: 15_000, readTimeout: 20_000, responseType: 'text',
      })
    } catch {
      if (attempt < 2) continue
      throw new Error('检查更新失败，连接中断或无法访问 GitHub，请检查网络后重试，也可前往发布页下载')
    }
    if (allowMissing && response.status === 404) return null
    if (response.status === 403 || response.status === 429) throw new Error('更新服务请求过于频繁，请稍后重试')
    if (response.status >= 500 && attempt < 2) continue
    if (response.status !== 200) throw new Error('无法获取更新信息（' + response.status + '），请稍后重试')
    try {
      const data: unknown = typeof response.data === 'string' ? JSON.parse(response.data) : response.data
      if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error('Invalid update response')
      return data
    }
    catch {
      if (attempt < 2) continue
      throw new Error('更新信息接收不完整，请稍后重试或前往发布页下载')
    }
  }
  throw new Error('检查更新失败，请稍后重试')
}
