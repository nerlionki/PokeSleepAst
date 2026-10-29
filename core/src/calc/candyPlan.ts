import runtimeParameters from '../data/runtime-parameters.resource'
import clientFactoryDefaults from '../data/client-defaults.resource'
import extracted0 from '../data/client-defaults.resource'
import { cloneData } from './dataClone'
import { newUid } from './uid'
import { EVENT_PARAMETERS, activityMiniCandyBoost, activityValues, createActivityContext, type ActivitySelection } from './activities'
import growth from '../data/growth-meta.resource'
import legacyStockKeys from '../data/legacy-candy-stock-keys.resource'
import type { BoxPokemon } from '../types'
import { natureByName, pokeById } from './data'
import { candyExpAtLevel, shardsTo } from './xp'
const candyPlan_config_extracted0 = extracted0.modules.candyPlan
const factory_candyPlan_config_clientFactoryDefaults = clientFactoryDefaults.modules.factory_candyPlan
const candyPlan_calculateCandy_runtimeParameters = runtimeParameters.modules.candyPlan.calculateCandy.values


export type CandyNature = 'flat' | 'up' | 'down'
export type CandyMethod = 'target' | 'manual'

export interface CandyRow {
  id: string
  pokeId: number
  method: CandyMethod
  start: number
  target: number
  use: number
  useAll: boolean
  nature: CandyNature
  remaining: number | null
}

export interface CandyResult {
  candies: number
  shards: number
  level: number
  missing: number
  unused: number
  error?: string
}

export const CANDY_BOOSTS = EVENT_PARAMETERS.candyBoosts

export type CandyBoostId = keyof typeof CANDY_BOOSTS

export function candyBoostPolicy(mode: CandyBoostId, activity?: ActivitySelection) {
  const base = CANDY_BOOSTS[mode]
  const event = mode === 'mini' ? activityMiniCandyBoost(createActivityContext('research', activity)) : undefined
  return { ...base, ...(event ?? {}), quota: event ? event.dailyLimit : event === null ? 0 : base.quota, available: event !== null, daily: !!event }
}

const MAX_LEVEL = (candyPlan_config_extracted0.MAX_LEVEL as 70)
const curves = growth.exp as Record<string, number[]>
const expTypes = growth.expType as Record<string, number>
const families = growth.family as Record<string, string>
const evolves = growth.evolve as Record<string, number[]>

export function familyOf(pokeId: number): string {
  return families[String(pokeId)] ?? String(pokeId)
}

/** 旧版本缺少家族映射的库存键；用户确认同家族取最大值，迁移后移除旧键。
 * 仅处理已知旧键，不能将全部库存键当作宝可梦 ID（它们通常是家族 ID）。
 */
export function migrateCandyStocks(stocks: Record<string, number>): Record<string, number> {
  const next = { ...stocks }
  for (const key of legacyStockKeys) {
    if (!Object.hasOwn(next, key)) continue
    const family = familyOf(Number(key))
    if (family === key) continue
    next[family] = Math.max(next[family] ?? 0, next[key]!)
    delete next[key]
  }
  return next
}

export function evolutionLevels(pokeId: number): number[] {
  return evolves[String(pokeId)] ?? []
}

export const CANDY_PRESETS = cloneData(candyPlan_config_extracted0.CANDY_PRESETS)

/** Pure Box-to-planning conversion; identity is supplied by the caller. */
export function createCandyRowFromBox(pokemon: BoxPokemon, id: string): CandyRow {
  const nature = natureByName(pokemon.nature)
  const start = Math.min(MAX_LEVEL, Math.max(1, pokemon.level))
  return {
    id,
    pokeId: pokemon.pokeId,
    method: (factory_candyPlan_config_clientFactoryDefaults["createCandyRowFromBox_method"] as "target"),
    start,
    target: CANDY_PRESETS.find((lv) => lv > start) ?? start,
    use: (factory_candyPlan_config_clientFactoryDefaults["createCandyRowFromBox_use"] as 50),
    useAll: (factory_candyPlan_config_clientFactoryDefaults["createCandyRowFromBox_useAll"] as false),
    nature: nature.up === 'exp' ? 'up' : nature.down === 'exp' ? 'down' : 'flat',
    remaining: pokemon.tune?.exp || null,
  }
}

/** UI compatibility boundary: random identity stays outside the conversion. */
export function candyRowFromBox(pokemon: BoxPokemon): CandyRow {
  return createCandyRowFromBox(pokemon, newUid())
}

function curveOf(pokeId: number): number[] {
  return curves[String(expTypes[String(pokeId)] ?? 1)] ?? curves['1']
}

function levelGap(exp: number[], level: number): number {
  if (level >= MAX_LEVEL) return 0
  return (exp[level + 1] ?? 0) - (exp[level] ?? 0)
}

export function calculateCandy(row: CandyRow, mode: CandyBoostId, useOverride?: number, activity?: ActivitySelection, island = ''): CandyResult {
  const boost = candyBoostPolicy(mode, activity)
  if (!boost.available) return { candies: 0, shards: 0, level: row.start, missing: 0, unused: 0, error: '当前活动日期未开放迷你糖果增强' }
  const poke = pokeById(row.pokeId)
  if (!poke) return { candies: 0, shards: 0, level: row.start, missing: 0, unused: 0, error: '请选择宝可梦' }
  const effects = activityValues(createActivityContext('research', activity), island, poke)
  if (!Number.isInteger(row.start) || row.start < 1 || row.start > MAX_LEVEL) {
    return { candies: 0, shards: 0, level: row.start, missing: 0, unused: 0, error: '当前等级需在 1–70' }
  }
  const exp = curveOf(row.pokeId)
  const required = levelGap(exp, row.start)
  const remaining = row.remaining ?? required
  if (remaining > required || remaining < (required === 0 ? 0 : 1)) {
    return { candies: 0, shards: 0, level: row.start, missing: 0, unused: 0, error: '升级还需 EXP 超出本级范围' }
  }
  const use = useOverride ?? row.use
  if (row.method === 'target' && (!Number.isInteger(row.target) || row.target < row.start || row.target > MAX_LEVEL)) {
    return { candies: 0, shards: 0, level: row.start, missing: 0, unused: 0, error: `目标等级需在 ${row.start}–${MAX_LEVEL}` }
  }
  if (row.method === 'manual' && (!Number.isInteger(use) || use < 0 || use > (candyPlan_calculateCandy_runtimeParameters.p001 as 100000))) {
    return { candies: 0, shards: 0, level: row.start, missing: 0, unused: 0, error: '使用糖果需为 0–100000 的整数' }
  }

  let level = row.start
  let current = (exp[level] ?? 0) + (required - remaining)
  let candies = 0
  let shards = 0
  const nature = row.nature === 'up' ? '胆小' : row.nature === 'down' ? '勇敢' : '勤奋'
  while (level < MAX_LEVEL && (row.method === 'target' ? level < row.target : candies < use)) {
    shards += shardsTo(level + 1) * boost.shards * effects.candyShardMultiplier
    current += candyExpAtLevel(level, nature, boost.exp * effects.candyExpMultiplier)
    candies += 1
    while (level < MAX_LEVEL && current >= (exp[level + 1] ?? Infinity)) level += 1
  }
  return {
    candies,
    shards,
    level,
    missing: 0,
    unused: row.method === 'manual' ? Math.max(0, use - candies) : 0,
  }
}

export function planCandy(rows: CandyRow[], stocks: Record<string, number>, mode: CandyBoostId, activity?: ActivitySelection, island = '') {
  activity = createActivityContext('research', activity)
  const used: Record<string, number> = {}
  let candies = 0
  let shards = 0
  let missing = 0
  const results = rows.map((row) => {
    const family = familyOf(row.pokeId)
    const stock = stocks[family] ?? 0
    const consumed = used[family] ?? 0
    const left = Math.max(0, stock - consumed)
    const result = calculateCandy(row, mode, row.method === 'manual' && row.useAll ? left : undefined, activity, island)
    if (result.error) return result
    result.missing = Math.max(0, consumed + result.candies - stock) - Math.max(0, consumed - stock)
    used[family] = consumed + result.candies
    candies += result.candies
    shards += result.shards
    missing += result.missing
    return result
  })
  const policy = candyBoostPolicy(mode, activity)
  const quota = policy.quota
  return {
    results,
    candies,
    shards,
    missing,
    over: Math.max(0, candies - quota),
    invalid: results.filter((row) => row.error).length,
    quota,
    available: policy.available,
    daily: policy.daily,
  }
}
