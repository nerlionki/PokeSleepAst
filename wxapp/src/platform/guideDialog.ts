import type { Ref } from 'vue'

// Keyboard focus is a WebView concern; native buttons use platform focus.
export function useGuideDialog(_open: Readonly<Ref<boolean>>, _target: () => unknown) {
  return { trapFocus: (_event: unknown) => {} }
}
