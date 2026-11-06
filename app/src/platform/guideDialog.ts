import type { Ref } from 'vue'
import { useProgressDialogFocus } from './progressDialogFocus'

export function useGuideDialog(open: Readonly<Ref<boolean>>, target: () => unknown) {
  useProgressDialogFocus(open, target)
  function trapFocus(event: KeyboardEvent) {
    const panel = target()
    if (!(panel instanceof HTMLElement)) return
    const buttons = [...panel.querySelectorAll<HTMLButtonElement>('button:not(:disabled)')]
    const first = buttons[0], last = buttons.at(-1)
    if (!first || !last) return
    if (event.shiftKey && (document.activeElement === first || document.activeElement === panel)) {
      event.preventDefault(); last.focus()
    } else if (!event.shiftKey && (document.activeElement === last || document.activeElement === panel)) {
      event.preventDefault(); first.focus()
    }
  }
  return { trapFocus }
}
