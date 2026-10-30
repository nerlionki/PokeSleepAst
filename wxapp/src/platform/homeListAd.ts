import { shallowRef } from 'vue'

// Process memory only: keep dismissal across tab/component remounts, and allow
// ads again when WeChat starts a new mini-program runtime. Do not persist it.
export const homeListAdDismissed = shallowRef(false)
