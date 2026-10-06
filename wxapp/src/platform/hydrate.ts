import { useBoxStore } from '../../../core/src/stores/box'
import { usePlanStore } from '../../../core/src/stores/plans'
import { useRosterStore } from '../../../core/src/stores/roster'
import { useSettingsStore } from '../../../core/src/stores/settings'
let loading: Promise<unknown> | null = null
export function hydrate() {
  loading ??= Promise.all([useBoxStore().hydrate(), usePlanStore().hydrate(), useRosterStore().hydrate(), useSettingsStore().hydrate()]).catch(error => { loading = null; throw error })
  return loading
}
