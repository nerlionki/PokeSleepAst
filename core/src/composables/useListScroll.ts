import { onMounted, shallowRef, useTemplateRef } from 'vue'

const positions = new Map<string, number>()

export function useListScroll(key: string) {
  const restoreTop = shallowRef(positions.get(key) ?? 0)
  const scrollArea = useTemplateRef<HTMLElement>('scrollArea')
  onMounted(() => scrollArea.value?.scrollTo?.(0, restoreTop.value))

  function trackListScroll(event: Event | { detail: { scrollTop: number } }) {
    const detail = (event as { detail?: { scrollTop?: number } }).detail
    const top = detail?.scrollTop ?? ((event as Event).target as HTMLElement | null)?.scrollTop ?? 0
    positions.set(key, top)
    return top
  }

  function resetListScroll() {
    positions.delete(key)
    restoreTop.value = 0
  }

  return { restoreTop, trackListScroll, resetListScroll }
}
