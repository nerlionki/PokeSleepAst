import { computed, onActivated, onDeactivated, onMounted, onUnmounted, type Ref } from 'vue'
import { activityValues, createActivityContext, type ActivitySelection, type ActivityValues } from '../calc/activities'
import { activityNow, retainActivityClock } from './activityClock'

/** Context is serializable: workers receive the same dated catalog and manual overrides. */
export function useActivities<T extends { activity?: ActivitySelection }>(model: Ref<T>, island: () => string, parent: () => ActivitySelection | undefined = () => undefined, period: () => 'day' | 'week' | 'research' = () => 'research') {
  let release: (() => void) | undefined
  const stop = () => { release?.(); release = undefined }
  const start = () => { if (!release) release = retainActivityClock() }
  onMounted(start); onActivated(start); onDeactivated(stop); onUnmounted(stop)
  const context = computed(() => createActivityContext(period(), { ...parent(), ...model.value.activity,
    overrides: { ...parent()?.overrides, ...model.value.activity?.overrides } }, new Date(activityNow.value)))
  function field<K extends keyof ActivityValues>(key: K, fallback?: () => ActivityValues[K]) {
    return computed({
      get: () => activityValues(context.value, island(), undefined, 240, fallback ? { [key]: fallback() } : {})[key],
      set: (value: ActivityValues[K]) => { model.value.activity = { ...model.value.activity, overrides: { ...model.value.activity?.overrides, [key]: value } } },
    })
  }
  function reset(key?: keyof ActivityValues) {
    const overrides = { ...model.value.activity?.overrides }
    if (key) delete overrides[key]
    model.value.activity = { ...model.value.activity, overrides: key ? overrides : {} }
  }
  return { context, field, reset }
}
