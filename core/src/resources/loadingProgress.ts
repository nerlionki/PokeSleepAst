export interface LoadingProgress { percent: number; label: string }
let current: LoadingProgress = { percent: 0, label: '正在加载资料…' }
const listeners = new Set<(progress: LoadingProgress) => void>()
export function loadingProgress() { return current }
export function updateLoadingProgress(progress: LoadingProgress) {
  current = { ...progress, percent: Math.max(0, Math.min(100, Math.floor(progress.percent))) }
  for (const listener of listeners) listener(current)
}
export function subscribeLoadingProgress(listener: (progress: LoadingProgress) => void) {
  listeners.add(listener); listener(current)
  return () => { listeners.delete(listener) }
}
