import { defineStore } from 'pinia'
import { ref, watch } from 'vue'
import { cloneData } from '../calc/dataClone'
import { firstRandomPanelFriendship, type PanelCatchPlan } from '../calc/panelProbability'
import { loadJson, saveJson } from '../storage'

const storageKey = 'panel-probability-plans'

export const usePanelPlans = defineStore('panel-plans', () => {
  const selected = ref(0)
  const plans = ref<Record<number, PanelCatchPlan>>({})
  const ready = ref(false)
  const storageError = ref(false)
  let loading: Promise<void> | undefined
  let saving = Promise.resolve()

  function hydrate() {
    return loading ??= loadJson(storageKey, { selected: 0, plans: {} as Record<number, PanelCatchPlan> })
      .then(saved => {
        selected.value = saved?.selected ?? 0
        plans.value = saved?.plans ?? {}
      })
      .catch(() => { storageError.value = true })
      .finally(() => { ready.value = true })
  }

  watch([selected, plans], () => {
    if (!ready.value) return
    const snapshot = cloneData({ selected: selected.value, plans: plans.value })
    saving = saving.then(() => saveJson(storageKey, snapshot))
      .then(() => { storageError.value = false }, () => { storageError.value = true })
  }, { deep: true })

  function choose(id: number) {
    if (!plans.value[id]) {
      plans.value[id] = { friendship: firstRandomPanelFriendship(id), catches: 10, goldSlots: [true, true, true],
        groups: [], allowUpgrade: false, natures: null, ingredients: [] }
    }
    selected.value = id
  }

  return { selected, plans, ready, storageError, hydrate, choose }
})
