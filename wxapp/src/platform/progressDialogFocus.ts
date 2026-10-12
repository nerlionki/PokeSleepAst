import type { Ref } from 'vue'
// Native view/button components do not expose the browser HTMLElement focus API.
export function useProgressDialogFocus(_open: Readonly<Ref<boolean>>, _target: () => unknown) {
  return { focus: () => {} }
}
