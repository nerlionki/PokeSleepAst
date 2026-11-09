let locks = 0
let restore: (() => void) | undefined

export function lockPageScroll() {
  if (locks++ === 0) {
    const style = document.body.style
    const { overflow, position, top, left, right } = style
    const y = typeof window === 'undefined' ? 0 : window.scrollY
    Object.assign(style, { overflow: 'hidden', position: 'fixed', top: -y + 'px', left: '0', right: '0' })
    restore = () => {
      Object.assign(style, { overflow, position, top, left, right })
      if (typeof window !== 'undefined') window.scrollTo(0, y)
    }
  }
  return () => {
    if (--locks === 0) {
      restore?.()
      restore = undefined
    }
  }
}
