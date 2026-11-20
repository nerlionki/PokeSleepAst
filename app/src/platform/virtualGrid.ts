import type { VirtualGridSize } from '../../../core/src/ui/responsive'

export async function measureVirtualGrid(element: HTMLElement | null): Promise<VirtualGridSize | undefined> {
  if (!element) return
  const grid = element.querySelector<HTMLElement>('.virtual-dex-grid')
  if (!grid) return
  const style = getComputedStyle(grid)
  const cell = grid.querySelector('.poke-wall-cell')
  return {
    width: element.clientWidth,
    height: element.clientHeight,
    rowHeight: (cell?.getBoundingClientRect().height ?? parseFloat(style.gridAutoRows)) + parseFloat(style.rowGap),
  }
}

export function observeVirtualGrid(element: HTMLElement | null, refresh: () => void) {
  if (!element) return () => {}
  const observer = new ResizeObserver(refresh)
  observer.observe(element)
  const grid = element.querySelector('.virtual-dex-grid')
  if (grid) observer.observe(grid)
  return () => observer.disconnect()
}

export function scrollVirtualGrid(element: HTMLElement | null, top: number) {
  element?.scrollTo({ top, behavior: 'instant' })
}
