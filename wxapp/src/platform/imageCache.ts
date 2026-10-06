export type ImageManifest = Record<string, { pack: string; key: string; file: string; size: number }>
export interface ImageFiles {
  mkdirSync(path: string, recursive: boolean): void
  statSync(path: string): { size: number }
  writeFileSync(path: string, data: string, encoding: 'base64'): void
  renameSync(from: string, to: string): void
}
export function createImageResolver(manifest: ImageManifest, userPath: string, fs: ImageFiles, load: (name: string) => Promise<Record<string, string>>) {
  const packages = new Map<string, Promise<Record<string, string>>>()
  const pending = new Map<string, Promise<string>>()
  const directory = `${userPath}/pokesleep-images`
  let directoryReady = false
  function intact(path: string, size: number) {
    try { return fs.statSync(path).size === size } catch { return false }
  }
  return function resolve(src: string): Promise<string> {
    const item = manifest[src]
    if (!item) return /^\/asset-pack\d+\//.test(src) ? Promise.reject(new Error(`图片未打包：${src}`)) : Promise.resolve(src)
    const path = `${directory}/${item.file}`
    if (intact(path, item.size)) return Promise.resolve(path)
    if (!pending.has(src)) {
      const task = (async () => {
        if (!packages.has(item.pack)) packages.set(item.pack, load(item.pack).catch(error => { packages.delete(item.pack); throw error }))
        const data = (await packages.get(item.pack)!)[item.key]
        if (!data) throw new Error(`图片分包缺少资源：${item.key}`)
        if (!directoryReady) {
          try { fs.mkdirSync(directory, true) }
          catch (error) { try { fs.statSync(directory) } catch { throw error } }
          directoryReady = true
        }
        fs.writeFileSync(`${path}.tmp`, data, 'base64')
        fs.renameSync(`${path}.tmp`, path)
        return path
      })().finally(() => { pending.delete(src) })
      pending.set(src, task)
    }
    return pending.get(src)!
  }
}
