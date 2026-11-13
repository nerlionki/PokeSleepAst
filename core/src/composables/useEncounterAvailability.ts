import { computed, inject, onScopeDispose, provide, shallowRef, watch, type InjectionKey, type Ref } from 'vue'
import { researchActivity, type ActivitySelection } from '../calc/activities'
import { pendingResearchPokemon, upcomingResearchReleases } from '../calc/researchAvailability'

const key: InjectionKey<Ref<{ includeUnreleasedPokemon: boolean, pendingPokemon: number[] }>> = Symbol('encounter availability')

export function provideEncounterAvailability(active: Ref<boolean>) {
  const now = shallowRef(Date.now())
  const includeUnreleasedPokemon = shallowRef(false)
  const visible = computed(() => upcomingResearchReleases(now.value).length > 0)
  const pendingPokemon = shallowRef(pendingResearchPokemon(now.value))
  let timer: ReturnType<typeof setTimeout> | undefined

  function refresh() {
    clearTimeout(timer)
    now.value = Date.now()
    const pending = pendingResearchPokemon(now.value)
    if (pending.join() !== pendingPokemon.value.join()) pendingPokemon.value = pending
    const next = Math.min(...upcomingResearchReleases(now.value))
    if (Number.isFinite(next)) timer = setTimeout(refresh, Math.min(next - now.value, 60_000))
  }

  watch(active, value => {
    if (value) refresh()
    else {
      clearTimeout(timer)
      includeUnreleasedPokemon.value = false
    }
  }, { immediate: true })
  watch(visible, value => { if (!value) includeUnreleasedPokemon.value = false })
  onScopeDispose(() => clearTimeout(timer))
  provide(key, computed(() => ({
    includeUnreleasedPokemon: visible.value && includeUnreleasedPokemon.value,
    pendingPokemon: pendingPokemon.value,
  })))
  return { visible, includeUnreleasedPokemon }
}

export function useEncounterActivity(activity: Ref<ActivitySelection>) {
  const availability = inject(key, undefined)
  return computed(() => researchActivity({ ...activity.value, ...availability?.value }))
}
