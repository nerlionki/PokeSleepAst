import { computed, type Ref } from 'vue'
import type { Settings } from '../types'
import { useActivities } from './useActivities'
import { activitySelection } from '../calc/activityToggle'
import { useStoredBoolean } from './useStoredBoolean'

export function useProductionActivity(key: string, source: Ref<Settings>) {
  const { state: enabled, ready, error } = useStoredBoolean(`activity-enabled-${key}`)
  const activity = useActivities(source, () => source.value.island, undefined, () => source.value.period)
  const settings = computed(() => ({ ...source.value, activity: activitySelection(enabled.value, activity.context.value, source.value.period) }))
  return { enabled, settings, ready, error }
}
