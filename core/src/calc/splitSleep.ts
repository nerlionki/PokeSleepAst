import runtimeParameters from '../data/runtime-parameters.json'
import ruleCatalogs from '../data/rule-catalogs.json'
import ruleParameters from '../data/rule-parameters.json'
import clientFactoryDefaults from '../data/client-defaults.json'
import { cloneData } from './dataClone'
import { activityValues, createActivityContext, type ActivitySelection } from './activities'
import { activityEfficiencyIsland } from './babyEfficiency'
import type { IslandId, SleepType } from '../types'
import { ISLANDS, SLEEP_STYLES } from './data'
import { BABY_POKEMON_IDS, babyEfficiencyIslands, babyEfficiencyPokemonName, efficiencyCurve, efficiencyDrawState, efficiencyIslands, EFFICIENCY_SLEEP_TYPES, MAX_EFFICIENCY_DROWSY_POWER, normalizeBabyEfficiencyPokemonId, type EfficiencyIsland } from './babyEfficiency'
import { createDrawStateKey, efficiencyRandom, efficiencyRewardsAfterResearch, simulateEfficiencySlots, type EfficiencySimulation } from './babyEfficiencyDraw'
import { drowsyPower, encounterCount, rankStrength, RANK_ORDER, styleKey, styleUnlockIndex } from './sleep'
import { normalizeEventMix, type EventMix } from './sleepRules'
const factory_splitSleep_config_clientFactoryDefaults = clientFactoryDefaults.modules.factory_splitSleep
const splitSleep_config_ruleCatalogs = ruleCatalogs.modules.splitSleep
const splitSleep_normalizeSplitOptions_ruleParameters = ruleParameters.modules.splitSleep.normalizeSplitOptions
const splitSleep_validateSplitOptions_ruleParameters = ruleParameters.modules.splitSleep.validateSplitOptions
const splitSleep_splitSleepSteps_runtimeParameters = runtimeParameters.modules.splitSleep.splitSleepSteps.values


export interface SplitTarget {
  kind: 'baby' | 'style'
  pokeId: number
  style: string
  countWeight: number
  candyWeight: number
  probabilityWeight: number
}
export interface SplitOptions {
  activity?: ActivitySelection
  island: IslandId
  strength: number
  targets: SplitTarget[]
  sleepType: SleepType | 'all'
  eventMult: number
  eventMix: EventMix | boolean
  iterations: number
}
export const newSplitTarget = (kind: SplitTarget['kind'], pokeId: number, style = ''): SplitTarget => ({ kind, pokeId, style, ...cloneData(clientFactoryDefaults.modules.factory_splitSleep.newSplitTarget) })
export function defaultSplitOptions(): SplitOptions {
  return (cloneData(factory_splitSleep_config_clientFactoryDefaults["defaultSplitOptions"]) as unknown as SplitOptions)
}
export const splitTargetKey = (target: SplitTarget) => target.kind === 'baby' ? `baby:${normalizeBabyEfficiencyPokemonId(target.pokeId)}` : `style:${target.style}`
export function splitTargetStatus(target: SplitTarget, island: IslandId, strength: number) {
  const style = SLEEP_STYLES.find(row => !row.limited && row.island === island && row.pokeId === target.pokeId && styleKey(row.pokeId, row.stars, row.styleId) === target.style)
  const available = target.kind === 'baby' ? babyEfficiencyIslands(target.pokeId).some(row => row.id === island) : !!style
  const unlockStrength = style ? rankStrength(island, RANK_ORDER[styleUnlockIndex(island, style)]!) : null
  const unlocked = available && (target.kind === 'baby' || (unlockStrength != null && strength >= unlockStrength))
  const namedStyle = style ?? SLEEP_STYLES.find(row => row.pokeId === target.pokeId && styleKey(row.pokeId, row.stars, row.styleId) === target.style)
  const label = target.kind === 'baby' ? babyEfficiencyPokemonName(target.pokeId) : namedStyle ? `${namedStyle.name} ${namedStyle.stars}★ ${namedStyle.styleName}` : target.style
  const reason = !available ? '当前岛屿无此普通研究目标，请更换岛屿或移除目标' : !unlocked ? `未达到解锁能量 ${unlockStrength!.toLocaleString('zh-CN')}，当前权重为 0` : ''
  return { label, available, unlocked, unlockStrength, reason }
}
function validTarget(target: SplitTarget): boolean {
  if (!target || !splitSleep_config_ruleCatalogs.validTargetList0.values.includes(target.kind)) return false
  if (![target.countWeight, target.candyWeight, target.probabilityWeight].every(n => Number.isFinite(n) && n >= 0)) return false
  return target.kind === 'baby' ? BABY_POKEMON_IDS.includes(normalizeBabyEfficiencyPokemonId(target.pokeId))
    : SLEEP_STYLES.some(row => !row.limited && row.pokeId === target.pokeId && styleKey(row.pokeId, row.stars, row.styleId) === target.style)
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
  const seen = new Set<string>()
  value.targets = (Array.isArray(saved?.targets) ? saved.targets : []).filter(validTarget).map(target => ({ ...target, pokeId: target.kind === 'baby' ? normalizeBabyEfficiencyPokemonId(target.pokeId) : target.pokeId })).filter(target => {
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
    const status = splitTargetStatus(target, options.island, options.strength)
    return target.kind === 'baby' ? [
      { targetIndex, kind: 'count' as const, label: `${status.label} · 只数`, weight: target.countWeight },
      { targetIndex, kind: 'candy' as const, label: `${status.label} · 家族糖果`, weight: target.candyWeight },
    ] : [{ targetIndex, kind: 'probability' as const, label: status.label, weight: status.unlocked ? target.probabilityWeight : 0 }]
  })
}
export function validateSplitOptions(options: SplitOptions): string | null {
  if (!ISLANDS.some(row => row.id === options.island)) return '请选择有效岛屿'
  if (!Number.isSafeInteger(options.strength) || options.strength < 0) return '卡比兽能量需为非负安全整数'
  if (!Array.isArray(options.targets) || !options.targets.length || options.targets.some(target => !validTarget(target))) return '请添加有效目标，权重需为非负有限数'
  if (new Set(options.targets.map(splitTargetKey)).size !== options.targets.length) return '请移除重复目标'
  if (options.targets.some(target => !splitTargetStatus(target, options.island, options.strength).available)) return '存在当前岛屿不适用的目标，请更换岛屿或移除目标'
  if (options.sleepType !== 'all' && !EFFICIENCY_SLEEP_TYPES.includes(options.sleepType)) return '请选择有效睡眠类型'
  if ((!Number.isFinite(options.eventMult) || options.eventMult <= 0 || options.eventMult > splitSleep_validateSplitOptions_ruleParameters.maxEventMultiplier) || !splitSleep_config_ruleCatalogs.validateSplitOptionsList0.values.includes(options.eventMix)) return '请选择有效活动设置'
  if (!Number.isInteger(options.iterations) || options.iterations < splitSleep_validateSplitOptions_ruleParameters.minIterations || options.iterations > splitSleep_validateSplitOptions_ruleParameters.maxIterations) return '模拟次数需为 100–100000 的整数'
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
interface Session { count: number, probability: number, candies: number[] }
export interface SplitCheckpoint { version: 1, signature: string, completed: number, sessions: Session[][] }
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
  const context = createActivityContext('research', request.splitOptions.activity)
  const effects = activityValues(context, request.splitOptions.island, undefined, (splitSleep_splitSleepSteps_runtimeParameters.p001 as 240), { drowsyPowerMultiplier: request.splitOptions.eventMult, eventMix: normalizeEventMix(request.splitOptions.eventMix) })
  const options: SplitOptions = { ...JSON.parse(JSON.stringify(request.splitOptions)), activity: context, eventMult: effects.drowsyPowerMultiplier, eventMix: effects.eventMix }
  const error = validateSplitOptions(options)
  if (error) throw new Error(error)
  const signature = JSON.stringify(options)
  const checkpoint = request.checkpoint
  if (checkpoint && (checkpoint.version !== 1 || checkpoint.signature !== signature)) throw new Error('拆觉规则或参数已变化，请重新计算')
  const types = options.sleepType === 'all' ? EFFICIENCY_SLEEP_TYPES : [options.sleepType]
  const total = options.targets.length * 100 * types.length
  if (checkpoint && (!Number.isInteger(checkpoint.completed) || checkpoint.completed < 0 || checkpoint.completed > total || checkpoint.sessions.length !== options.targets.length)) throw new Error('拆觉检查点无效，请重新计算')
  const sessions: Session[][] = checkpoint ? JSON.parse(JSON.stringify(checkpoint.sessions)) : options.targets.map(() => [])
  let completed = checkpoint?.completed ?? 0
  if (checkpoint) {
    for (let i = 0; i < completed; i++) {
      const session = sessions[Math.floor(i / (100 * types.length))]?.[i % (100 * types.length)]
      if (!session || !Number.isFinite(session.count) || session.count < 0 || !Number.isFinite(session.probability) || session.probability < 0 || session.probability > 1
        || !Array.isArray(session.candies) || session.candies.length !== (splitSleep_splitSleepSteps_runtimeParameters.p002 as 9) || session.candies.some(value => !Number.isFinite(value) || value < 0)) throw new Error('拆觉检查点无效，请重新计算')
    }
  }
  for (const [targetIndex, target] of options.targets.entries()) {
    const end = (targetIndex + 1) * 100 * types.length
    if (completed >= end) continue
    const status = splitTargetStatus(target, options.island, options.strength)
    const island = activityEfficiencyIsland(efficiencyIslands(target.pokeId, target.kind === 'style' ? target.style : undefined).find(row => row.id === options.island)!, context)
    const pool = fixedPool(island, options.strength, options.eventMult)
    const keyOf = createDrawStateKey(), cache = new Map<string, EfficiencySimulation>()
    for (let score = 1; score <= (splitSleep_splitSleepSteps_runtimeParameters.p003 as 100); score++) {
      for (const [typeIndex, type] of types.entries()) {
        const offset = (score - 1) * types.length + typeIndex
        if (targetIndex * 100 * types.length + offset < completed) continue
        const power = drowsyPower(score, options.strength, options.eventMult)
        const draw = efficiencyDrawState(island, { ...pool, encounters: encounterCount(options.island, power) }, type, options.eventMix, power)
        const key = keyOf(draw)
        let simulation = cache.get(key)
        if (!simulation && (target.kind === 'baby' || status.unlocked)) {
          simulation = simulateEfficiencySlots(draw, options.iterations, efficiencyRandom(1)); cache.set(key, simulation)
        }
        const session: Session = simulation ? {
          count: simulation.catch / options.iterations,
          probability: simulation.hitRuns / options.iterations,
          candies: Array.from({ length: (splitSleep_splitSleepSteps_runtimeParameters.p004 as 9) }, (_, before) => efficiencyRewardsAfterResearch(simulation!, before).candy / options.iterations),
        } : { count: 0, probability: 0, candies: Array((splitSleep_splitSleepSteps_runtimeParameters.p005 as 9)).fill(0) }
        sessions[targetIndex]![offset] = session
        completed++
      }
      yield { version: 1, signature, completed, sessions }
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
      const a = rows[(first - 1) * types.length + firstType]!
      const b = secondType == null ? null : rows[((splitSleep_splitSleepSteps_runtimeParameters.p007 as 99) - first) * types.length + secondType]!
      if (!a || (secondType != null && !b)) throw new Error('拆觉检查点缺少研究结果，请重新计算')
      if (metric.kind === 'count') return a.count + (b?.count ?? 0)
      if (metric.kind === 'probability') return b ? 1 - (1 - a.probability) * (1 - b.probability) : a.probability
      return a.candies[0]! + (b?.candies[sleeps[0]!.encounters] ?? 0)
    })
    candidates.push({ sleeps, values, score: null })
  }
  for (let a = 1; a <= (splitSleep_splitSleepSteps_runtimeParameters.p008 as 100); a++) for (let ta = 0; ta < types.length; ta++) {
    if (a === (splitSleep_splitSleepSteps_runtimeParameters.p009 as 100)) add(a, ta)
    else for (let tb = 0; tb < types.length; tb++) add(a, ta, tb)
  }
  const individual = metrics.map((metric, index) => options.targets[metric.targetIndex]!.kind === 'style' && !splitTargetStatus(options.targets[metric.targetIndex]!, options.island, options.strength).unlocked
    ? { value: 0, indices: [] } : splitOptimum(candidates.map(candidate => candidate.values[index]!)))
  const maxima = individual.map(optimum => optimum.value)
  for (const candidate of candidates) candidate.score = splitScore(candidate.values, maxima, metrics)
  return { options, metrics, maxima, candidates, individual, combined: splitOptimum(candidates.map(candidate => candidate.score)), whole: splitOptimum(candidates.map(candidate => candidate.sleeps.length === 1 ? candidate.score : null)) }
}
