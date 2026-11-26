import runtimeParameters from '../data/runtime-parameters.resource'
import ruleCatalogs from '../data/rule-catalogs.resource'
import ruleParameters from '../data/rule-parameters.resource'
import clientFactoryDefaults from '../data/client-defaults.resource'
import { cloneData } from './dataClone'
import { researchActivity, researchSleepStyles, activityValues, type ResearchActivitySelection } from './activities'
import { pendingResearchPokemon } from './researchAvailability'
import { activityEfficiencyIsland } from './babyEfficiency'
import type { IslandId, SleepType } from '../types'
import { ISLANDS, SLEEP_STYLES, type SleepStyleRow } from './data'
import { familyOf } from './candyPlan'
import { BABY_POKEMON_IDS, babyEfficiencyIslands, babyEfficiencyPokemonName, efficiencyCurve, efficiencyDrawState, efficiencyIslands, EFFICIENCY_SLEEP_TYPES, MAX_EFFICIENCY_DROWSY_POWER, normalizeBabyEfficiencyPokemonId, type EfficiencyIsland, type EfficiencyPrecision } from './babyEfficiency'
import { createDrawStateKey, efficiencyRandom, efficiencyRewardsAfterResearch, simulateEfficiencySlots, type EfficiencySimulation } from './babyEfficiencyDraw'
import { drowsyPower, encounterCount, rankStrength, RANK_ORDER, styleUnlockIndex } from './sleep'
import { raeSleepStyleId, resolveSleepStyleRef, type SleepStyleRef } from './sleepStyleIdentity'
import { normalizeEventMix, type EventMix } from './sleepRules'
const factory_splitSleep_config_clientFactoryDefaults = clientFactoryDefaults.modules.factory_splitSleep
const splitSleep_config_ruleCatalogs = ruleCatalogs.modules.splitSleep
const splitSleep_normalizeSplitOptions_ruleParameters = ruleParameters.modules.splitSleep.normalizeSplitOptions
const splitSleep_validateSplitOptions_ruleParameters = ruleParameters.modules.splitSleep.validateSplitOptions
const splitSleep_splitSleepSteps_runtimeParameters = runtimeParameters.modules.splitSleep.splitSleepSteps.values


export interface SplitTarget {
  kind: 'baby' | 'catch' | 'candy' | 'style'
  pokeId: number
  style: SleepStyleRef
  countWeight: number
  candyWeight: number
  probabilityWeight: number
  statistic?: 'expectation' | 'first-hit'
}
export interface SplitOptions {
  campTicket?: boolean
  activity?: ResearchActivitySelection
  island: IslandId
  strength: number
  targets: SplitTarget[]
  sleepType: SleepType | 'all'
  eventMult: number
  eventMix: EventMix | boolean
  iterations: number
  precision?: EfficiencyPrecision
}
export const newSplitTarget = (kind: SplitTarget['kind'], pokeId: number, style: SleepStyleRef = ''): SplitTarget => ({ kind, pokeId, style: resolveSleepStyleRef(style) ?? style, ...cloneData(clientFactoryDefaults.modules.factory_splitSleep.newSplitTarget) })
export function defaultSplitOptions(): SplitOptions {
  const options = cloneData(factory_splitSleep_config_clientFactoryDefaults["defaultSplitOptions"]) as unknown as SplitOptions
  return { ...options, precision: options.precision ?? 'low' }
}
export const splitTargetKey = (target: SplitTarget) => target.kind === 'style' ? `style:${resolveSleepStyleRef(target.style) ?? target.style}`
  : `${target.kind}:${target.kind === 'candy' ? familyOf(target.pokeId) : normalizeBabyEfficiencyPokemonId(target.pokeId)}`
export function splitTargetStatus(target: SplitTarget, island: IslandId, strength: number, activity?: ResearchActivitySelection) {
  const internalId = target.kind === 'style' ? resolveSleepStyleRef(target.style) : undefined
  const matches = (row: SleepStyleRow) => !row.limited && row.pokeId === target.pokeId && raeSleepStyleId(row) === internalId
  const style = internalId == null ? undefined : researchSleepStyles(SLEEP_STYLES, researchActivity(activity)).find(row => row.island === island && matches(row))
  const available = target.kind === 'style' ? !!style
    : babyEfficiencyIslands(target.pokeId, undefined, activity, target.kind === 'candy' ? 'candy' : 'catch').some(row => row.id === island)
  const unlockStrength = style ? rankStrength(island, RANK_ORDER[styleUnlockIndex(island, style)]!) : null
  const unlocked = available && (target.kind !== 'style' || (unlockStrength != null && strength >= unlockStrength))
  const namedStyle = style ?? (internalId == null ? undefined : SLEEP_STYLES.find(matches))
  const label = target.kind !== 'style' ? babyEfficiencyPokemonName(target.pokeId) : namedStyle ? `${namedStyle.name} ${namedStyle.stars}★ ${namedStyle.styleName}` : String(target.style)
  const reason = !available ? '当前岛屿无此普通研究目标，请更换岛屿或移除目标' : !unlocked ? `未达到解锁能量 ${unlockStrength!.toLocaleString('zh-CN')}，当前权重为 0` : ''
  return { label, namedStyle, available, unlocked, unlockStrength, reason }
}
function validTarget(target: SplitTarget): boolean {
  if (!target || !['baby', 'catch', 'candy', 'style'].includes(target.kind)) return false
  if (![target.countWeight, target.candyWeight, target.probabilityWeight].every(n => Number.isFinite(n) && n >= 0)) return false
  if (target.statistic != null && !['expectation', 'first-hit'].includes(target.statistic)) return false
  return target.kind !== 'style' ? BABY_POKEMON_IDS.includes(normalizeBabyEfficiencyPokemonId(target.pokeId))
    : Number.isSafeInteger(target.pokeId) && target.pokeId > 0 && (typeof target.style === 'string' ? target.style.length > 0 : resolveSleepStyleRef(target.style) != null)
}
/** Preserve valid saved preferences without carrying corrupt data into a worker. */
export function normalizeSplitOptions(saved?: Partial<SplitOptions> | null): SplitOptions {
  const value = { ...defaultSplitOptions(), ...saved }
  if (!ISLANDS.some(row => row.id === value.island)) value.island = 'greengrass'
  if (!Number.isSafeInteger(value.strength) || value.strength < 0) value.strength = 0
  if (value.sleepType !== 'all' && !EFFICIENCY_SLEEP_TYPES.includes(value.sleepType)) value.sleepType = 'all'
  if (!Number.isFinite(value.eventMult) || value.eventMult <= 0 || value.eventMult > splitSleep_normalizeSplitOptions_ruleParameters.maxEventMultiplier) value.eventMult = 1
  if (!splitSleep_config_ruleCatalogs.normalizeSplitOptionsList0.values.includes(value.eventMix)) value.eventMix = false
  if (!Number.isInteger(value.iterations) || value.iterations < splitSleep_normalizeSplitOptions_ruleParameters.minIterations || value.iterations > splitSleep_normalizeSplitOptions_ruleParameters.maxIterations) value.iterations = splitSleep_normalizeSplitOptions_ruleParameters.defaultIterations
  if (value.campTicket != null && typeof value.campTicket !== 'boolean') value.campTicket = false
  if (value.precision == null || !['low', 'medium', 'high'].includes(value.precision)) value.precision = defaultSplitOptions().precision
  const seen = new Set<string>()
  value.targets = (Array.isArray(saved?.targets) ? saved.targets : []).filter(validTarget).flatMap((target): SplitTarget[] => {
    if (target.kind === 'style') return [{ ...target, style: resolveSleepStyleRef(target.style) ?? target.style }]
    const normalized = { ...target, pokeId: normalizeBabyEfficiencyPokemonId(target.pokeId) }
    if (normalized.kind !== 'baby') return [normalized]
    return [{ ...normalized, kind: 'catch' }, { ...normalized, kind: 'candy' }]
  }).filter(target => {
    const key = splitTargetKey(target)
    if (seen.has(key)) return false
    seen.add(key); return true
  })
  return value
}
export type SplitMetricKind = 'count' | 'candy' | 'probability'
export interface SplitMetric { targetIndex: number, kind: SplitMetricKind, label: string, weight: number }
export function splitMetrics(options: SplitOptions): SplitMetric[] {
  return options.targets.flatMap<SplitMetric>((target, targetIndex) => {
    const status = splitTargetStatus(target, options.island, options.strength, options.activity)
    if (target.kind === 'style') return [{ targetIndex, kind: target.statistic === 'expectation' ? 'count' : 'probability', label: status.label, weight: status.unlocked ? target.probabilityWeight : 0 }]
    const count = { targetIndex, kind: 'count' as const, label: `${status.label} · 只数`, weight: target.countWeight }
    const candy = { targetIndex, kind: 'candy' as const, label: `${status.label} · 家族糖果`, weight: target.candyWeight }
    return target.kind === 'catch' ? [count] : target.kind === 'candy' ? [candy] : [count, candy]
  })
}
export function validateSplitOptions(options: SplitOptions): string | null {
  if (options.campTicket != null && typeof options.campTicket !== 'boolean') return '请选择是否使用露营券'
  if (options.precision != null && !['low', 'medium', 'high'].includes(options.precision)) return '请选择计算精度'
  if (!ISLANDS.some(row => row.id === options.island)) return '请选择有效岛屿'
  if (!Number.isSafeInteger(options.strength) || options.strength < 0) return '卡比兽能量需为非负安全整数'
  if (!Array.isArray(options.targets) || !options.targets.length || options.targets.some(target => !validTarget(target))) return '请添加有效目标，权重需为非负有限数'
  if (new Set(options.targets.map(splitTargetKey)).size !== options.targets.length) return '请移除重复目标'
  if (options.targets.some(target => !splitTargetStatus(target, options.island, options.strength, options.activity).available)) return '存在当前岛屿不适用的目标，请更换岛屿或移除目标'
  if (options.sleepType !== 'all' && !EFFICIENCY_SLEEP_TYPES.includes(options.sleepType)) return '请选择有效睡眠类型'
  if ((!Number.isFinite(options.eventMult) || options.eventMult <= 0 || options.eventMult > splitSleep_validateSplitOptions_ruleParameters.maxEventMultiplier) || !splitSleep_config_ruleCatalogs.validateSplitOptionsList0.values.includes(options.eventMix)) return '请选择有效活动设置'
  if ((options.precision ?? 'low') === 'low' && (!Number.isInteger(options.iterations) || options.iterations < splitSleep_validateSplitOptions_ruleParameters.minIterations || options.iterations > splitSleep_validateSplitOptions_ruleParameters.maxIterations)) return '模拟次数需为 100–100000 的整数'
  if (drowsyPower(splitSleep_validateSplitOptions_ruleParameters.minIterations, options.strength, options.eventMult) > MAX_EFFICIENCY_DROWSY_POWER) return '整觉睡意之力超过 50 亿，请降低能量或活动倍率'
  if (!splitMetrics(options).some(metric => metric.weight > 0)) return '所有指标的有效权重均为 0，请调整能量、目标或权重'
  return null
}
export interface SplitSleep { score: number, sleepType: SleepType, power: number, encounters: number }
export interface SplitCandidate { sleeps: SplitSleep[], values: number[], score: number | null }
export interface SplitOptimum { value: number, indices: number[] }
export interface SplitResult {
  options: SplitOptions
  metrics: SplitMetric[]
  maxima: number[]
  candidates: SplitCandidate[]
  combined: SplitOptimum
  whole: SplitOptimum
  individual: SplitOptimum[]
}
interface SessionMetric { count: number, probability: number, candies: number[] }
interface Session extends SessionMetric { second: SessionMetric, camp?: SessionMetric }
export const SPLIT_CHECKPOINT_VERSION = 8
export interface SplitCheckpoint { version: typeof SPLIT_CHECKPOINT_VERSION, signature: string, pendingPokemon?: number[], completed: number, sessions: Session[][] }
export interface SplitRequest { splitOptions: SplitOptions, checkpoint?: SplitCheckpoint }
export type SplitMessage = { type: 'checkpoint', checkpoint: SplitCheckpoint } | { type: 'progress', completed: number, total: number } | { type: 'result', result: SplitResult } | { type: 'error', message: string }
export function splitScore(values: number[], maxima: number[], metrics: SplitMetric[]): number | null {
  // Normalize weights before summing to avoid overflow for large, finite user inputs.
  const scale = Math.max(0, ...metrics.map((metric, i) => maxima[i]! > 0 ? metric.weight : 0))
  if (!scale) return null
  let sum = 0, weights = 0
  metrics.forEach((metric, i) => {
    if (maxima[i]! <= 0 || metric.weight <= 0) return
    const weight = metric.weight / scale
    sum += weight * values[i]! / maxima[i]!; weights += weight
  })
  return weights ? sum / weights : null
}
export function splitOptimum(values: (number | null)[]): SplitOptimum {
  let value = 0
  for (const next of values) if (next != null && next > value) value = next
  return { value, indices: value > 0 ? values.flatMap((next, index) => next != null && Math.abs(next - value) < 1e-12 ? [index] : []) : [] }
}
/** Fixed energy uses the same unlocked pool as the existing efficiency panel. */
function fixedPool(island: EfficiencyIsland, strength: number, mult: number) {
  const curve = efficiencyCurve(island, 1, mult)
  let index = 0
  while (index + 1 < curve.length && curve[index + 1]!.min <= Math.max(1, strength)) index++
  return curve[index]!
}
/** User-approved 100-score search; DPR/rewards stay in the existing shared model. */
export function* splitSleepSteps(request: SplitRequest): Generator<SplitCheckpoint, SplitResult> {
  const context = researchActivity(request.splitOptions.activity, pendingResearchPokemon())
  const effects = activityValues(context, request.splitOptions.island, undefined, (splitSleep_splitSleepSteps_runtimeParameters.p001 as 240), { drowsyPowerMultiplier: request.splitOptions.eventMult, eventMix: normalizeEventMix(request.splitOptions.eventMix) })
  const options: SplitOptions = { ...JSON.parse(JSON.stringify(request.splitOptions)), activity: context, eventMult: effects.drowsyPowerMultiplier, eventMix: effects.eventMix }
  const error = validateSplitOptions(options)
  if (error) throw new Error(error)
  options.targets = options.targets.map(target => target.kind === 'style' ? { ...target, style: resolveSleepStyleRef(target.style) ?? target.style } : target)
  const precision = options.precision ?? 'low'
  const iterations = precision === 'low' ? options.iterations : 1
  const signature = JSON.stringify({ ...options, activity: { ...context, pendingPokemon: undefined } }) + (options.campTicket ? ":camp-v1" : "")
  let checkpoint = request.checkpoint
  if (checkpoint && (checkpoint.version !== SPLIT_CHECKPOINT_VERSION || checkpoint.signature !== signature)) throw new Error('拆觉规则或参数已变化，请重新计算')
  if (checkpoint && JSON.stringify(checkpoint.pendingPokemon) !== JSON.stringify(context.pendingPokemon)) checkpoint = undefined
  const types = options.sleepType === 'all' ? EFFICIENCY_SLEEP_TYPES : [options.sleepType]
  const total = options.targets.length * 100 * types.length
  if (checkpoint && (!Number.isInteger(checkpoint.completed) || checkpoint.completed < 0 || checkpoint.completed > total || checkpoint.sessions.length !== options.targets.length)) throw new Error('拆觉检查点无效，请重新计算')
  const sessions: Session[][] = checkpoint ? JSON.parse(JSON.stringify(checkpoint.sessions)) : options.targets.map(() => [])
  let completed = checkpoint?.completed ?? 0
  const precedingCounts = options.campTicket ? 10 : 9
  const validSession = (session?: SessionMetric) => Boolean(session && Number.isFinite(session.count) && session.count >= 0
    && Number.isFinite(session.probability) && session.probability >= 0 && session.probability <= 1
    && Array.isArray(session.candies) && session.candies.length === precedingCounts
    && session.candies.every(value => Number.isFinite(value) && value >= 0))
  if (checkpoint) {
    for (let i = 0; i < completed; i++) {
      const session = sessions[Math.floor(i / (100 * types.length))]?.[i % (100 * types.length)]
      if (!session || !validSession(session) || !validSession(session.second) || (options.campTicket && !validSession(session.camp))) {
        throw new Error('拆觉检查点无效，请重新计算')
      }
    }
  }
  for (const [targetIndex, target] of options.targets.entries()) {
    const end = (targetIndex + 1) * 100 * types.length
    if (completed >= end) continue
    const status = splitTargetStatus(target, options.island, options.strength, context)
    const base = efficiencyIslands(target.pokeId, target.kind === 'style' ? target.style : undefined, context, target.kind === 'candy' ? 'candy' : undefined).find(row => row.id === options.island)!
    const statistic = target.kind === 'style' && target.statistic !== 'expectation' ? 'first-hit' : 'expectation'
    const island = activityEfficiencyIsland(base, context)
    const secondIsland = activityEfficiencyIsland(base, context, 1)
    const pool = fixedPool(island, options.strength, options.eventMult)
    const secondPool = fixedPool(secondIsland, options.strength, options.eventMult)
    const keyOf = createDrawStateKey(), cache = new Map<string, EfficiencySimulation>()
    for (let score = 1; score <= (splitSleep_splitSleepSteps_runtimeParameters.p003 as 100); score++) {
      for (const [typeIndex, type] of types.entries()) {
        const offset = (score - 1) * types.length + typeIndex
        if (targetIndex * 100 * types.length + offset < completed) continue
        const power = drowsyPower(score, options.strength, options.eventMult)
        const encounters = encounterCount(options.island, power)
        const simulate = (campTicket: boolean, second = false): SessionMetric => {
          const draw = efficiencyDrawState(second ? secondIsland : island, { ...(second ? secondPool : pool), encounters }, type, options.eventMix, power)
          draw.campTicket = campTicket
          const key = keyOf(draw)
          let simulation = cache.get(key)
          if (!simulation && status.unlocked) {
            simulation = simulateEfficiencySlots(draw, iterations, efficiencyRandom(42), precision, statistic); cache.set(key, simulation)
          }
          return simulation ? {
            count: simulation.catch / iterations,
            probability: simulation.hitRuns / iterations,
            candies: Array.from({ length: precedingCounts }, (_, before) => efficiencyRewardsAfterResearch(simulation!, before).candy / iterations),
          } : { count: 0, probability: 0, candies: Array(precedingCounts).fill(0) }
        }
        const session: Session = { ...simulate(false), second: simulate(false, true) }
        if (options.campTicket) session.camp = simulate(true)
        sessions[targetIndex]![offset] = session
        completed++
      }
      yield { version: SPLIT_CHECKPOINT_VERSION, signature, pendingPokemon: context.pendingPokemon, completed, sessions }
    }
  }
  const metrics = splitMetrics(options), candidates: SplitCandidate[] = []
  const sleep = (score: number, sleepType: SleepType): SplitSleep => {
    const power = drowsyPower(score, options.strength, options.eventMult)
    return { score, sleepType, power, encounters: encounterCount(options.island, power) }
  }
  const add = (first: number, firstType: number, secondType?: number) => {
    const sleeps = [sleep(first, types[firstType]!)]
    if (secondType != null) sleeps.push(sleep((splitSleep_splitSleepSteps_runtimeParameters.p006 as 100) - first, types[secondType]!))
    const values = metrics.map(metric => {
      const rows = sessions[metric.targetIndex]!
      const normalFirst = rows[(first - 1) * types.length + firstType]!
      const a = options.campTicket ? normalFirst.camp! : normalFirst
      const b = secondType == null ? null : rows[((splitSleep_splitSleepSteps_runtimeParameters.p007 as 99) - first) * types.length + secondType]?.second
      if (!a || (secondType != null && !b)) throw new Error('拆觉检查点缺少研究结果，请重新计算')
      if (metric.kind === 'count') return a.count + (b?.count ?? 0)
      if (metric.kind === 'probability') return b ? 1 - (1 - a.probability) * (1 - b.probability) : a.probability
      return a.candies[0]! + (b?.candies[sleeps[0]!.encounters + Number(!!options.campTicket)] ?? 0)
    })
    candidates.push({ sleeps, values, score: null })
  }
  for (let a = 1; a <= (splitSleep_splitSleepSteps_runtimeParameters.p008 as 100); a++) for (let ta = 0; ta < types.length; ta++) {
    if (a === (splitSleep_splitSleepSteps_runtimeParameters.p009 as 100)) add(a, ta)
    else for (let tb = 0; tb < types.length; tb++) add(a, ta, tb)
  }
  const individual = metrics.map((metric, index) => options.targets[metric.targetIndex]!.kind === 'style' && !splitTargetStatus(options.targets[metric.targetIndex]!, options.island, options.strength, options.activity).unlocked
    ? { value: 0, indices: [] } : splitOptimum(candidates.map(candidate => candidate.values[index]!)))
  const maxima = individual.map(optimum => optimum.value)
  for (const candidate of candidates) candidate.score = splitScore(candidate.values, maxima, metrics)
  return { options, metrics, maxima, candidates, individual, combined: splitOptimum(candidates.map(candidate => candidate.score)), whole: splitOptimum(candidates.map(candidate => candidate.sleeps.length === 1 ? candidate.score : null)) }
}
