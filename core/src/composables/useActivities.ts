import { computed, onActivated, onDeactivated, onMounted, onUnmounted, ref, type Ref } from 'vue'
import { activityValues, createActivityContext, localActivityDate, type ActivitySelection, type ActivityValues } from '../calc/activities'

/** Context is serializable: workers receive the same dated catalog and manual overrides. */
export function useActivities<T extends { activity?: ActivitySelection }>(model: Ref<T>, island: () => string, parent: () => ActivitySelection | undefined = () => undefined, period: () => 'day' | 'week' | 'research' = () => 'research') {
  const now = ref(Date.now())
  const dayKey = (date: Date) => `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}/${localActivityDate(date)}`
  let currentDay = dayKey(new Date(now.value))
  let timer: ReturnType<typeof setInterval> | undefined
  const stop = () => { if (timer) clearInterval(timer); timer = undefined }
  const refresh = () => {
    const time = Date.now(), next = dayKey(new Date(time))
    if (next !== currentDay) { currentDay = next; now.value = time }
  }
  const start = () => { stop(); refresh(); timer = setInterval(refresh, 60000) }
  onMounted(start); onActivated(start); onDeactivated(stop); onUnmounted(stop)
  const context = computed(() => createActivityContext(period(), { ...parent(), ...model.value.activity,
    overrides: { ...parent()?.overrides, ...model.value.activity?.overrides } }, new Date(now.value)))
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
