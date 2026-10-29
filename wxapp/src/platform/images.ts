import images from './image-map.json'
import manifest from './image-manifest.json'
import { loadImageModule } from '#image-loader'
import { createImageResolver, type ImageFiles } from './imageCache'
import { activeSnapshot, remoteImage, RESOURCE_ORIGIN } from '../../../core/src/resources/runtime'
import { sha256 } from '../../../core/src/resources/sha256'
function localOnly(file: string): string { return (images as Record<string, string>)[file] ?? '' }
export function localImage(file: string): string { return remoteImage(`images/${file}`) || localOnly(file) }
export function publicImage(file: string): string { return remoteImage(file) || '/' + file }
export function bundledImage(src: string): string {
  const match = Object.entries(activeSnapshot()?.manifest.assets ?? {}).find(([,item]) => RESOURCE_ORIGIN + item.path === src)
  if (!match) return src
  return match[0].startsWith('images/') ? localOnly(match[0].slice(7)) : localOnly(match[0]) || '/' + match[0]
}
let resolve: ReturnType<typeof createImageResolver> | undefined
const pending = new Map<string, Promise<string>>()
const verified = new Set<string>()
export function resolveBundledImagePath(src: string): Promise<string> {
  resolve ??= createImageResolver(manifest, wx.env.USER_DATA_PATH, wx.getFileSystemManager() as unknown as ImageFiles, loadImageModule)
  const bundled = bundledImage(src)
  if (!bundled) return Promise.reject(new Error('没有对应的本地图片'))
  return resolve(localOnly(bundled.replace(/^\//, '')) || bundled)
}
export function resolveImagePath(src: string): Promise<string> {
  resolve ??= createImageResolver(manifest, wx.env.USER_DATA_PATH, wx.getFileSystemManager() as unknown as ImageFiles, loadImageModule)
  const local = () => resolveBundledImagePath(src)
  const item = Object.values(activeSnapshot()?.manifest.assets ?? {}).find(item => RESOURCE_ORIGIN + item.path === src)
  if (!item) return local()
  if (!pending.has(src)) {
    const task = (async () => {
      const fs = wx.getFileSystemManager()
      const directory = `${wx.env.USER_DATA_PATH}/sleepast-remote-images`
      const path = `${directory}/${item.sha256}${item.path.slice(item.path.lastIndexOf('.'))}`
      if (verified.has(path)) { try { fs.accessSync(path); return path } catch { verified.delete(path) } }
      const intact = (file: string) => {
        try {
          const bytes = new Uint8Array(fs.readFileSync(file) as ArrayBuffer)
          return bytes.length === item.bytes && sha256(bytes) === item.sha256
        } catch { return false }
      }
      if (!intact(path)) {
        const temp = await new Promise<string>((resolve, reject) => wx.downloadFile({ url: src, timeout: 5000,
          success: result => result.statusCode === 200 ? resolve(result.tempFilePath) : reject(new Error('图片下载失败')), fail: reject }))
        try {
          if (!intact(temp)) throw new Error('图片校验失败')
          try { fs.mkdirSync(directory, true) } catch { fs.accessSync(directory) }
          fs.copyFileSync(temp, path + '.tmp')
          fs.renameSync(path + '.tmp', path)
        } finally { try { fs.unlinkSync(temp) } catch { /* temporary file cleanup is optional */ } }
      }
      verified.add(path)
      return path
    })().catch(local).finally(() => pending.delete(src))
    pending.set(src, task)
  }
  return pending.get(src)!
}
