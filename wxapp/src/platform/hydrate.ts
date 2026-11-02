import { useFeaturesStore } from '../../../core/src/stores/features'
import { useBoxStore } from '../../../core/src/stores/box'
import { usePlanStore } from '../../../core/src/stores/plans'
import { useRosterStore } from '../../../core/src/stores/roster'
import { useSettingsStore } from '../../../core/src/stores/settings'
import { useAppearanceStore } from '../../../core/src/stores/appearance'
let loading: Promise<unknown> | null = null
export function hydrate() {
  loading ??= Promise.all([useFeaturesStore().hydrate(), useBoxStore().hydrate(), usePlanStore().hydrate(), useRosterStore().hydrate(), useSettingsStore().hydrate(), useAppearanceStore().hydrate()]).catch(error => { loading = null; throw error })
  return loading
}
