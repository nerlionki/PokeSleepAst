/** Dimensions are logical pixels on both platforms. */
export interface ViewportSize {
  width: number
  height: number
  visibleHeight: number
  visibleTop: number
  safeLeft: number
  safeRight: number
  safeBottom: number
}

export interface VirtualGridSize {
  width: number
  height: number
  rowHeight: number
}

export function pokedexColumns(width: number): number {
  if (width < 328) return 2
  if (width < 568) return 3
  return Math.min(6, Math.max(4, Math.floor((width + 8) / 144)))
}

export function viewportVariables(size: ViewportSize): Record<string, string> {
  return {
    '--viewport-height': `${size.height}px`,
    '--visible-height': `${size.visibleHeight}px`,
    '--visible-top': `${size.visibleTop}px`,
  }
}
