import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useFeaturesStore } from '../stores/features'

/** Keep page sections in route history so system Back restores the previous section. */
export function usePageTab<T extends string>(tabs: readonly T[], fallback: T) {
  const route = useRoute()
  const router = useRouter()
  const features = useFeaturesStore()
  return computed<T>({
    get: () => {
      const page = route.path.replace(/^\//, '')
      const requested = page === 'plan' && ['catch', 'baby', 'completion'].includes(String(route.query.tab)) && tabs.includes('encounter' as T) ? 'encounter' : route.query.tab
      const available = tabs.filter(tab => features.enabled(page, tab))
      return (available.includes(requested as T) ? requested : available.includes(fallback) ? fallback : available[0] ?? '') as T
    },
    set: (tab) => { void router.push({ path: route.path, query: { ...route.query, tab } }) },
  })
}
