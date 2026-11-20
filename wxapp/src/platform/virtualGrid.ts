import Taro from '@tarojs/taro'
import type { VirtualGridSize } from '../../../core/src/ui/responsive'

export async function measureVirtualGrid(_element: unknown): Promise<VirtualGridSize | undefined> {
  await new Promise<void>(resolve => Taro.nextTick(resolve))
  return new Promise(resolve => {
    const query = Taro.createSelectorQuery()
    query.select('.virtual-dex').boundingClientRect()
    query.select('.virtual-dex-grid').fields({ computedStyle: ['grid-auto-rows', 'row-gap'] })
    query.select('.virtual-dex-grid .poke-wall-cell').boundingClientRect()
    query.exec(results => {
      const rect = results[0] as { width: number; height: number } | null
      const style = results[1] as Record<string, string> | null
      const cell = results[2] as { height: number } | null
      if (!rect || !style) return resolve(undefined)
      resolve({ width: rect.width, height: rect.height,
        rowHeight: (cell?.height ?? parseFloat(style['grid-auto-rows'])) + parseFloat(style['row-gap']) })
    })
  })
}

// Window, appearance and ad changes trigger native measurements in the caller.
export function observeVirtualGrid(_element: unknown, _refresh: () => void) { return () => {} }
export function scrollVirtualGrid(_element: unknown, _top: number) {
  // The generated scroll-view binds the shared restoreTop ref.
}
