import { onMounted, onScopeDispose, shallowRef } from 'vue'
import Taro, { useDidShow } from '@tarojs/taro'
import type { ViewportSize } from '../../../core/src/ui/responsive'

let keyboardHeight = 0
let fullHeight = Taro.getWindowInfo().windowHeight

function measure(): ViewportSize {
  const info = Taro.getWindowInfo()
  return {
    width: info.windowWidth,
    height: info.windowHeight,
    visibleHeight: keyboardHeight ? Math.min(info.windowHeight, Math.max(0, fullHeight - keyboardHeight)) : info.windowHeight,
    visibleTop: 0,
    safeLeft: info.safeArea?.left ?? 0,
    safeRight: Math.max(0, info.screenWidth - (info.safeArea?.right ?? info.screenWidth)),
    // Native navigation and tab bars are already outside windowHeight.
    safeBottom: Math.max(0, info.windowHeight - (info.safeArea?.bottom ?? info.windowHeight)),
  }
}

const viewport = shallowRef(measure())
let subscribers = 0
export function currentViewport() { return viewport.value }

export function refreshViewport() {
  if (!keyboardHeight) fullHeight = Taro.getWindowInfo().windowHeight
  viewport.value = measure()
}

function keyboardChanged(event: { height: number }) {
  keyboardHeight = event.height
  refreshViewport()
}

export function useViewport() {
  let mounted = false
  onMounted(() => {
    mounted = true
    if (subscribers++ === 0) {
      Taro.onWindowResize(refreshViewport)
      Taro.onKeyboardHeightChange(keyboardChanged)
    }
    refreshViewport()
  })
  useDidShow(refreshViewport)
  onScopeDispose(() => {
    if (mounted && --subscribers === 0) {
      Taro.offWindowResize(refreshViewport)
      Taro.offKeyboardHeightChange(keyboardChanged)
    }
  })
  return viewport
}
