export function virtualRowHeight(pixels: number) { return pixels }
export function virtualViewportHeight() { return typeof window === 'undefined' ? 800 : window.innerHeight }
export function watchVirtualViewport(callback: () => void) {
  window.addEventListener('resize', callback)
  return () => window.removeEventListener('resize', callback)
}
