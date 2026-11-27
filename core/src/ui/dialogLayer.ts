import { inject, provide, type InjectionKey } from 'vue'

const dialogLayer: InjectionKey<number> = Symbol('dialogLayer')

export function useDialogLayer() {
  const layer = inject(dialogLayer, 29) + 1
  provide(dialogLayer, layer)
  return layer
}
