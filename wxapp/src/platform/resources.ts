import { selectedDataSource } from './dataSource'
import { setResourceContext } from '../../../core/src/resources/runtime'
import { initializeResources } from '../../../core/src/resources/loader'
import { updateLoadingProgress } from '../../../core/src/resources/loadingProgress'

// Start only after a page has committed its loading view. Starting at module
// evaluation can finish (or time out) before the first mini-program frame.
let initialization: ReturnType<typeof initializeResources> | undefined
let resolveReady!: (source: Awaited<ReturnType<typeof initializeResources>>) => void
let rejectReady!: (cause: unknown) => void
export const resourcesReady = new Promise<Awaited<ReturnType<typeof initializeResources>>>((resolve, reject) => {
  resolveReady = resolve
  rejectReady = reject
})
export function startResources() {
  if (!initialization) {
    initialization = loadResources()
    void initialization.then(resolveReady, rejectReady)
  }
  return resourcesReady
}
async function loadResources() {
const context = await selectedDataSource()
setResourceContext(context)
const path = `${wx.env.USER_DATA_PATH}/sleepast-resources-v1-${context}.json`
return initializeResources({
  async readCache() { return wx.getFileSystemManager().readFileSync(path, 'utf8') as string },
  async writeCache(value) {
    const fs = wx.getFileSystemManager()
    fs.writeFileSync(path + '.tmp', value, 'utf8')
    fs.renameSync(path + '.tmp', path)
  },
  fetchText(url, timeout, onProgress) {
    if (onProgress) return new Promise<string>((resolve, reject) => {
      const fs = wx.getFileSystemManager()
      const request = wx.downloadFile({ url, timeout,
        success(response) {
          try {
            if (response.statusCode !== 200) throw new Error('资料下载失败')
            const data = fs.readFileSync(response.tempFilePath, 'utf8') as string
            if (data.length > 8_000_000) throw new Error('资料过大')
            resolve(data)
          } catch (cause) { reject(cause) }
          finally { try { fs.unlinkSync(response.tempFilePath) } catch { /* temporary file may already be gone */ } }
        }, fail: reject })
      request.onProgressUpdate(event => onProgress(event.totalBytesWritten, event.totalBytesExpectedToWrite))
    })
    return new Promise((resolve, reject) => {
      wx.request({ url, timeout, dataType: 'text', responseType: 'text', header: { 'Cache-Control': 'no-cache' },
        success(response) {
          if (response.statusCode !== 200 || typeof response.data !== 'string' || response.data.length > 8_000_000) reject(new Error('资料下载失败'))
          else resolve(response.data)
        }, fail: reject })
    })
  },
}, 8000, updateLoadingProgress, context) }
