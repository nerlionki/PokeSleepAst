import images from './image-map.json'
import manifest from './image-manifest.json'
import { loadImageModule } from '#image-loader'
import { createImageResolver, type ImageFiles } from './imageCache'
export function localImage(file: string): string { return (images as Record<string, string>)[file] ?? '' }
let resolve: ReturnType<typeof createImageResolver> | undefined
export function resolveImagePath(src: string): Promise<string> {
  resolve ??= createImageResolver(manifest, wx.env.USER_DATA_PATH, wx.getFileSystemManager() as unknown as ImageFiles, loadImageModule)
  return resolve(localImage(src.replace(/^\//, '')) || src)
}
