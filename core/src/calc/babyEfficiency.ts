import { normalizeEventMix, openSleepSlots, pokemonSleepWeight, type EventMix } from './sleepRules'
import { compareSleepPriority } from './sleepSelection'
import type { IslandId, SleepType } from '../types'
import { familyOf } from './candyPlan'
import { ENCOUNTER_BANDS, ISLANDS, POKEDEX, SLEEP_STYLES, type SleepStyleRow } from './data'
import { evolutionStages } from './evolution'
import { EVENT_BONUSES, fallbackStyle, RANK_ORDER, rankStrength, SPECIAL_POKEMON, styleUnlockIndex } from './sleep'
import { sleepReward, sleepStyleInternalId } from './sleepRewards'
import { drawStateKey, efficiencyRandom, simulateEfficiencyState, type EfficiencyBucket, type EfficiencyDrawState, type EfficiencyReward } from './babyEfficiencyDraw'

export type EfficiencyPrecision = 'low' | 'medium' | 'high'
export interface BabyEfficiencyOptions {
  pokeId: number
  island?: IslandId | 'all'
  sleepType?: SleepType | 'all'
  splitSleep?: boolean
  eventMult: number
  eventMix: EventMix | boolean
  iterations: number
  precision: EfficiencyPrecision
}
export const DEFAULT_BABY_EFFICIENCY: BabyEfficiencyOptions = {
  pokeId: 1, island: 'all', sleepType: 'all', splitSleep: true, eventMult: 1, eventMix: false, iterations: 4000, precision: 'medium',
}
export const EFFICIENCY_SLEEP_TYPES: SleepType[] = ['淺淺入夢', '安然入睡', '深深入眠', '没有特征']
export const BABY_POKEMON_IDS = POKEDEX.filter((poke) => evolutionStages(poke.id)[0]?.[0]?.id === poke.id).map((poke) => poke.id)

export interface EfficiencyStyle extends EfficiencyReward {
  sleepType: SleepType
  special: boolean
  unlockStrength: number
  dpr: number
  belly?: boolean
  order?: number
  unlockRank?: number
  pokeId?: number
}
export interface EfficiencyIsland {
  id: IslandId
  name: string
  styles: EfficiencyStyle[]
  bands: { count: number, min: number }[]
  fallbacks: Record<SleepType, EfficiencyReward>
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

export function validateBabyEfficiency(options: BabyEfficiencyOptions): string | null {
  if (!BABY_POKEMON_IDS.includes(options.pokeId)) return '请选择进化链的一阶段宝可梦'
  if (options.island != null && options.island !== 'all' && !babyEfficiencyIslands(options.pokeId).some((island) => island.id === options.island)) return '请选择目标宝可梦出没的岛屿'
  if (options.sleepType != null && options.sleepType !== 'all' && !EFFICIENCY_SLEEP_TYPES.includes(options.sleepType)) return '请选择有效的睡眠类型'
  if (options.splitSleep != null && typeof options.splitSleep !== 'boolean') return '请选择是否拆分睡眠'
  if (!Number.isInteger(options.iterations) || options.iterations < 100 || options.iterations > 100000) return '计算次数需为 100–100000 的整数'
  if (!EVENT_BONUSES.some((bonus) => bonus.mult === options.eventMult)) return '请选择有效的活动倍率'
  if (![false, true, 'off', 'some', 'all'].includes(options.eventMix)) return '请选择有效的跨睡眠类型模式'
  if (!['low', 'medium', 'high'].includes(options.precision)) return '请选择有效的搜索精度'
  return null
}

export function babyEfficiencyIslands(pokeId: number) {
  return ISLANDS.filter((island) => SLEEP_STYLES.some((style) => style.island === island.id && style.pokeId === pokeId && !style.limited))
}

export function babyEfficiencySleepTypes(options: BabyEfficiencyOptions): SleepType[] {
  if (options.sleepType && options.sleepType !== 'all') return [options.sleepType]
  if (normalizeEventMix(options.eventMix) !== 'off') return EFFICIENCY_SLEEP_TYPES
  const ownType = POKEDEX.find((poke) => poke.id === options.pokeId)?.sleepType as SleepType
  return EFFICIENCY_SLEEP_TYPES.filter((type) => type === ownType || type === '没有特征')
}

export function efficiencyIslands(pokeId: number): EfficiencyIsland[] {
  const family = familyOf(pokeId)
  const rewardOf = (style: { pokeId: number, stars: number, styleId?: number }): EfficiencyReward => ({
    catch: Number(style.pokeId === pokeId),
    candy: familyOf(style.pokeId) === family ? (sleepReward(style)?.candy ?? 0) : 0,
  })
  return ISLANDS.flatMap((island) => {
    const styles = SLEEP_STYLES.filter((style) => style.island === island.id && !style.limited)
    if (!styles.some((style) => style.pokeId === pokeId)) return []
    const bands = ENCOUNTER_BANDS[island.band as keyof typeof ENCOUNTER_BANDS] ?? ENCOUNTER_BANDS.greengrass
    return [{
      id: island.id as IslandId,
      name: island.name,
      bands,
      fallbacks: Object.fromEntries(EFFICIENCY_SLEEP_TYPES.map((type) => [type, rewardOf(fallbackStyle(island.id as IslandId, type))])) as Record<SleepType, EfficiencyReward>,
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
      })),
    }]
  })
}

/** Correct boundary rounding using the same multiplication order as drowsyPower. */
export function strengthForPower(power: number, score: number, mult: number): number {
  if (power <= 1) return 1
  let strength = Math.max(1, Math.ceil(power / (score * mult)))
  while ((score * strength) * mult < power) strength++
  while (strength > 1 && (score * (strength - 1)) * mult >= power) strength--
  return strength
}

interface CurveState { min: number, encounters: number, groups: Group[] }
interface Group extends EfficiencyReward { sleepType: SleepType, special: boolean, count: number, dpr: number, belly?: boolean, order?: number, unlockRank?: number, weight?: number }

export function efficiencyCurve(island: EfficiencyIsland, score: number, mult: number): CurveState[] {
  const unlocks = island.styles.map((style) => ({ style, at: Math.max(1, style.unlockStrength) }))
    .sort((a, b) => a.at - b.at)
  const bands = island.bands.map((band) => ({ count: band.count, at: strengthForPower(band.min, score, mult) }))
  const maxCount = Math.max(3, ...island.bands.map((band) => band.count))
  const costs = [...new Set(island.styles.map((style) => style.dpr))]
  const budgetPoints = costs.flatMap((cost) => Array.from({ length: maxCount }, (_, i) => strengthForPower(cost * (i + 1), score, mult)))
  const starts = [...new Set([1, ...budgetPoints, ...unlocks.map((row) => row.at), ...bands.map((row) => row.at)])].sort((a, b) => a - b)
  const groups = new Map<string, Group>()
  let unlocked = 0
  let snapshot: Group[] = []
  return starts.map((min) => {
    const previous = unlocked
    while (unlocked < unlocks.length && unlocks[unlocked]!.at <= min) {
      const style = unlocks[unlocked++]!.style
      const weight = pokemonSleepWeight(style.pokeId ?? 0, mult)
      const key = `${weight}|${style.sleepType}|${Number(style.special)}|${style.catch}|${style.candy}|${style.dpr}|${style.belly}`
      const group = groups.get(key)
      if (group) { group.count++; if (compareSleepPriority(style, group) < 0) { group.order = style.order; group.unlockRank = style.unlockRank } }
      else groups.set(key, { sleepType: style.sleepType, special: style.special, catch: style.catch, candy: style.candy, dpr: style.dpr, belly: style.belly, order: style.order, unlockRank: style.unlockRank, weight, count: 1 })
    }
    // Budget points between rank unlocks share one immutable pool snapshot.
    // Dense precision adds scores, not copies of every style at every point.
    if (unlocked !== previous) snapshot = [...groups.values()].map((group) => ({ ...group }))
    const encounters = bands.reduce((n, band) => band.at <= min ? Math.max(n, band.count) : n, 3)
    return { min, encounters, groups: snapshot }
  })
}

export function efficiencyDrawState(island: EfficiencyIsland, state: CurveState, type: SleepType, eventMix: EventMix | boolean, power: number): EfficiencyDrawState {
  const mixed = normalizeEventMix(eventMix) !== 'off' && type !== '没有特征'
  const buckets = new Map<string, EfficiencyBucket>()
  for (const group of state.groups) {
    const typed = type === '没有特征' || type === group.sleepType
    if (!mixed && !typed) continue
    const key = `${group.weight}|${Number(typed)}|${Number(group.special)}|${group.catch}|${group.candy}|${group.dpr}|${group.belly}`
    const existing = buckets.get(key)
    if (existing) { existing.count += group.count; if (compareSleepPriority(group, existing) < 0) { existing.order = group.order; existing.unlockRank = group.unlockRank } }
    else buckets.set(key, { typed, special: group.special, catch: group.catch, candy: group.candy, dpr: group.dpr, belly: group.belly, order: group.order, unlockRank: group.unlockRank, weight: group.weight, count: group.count })
  }
  return {
    buckets: [...buckets.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([, bucket]) => bucket),
    power: Math.min(power, Math.max(0, ...[...buckets.values()].map((group) => group.dpr * state.encounters))),
    encounters: state.encounters,
    otherSlots: mixed ? openSleepSlots(state.encounters, eventMix) : 0,
    typedFallback: island.fallbacks[type],
    openFallback: island.fallbacks[mixed ? '没有特征' : type],
  }
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
export interface BabyEfficiencyCheckpoint {
  version: 1
  options: BabyEfficiencyOptions
  islandIndex: number
  splitIndex: number
  leaders: SplitLeaders
  best: { catch: EfficiencyOptimum, candy: EfficiencyOptimum }
  evaluatedStates: number
}
const emptyLeaders = (): SplitLeaders => ({ catch: { value: -1, splits: [] }, candy: { value: -1, splits: [] } })

/** A checkpoint completes one split search; interrupted splits are safely repeated. */
export function* babyEfficiencySteps(
  options: BabyEfficiencyOptions,
  onProgress: (progress: EfficiencyProgress) => void = () => {},
  islands: EfficiencyIsland[] = efficiencyIslands(options.pokeId),
  checkpoint?: BabyEfficiencyCheckpoint,
): Generator<BabyEfficiencyCheckpoint, BabyEfficiencyResult> {
  const error = validateBabyEfficiency(options)
  if (error) throw new Error(error)
  if (checkpoint && (checkpoint.version !== 1 || JSON.stringify(checkpoint.options) !== JSON.stringify(options))) throw new Error('续算参数与检查点不一致')
  islands = islands.filter((island) => !options.island || options.island === 'all' || island.id === options.island)
  if (!islands.length) throw new Error('资料未收录这个家族可参与普通研究的睡姿')
  const cache = new Map<string, EfficiencyReward>()
  const best = checkpoint?.best ?? { catch: { value: 0, intervals: [] as EfficiencyInterval[] }, candy: { value: 0, intervals: [] as EfficiencyInterval[] } }
  const step = options.precision === 'low' ? 10 : options.precision === 'medium' ? 5 : 1
  const stride = options.precision === 'low' ? 8 : options.precision === 'medium' ? 2 : 1
  const baseSplits = options.splitSleep !== false ? Array.from({ length: 50 / step }, (_, index) => (index + 1) * step) : [100]
  const initialStates = checkpoint?.evaluatedStates ?? 0
  const completedStates = () => initialStates + cache.size
  let progressTime = 0
  let progressPercent = 0
  const update = (percent: number, island: string, force = false) => {
    if (!force && Date.now() - progressTime < 100) return
    progressTime = Date.now()
    progressPercent = Math.max(progressPercent, percent)
    onProgress({ percent: progressPercent, island, evaluatedStates: completedStates() })
  }

  for (const [islandIndex, island] of islands.entries()) {
    if (islandIndex < (checkpoint?.islandIndex ?? 0)) continue
    const resumeIndex = islandIndex === checkpoint?.islandIndex ? checkpoint.splitIndex : 0
    update(islandIndex / islands.length * 100, island.name, true)
    const curves = new Map<number, CurveState[]>()
    const curveOf = (score: number) => {
      if (!curves.has(score)) curves.set(score, efficiencyCurve(island, score, options.eventMult))
      return curves.get(score)!
    }
    const sessionCache = new Map<string, { catch: { value: number, types: SleepType[] }, candy: { value: number, types: SleepType[] } }>()
    const sessionAt = (score: number, min: number) => {
      const state = stateAt(curveOf(score), min)
      const sessionKey = `${score}:${min}`
      const known = sessionCache.get(sessionKey)
      if (known) return known
      const result = { catch: { value: -1, types: [] as SleepType[] }, candy: { value: -1, types: [] as SleepType[] } }
      for (const type of babyEfficiencySleepTypes(options)) {
        const draw = efficiencyDrawState(island, state, type, options.eventMix, score * min * options.eventMult)
        const key = drawStateKey(draw)
        let metric = cache.get(key)
        if (!metric) {
          metric = simulateEfficiencyState(draw, options.iterations, efficiencyRandom(1))
          cache.set(key, metric)
        }
        for (const goal of ['catch', 'candy'] as const) {
          if (metric[goal] > result[goal].value) result[goal] = { value: metric[goal], types: [type] }
          else if (metric[goal] === result[goal].value) result[goal].types.push(type)
        }
      }
      sessionCache.set(sessionKey, result)
      return result
    }
    const scanSplit = (first: number, position: number, total: number) => {
      const second = first === 100 ? 0 : 100 - first
      const curvesToMerge = second ? [curveOf(first), curveOf(second)] : [curveOf(first)]
      const starts = [...new Set(curvesToMerge.flatMap((curve) => curve.map((state) => state.min)))].sort((a, b) => a - b)
      const checked = new Set<number>()
      const values = new Map<number, EfficiencyReward>()
      const leaders = { catch: { value: -1, indexes: [] as number[] }, candy: { value: -1, indexes: [] as number[] } }
      const evaluate = (index: number) => {
        if (index < 0 || index >= starts.length) return
        if (checked.has(index)) return values.get(index)
        checked.add(index)
        const min = starts[index]!
        // Budget depletion can change within unlock intervals. Only report sampled
        // energies; the final point is beyond all unlocks and the maximum total cost.
        const max = starts[index + 1] == null ? null : min
        const a = sessionAt(first, min)
        const b = second ? sessionAt(second, min) : null
        const totals = { catch: a.catch.value + (b?.catch.value ?? 0), candy: a.candy.value + (b?.candy.value ?? 0) }
        values.set(index, totals)
        for (const goal of ['catch', 'candy'] as const) {
          const value = totals[goal]
          if (value > leaders[goal].value) leaders[goal] = { value, indexes: [index] }
          else if (value === leaders[goal].value) leaders[goal].indexes.push(index)
          if (value <= 0 || value < best[goal].value) continue
          if (value > best[goal].value) best[goal] = { value, intervals: [] }
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
        const neighbors = [...leaders.catch.indexes, ...leaders.candy.indexes].flatMap((index) => [index - 1, index + 1])
        for (const index of neighbors) evaluate(index)
      }
      if (options.precision !== 'high') {
        // Complete the contiguous plateau for every coarse winner, including skipped segments.
        const queue = [...leaders.catch.indexes, ...leaders.candy.indexes]
        const expanded = new Set<number>()
        for (let cursor = 0; cursor < queue.length; cursor++) {
          const index = queue[cursor]!
          if (expanded.has(index)) continue
          expanded.add(index)
          const current = values.get(index)!
          if (!(current.catch > 0 && current.catch === leaders.catch.value)
            && !(current.candy > 0 && current.candy === leaders.candy.value)) continue
          for (const neighbor of [index - 1, index + 1]) {
            const metric = evaluate(neighbor)
            if (metric && ((metric.catch > 0 && metric.catch === leaders.catch.value)
              || (metric.candy > 0 && metric.candy === leaders.candy.value))) queue.push(neighbor)
          }
        }
      }
      return leaders
    }
    const localLeaders = islandIndex === checkpoint?.islandIndex ? checkpoint.leaders : emptyLeaders()
    const save = (splitIndex: number): BabyEfficiencyCheckpoint => ({ version: 1, options: { ...options }, islandIndex, splitIndex, leaders: localLeaders, best, evaluatedStates: completedStates() })
    for (const [index, split] of baseSplits.entries()) {
      if (index < resumeIndex) continue
      const leaders = scanSplit(split, index, baseSplits.length + (options.precision === 'medium' ? 4 : 0))
      for (const goal of ['catch', 'candy'] as const) {
        if (leaders[goal].value > localLeaders[goal].value) localLeaders[goal] = { value: leaders[goal].value, splits: [split] }
        else if (leaders[goal].value === localLeaders[goal].value) localLeaders[goal].splits.push(split)
      }
      yield save(index + 1)
    }
    if (options.precision === 'medium' && options.splitSleep !== false) {
      const extra = [...new Set([...localLeaders.catch.splits, ...localLeaders.candy.splits]
        .flatMap((score) => [score - 1, score + 1]).filter((score) => score >= 1 && score <= 50 && !baseSplits.includes(score)))]
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
    catch: { value: best.catch.value / options.iterations, intervals: mergeIntervals(best.catch.intervals) },
    candy: { value: best.candy.value / options.iterations, intervals: mergeIntervals(best.candy.intervals) },
    evaluatedStates: completedStates(),
  }
}

/** Synchronous adapter for browsers and deterministic algorithm tests. */
export function searchBabyEfficiency(options: BabyEfficiencyOptions, onProgress: (progress: EfficiencyProgress) => void = () => {}, islands = efficiencyIslands(options.pokeId)): BabyEfficiencyResult {
  const steps = babyEfficiencySteps(options, onProgress, islands)
  let next = steps.next()
  while (!next.done) next = steps.next()
  return next.value
}
