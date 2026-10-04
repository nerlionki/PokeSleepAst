import { defineStore } from 'pinia'
import { ref, watch } from 'vue'
import type { CandyRow } from '../calc/candyPlan'
import type { CatchGoal } from '../calc/catch'
import { loadJson, saveJson } from '../storage'

interface PlanState {
  snorlaxStrength: number
  sleepScore: number
  sleepType: '淺淺入夢' | '安然入睡' | '深深入眠' | '没有特征'
  campTicket: boolean
  incense: boolean
  rank: string
  sleepdex: string[]
  /** all：默认全选，sleepdexExcluded 里的是取消的。list：sleepdex 是手动记下的已发现。 */
  sleepdexMode: 'all' | 'list'
  sleepdexExcluded: string[]
  undiscoveredBoost: boolean
  rare: boolean
  shinyUp: boolean
  catchGoals: CatchGoal[]
  candyRows: CandyRow[]
  candyStocks: Record<string, number>
}

const empty: PlanState = {
  snorlaxStrength: 0,
  sleepScore: 100,
  sleepType: '没有特征',
  campTicket: false,
  incense: false,
  rank: '',
  sleepdex: [],
  sleepdexMode: 'all',
  sleepdexExcluded: [],
  undiscoveredBoost: true,
  rare: true,
  shinyUp: false,
  catchGoals: [],
  candyRows: [],
  candyStocks: {},
}

export const usePlanStore = defineStore('plans', () => {
  const plan = ref<PlanState>({ ...empty })
  const ready = ref(false)

  async function hydrate() {
    const saved = await loadJson<Partial<PlanState>>('plans', empty)
    plan.value = {
      ...empty,
      ...saved,
      sleepdex: saved.sleepdex ?? [],
      sleepdexMode: saved.sleepdexMode ?? ((saved.sleepdex?.length ?? 0) > 0 ? 'list' : 'all'),
      sleepdexExcluded: saved.sleepdexExcluded ?? [],
      catchGoals: saved.catchGoals ?? [],
      candyRows: saved.candyRows ?? [],
      candyStocks: saved.candyStocks ?? {},
    }
    ready.value = true
  }

  watch(plan, (v) => {
    if (ready.value) void saveJson('plans', v)
  }, { deep: true })

  function toggleStyle(key: string) {
    if (plan.value.sleepdexMode === 'list') {
      const set = new Set(plan.value.sleepdex)
      if (set.has(key)) set.delete(key)
      else set.add(key)
      plan.value.sleepdex = [...set]
      return
    }
    const set = new Set(plan.value.sleepdexExcluded)
    if (set.has(key)) set.delete(key)
    else set.add(key)
    plan.value.sleepdexExcluded = [...set]
  }

  return { plan, ready, hydrate, toggleStyle }
})
