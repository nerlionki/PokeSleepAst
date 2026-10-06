import { newUid } from './uid'
import growth from '../data/growth-meta.json'
import type { BoxPokemon } from '../types'
import { natureByName, pokeById } from './data'
import { shardsTo } from './xp'

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

export const CANDY_BOOSTS = {
  christmas: { id: 'christmas', name: '大型增强', exp: 2, shards: 5, quota: 3500 },
  mini: { id: 'mini', name: '迷你增强', exp: 2, shards: 4, quota: 350 },
} as const

export type CandyBoostId = keyof typeof CANDY_BOOSTS

const CANDY_EXP = [
  { max: 24, exp: 40 },
  { max: 29, exp: 35 },
  { max: 99, exp: 25 },
]

const MAX_LEVEL = 70
const curves = growth.exp as Record<string, number[]>
const expTypes = growth.expType as Record<string, number>
const families = growth.family as Record<string, string>
const evolves = growth.evolve as Record<string, number[]>

export function familyOf(pokeId: number): string {
  return families[String(pokeId)] ?? String(pokeId)
}

export function evolutionLevels(pokeId: number): number[] {
  return evolves[String(pokeId)] ?? []
}

export const CANDY_PRESETS = [25, 30, 50, 60, 70]

export function candyRowFromBox(pokemon: BoxPokemon): CandyRow {
  const nature = natureByName(pokemon.nature)
  const start = Math.min(MAX_LEVEL, Math.max(1, pokemon.level))
  return {
    id: newUid(),
    pokeId: pokemon.pokeId,
    method: 'target',
    start,
    target: CANDY_PRESETS.find((lv) => lv > start) ?? start,
    use: 50,
    useAll: false,
    nature: nature.up === 'exp' ? 'up' : nature.down === 'exp' ? 'down' : 'flat',
    remaining: pokemon.tune?.exp || null,
  }
}

function curveOf(pokeId: number): number[] {
  return curves[String(expTypes[String(pokeId)] ?? 1)] ?? curves['1']
}

function candyExpAt(level: number): number {
  return CANDY_EXP.find((band) => level <= band.max)?.exp ?? 25
}

function natureRate(nature: CandyNature): number {
  if (nature === 'up') return 118
  if (nature === 'down') return 82
  return 100
}

function levelGap(exp: number[], level: number): number {
  if (level >= MAX_LEVEL) return 0
  return (exp[level + 1] ?? 0) - (exp[level] ?? 0)
}

export function calculateCandy(row: CandyRow, mode: CandyBoostId, useOverride?: number): CandyResult {
  const boost = CANDY_BOOSTS[mode]
  const poke = pokeById(row.pokeId)
  if (!poke) return { candies: 0, shards: 0, level: row.start, missing: 0, unused: 0, error: '请选择宝可梦' }
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
  if (row.method === 'manual' && (!Number.isInteger(use) || use < 0 || use > 100000)) {
    return { candies: 0, shards: 0, level: row.start, missing: 0, unused: 0, error: '使用糖果需为 0–100000 的整数' }
  }

  let level = row.start
  let current = (exp[level] ?? 0) + (required - remaining)
  let candies = 0
  let shards = 0
  const rate = natureRate(row.nature)
  while (level < MAX_LEVEL && (row.method === 'target' ? level < row.target : candies < use)) {
    shards += shardsTo(level + 1) * boost.shards
    current += Math.ceil(candyExpAt(level) * rate / 100) * boost.exp
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

export function planCandy(rows: CandyRow[], stocks: Record<string, number>, mode: CandyBoostId) {
  const used: Record<string, number> = {}
  let candies = 0
  let shards = 0
  let missing = 0
  const results = rows.map((row) => {
    const family = familyOf(row.pokeId)
    const stock = stocks[family] ?? 0
    const consumed = used[family] ?? 0
    const left = Math.max(0, stock - consumed)
    const result = calculateCandy(row, mode, row.method === 'manual' && row.useAll ? left : undefined)
    if (result.error) return result
    result.missing = Math.max(0, consumed + result.candies - stock) - Math.max(0, consumed - stock)
    used[family] = consumed + result.candies
    candies += result.candies
    shards += result.shards
    missing += result.missing
    return result
  })
  const quota = CANDY_BOOSTS[mode].quota
  return {
    results,
    candies,
    shards,
    missing,
    over: Math.max(0, candies - quota),
    invalid: results.filter((row) => row.error).length,
  }
}
