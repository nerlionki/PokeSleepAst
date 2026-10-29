/** Shared CSS uses Taro's 375px design width; scroll events report device px. */
export function virtualRowHeight(pixels: number) {
  return pixels * wx.getWindowInfo().windowWidth / 375
}
export function virtualViewportHeight() { return wx.getWindowInfo().windowHeight }
export function watchVirtualViewport(callback: () => void) {
  wx.onWindowResize(callback)
  return () => wx.offWindowResize(callback)
}
