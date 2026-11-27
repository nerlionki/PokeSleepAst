import { usePlanCampTicket } from './usePlanCampTicket'

import clientDefaults from '../data/client-defaults.resource'

import { useActivities } from './useActivities'
import { activityHasPokemonUp } from '../calc/activities'
import { computed, shallowRef, watch } from 'vue'
import { storeToRefs } from 'pinia'
import {
  drowsyPower,
  expectSpecies,
  maxEncounters,
  rankFromStrength,
  rankStrength,
  rankToNext,
  resolvedSleepdex,
  sleepShinyRate,
  strengthToNext
} from '../calc/sleep'
import { usePlanStore } from '../stores/plans'
import { useSettingsStore } from '../stores/settings'
import type { SleepType } from '../types'
import { useSleepSimulation } from './useSleepSimulation'
import { candyExpectation } from '../calc/sleepCandy'
import { teamResearchBonuses } from '../calc/sleepRewards'
import { useRosterStore } from '../stores/roster'
import { useBoxStore } from '../stores/box'
const defaults =
  clientDefaults.modules.components_plan_SleepPane

export function useSleepPlanner() {
  const settingsStore = useSettingsStore()
  const planStore = usePlanStore()
  const roster = useRosterStore()
  const box = useBoxStore()
  const researchBonuses = computed(() =>
    teamResearchBonuses(
      roster.slots.flatMap(uid => {
        const member =
          roster.customs.find(item => item.uid === uid) ??
          box.pokemon.find(item => item.uid === uid)
        return member ? [member] : []
      })
    )
  )
  const focusIncense = shallowRef(
    defaults['focusIncenseInitial']
  )
  const luckIncense = shallowRef(
    defaults['luckIncenseInitial']
  )
  const incenseSession = shallowRef<0 | 1>(
    defaults[
      'incenseSessionInitial'
    ] as unknown as 0 | 1
  )
  const { settings } = storeToRefs(settingsStore)
  const { mode: campTicketMode, enabled: campTicket } = usePlanCampTicket('sleep')
  const { plan } = storeToRefs(planStore)

  const island = computed({
    get: () => settings.value.island,
    set: value => settingsStore.applyIsland(value)
  })

  const activity = useActivities(settings, () => island.value)
  const researchSession = shallowRef<0 | 1>(0)
  const eventMult = activity.field(
    'drowsyPowerMultiplier',
    () => settings.value.eventMult
  )
  const shinyUp = computed(() => plan.value.shinyUp || settings.value.shinyUp)
  const shinyRate = computed(() =>
    sleepShinyRate(
      activity.context.value,
      shinyUp.value,
      island.value,
      undefined,
      researchSession.value
    )
  )
  const rank = computed(() =>
    rankFromStrength(island.value, plan.value.snorlaxStrength)
  )
  const nextRank = computed(() =>
    rankToNext(island.value, plan.value.snorlaxStrength)
  )
  const pickedRank = computed({
    get: () => rank.value,
    set: value => {
      plan.value.snorlaxStrength = rankStrength(island.value, value)
    }
  })
  // The overview recommends a full day's 100 points; simulation keeps the selected score.
  const overviewScore = 100
  const dp = computed(() =>
    drowsyPower(overviewScore, plan.value.snorlaxStrength, eventMult.value)
  )
  const overview = computed(() =>
    maxEncounters(
      island.value,
      overviewScore,
      plan.value.snorlaxStrength,
      eventMult.value
    )
  )
  const overviewSplitHelps = computed(
    () => overview.value.best.total > overview.value.single
  )

  const result = computed(() =>
    maxEncounters(
      island.value,
      plan.value.sleepScore,
      plan.value.snorlaxStrength,
      eventMult.value
    )
  )
  const splitHelps = computed(
    () => result.value.best.total > result.value.single
  )
  /** null 表示跟随推荐：拆分能多抓时拆分。改岛屿、能量或加成后回到推荐。 */
  const manualWhole = shallowRef<boolean | null>(
    defaults[
      'manualWholeInitial'
    ] as unknown as boolean | null
  )
  const whole = computed(
    () =>
      researchSession.value === 1 || (manualWhole.value ?? !splitHelps.value)
  )
  const overviewWhole = computed(
    () =>
      researchSession.value === 1 ||
      (manualWhole.value ?? !overviewSplitHelps.value)
  )
  const caught = computed(() =>
    overviewWhole.value ? overview.value.single : overview.value.best.total
  )
  const shown = computed(
    () =>
      caught.value +
      (campTicket.value && researchSession.value === 0 ? 1 : 0)
  )
  const nextCatch = computed(() =>
    strengthToNext(
      island.value,
      overviewScore,
      plan.value.snorlaxStrength,
      eventMult.value
    )
  )
  const sameMult = (mult: number) => Math.abs(eventMult.value - mult) < 0.001

  const BATCH = defaults[
    'BATCH'
  ] as 4000
  const mixMode = activity.field('eventMix', () => 'off')
  const otherTypes = computed({
    get: () => mixMode.value !== 'off',
    set: (value: boolean) => {
      mixMode.value = value ? settings.value.sleepEventMix : 'off'
    }
  })
  const researchedBefore = shallowRef(
    defaults['researchedBeforeInitial']
  )
  const specialEncountered = shallowRef(
    defaults['specialEncounteredInitial']
  )
  const specialEncounterDefault = computed(() =>
    activityHasPokemonUp(activity.context.value, island.value)
  )
  // A stable key preserves manual changes across clock ticks within the same day.
  watch(
    () =>
      `${activity.context.value.startDate}|${island.value}|${specialEncounterDefault.value}`,
    () => {
      specialEncountered.value = specialEncounterDefault.value
    },
    { immediate: true, flush: 'sync' }
  )
  const firstResearchExtras = shallowRef(
    defaults[
      'firstResearchExtrasInitial'
    ]
  )
  const eventMix = mixMode
  const resultTab = shallowRef<'encounters' | 'candies'>(
    defaults[
      'resultTabInitial'
    ] as unknown as 'encounters' | 'candies'
  )
  const {
    busy,
    error: simulationError,
    notice,
    progress,
    result: seen,
    calculate: startSimulation,
    cancel,
    reset
  } = useSleepSimulation(() => campTicket.value, () => plan.value.sleepPrecision)
  const sampled = computed(() => plan.value.sleepPrecision === 'low')
  watch(
    () => [
      researchBonuses.value,
      focusIncense.value,
      luckIncense.value,
      incenseSession.value
    ],
    () => reset(),
    { deep: true, flush: 'sync' }
  )
  const percent = computed(() =>
    progress.value.total
      ? Math.floor((progress.value.completed / progress.value.total) * 100)
      : 0
  )
  let drawSeed = defaults['drawSeed']

  watch(
    () => [island.value, plan.value.snorlaxStrength, eventMult.value],
    () => {
      manualWhole.value = null
    }
  )
  watch(
    () => [
      island.value,
      plan.value.sleepScore,
      plan.value.sleepPrecision,
      plan.value.snorlaxStrength,
      eventMult.value,
      whole.value,
      plan.value.sleepType,
      plan.value.rare,
      plan.value.shinyUp,
      shinyUp.value,
      activity.context.value,
      eventMix.value,
      plan.value.sleepdexMode,
      plan.value.sleepdex,
      plan.value.sleepdexExcluded,
      researchedBefore.value,
      researchSession.value,
      specialEncountered.value,
      firstResearchExtras.value,
      campTicket.value
    ],
    () => {
      reset()
    },
    { deep: true, flush: 'sync' }
  )

  function calculate() {
    if (busy.value) return
    drawSeed += 1
    const opts = {
      campTicket: campTicket.value,
      ...researchBonuses.value,
      focusIncense: focusIncense.value,
      luckIncense: luckIncense.value,
      incenseSession: whole.value ? (0 as const) : incenseSession.value,
      researchedBefore: Math.max(0, Math.floor(researchedBefore.value)),
      researchSession: researchSession.value,
      researchLimit: specialEncountered.value ? (11 as const) : (10 as const),
      firstResearchExtras:
        Math.max(0, Math.floor(firstResearchExtras.value)) +
        Number(campTicket.value) +
        Number(specialEncountered.value),
      rank: rank.value,
      discovered: resolvedSleepdex(plan.value),
      rare: plan.value.rare,
      shinyUp: shinyUp.value,
      activity: activity.context.value,
      eventMix: eventMix.value,
      eventMult: eventMult.value
    }
    const scores = whole.value
      ? [plan.value.sleepScore]
      : [result.value.best.a, result.value.best.b]
    resultTab.value = 'encounters'
    void startSimulation({
      island: island.value,
      sleepType: plan.value.sleepType as SleepType,
      powers: scores.map(score =>
        drowsyPower(score, plan.value.snorlaxStrength, eventMult.value)
      ),
      iterations: BATCH,
      precision: plan.value.sleepPrecision,
      seed: drawSeed,
      options: opts
    })
  }

  const seenShiny = computed(() =>
    seen.value.reduce((sum, row) => sum + row.shiny, 0)
  )
  const board = computed(() => {
    const total = seen.value.reduce((sum, row) => sum + row.count, 0)
    const rows = [false, true].flatMap(shiny =>
      expectSpecies(
        seen.value.map(row => ({
          ...row,
          count: shiny ? row.shiny : row.count - row.shiny
        }))
      )
        .filter(row => row.count > 0)
        .map(row => ({ ...row, shiny, percent: (row.count / total) * 100 }))
    )
    return rows.sort((a, b) => b.count - a.count || a.pokeId - b.pokeId)
  })
  const candies = computed(() => candyExpectation(seen.value, BATCH))
  const seenTotal = computed(() =>
    seen.value.reduce((sum, row) => sum + row.count, 0)
  )
  const rewards = computed(() =>
    seen.value.reduce(
      (sum, row) => ({
        researchExp: sum.researchExp + row.researchExp,
        shards: sum.shards + row.shards
      }),
      { researchExp: 0, shards: 0 }
    )
  )
  const perSleep = computed(() => ({
    researchExp: rewards.value.researchExp / BATCH,
    shards: rewards.value.shards / BATCH
  }))
  const average = (n: number) =>
    n.toLocaleString('zh-CN', { maximumFractionDigits: 1 })
  const expectedCount = (n: number) =>
    (n / BATCH).toLocaleString('zh-CN', { maximumFractionDigits: 4 })

  return {
    busy,
    sameMult,
    eventMult,
    overviewWhole,
    manualWhole,
    overviewScore,
    shown,
    dp,
    overviewSplitHelps,
    overview,
    nextCatch,
    island,
    plan,
    pickedRank,
    researchSession,
    researchedBefore,
    specialEncountered,
    whole,
    firstResearchExtras,
    campTicketMode,
    focusIncense,
    luckIncense,
    incenseSession,
    otherTypes,
    rank,
    nextRank,
    calculate,
    sampled,
    shinyRate,
    seenTotal,
    seenShiny,
    expectedCount,
    simulationError,
    notice,
    BATCH,
    average,
    perSleep,
    resultTab,
    candies,
    campTicket,
    board,
    percent,
    progress,
    cancel,
  }
}
