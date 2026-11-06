export interface GuideRect { top: number; left: number; width: number; height: number }
export interface GuideMeasure { width: number; height: number; target?: GuideRect; contentHeight?: number }

/** Position a popover beside its target while keeping the buttons in view. */
export function guideLayout(measure: GuideMeasure) {
  const margin = 16, gap = 12, padding = 6
  const width = Math.max(1, Math.min(360, measure.width - margin * 2))
  const desiredHeight = Math.max(220, (measure.contentHeight ?? 190) + 128)
  const viewportHeight = Math.max(1, measure.height)
  let target: GuideRect | undefined
  const rect = measure.target
  if (rect && rect.width > 0 && rect.height > 0 && rect.top + rect.height > 0 && rect.top < viewportHeight && rect.left + rect.width > 0 && rect.left < measure.width) {
    const left = Math.max(0, rect.left - padding), top = Math.max(0, rect.top - padding)
    target = { left, top, width: Math.max(0, Math.min(measure.width, rect.left + rect.width + padding) - left), height: Math.max(0, Math.min(viewportHeight, rect.top + rect.height + padding) - top) }
  }
  let side: 'top' | 'bottom' | 'none' = 'none'
  let maxHeight = Math.max(1, viewportHeight - margin * 2)
  let left = (measure.width - width) / 2
  let top = Math.max(margin, (viewportHeight - Math.min(desiredHeight, maxHeight)) / 2)
  let arrowLeft = width / 2
  if (target) {
    const below = viewportHeight - target.top - target.height - gap - margin
    const above = target.top - gap - margin
    if (Math.max(below, above) >= Math.min(220, desiredHeight)) {
      side = below >= Math.min(desiredHeight, 260) || below >= above ? 'bottom' : 'top'
      maxHeight = side === 'bottom' ? below : above
      const height = Math.min(desiredHeight, maxHeight)
      top = side === 'bottom' ? target.top + target.height + gap : target.top - height - gap
      left = Math.max(margin, Math.min(measure.width - width - margin, target.left + target.width / 2 - width / 2))
      arrowLeft = Math.max(22, Math.min(width - 22, target.left + target.width / 2 - left))
    }
  }
  return { target, side, arrowLeft, panel: { left, top, width, height: Math.min(desiredHeight, maxHeight) }, viewport: { width: measure.width, height: viewportHeight } }
}
