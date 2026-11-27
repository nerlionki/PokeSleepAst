import { computed, onActivated, onDeactivated, onMounted, onUnmounted } from 'vue'
import { exchangeCatalog, exchangeClockBoundaries, exchangePlanShops } from '../calc/eventExchange'
import { eventBundleCatalog } from '../calc/eventBundles'
import { exactActivityNow, retainActivityClock } from './activityClock'

export function useEventExchanges(trial = false) {
  const shops = exchangeCatalog()
  const bundles = computed(() => {
    try {
      return shops.some(shop => trial || shop.exchange.opensAt) ? eventBundleCatalog(true) : null
    } catch {
      return null
    }
  })
  const plannerShops = computed(() => exchangePlanShops(shops, exactActivityNow.value, trial))
  let release: (() => void) | undefined
  const start = () => {
    release ??= retainActivityClock(() => exchangeClockBoundaries(shops, bundles.value))
  }
  const stop = () => {
    release?.()
    release = undefined
  }
  onMounted(start)
  onActivated(start)
  onDeactivated(stop)
  onUnmounted(stop)
  return { plannerShops, bundles, now: exactActivityNow }
}
