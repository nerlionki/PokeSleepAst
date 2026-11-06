import runtimeParameters from '../data/runtime-parameters.resource'
import ruleParameters from '../data/rule-parameters.resource'
import extracted0 from '../data/calc-tables.resource'
import { EVENT_PARAMETERS, activityMiniCandyBoost, activityValues, createActivityContext, type ActivitySelection } from './activities'
import { NEUTRAL_NATURE, pokeById } from './data'
import type { ExpGroup, TrainingProgress } from './xp'
import { advanceTrainingState, expTo, feedTrainingState as baseFeedTrainingState, groupMult, natureExpFactor, xpCandy } from './xp'
const train_config_extracted0 = extracted0.modules.train
const train_napDailyExp_ruleParameters = ruleParameters.modules.train.napDailyExp
const train_napTotalExp_ruleParameters = ruleParameters.modules.train.napTotalExp
const train_trainPlan_runtimeParameters = runtimeParameters.modules.train.trainPlan.values
const train_trainPlan_ruleParameters = ruleParameters.modules.train.trainPlan


export interface TrainInput {
  activity?: ActivitySelection
  island?: string
  pokeId?: number
  from: number
  to: number
  remaining: number
  nature: string
  sleepOnTeam: boolean
  napping: boolean
  napDays: number
  earlyRetrieve: boolean
  relaxTicket: boolean
  /** 留空且启用券时无限续券；有限张数耗尽后恢复普通寄放经验。 */
  relaxTicketCount?: number
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

export const SLEEP_EXP_BONUS = (train_config_extracted0.SLEEP_EXP_BONUS as 0.14)
export const SLEEP_EXP_BONUS_MAX = (train_config_extracted0.SLEEP_EXP_BONUS_MAX as 5)

export function napDailyExp(relax: boolean, nature = NEUTRAL_NATURE): number {
  // 午睡岛只有 EXP 上升性格生效，下降性格不会减少所得。
  return (relax ? train_napDailyExp_ruleParameters.relaxDailyExp : train_napDailyExp_ruleParameters.normalDailyExp) * Math.max(1, natureExpFactor(nature))
}

/** 最后一个参数：false 为单张券，true 为无限续券，数字为本次寄放剩余覆盖天数。 */
export function napTotalExp(days: number, relax: boolean, _early: boolean, nature = NEUTRAL_NATURE, renewRelax: boolean | number = false): number {
  const duration = Math.min(train_napTotalExp_ruleParameters.maxDays, Math.max(0, days))
  const ticketDuration = typeof renewRelax === 'number' ? Math.min(duration, Math.max(0, renewRelax))
    : renewRelax ? duration : Math.min(train_napTotalExp_ruleParameters.relaxDays, duration)
  const raw = (train_napTotalExp_ruleParameters.normalDailyExp * duration + (relax ? train_napTotalExp_ruleParameters.relaxExtraExp * ticketDuration : 0)) * Math.max(1, natureExpFactor(nature))
  return Math.floor(raw * (duration < train_napTotalExp_ruleParameters.relaxDays ? train_napTotalExp_ruleParameters.earlyRetrieveMultiplier : 1))
}

export function trainPlan(input: TrainInput) {
  const ticketCountError = input.relaxTicketCount != null && (!Number.isSafeInteger(input.relaxTicketCount) || input.relaxTicketCount < 0)
    ? '午睡券张数须为非负整数，留空表示无限张' : ''
  const ticketCount = ticketCountError ? 0 : input.relaxTicketCount
  const useRelax = ticketCount == null ? input.relaxTicket : ticketCount > 0
  const coveredDays = ticketCount == null ? Infinity : ticketCount * train_napTotalExp_ruleParameters.relaxDays
  const activity = createActivityContext('research', input.activity)
  const effects = (day = 0) => activityValues(activity, input.island ?? '', pokeById(input.pokeId ?? 0), day * 1440 + (train_trainPlan_runtimeParameters.p001 as 240))
  const feedTrainingState = (progress: Readonly<TrainingProgress>, count: number, target: number, nature: string, group: ExpGroup, boost: boolean | number = false, shards = 1, day = 0) => {
    const event = effects(day)
    return baseFeedTrainingState(progress, count, target, nature, group, (typeof boost === 'number' ? boost : boost ? EVENT_PARAMETERS.candyBoosts.christmas.exp : 1) * event.candyExpMultiplier, shards * event.candyShardMultiplier)
  }
  const mini = input.boost === 'mini' ? activityMiniCandyBoost(activity) : undefined
  const boostPolicy = input.boost === 'none' ? undefined : mini ?? EVENT_PARAMETERS.candyBoosts[input.boost === 'mini' ? 'mini' : 'christmas']

  const gap = xpCandy({
    from: input.from,
    to: input.to,
    remaining: input.remaining,
    nature: input.nature,
    group: input.group,
  })
  const usable = Math.max(0, Math.floor(input.ownedCandy - input.reserveCandy))
  const bonusFactor = 1 + SLEEP_EXP_BONUS * Math.min(SLEEP_EXP_BONUS_MAX, Math.max(0, Math.floor(input.sleepExpBonus)))
  const sleepFactor = bonusFactor * (input.sleepIncense ? train_trainPlan_ruleParameters.sleepIncenseMultiplier : 1)
  const sleepThen = Math.max(0, input.sleepScore) * sleepFactor * natureExpFactor(input.nature)
  const dailySleep = input.sleepOnTeam && !input.napping ? sleepThen : 0
  const dailyNap = input.napping ? napDailyExp(useRelax, input.nature) : 0
  const dailyCandies = Math.max(0, Math.floor(input.dailyCandy))
  const boostShard = boostPolicy?.shards ?? 1
  const initial = { level: input.from, exp: expTo(input.to) * groupMult(input.group) - gap.exp }
  const boosted = Math.min(Math.max(0, Math.floor(input.boostCandy)), usable)
  const boostError = input.boost === 'mini' && mini === null ? '当前活动日期未开放迷你糖果增强' : mini && boosted > mini.dailyLimit ? `迷你糖果增强每天最多 ${mini.dailyLimit} 颗，请分日规划` : ''
  const fedBoost = gap.error ? initial : feedTrainingState(initial, boosted, input.to, input.nature, input.group, boostPolicy?.exp ?? 1, boostShard).progress
  const fed = gap.error ? initial : feedTrainingState(fedBoost, usable - boosted, input.to, input.nature, input.group).progress
  const feedExp = fed.exp - initial.exp
  const daysOf = (daily: number, progress = initial, candies = 0): number => {
    if (gap.error) return NaN
    if (progress.level >= input.to) return 0
    if ((daily <= 0 || activity.overrides?.sleepExpMultiplier === 0) && candies <= 0) return Infinity
    if (!candies && !activity.catalog.activities.length && effects().sleepExpMultiplier === 1) return Math.ceil(Math.max(0, expTo(input.to) * groupMult(input.group) - progress.exp) / daily)
    let next = { ...progress }
    let days = 0
    while (next.level < input.to) {
      next = feedTrainingState(advanceTrainingState(next, daily * effects(days).sleepExpMultiplier, input.to, input.group), candies, input.to, input.nature, input.group, false, 1, days).progress
      days++
    }
    return days
  }
  const stayDays = Math.min(train_trainPlan_ruleParameters.maxNapDays, Math.max(1, Math.floor(input.napDays) || train_trainPlan_ruleParameters.defaultAndRelaxDays))
  const daysOnNap = (relax: boolean, progress = initial, candies = 0): number => {
    if (gap.error) return NaN
    let next = { ...progress }
    let days = 0
    // With no candy feeding, stay on the island until the target is reached.
    // Only collection for feeding (or explicitly early collection) needs cycles.
    const period = candies > 0 || stayDays < train_trainPlan_ruleParameters.defaultAndRelaxDays ? stayDays : train_trainPlan_ruleParameters.maxNapDays
    const firstCollection = Math.min(stayDays, train_trainPlan_ruleParameters.defaultAndRelaxDays)
    while (next.level < input.to) {
      // 券按实际寄放天数消耗，领回再寄放不重置剩余有效时间。
      // 寄放期间不能喂糖，糖果只在领回时结算；提前领回仍减半。
      for (let duration = firstCollection; duration <= period; duration++) {
        const collected = napTotalExp(duration, relax, duration < train_trainPlan_ruleParameters.defaultAndRelaxDays, input.nature, Math.max(0, coveredDays - days))
        const candidate = feedTrainingState(advanceTrainingState(next, collected, input.to, input.group), candies * duration, input.to, input.nature, input.group, false, 1, days + duration - 1).progress
        if (candidate.level >= input.to) return days + duration
        if (duration === period) next = candidate
      }
      days += period
    }
    return days
  }
  const dailyPreview = !gap.error && !input.napping ? advanceTrainingState(fed, dailySleep * effects().sleepExpMultiplier, input.to, input.group) : fed
  const candyPreview = gap.error ? 0 : feedTrainingState(dailyPreview, dailyCandies, input.to, input.nature, input.group).exp
  const dailyExp = dailySleep * effects().sleepExpMultiplier + dailyNap + (input.napping ? 0 : candyPreview)
  const days = input.napping ? daysOnNap(useRelax, fed, dailyCandies) : daysOf(dailySleep, fed, dailyCandies)
  const napExp = input.napping ? napTotalExp(input.napDays || (Number.isFinite(days) ? days : train_trainPlan_ruleParameters.defaultAndRelaxDays), useRelax, input.earlyRetrieve, input.nature, coveredDays) : 0
  const afterNap = gap.error ? initial : advanceTrainingState(initial, napTotalExp(train_trainPlan_ruleParameters.defaultAndRelaxDays, false, false, input.nature), input.to, input.group)
  const plainFeed = gap.error ? initial : feedTrainingState(initial, usable, input.to, input.nature, input.group).progress
  const boostedCost = gap.error ? { progress: initial, candies: 0, shards: 0 } : feedTrainingState(initial, boosted, input.to, input.nature, input.group, boostPolicy?.exp ?? 1, boostShard)
  const normalCost = gap.error ? { candies: 0, shards: 0 } : feedTrainingState(boostedCost.progress, Infinity, input.to, input.nature, input.group)
  return {
    error: gap.error || boostError || ticketCountError,
    needExp: gap.exp,
    candy: gap.error ? NaN : boostedCost.candies + normalCost.candies,
    shards: gap.error ? NaN : boostedCost.shards + normalCost.shards,
    feedExp,
    dailyExp,
    days,
    napExp,
    paths: gap.error ? [] : [
      { name: '只上阵睡觉', days: daysOf(sleepThen) },
      { name: '只午睡岛（无券）', days: daysOnNap(false) },
      { name: ticketCount == null ? '只午睡岛（持续放松券）' : `只午睡岛（放松券 ${ticketCount} 张）`, days: daysOnNap(true) },
      { name: '午睡岛满 7 天再上阵', days: initial.level >= input.to ? 0 : daysOf(sleepThen, afterNap) + train_trainPlan_ruleParameters.defaultAndRelaxDays },
      { name: '先喂糖再睡', days: daysOf(sleepThen, fed, dailyCandies) },
      { name: '先喂糖再寄放', days: daysOnNap(false, fed, dailyCandies) },
      { name: '不增强只喂糖', days: daysOf(0, plainFeed, dailyCandies) },
    ],
    boostShard,
  }
}
