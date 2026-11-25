import runtimeParameters from '../data/runtime-parameters.resource'
import ruleCatalogs from '../data/rule-catalogs.resource'
import ruleParameters from '../data/rule-parameters.resource'
import extracted0 from '../data/client-defaults.resource'
import extracted1 from '../data/calc-tables.resource'
import { cloneData } from './dataClone'
import { researchActivity, researchSleepStyles, sameResearchAvailability, activityValues, type ActivityContext, type ResearchActivitySelection } from './activities'
import { pendingResearchPokemon } from './researchAvailability'
import { normalizeEventMix, openSleepSlots, type EventMix } from './sleepRules'
import { isLastRollExcluded, isRaeFiller, raeSpoCost, RAE_SPO_RATE, requireRaeSleepLottery } from './sleepLastRoll'
import type { IslandId, SleepType } from '../types'
import { familyOf } from './candyPlan'
import { ENCOUNTER_BANDS, ISLANDS, POKEDEX, SLEEP_STYLES, type SleepStyleRow } from './data'
import { evolutionStages } from './evolution'
import { drowsyPower, encounterCount, RANK_ORDER, rankFromStrength, rankStrength, SPECIAL_POKEMON, styleUnlockIndex, styleKey } from './sleep'
import { raeMappedSleepStyleId, sleepReward, sleepStyleInternalId } from './sleepRewards'
import { createDrawStateKey, efficiencyRandom, prepareEfficiencyLottery, simulateEfficiencySlots, efficiencyRewardsAfterResearch, type EfficiencySimulation, type EfficiencyBucket, type EfficiencyDrawState, type EfficiencyReward } from './babyEfficiencyDraw'
const babyEfficiency_config_extracted0 = extracted0.modules.babyEfficiency
const babyEfficiency_config_extracted1 = extracted1.modules.babyEfficiency
const babyEfficiency_normalizeBabyEfficiencyPokemonId_runtimeParameters = runtimeParameters.modules.babyEfficiency.normalizeBabyEfficiencyPokemonId.values
const babyEfficiency_babyEfficiencyTargetIds_runtimeParameters = runtimeParameters.modules.babyEfficiency.babyEfficiencyTargetIds.values
const babyEfficiency_validateBabyEfficiency_ruleParameters = ruleParameters.modules.babyEfficiency.validateBabyEfficiency
const babyEfficiency_config_ruleCatalogs = ruleCatalogs.modules.babyEfficiency
const babyEfficiency_babyEfficiencySteps_runtimeParameters = runtimeParameters.modules.babyEfficiency.babyEfficiencySteps.values


export const MAX_EFFICIENCY_DROWSY_POWER = (babyEfficiency_config_extracted0.MAX_EFFICIENCY_DROWSY_POWER as 5000000000)

export type EfficiencyPrecision = 'low' | 'medium' | 'high'
export interface BabyEfficiencyOptions {
  /** Omitted for the legacy planner, which optimizes both metrics. */
  objective?: 'catch' | 'candy'
  activity?: ResearchActivitySelection
  pokeId: number
  /** 指定时搜索这一条睡姿的每日至少一次概率，不合并物种或同星睡姿。 */
  completionTarget?: string
  /** Existing completion panels default to first-hit. Fixed and offline callers can select expectation. */
  completionStatistic?: 'expectation' | 'first-hit'
  island?: IslandId | 'all'
  sleepType?: SleepType | 'all'
  campTicket?: boolean
  splitSleep?: boolean
  eventMult: number
  eventMix: EventMix | boolean
  iterations: number
  precision: EfficiencyPrecision
}
export const DEFAULT_BABY_EFFICIENCY: BabyEfficiencyOptions = (cloneData(babyEfficiency_config_extracted0.DEFAULT_BABY_EFFICIENCY) as unknown as BabyEfficiencyOptions)
export const DEFAULT_COMPLETION_EFFICIENCY: BabyEfficiencyOptions = {
  ...DEFAULT_BABY_EFFICIENCY, pokeId: babyEfficiency_config_extracted0.DEFAULT_COMPLETION_EFFICIENCY.pokeId, completionTarget: babyEfficiency_config_extracted0.DEFAULT_COMPLETION_EFFICIENCY.completionTarget,
}
export const EFFICIENCY_SLEEP_TYPES: SleepType[] = (cloneData(babyEfficiency_config_extracted1.EFFICIENCY_SLEEP_TYPES) as unknown as SleepType[])
const PUMPKABOO_IDS = (cloneData(babyEfficiency_config_extracted1.PUMPKABOO_IDS) as unknown as readonly [710,71002,71003,71004])
export const BABY_POKEMON_NAMES: Record<number, string> = (cloneData(babyEfficiency_config_extracted1.BABY_POKEMON_NAMES) as unknown as Record<number, string>)
export function normalizeBabyEfficiencyPokemonId(pokeId: number): number {
  return PUMPKABOO_IDS.some(id => id === pokeId) ? (babyEfficiency_normalizeBabyEfficiencyPokemonId_runtimeParameters.p001 as 710) : pokeId
}
export function babyEfficiencyTargetIds(pokeId: number): readonly number[] {
  return normalizeBabyEfficiencyPokemonId(pokeId) === (babyEfficiency_babyEfficiencyTargetIds_runtimeParameters.p001 as 710) ? PUMPKABOO_IDS : [pokeId]
}
export function babyEfficiencyPokemonName(pokeId: number): string {
  const id = normalizeBabyEfficiencyPokemonId(pokeId)
  return BABY_POKEMON_NAMES[id] ?? POKEDEX.find(poke => poke.id === id)?.name ?? ''
}
export const BABY_POKEMON_IDS = POKEDEX.filter((poke) => normalizeBabyEfficiencyPokemonId(poke.id) === poke.id && evolutionStages(poke.id)[0]?.[0]?.id === poke.id).map((poke) => poke.id)

export interface EfficiencyStyle extends EfficiencyReward {
  sleepType: SleepType
  special: boolean
  unlockStrength: number
  dpr: number
  belly?: boolean
  order?: number
  unlockRank?: number
  pokeId?: number
  lastRollExcluded?: boolean
  activityWeight?: number
  filler?: boolean
}
export interface EfficiencyIsland {
  id: IslandId
  name: string
  styles: EfficiencyStyle[]
  bands: { count: number, min: number }[]
}
export interface EfficiencySleep { score: number, sleepTypes: SleepType[] }
export interface EfficiencyInterval {
  min: number
  max: number | null
  islandId: IslandId
  island: string
  sleeps: EfficiencySleep[]
}
export interface EfficiencyOptimum { value: number, intervals: EfficiencyInterval[] }
export interface BabyEfficiencyResult {
  options: BabyEfficiencyOptions
  catch: EfficiencyOptimum
  candy: EfficiencyOptimum
  evaluatedStates: number
}
export interface EfficiencyProgress { percent: number, island: string, evaluatedStates: number }

export function validateBabyEfficiency(options: BabyEfficiencyOptions, checkAvailability = true): string | null {
  if (options.objective != null && options.objective !== 'catch' && options.objective !== 'candy') return '请选择有效的效率目标'
  if (options.completionTarget != null) {
    if (typeof options.completionTarget !== 'string' || (checkAvailability && completionStyleId(researchSleepStyles(SLEEP_STYLES, researchActivity(options.activity)), options.pokeId, options.completionTarget) == null)) return '请选择可参与普通研究的未收集睡姿'
    if (options.completionStatistic != null && options.completionStatistic !== 'expectation' && options.completionStatistic !== 'first-hit') return '请选择可参与普通研究的未收集睡姿'
  } else if (!BABY_POKEMON_IDS.includes(normalizeBabyEfficiencyPokemonId(options.pokeId))) return '请选择进化链的一阶段宝可梦'
  if (options.island != null && options.island !== 'all' && !(checkAvailability ? babyEfficiencyIslands(options.pokeId, options.completionTarget, options.activity, options.objective) : ISLANDS).some((island) => island.id === options.island)) return '请选择目标睡姿或宝可梦出没的岛屿'
  if (options.sleepType != null && options.sleepType !== 'all' && !EFFICIENCY_SLEEP_TYPES.includes(options.sleepType)) return '请选择有效的睡眠类型'
  if (options.campTicket != null && typeof options.campTicket !== 'boolean') return '请选择是否使用露营券'
  if (options.splitSleep != null && typeof options.splitSleep !== 'boolean') return '请选择是否拆分睡眠'
  if (options.precision === 'low' && (!Number.isInteger(options.iterations) || options.iterations < babyEfficiency_validateBabyEfficiency_ruleParameters.minIterations || options.iterations > babyEfficiency_validateBabyEfficiency_ruleParameters.maxIterations)) return '计算次数需为 100–100000 的整数'
  if (!Number.isFinite(options.eventMult) || options.eventMult <= 0 || options.eventMult > babyEfficiency_validateBabyEfficiency_ruleParameters.maxEventMultiplier) return '请选择有效的活动倍率'
  if (!babyEfficiency_config_ruleCatalogs.validateBabyEfficiencyList0.values.includes(options.eventMix)) return '请选择有效的跨睡眠类型模式'
  if (!babyEfficiency_config_ruleCatalogs.validateBabyEfficiencyList1.values.includes(options.precision)) return '请选择有效的搜索精度'
  return null
}

/** The saved sleepdex key selects a row; only the verified RAE ID identifies its draws. */
function completionStyleId(styles: readonly SleepStyleRow[], pokeId: number, key: string): number | undefined {
  const ids = new Set(styles.filter(style => !style.limited && style.pokeId === pokeId && styleKey(style.pokeId, style.stars, style.styleId) === key)
    .map(raeMappedSleepStyleId).filter(id => id != null))
  return ids.size === 1 ? ids.values().next().value : undefined
}

export function babyEfficiencyIslands(pokeId: number, completionTarget?: string, activity?: ResearchActivitySelection, objective?: BabyEfficiencyOptions['objective']) {
  const targets = babyEfficiencyTargetIds(pokeId)
  const family = familyOf(pokeId)
  const styles = researchSleepStyles(SLEEP_STYLES, researchActivity(activity))
  const internalId = completionTarget == null ? undefined : completionStyleId(styles, pokeId, completionTarget)
  const isTarget = (style: SleepStyleRow) => completionTarget != null ? internalId != null && raeMappedSleepStyleId(style) === internalId
    : objective === 'candy' ? familyOf(style.pokeId) === family : targets.includes(style.pokeId)
  return ISLANDS.filter(island => styles.some(style => !style.limited && style.island === island.id && isTarget(style)))
}

export function availableBabyPokemonIds(activity?: ResearchActivitySelection, objective?: BabyEfficiencyOptions['objective']) {
  const species = new Set(researchSleepStyles(SLEEP_STYLES, researchActivity(activity)).map(style => style.pokeId))
  if (objective === 'candy') {
    const families = new Set([...species].map(familyOf))
    return BABY_POKEMON_IDS.filter(id => families.has(familyOf(id)))
  }
  return BABY_POKEMON_IDS.filter(id => babyEfficiencyTargetIds(id).some(target => species.has(target)))
}

export function babyEfficiencySleepTypes(options: BabyEfficiencyOptions): SleepType[] {
  if (options.sleepType && options.sleepType !== 'all') return [options.sleepType]
  if (options.objective === 'candy' && options.completionTarget == null) return EFFICIENCY_SLEEP_TYPES
  if (normalizeEventMix(options.eventMix) !== 'off') return EFFICIENCY_SLEEP_TYPES
  const ownType = POKEDEX.find((poke) => poke.id === normalizeBabyEfficiencyPokemonId(options.pokeId))?.sleepType as SleepType
  return EFFICIENCY_SLEEP_TYPES.filter((type) => type === ownType || type === '没有特征')
}

export function efficiencyIslands(pokeId: number, completionTarget?: string, activity?: ResearchActivitySelection, objective?: BabyEfficiencyOptions['objective']): EfficiencyIsland[] {
  requireRaeSleepLottery()
  const targets = babyEfficiencyTargetIds(pokeId)
  const family = familyOf(pokeId)
  const context = researchActivity(activity)
  const eligibleStyles = researchSleepStyles(SLEEP_STYLES, context).filter(style => !style.limited)
  const internalId = completionTarget == null ? undefined : completionStyleId(eligibleStyles, pokeId, completionTarget)
  const rewardOf = (style: SleepStyleRow): EfficiencyReward => ({
    catch: Number(completionTarget == null ? targets.includes(style.pokeId) : internalId != null && raeMappedSleepStyleId(style) === internalId),
    candy: completionTarget == null && familyOf(style.pokeId) === family ? (sleepReward(style)?.candy ?? 0) : 0,
  })
  return ISLANDS.flatMap((island) => {
    const styles = eligibleStyles.filter((style) => style.island === island.id)
    if (!styles.some(style => objective === 'candy' && completionTarget == null ? familyOf(style.pokeId) === family : rewardOf(style).catch > 0)) return []
    const bands = ENCOUNTER_BANDS[island.band as keyof typeof ENCOUNTER_BANDS] ?? ENCOUNTER_BANDS.greengrass
    return [{
      id: island.id as IslandId,
      name: island.name,
      bands,
      styles: styles.map((style: SleepStyleRow) => ({
        ...rewardOf(style),
        pokeId: style.pokeId,
        unlockRank: styleUnlockIndex(island.id as IslandId, style),
        sleepType: style.sleepType as SleepType,
        special: SPECIAL_POKEMON.has(style.pokeId),
        unlockStrength: rankStrength(island.id as IslandId, RANK_ORDER[styleUnlockIndex(island.id as IslandId, style)]!),
        dpr: style.dpr,
        belly: style.styleName.includes('大肚'),
        order: sleepStyleInternalId(style),
        lastRollExcluded: isLastRollExcluded(style),
        filler: isRaeFiller(island.id, sleepStyleInternalId(style)),
      })),
    }]
  })
}

/** Correct boundary rounding using the same multiplication order as drowsyPower. */
export function activityEfficiencyIsland(island: EfficiencyIsland, context: ActivityContext, session = 0): EfficiencyIsland {
  const effects = (id?: number, research = session) => activityValues(context, island.id, POKEDEX.find(p => p.id === id), 240, undefined, research)
  return { ...island, styles: island.styles.map(style => ({
    ...style,
    firstCandyMultiplier: effects(style.pokeId, 0).researchCandyMultiplier,
    secondCandyMultiplier: effects(style.pokeId, 1).researchCandyMultiplier,
    activityWeight: effects(style.pokeId).encounterModifier,
  })) }
}

export function strengthForPower(power: number, score: number, mult: number): number {
  if (power <= 1) return 1
  let strength = Math.max(1, Math.ceil(power / (score * mult)))
  while ((score * strength) * mult < power) strength++
  while (strength > 1 && (score * (strength - 1)) * mult >= power) strength--
  return strength
}

interface CurveState { min: number, encounters: number, groups: EfficiencyStyle[] }

export function efficiencyCurve(island: EfficiencyIsland, score: number, mult: number): CurveState[] {
  const unlocks = island.styles.map(style => ({ style, at: Math.max(1, style.unlockStrength) })).sort((a, b) => a.at - b.at)
  const bands = island.bands.map(band => ({ count: band.count, at: strengthForPower(band.min, score, mult) }))
  const maxCount = Math.max(3, ...island.bands.map(band => band.count))
  const costs = [...new Set(island.styles.map(style => raeSpoCost(style.dpr) * RAE_SPO_RATE))]
  const budgetPoints = costs.flatMap(cost => Array.from({ length: maxCount }, (_, i) => strengthForPower(cost * (i + 1), score, mult)))
  const ceiling = Math.floor(MAX_EFFICIENCY_DROWSY_POWER / (score * mult))
  const starts = [...new Set([1, ceiling, ...budgetPoints, ...unlocks.map(row => row.at), ...bands.map(row => row.at)])]
    .filter(min => min <= ceiling).sort((a, b) => a - b)
  let unlocked = 0
  let snapshot: EfficiencyStyle[] = []
  return starts.map(min => {
    const previous = unlocked
    while (unlocked < unlocks.length && unlocks[unlocked]!.at <= min) unlocked++
    if (unlocked !== previous) snapshot = unlocks.slice(0, unlocked).map(row => row.style)
    const encounters = bands.reduce((n, band) => band.at <= min ? Math.max(n, band.count) : n, 3)
    return { min, encounters, groups: snapshot }
  })
}

const bucketCache = new WeakMap<EfficiencyStyle[], Map<string, EfficiencyBucket[]>>()
export function efficiencyDrawState(_island: EfficiencyIsland, state: CurveState, type: SleepType, eventMix: EventMix | boolean, power: number): EfficiencyDrawState {
  const mixed = normalizeEventMix(eventMix) !== 'off' && type !== '没有特征'
  const key = type + ':' + Number(mixed)
  let prepared = bucketCache.get(state.groups)
  if (!prepared) { prepared = new Map(); bucketCache.set(state.groups, prepared) }
  let buckets = prepared.get(key)
  if (!buckets) {
    buckets = state.groups.flatMap(style => {
      const typed = type === '没有特征' || type === style.sleepType
      return typed || mixed ? [{ ...style, typed, weight: style.activityWeight }] : []
    })
    prepared.set(key, buckets)
  }
  const maxSpo = Math.max(0, ...buckets.map(row => raeSpoCost(row.dpr))) * state.encounters
  return {
    buckets, power: Math.min(power, MAX_EFFICIENCY_DROWSY_POWER, maxSpo * RAE_SPO_RATE),
    encounters: state.encounters, otherSlots: mixed ? openSleepSlots(state.encounters, eventMix) : 0,
  }
}

/** Fixed single-session entry using the same pool and settings as the completion planner. */
export function inspectCompletionLottery(options: BabyEfficiencyOptions & { island: IslandId, sleepType: SleepType, completionTarget: string }, strength: number, score: number) {
  const context = researchActivity(options.activity)
  const base = efficiencyIslands(options.pokeId, options.completionTarget, context).find(row => row.id === options.island)
  if (!base) return undefined
  const effects = activityValues(context, base.id, undefined, 240, { drowsyPowerMultiplier: options.eventMult, eventMix: normalizeEventMix(options.eventMix) })
  const island = activityEfficiencyIsland(base, context)
  const rank = rankFromStrength(base.id, strength)
  const power = drowsyPower(score, strength, effects.drowsyPowerMultiplier)
  const encounters = encounterCount(base.id, power)
  const groups = island.styles.filter(row => row.unlockStrength <= strength)
  const state = efficiencyDrawState(island, { min: strength, encounters, groups }, options.sleepType, effects.eventMix, power)
  const query = prepareEfficiencyLottery({ ...state, power, campTicket: options.campTicket })
  return { rank, power, query }
}

function stateAt(curve: CurveState[], strength: number): CurveState {
  let low = 0
  let high = curve.length - 1
  while (low < high) {
    const middle = Math.ceil((low + high) / 2)
    if (curve[middle]!.min <= strength) low = middle
    else high = middle - 1
  }
  return curve[low]!
}

function mergeIntervals(intervals: EfficiencyInterval[]): EfficiencyInterval[] {
  const byPlan = new Map<string, EfficiencyInterval[]>()
  for (const interval of intervals) {
    const key = JSON.stringify([interval.islandId, interval.sleeps])
    const rows = byPlan.get(key) ?? []
    rows.push(interval)
    byPlan.set(key, rows)
  }
  const merged: EfficiencyInterval[] = []
  for (const rows of byPlan.values()) {
    rows.sort((a, b) => a.min - b.min)
    for (const row of rows) {
      const last = merged[merged.length - 1]
      if (last && last.islandId === row.islandId && JSON.stringify(last.sleeps) === JSON.stringify(row.sleeps)
        && (last.max === null || row.min <= last.max + 1)) {
        last.max = last.max === null || row.max === null ? null : Math.max(last.max, row.max)
      } else merged.push({ ...row })
    }
  }
  return merged.sort((a, b) => a.min - b.min || a.islandId.localeCompare(b.islandId) || a.sleeps[0]!.score - b.sleeps[0]!.score)
}

interface SplitLeaders { catch: { value: number, splits: number[] }, candy: { value: number, splits: number[] } }
export const BABY_EFFICIENCY_CHECKPOINT_VERSION = 11
export interface BabyEfficiencyCheckpoint {
  version: typeof BABY_EFFICIENCY_CHECKPOINT_VERSION
  /** 捕捉目标组；用于丢弃南瓜精合并前的旧续算结果。 */
  targetPokeIds?: readonly number[]
  options: BabyEfficiencyOptions
  islandIndex: number
  splitIndex: number
  leaders: SplitLeaders
  best: { catch: EfficiencyOptimum, candy: EfficiencyOptimum }
  evaluatedStates: number
}
const emptyLeaders = (): SplitLeaders => ({ catch: { value: -1, splits: [] }, candy: { value: -1, splits: [] } })

function compareEfficiency(a: number, b: number): number {
  const difference = a - b
  return Math.abs(difference) <= 1e-12 * Math.max(Math.abs(a), Math.abs(b)) ? 0 : difference
}

/** A checkpoint completes one split search; interrupted splits are safely repeated. */
export function* babyEfficiencySteps(
  options: BabyEfficiencyOptions,
  onProgress: (progress: EfficiencyProgress) => void = () => {},
  islands?: EfficiencyIsland[],
  checkpoint?: BabyEfficiencyCheckpoint,
): Generator<BabyEfficiencyCheckpoint, BabyEfficiencyResult> {
  const availability = researchActivity(options.activity ?? checkpoint?.options.activity, options.activity?.pendingPokemon ?? pendingResearchPokemon())
  if (checkpoint && checkpoint.version !== BABY_EFFICIENCY_CHECKPOINT_VERSION) throw new Error('续算规则或参数与检查点不一致，请重新计算')
  if (checkpoint && !sameResearchAvailability(checkpoint.options.activity, availability)) checkpoint = undefined
  options = { ...options, activity: availability }
  islands ??= efficiencyIslands(options.pokeId, options.completionTarget, options.activity, options.objective)
  const completion = options.completionTarget != null
  const firstHit = completion && options.completionStatistic !== 'expectation'
  const goals: readonly ('catch' | 'candy')[] = completion ? ['catch'] : options.objective ? [options.objective] : ['catch', 'candy']
  options = { ...options, pokeId: completion ? options.pokeId : normalizeBabyEfficiencyPokemonId(options.pokeId) }
  const targetPokeIds = babyEfficiencyTargetIds(options.pokeId)
  if (!completion && options.pokeId === 710 && JSON.stringify(checkpoint?.targetPokeIds) !== JSON.stringify(targetPokeIds)) checkpoint = undefined
  const error = validateBabyEfficiency(options)
  if (error) throw new Error(error)
  const iterations = options.precision === 'low' ? options.iterations : 1
  if (checkpoint && JSON.stringify(checkpoint.options) !== JSON.stringify(options)) throw new Error('续算规则或参数与检查点不一致，请重新计算')
  islands = islands.filter((island) => !options.island || options.island === 'all' || island.id === options.island)
  if (!islands.length) throw new Error('资料未收录这个家族可参与普通研究的睡姿')
  const cache = new Map<string, EfficiencySimulation>()
  const drawStateKey = createDrawStateKey()
  const best = checkpoint?.best ?? { catch: { value: 0, intervals: [] as EfficiencyInterval[] }, candy: { value: 0, intervals: [] as EfficiencyInterval[] } }
  const step = options.precision === 'low' ? (babyEfficiency_babyEfficiencySteps_runtimeParameters.p001 as 10) : options.precision === 'medium' ? (babyEfficiency_babyEfficiencySteps_runtimeParameters.p002 as 5) : 1
  const stride = options.precision === 'low' ? (babyEfficiency_babyEfficiencySteps_runtimeParameters.p003 as 8) : options.precision === 'medium' ? 2 : 1
  const baseSplits = options.splitSleep !== false ? Array.from({ length: Math.floor((babyEfficiency_babyEfficiencySteps_runtimeParameters.p004 as 99) / step) }, (_, index) => (index + 1) * step) : babyEfficiency_config_ruleCatalogs.babyEfficiencyStepsList2.values
  // 补齐同时比较整觉和拆觉；原宝宝效率保持原有拆觉开关含义。
  if (completion && options.splitSleep !== false) baseSplits.push((babyEfficiency_babyEfficiencySteps_runtimeParameters.p005 as 100))
  const initialStates = checkpoint?.evaluatedStates ?? 0
  const completedStates = () => initialStates + cache.size
  let progressTime = 0
  let progressPercent = 0
  const update = (percent: number, island: string, force = false) => {
    if (!force && Date.now() - progressTime < (babyEfficiency_babyEfficiencySteps_runtimeParameters.p006 as 100)) return
    progressTime = Date.now()
    progressPercent = Math.max(progressPercent, percent)
    onProgress({ percent: progressPercent, island, evaluatedStates: completedStates() })
  }

  const baseOptions = options
  for (const [islandIndex, originalIsland] of islands.entries()) {
    const context = baseOptions.activity as ActivityContext
    const effects = activityValues(context, originalIsland.id, undefined, (babyEfficiency_babyEfficiencySteps_runtimeParameters.p007 as 240), { drowsyPowerMultiplier: baseOptions.eventMult, eventMix: normalizeEventMix(baseOptions.eventMix) })
    const options = { ...baseOptions, eventMult: effects.drowsyPowerMultiplier, eventMix: effects.eventMix }
    const island = activityEfficiencyIsland(originalIsland, context)
    const secondIsland = activityEfficiencyIsland(originalIsland, context, 1)
    if (islandIndex < (checkpoint?.islandIndex ?? 0)) continue
    const resumeIndex = islandIndex === checkpoint?.islandIndex ? checkpoint.splitIndex : 0
    update(islandIndex / islands.length * 100, island.name, true)
    const curves = new Map<number, CurveState[]>()
    const curveOf = (score: number, second = false) => {
      const key = second ? -score : score
      if (!curves.has(key)) curves.set(key, efficiencyCurve(second ? secondIsland : island, score, options.eventMult))
      return curves.get(key)!
    }
    const sessionCache = new Map<string, { catch: { value: number, types: SleepType[] }, candy: { value: number, types: SleepType[] } }>()
    const sessionAt = (score: number, min: number, researchedBefore = 0) => {
      const state = stateAt(curveOf(score, researchedBefore > 0), min)
      const sessionKey = `${score}:${min}:${researchedBefore}`
      const known = sessionCache.get(sessionKey)
      if (known) return known
      const result = { catch: { value: -1, types: [] as SleepType[] }, candy: { value: -1, types: [] as SleepType[] } }
      for (const type of babyEfficiencySleepTypes(options)) {
        const draw = efficiencyDrawState(island, state, type, options.eventMix, score * min * options.eventMult)
        draw.campTicket = !!options.campTicket && researchedBefore === 0
        const key = drawStateKey(draw)
        let metric = cache.get(key)
        if (!metric) {
          metric = simulateEfficiencySlots(draw, iterations, efficiencyRandom(42), options.precision, firstHit ? 'first-hit' : 'expectation')
          cache.set(key, metric)
        }
        const rewards = efficiencyRewardsAfterResearch(metric, researchedBefore)
        if (firstHit) rewards.catch = metric.hitRuns
        for (const goal of goals) {
          const comparison = compareEfficiency(rewards[goal], result[goal].value)
          if (comparison > 0) result[goal] = { value: rewards[goal], types: [type] }
          else if (comparison === 0) result[goal].types.push(type)
        }
      }
      sessionCache.set(sessionKey, result)
      return result
    }
    const scanSplit = (first: number, position: number, total: number) => {
      const second = first === (babyEfficiency_babyEfficiencySteps_runtimeParameters.p008 as 100) ? 0 : (babyEfficiency_babyEfficiencySteps_runtimeParameters.p009 as 100) - first
      const curvesToMerge = second ? [curveOf(first), curveOf(second)] : [curveOf(first)]
      const ceiling = Math.floor(MAX_EFFICIENCY_DROWSY_POWER / (Math.max(first, second) * options.eventMult))
      const starts = [...new Set([ceiling, ...curvesToMerge.flatMap((curve) => curve.map((state) => state.min))])].filter(min => min <= ceiling).sort((a, b) => a - b)
      const smallestScore = second ? Math.min(first, second) : first
      const maxCount = Math.max(3, ...island.bands.map(band => band.count))
      const stableFrom = Math.max(1, ...island.styles.map(style => Math.max(style.unlockStrength, strengthForPower(raeSpoCost(style.dpr) * RAE_SPO_RATE * maxCount, smallestScore, options.eventMult))), ...island.bands.map(band => strengthForPower(band.min, smallestScore, options.eventMult)))
      const checked = new Set<number>()
      const values = new Map<number, EfficiencyReward>()
      const leaders = { catch: { value: -1, indexes: [] as number[] }, candy: { value: -1, indexes: [] as number[] } }
      const evaluate = (index: number) => {
        if (index < 0 || index >= starts.length) return
        if (checked.has(index)) return values.get(index)
        checked.add(index)
        const min = starts[index]!
        // Budget depletion can change within unlock intervals. Only report sampled
        // energies, including the finite per-sleep 5-billion-power search ceiling.
        const max = min >= stableFrom ? ceiling : min
        const a = sessionAt(first, min)
        const b = second ? sessionAt(second, min, stateAt(curveOf(first), min).encounters + Number(!!options.campTicket)) : null
        const totals = { catch: a.catch.value + (b?.catch.value ?? 0) - (firstHit && b ? a.catch.value * b.catch.value / iterations : 0), candy: a.candy.value + (b?.candy.value ?? 0) }
        values.set(index, totals)
        for (const goal of goals) {
          const value = totals[goal]
          const local = compareEfficiency(value, leaders[goal].value)
          if (local > 0) leaders[goal] = { value, indexes: [index] }
          else if (local === 0) leaders[goal].indexes.push(index)
          const global = compareEfficiency(value, best[goal].value)
          if (value <= 0 || global < 0) continue
          if (global > 0) best[goal] = { value, intervals: [] }
          best[goal].intervals.push({
            min, max, islandId: island.id, island: island.name,
            sleeps: [{ score: first, sleepTypes: a[goal].types }, ...(b ? [{ score: second, sleepTypes: b[goal].types }] : [])],
          })
        }
        update((islandIndex + (position + checked.size / starts.length) / total) / islands.length * 100, island.name)
        return totals
      }
      for (let index = 0; index < starts.length; index += stride) evaluate(index)
      evaluate(starts.length - 1)
      if (options.precision === 'medium') {
        const neighbors = goals.flatMap(goal => leaders[goal].indexes).flatMap((index) => [index - 1, index + 1])
        for (const index of neighbors) evaluate(index)
      }
      if (options.precision !== 'high') {
        // Complete the contiguous plateau for every coarse winner, including skipped segments.
        const queue = goals.flatMap(goal => leaders[goal].indexes)
        const expanded = new Set<number>()
        for (let cursor = 0; cursor < queue.length; cursor++) {
          const index = queue[cursor]!
          if (expanded.has(index)) continue
          expanded.add(index)
          const current = values.get(index)!
          if (!goals.some(goal => current[goal] > 0 && compareEfficiency(current[goal], leaders[goal].value) === 0)) continue
          for (const neighbor of [index - 1, index + 1]) {
            const metric = evaluate(neighbor)
            if (metric && goals.some(goal => metric[goal] > 0 && compareEfficiency(metric[goal], leaders[goal].value) === 0)) queue.push(neighbor)
          }
        }
      }
      return leaders
    }
    const localLeaders = islandIndex === checkpoint?.islandIndex ? checkpoint.leaders : emptyLeaders()
    const save = (splitIndex: number): BabyEfficiencyCheckpoint => ({ version: BABY_EFFICIENCY_CHECKPOINT_VERSION, targetPokeIds, options: { ...baseOptions }, islandIndex, splitIndex, leaders: localLeaders, best, evaluatedStates: completedStates() })
    for (const [index, split] of baseSplits.entries()) {
      if (index < resumeIndex) continue
      const leaders = scanSplit(split, index, baseSplits.length + (options.precision === 'medium' ? (babyEfficiency_babyEfficiencySteps_runtimeParameters.p011 as 4) : 0))
      for (const goal of goals) {
        const comparison = compareEfficiency(leaders[goal].value, localLeaders[goal].value)
        if (comparison > 0) localLeaders[goal] = { value: leaders[goal].value, splits: [split] }
        else if (comparison === 0) localLeaders[goal].splits.push(split)
      }
      yield save(index + 1)
    }
    if (options.precision === 'medium' && options.splitSleep !== false) {
      const extra = [...new Set(goals.flatMap(goal => localLeaders[goal].splits)
        .flatMap((score) => [score - 1, score + 1]).filter((score) => score >= 1 && score <= (babyEfficiency_babyEfficiencySteps_runtimeParameters.p012 as 99) && !baseSplits.includes(score)))]
      for (const [index, split] of extra.entries()) {
        if (baseSplits.length + index < resumeIndex) continue
        scanSplit(split, baseSplits.length + index, baseSplits.length + extra.length)
        yield save(baseSplits.length + index + 1)
      }
    }
    update((islandIndex + 1) / islands.length * 100, island.name, true)
    yield { ...save(0), islandIndex: islandIndex + 1, leaders: emptyLeaders() }
  }
  return {
    options: { ...options },
    catch: { value: best.catch.value / iterations, intervals: mergeIntervals(best.catch.intervals) },
    candy: { value: best.candy.value / iterations, intervals: mergeIntervals(best.candy.intervals) },
    evaluatedStates: completedStates(),
  }
}

/** Synchronous adapter for browsers and deterministic algorithm tests. */
export function searchBabyEfficiency(options: BabyEfficiencyOptions, onProgress: (progress: EfficiencyProgress) => void = () => {}, islands?: EfficiencyIsland[]): BabyEfficiencyResult {
  const steps = babyEfficiencySteps(options, onProgress, islands)
  let next = steps.next()
  while (!next.done) next = steps.next()
  return next.value
}
