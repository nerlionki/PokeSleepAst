import { onScopeDispose } from 'vue'
import Taro, { usePageScroll } from '@tarojs/taro'
import type { GuideMeasure, GuideRect } from '../../../core/src/ui/guideLayout'

function rectOf(selector: string): Promise<GuideRect | undefined> {
  return new Promise(resolve => {
    Taro.createSelectorQuery().select(selector).boundingClientRect(rect => {
      resolve(rect && !Array.isArray(rect) ? { left: rect.left, top: rect.top, width: rect.width, height: rect.height } : undefined)
    }).exec()
  })
}

export async function measureGuide(selectors: readonly string[], reveal = false): Promise<GuideMeasure> {
  await new Promise<void>(resolve => Taro.nextTick(resolve))
  const viewport = Taro.getWindowInfo()
  let target: GuideRect | undefined
  for (const selector of selectors) { target = await rectOf(selector); if (target) break }
  if (reveal && target && (target.top < 0 || target.top + target.height > viewport.windowHeight)) {
    const offset = await new Promise<number>(resolve => { Taro.createSelectorQuery().selectViewport().scrollOffset(rect => resolve(!Array.isArray(rect) && rect ? rect.scrollTop : 0)).exec() })
    await Taro.pageScrollTo({ scrollTop: Math.max(0, offset + target.top - 80), duration: 0 }).catch(() => {})
    target = undefined
    for (const selector of selectors) { target = await rectOf(selector); if (target) break }
  }
  const content = await rectOf('#guide-tour-content')
  return { width: viewport.windowWidth, height: viewport.windowHeight, target, contentHeight: content?.height }
}

export function useGuideAnchorChanges(refresh: () => void) {
  usePageScroll(refresh)
  Taro.onWindowResize(refresh)
  onScopeDispose(() => Taro.offWindowResize(refresh))
}
