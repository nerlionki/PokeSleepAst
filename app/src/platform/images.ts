import { activeSnapshot, remoteImage, RESOURCE_ORIGIN } from '../../../core/src/resources/runtime'
import { isBundledImage } from '../../../core/src/resources/imagePolicy'
const localImages = import.meta.glob(['../../../core/src/assets/imgs/berry/*.webp', '../../../core/src/assets/imgs/ingredient/*.webp', '../../../core/src/assets/imgs/meal/*.webp', '../../../core/src/assets/imgs/pokemon/{icons,portrait}/*.webp'], {
  eager: true,
  query: '?url',
  import: 'default',
}) as Record<string, string>

const imageByFile = new Map<string, string>()
const absolute = (src: string) => typeof document === 'undefined' ? src : new URL(src, document.baseURI).href
for (const [key, url] of Object.entries(localImages)) {
  const file = key.split('assets/imgs/')[1]
  if (file) imageByFile.set(file, url)
}

export function localImage(file: string): string {
  const local = imageByFile.get(file) ?? ''
  return remoteImage(`images/${file}`) || (isBundledImage(file) ? local : '')
}

export function publicImage(file: string): string { return remoteImage(file) }
export function bundledImage(src: string): string {
  const match = Object.entries(activeSnapshot()?.manifest.assets ?? {}).find(([,item]) => RESOURCE_ORIGIN + item.path === src)
  if (!match) return ''
  if (!isBundledImage(match[0])) return ''
  return match[0].startsWith('images/') ? imageByFile.get(match[0].slice(7)) ?? '' : '/' + match[0]
}

/** Recipe pictures also remain usable when their versioned remote assets are unavailable. */
export function installImageFallbacks() {
  const onError = (event: Event) => {
    if (!(event.target instanceof HTMLImageElement)) return
    const image = event.target
    const fallback = bundledImage(image.src)
    if (fallback && absolute(fallback) !== absolute(image.src)) {
      event.stopImmediatePropagation()
      image.src = fallback
    }
  }
  document.addEventListener('error', onError, true)
  return () => document.removeEventListener('error', onError, true)
}
