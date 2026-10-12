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

export function candyExp(count: number, nature: string, boost: boolean, group: 'normal' | 'pseudo' | 'legendary' | 'mythical' = 'normal'): number {
  return Math.round(count * 25 * natureExpFactor(nature) * (boost ? 2 : 1) / groupMult(group))
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
  const need = Math.max(0, expTo(opts.to) - expTo(opts.from) - (opts.remaining ?? 0)) * groupMult(group)
  const per = 25 * natureExpFactor(opts.nature) * (opts.boost ? 2 : 1)
  const candy = Math.ceil(need / per)
  let shards = 0
  for (let lv = opts.from; lv < opts.to; lv++) shards += shardsTo(lv + 1) * (opts.boost ? 5 : 1)
  return { exp: need, candy, shards }
}
