import { natureByName, XP_TABLE } from './data'

/** 用户保留的规划上限；当前游戏开放到 70，71～100 的产量为推算。 */
export const POKEMON_LEVEL_MAX = 100
export const GAME_LEVEL_MAX = 70

export function expTo(level: number): number {
  return XP_TABLE.find((r) => r.level === level)?.exp ?? NaN
}

export function shardsTo(level: number): number {
  return XP_TABLE.find((r) => r.level === level)?.shards ?? NaN
}

export function natureExpFactor(nature: string): number {
  const n = natureByName(nature)
  if (n.up === 'exp') return 1.18
  if (n.down === 'exp') return 0.82
  return 1
}

export function groupMult(group: 'normal' | 'pseudo' | 'legendary' | 'mythical'): number {
  if (group === 'pseudo') return 1.5
  if (group === 'legendary') return 1.8
  if (group === 'mythical') return 2.2
  return 1
}

/** Ver.3.6.0：以喂糖前等级分档，每颗先按性格四舍五入，再应用增强。 */
export function candyExpAtLevel(level: number, nature: string, boost = false): number {
  const base = level < 25 ? 40 : level < 30 ? 35 : 25
  return Math.round(base * natureExpFactor(nature)) * (boost ? 2 : 1)
}

export function candyExp(count: number, nature: string, boost: boolean, group: 'normal' | 'pseudo' | 'legendary' | 'mythical' = 'normal', level = 30): number {
  return count * candyExpAtLevel(level, nature, boost) / groupMult(group)
}

export type ExpGroup = 'normal' | 'pseudo' | 'legendary' | 'mythical'
export interface TrainingProgress { level: number, exp: number }

/** Pure EXP transition; the supplied progress is never changed. */
export function advanceTrainingState(progress: Readonly<TrainingProgress>, amount: number, target: number, group: ExpGroup): TrainingProgress {
  const exp = progress.exp + amount
  let level = progress.level
  while (level < target && exp >= expTo(level + 1) * groupMult(group)) level++
  return { level, exp }
}

export interface TrainingFeedResult {
  progress: TrainingProgress
  candies: number
  shards: number
  exp: number
}

/** Pure feeding transition. Local iteration preserves per-candy rounding and level bands. */
export function feedTrainingState(progress: Readonly<TrainingProgress>, count: number, target: number, nature: string, group: ExpGroup, boost = false, shardMultiplier = 1): TrainingFeedResult {
  let next = { ...progress }
  let candies = 0
  let shards = 0
  while (next.level < target && candies < count) {
    shards += shardsTo(next.level + 1) * shardMultiplier
    next = advanceTrainingState(next, candyExpAtLevel(next.level, nature, boost), target, group)
    candies++
  }
  return { progress: next, candies, shards, exp: next.exp - progress.exp }
}

/** @deprecated Integration compatibility; prefer advanceTrainingState. */
export function advanceTraining(progress: TrainingProgress, amount: number, target: number, group: ExpGroup): void {
  Object.assign(progress, advanceTrainingState(progress, amount, target, group))
}

/** @deprecated Integration compatibility; prefer feedTrainingState. */
export function feedTraining(progress: TrainingProgress, count: number, target: number, nature: string, group: ExpGroup, boost = false, shardMultiplier = 1) {
  const { progress: next, ...result } = feedTrainingState(progress, count, target, nature, group, boost, shardMultiplier)
  Object.assign(progress, next)
  return result
}

export function xpCandy(opts: {
  from: number
  to: number
  remaining?: number
  nature: string
  boost?: boolean
  group?: 'normal' | 'pseudo' | 'legendary' | 'mythical'
}): { exp: number, candy: number, shards: number, error?: string } {
  if (!Number.isInteger(opts.from) || !Number.isInteger(opts.to) || opts.from < 1 || opts.to < opts.from) {
    return { exp: NaN, candy: NaN, shards: NaN, error: '等级范围无效' }
  }
  if (!Number.isFinite(expTo(opts.from)) || !Number.isFinite(expTo(opts.to))) {
    return { exp: NaN, candy: NaN, shards: NaN, error: '等级经验资料未收录' }
  }
  const group = opts.group ?? 'normal'
  const start = expTo(opts.from) * groupMult(group)
  const nextGap = opts.from < GAME_LEVEL_MAX ? (expTo(opts.from + 1) - expTo(opts.from)) * groupMult(group) : 0
  // 0/未填写表示本级尚未积累；正数是 UI 的「距下级剩余 EXP」。
  const remaining = opts.remaining === undefined || opts.remaining === 0 ? nextGap : opts.remaining
  if (!Number.isFinite(remaining) || remaining < 0 || remaining > nextGap) {
    return { exp: NaN, candy: NaN, shards: NaN, error: '距下级剩余 EXP 超出本级范围' }
  }
  const progress = { level: opts.from, exp: start + nextGap - remaining }
  const need = Math.max(0, expTo(opts.to) * groupMult(group) - progress.exp)
  const fed = feedTrainingState(progress, Infinity, opts.to, opts.nature, group, opts.boost, opts.boost ? 5 : 1)
  return { exp: need, candy: fed.candies, shards: fed.shards }
}
