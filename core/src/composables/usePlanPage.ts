import { computed, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { usePageTab } from './usePageTab'
import { provideEncounterAvailability } from './useEncounterAvailability'

import { useEventExchanges } from './useEventExchanges'

const planTabs = [
  { id: 'encounter', label: '遇见规划' },
  { id: 'sleep', label: '睡眠规划' },
  { id: 'split', label: '目标拆觉' },
  { id: 'candy', label: '糖果增强' },
  { id: 'train', label: '培养规划' },
  { id: 'whistle', label: '吹哨规划' },
  { id: 'sp', label: 'SP 计算' },
  { id: 'panel', label: '面板概率' },
  { id: 'exchange', label: '活动兑换' },
] as const

export function usePlanPage(trial: boolean) {
  const route = useRoute()
  const router = useRouter()
  const { plannerShops, bundles, now } = useEventExchanges(trial)
  const showExchange = computed(() => trial || plannerShops.value.length > 0)
  const options = computed(() => planTabs.filter(option => option.id !== 'exchange' || showExchange.value))
  const tab = usePageTab(computed(() => options.value.map(option => option.id)), 'sleep')
  watch([showExchange, () => route.path, () => route.query.tab], ([visible, path, requested]) => {
    if (visible || path !== '/plan' || requested !== 'exchange') return
    const { exchangeEvent: _exchangeEvent, ...query } = route.query
    void router.replace({ path, query: { ...query, tab: tab.value || 'sleep' } })
  }, { flush: 'post', immediate: true })
  const { visible: showUnreleasedToggle, includeUnreleasedPokemon } = provideEncounterAvailability(computed(() => tab.value === 'encounter'))
  const legacy = computed(() => route.query.encounterVersion === 'legacy' || ['catch', 'baby', 'completion'].includes(String(route.query.tab)))
  function switchVersion() {
    const { legacyTab, encounterVersion, ...query } = route.query
    void router.push({ path: route.path, query: { ...query, tab: 'encounter', ...(!legacy.value ? { encounterVersion: 'legacy', legacyTab: legacyTab ?? 'catch' } : {}) } })
  }
  return { tab, options, plannerShops, bundles, now, legacy, switchVersion, showUnreleasedToggle, includeUnreleasedPokemon }
}
