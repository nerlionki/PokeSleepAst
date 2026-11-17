import { computed } from 'vue'
import { usePlanStore, type PlanCampTicketScope } from '../stores/plans'
import { useSettingsStore } from '../stores/settings'

export type CampTicketMode = 'global' | 'on' | 'off'

export function usePlanCampTicket(scope: PlanCampTicketScope) {
  const plans = usePlanStore()
  const settings = useSettingsStore()
  const override = computed(() => plans.plan.campTicketOverrides?.[scope])
  const mode = computed<CampTicketMode>({
    get: () => override.value === true ? 'on' : override.value === false ? 'off' : 'global',
    set(value) {
      if (value === 'global') {
        if (plans.plan.campTicketOverrides) delete plans.plan.campTicketOverrides[scope]
      } else {
        (plans.plan.campTicketOverrides ??= {})[scope] = value === 'on'
      }
    }
  })
  const enabled = computed(() => mode.value === 'global' ? settings.settings.goodCamp : mode.value === 'on')
  return { mode, enabled }
}
