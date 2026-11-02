import runtimeParameters from '../data/runtime-parameters.resource'
import ruleParameters from '../data/rule-parameters.resource'
import extracted0 from '../data/calc-tables.resource'
import { EVENT_PARAMETERS, activityMiniCandyBoost, activityValues, createActivityContext, type ActivitySelection } from './activities'
import { pokeById } from './data'
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

export function napDailyExp(relax: boolean, nature = '勤奋'): number {
  // 午睡岛只有 EXP 上升性格生效，下降性格不会减少所得。
  return (relax ? train_napDailyExp_ruleParameters.relaxDailyExp : train_napDailyExp_ruleParameters.normalDailyExp) * Math.max(1, natureExpFactor(nature))
}

export function napTotalExp(days: number, relax: boolean, _early: boolean, nature = '勤奋'): number {
  const duration = Math.min(train_napTotalExp_ruleParameters.maxDays, Math.max(0, days))
  const raw = (train_napTotalExp_ruleParameters.normalDailyExp * duration + (relax ? train_napTotalExp_ruleParameters.relaxExtraExp * Math.min(train_napTotalExp_ruleParameters.relaxDays, duration) : 0)) * Math.max(1, natureExpFactor(nature))
  return Math.floor(raw * (duration < train_napTotalExp_ruleParameters.relaxDays ? train_napTotalExp_ruleParameters.earlyRetrieveMultiplier : 1))
}

export function trainPlan(input: TrainInput) {
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
  const dailyNap = input.napping ? napDailyExp(input.relaxTicket, input.nature) : 0
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
    let ticketDays = relax ? train_trainPlan_ruleParameters.defaultAndRelaxDays : 0
    while (next.level < input.to) {
      // 寄放期间不能喂糖；按所选停留时长领回结算，再喂这段期间积累的糖果。
      const raw = (train_trainPlan_ruleParameters.napDailyExp * stayDays + train_trainPlan_ruleParameters.napRelaxExtraExp * Math.min(ticketDays, stayDays)) * Math.max(1, natureExpFactor(input.nature))
      next = feedTrainingState(advanceTrainingState(next, Math.floor(raw * (stayDays < train_trainPlan_ruleParameters.defaultAndRelaxDays ? train_trainPlan_ruleParameters.earlyRetrieveMultiplier : 1)), input.to, input.group), candies * stayDays, input.to, input.nature, input.group, false, 1, days + stayDays - 1).progress
      ticketDays = Math.max(0, ticketDays - stayDays)
      days += stayDays
    }
    return days
  }
  const dailyPreview = !gap.error && !input.napping ? advanceTrainingState(fed, dailySleep * effects().sleepExpMultiplier, input.to, input.group) : fed
  const candyPreview = gap.error ? 0 : feedTrainingState(dailyPreview, dailyCandies, input.to, input.nature, input.group).exp
  const dailyExp = dailySleep * effects().sleepExpMultiplier + dailyNap + (input.napping ? 0 : candyPreview)
  const days = input.napping ? daysOnNap(input.relaxTicket, fed, dailyCandies) : daysOf(dailySleep, fed, dailyCandies)
  const napExp = input.napping ? napTotalExp(input.napDays || (Number.isFinite(days) ? days : train_trainPlan_ruleParameters.defaultAndRelaxDays), input.relaxTicket, input.earlyRetrieve, input.nature) : 0
  const afterNap = gap.error ? initial : advanceTrainingState(initial, napTotalExp(train_trainPlan_ruleParameters.defaultAndRelaxDays, false, false, input.nature), input.to, input.group)
  const plainFeed = gap.error ? initial : feedTrainingState(initial, usable, input.to, input.nature, input.group).progress
  const boostedCost = gap.error ? { progress: initial, candies: 0, shards: 0 } : feedTrainingState(initial, boosted, input.to, input.nature, input.group, boostPolicy?.exp ?? 1, boostShard)
  const normalCost = gap.error ? { candies: 0, shards: 0 } : feedTrainingState(boostedCost.progress, Infinity, input.to, input.nature, input.group)
  return {
    error: gap.error || boostError,
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
      { name: '只午睡岛（放松券）', days: daysOnNap(true) },
      { name: '午睡岛满 7 天再上阵', days: initial.level >= input.to ? 0 : daysOf(sleepThen, afterNap) + train_trainPlan_ruleParameters.defaultAndRelaxDays },
      { name: '先喂糖再睡', days: daysOf(sleepThen, fed, dailyCandies) },
      { name: '先喂糖再寄放', days: daysOnNap(false, fed, dailyCandies) },
      { name: '不增强只喂糖', days: daysOf(0, plainFeed, dailyCandies) },
    ],
    boostShard,
  }
}
