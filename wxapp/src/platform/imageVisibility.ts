type Start = () => void
interface Group { pending: Map<string, Start>; observer?: WechatMiniprogram.IntersectionObserver; scheduled: boolean }
const groups = new WeakMap<object, Group>()
/** Share one native observer per page; off-screen images do not download. */
export function whenImageVisible(id: string, start: Start): () => void {
  if (typeof wx === 'undefined' || typeof wx.createIntersectionObserver !== 'function' || typeof getCurrentPages !== 'function') { start(); return () => {} }
  const page = getCurrentPages().at(-1)
  if (!page) { start(); return () => {} }
  let group = groups.get(page)
  if (!group) { group = { pending: new Map(), scheduled: false }; groups.set(page, group) }
  const current = group
  current.pending.set(id, start)
  if (!current.scheduled) {
    current.scheduled = true
    wx.nextTick(() => {
      current.scheduled = false
      current.observer?.disconnect()
      if (!current.pending.size) return
      try {
        current.observer = wx.createIntersectionObserver(page, { observeAll: true, thresholds: [0], initialRatio: 0 })
        current.observer.relativeToViewport().observe('.resource-awaiting-image', result => {
          if (result.intersectionRatio <= 0) return
          const key = String(result.dataset?.resourceId ?? result.id)
          const show = current.pending.get(key)
          if (!show) return
          current.pending.delete(key); show()
          if (!current.pending.size) current.observer?.disconnect()
        })
      } catch {
        // Unsupported observer environments still show images on this page.
        for (const show of current.pending.values()) show()
        current.pending.clear()
      }
    })
  }
  return () => { current.pending.delete(id); if (!current.pending.size) current.observer?.disconnect() }
}
