import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'

/** Keep page sections in route history so system Back restores the previous section. */
export function usePageTab<T extends string>(tabs: readonly T[], fallback: T) {
  const route = useRoute()
  const router = useRouter()
  return computed<T>({
    get: () => tabs.includes(route.query.tab as T) ? route.query.tab as T : fallback,
    set: (tab) => { void router.push({ path: route.path, query: { ...route.query, tab } }) },
  })
}
