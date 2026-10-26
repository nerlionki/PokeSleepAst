import { defineStore } from 'pinia'
import { ref, watch } from 'vue'
import type { CandyRow } from '../calc/candyPlan'
import { migrateCandyStocks } from '../calc/candyPlan'
import type { CatchGoal } from '../calc/catch'
import { DEFAULT_BABY_EFFICIENCY, DEFAULT_COMPLETION_EFFICIENCY, normalizeBabyEfficiencyPokemonId, validateBabyEfficiency, type BabyEfficiencyOptions } from '../calc/babyEfficiency'
import { DEFAULT_WHISTLE, normalizeWhistleOptions, type WhistleOptions } from '../calc/whistle'
import { loadJson, saveJson } from '../storage'
import { defaultSplitOptions, normalizeSplitOptions, type SplitOptions } from '../calc/splitSleep'

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
  babyEfficiency: BabyEfficiencyOptions
  completionEfficiency: BabyEfficiencyOptions
  whistle: WhistleOptions
  splitSleep: SplitOptions
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
  babyEfficiency: { ...DEFAULT_BABY_EFFICIENCY },
  completionEfficiency: { ...DEFAULT_COMPLETION_EFFICIENCY },
  whistle: { ...DEFAULT_WHISTLE },
  splitSleep: defaultSplitOptions(),
}

export const usePlanStore = defineStore('plans', () => {
  const plan = ref<PlanState>({ ...empty, babyEfficiency: { ...DEFAULT_BABY_EFFICIENCY }, completionEfficiency: { ...DEFAULT_COMPLETION_EFFICIENCY }, whistle: { ...DEFAULT_WHISTLE }, splitSleep: defaultSplitOptions() })
  const ready = ref(false)

  async function hydrate() {
    const saved = await loadJson<Partial<PlanState>>('plans', empty)
    const babyEfficiency = { ...DEFAULT_BABY_EFFICIENCY, ...saved.babyEfficiency }
    babyEfficiency.pokeId = normalizeBabyEfficiencyPokemonId(babyEfficiency.pokeId)
    const completionEfficiency = { ...DEFAULT_COMPLETION_EFFICIENCY, ...saved.completionEfficiency }
    plan.value = {
      ...empty,
      ...saved,
      sleepdex: saved.sleepdex ?? [],
      sleepdexMode: saved.sleepdexMode ?? ((saved.sleepdex?.length ?? 0) > 0 ? 'list' : 'all'),
      sleepdexExcluded: saved.sleepdexExcluded ?? [],
      catchGoals: saved.catchGoals ?? [],
      candyRows: saved.candyRows ?? [],
      candyStocks: migrateCandyStocks(saved.candyStocks ?? {}),
      whistle: normalizeWhistleOptions(saved.whistle),
      splitSleep: normalizeSplitOptions(saved.splitSleep),
      babyEfficiency: validateBabyEfficiency(babyEfficiency) ? { ...DEFAULT_BABY_EFFICIENCY } : babyEfficiency,
      completionEfficiency: validateBabyEfficiency(completionEfficiency) ? { ...DEFAULT_COMPLETION_EFFICIENCY } : completionEfficiency,
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
