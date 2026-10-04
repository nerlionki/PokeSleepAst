import { xpCandy } from './xp'

export interface TrainInput {
  from: number
  to: number
  remaining: number
  nature: string
  sleepOnTeam: boolean
  napping: boolean
  napDays: number
  earlyRetrieve: boolean
  relaxTicket: boolean
  sleepScore: number
  /** 队伍里「睡眠 EXP 奖励」的个数，每个 +14%，加法叠加，最多 5 个。 */
  sleepExpBonus: number
  /** 红香（成长薰香）：睡眠 EXP 结算完再 ×2，不影响午睡岛和糖果。 */
  sleepIncense?: boolean
  ownedCandy: number
  reserveCandy: number
  dailyCandy: number
  boost: 'none' | 'mini' | 'normal'
  boostCandy: number
  group: 'normal' | 'pseudo' | 'legendary' | 'mythical'
}

export const SLEEP_EXP_BONUS = 0.14
export const SLEEP_EXP_BONUS_MAX = 5

export function napDailyExp(relax: boolean): number {
  return relax ? 600 : 150
}

export function napTotalExp(days: number, relax: boolean, early: boolean): number {
  const raw = napDailyExp(relax) * days
  return early && days < 7 ? Math.floor(raw * 0.5) : raw
}

export function trainPlan(input: TrainInput) {
  const gap = xpCandy({
    from: input.from,
    to: input.to,
    remaining: input.remaining,
    nature: input.nature,
    group: input.group,
  })
  const usable = Math.max(0, input.ownedCandy - input.reserveCandy)
  const bonusFactor = 1 + SLEEP_EXP_BONUS * Math.min(SLEEP_EXP_BONUS_MAX, Math.max(0, Math.floor(input.sleepExpBonus)))
  const sleepFactor = bonusFactor * (input.sleepIncense ? 2 : 1)
  const dailySleep = input.sleepOnTeam && !input.napping ? input.sleepScore * sleepFactor : 0
  const dailyNap = input.napping ? napDailyExp(input.relaxTicket) : 0
  const dailyExp = dailySleep + dailyNap + input.dailyCandy * 25
  const boostMult = input.boost === 'none' ? 1 : 2
  const boostShard = input.boost === 'mini' ? 4 : input.boost === 'normal' ? 5 : 1
  const feedExp = Math.min(input.boostCandy, usable) * 25 * boostMult
    + Math.max(0, usable - input.boostCandy) * 25
  const afterFeed = Math.max(0, gap.exp - feedExp)
  const days = dailyExp > 0 ? Math.ceil(afterFeed / dailyExp) : afterFeed > 0 ? Infinity : 0
  const napExp = input.napping ? napTotalExp(input.napDays || (Number.isFinite(days) ? days : 7), input.relaxTicket, input.earlyRetrieve) : 0
  const napPlain = napDailyExp(false)
  const napRelax = napDailyExp(true)
  const sleepThen = dailySleep || input.sleepScore * sleepFactor
  const daysOf = (daily: number, leftover = gap.exp) => daily > 0 ? Math.ceil(leftover / daily) : Infinity
  return {
    needExp: gap.exp,
    candy: gap.candy,
    shards: gap.shards,
    feedExp,
    dailyExp,
    days,
    napExp,
    paths: [
      { name: '只上阵睡觉', days: daysOf(sleepThen) },
      { name: '只午睡岛（无券）', days: daysOf(napPlain) },
      { name: '只午睡岛（放松券）', days: daysOf(napRelax) },
      { name: '午睡岛满 7 天再上阵', days: daysOf(sleepThen, Math.max(0, gap.exp - napTotalExp(7, false, false))) + 7 },
      { name: '先喂糖再睡', days: daysOf(sleepThen + input.dailyCandy * 25, afterFeed) },
      { name: '先喂糖再寄放', days: daysOf(napPlain + input.dailyCandy * 25, afterFeed) },
      { name: '不增强只喂糖', days: usable ? 0 : Infinity },
    ],
    boostShard,
  }
}
