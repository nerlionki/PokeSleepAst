import ruleParameters from '../data/rule-parameters.json'
/** RAE 睡姿图鉴的逐睡姿奖励：https://pks.raenonx.cc/zh/sleepdex/lookup */
import rewards from '../data/sleep-rewards.json'
import { unlockedSubskills } from './member'
const sleepRewards_teamResearchBonuses_ruleParameters = ruleParameters.modules.sleepRewards.teamResearchBonuses
const sleepRewards_boostedResearchReward_ruleParameters = ruleParameters.modules.sleepRewards.boostedResearchReward
const sleepRewards_dailyResearchReward_ruleParameters = ruleParameters.modules.sleepRewards.dailyResearchReward


export interface ResearchBonuses {
  researchExpBonus?: number
  shardBonus?: number
  focusIncense?: boolean
  luckIncense?: boolean
}

export function teamResearchBonuses(team: readonly { level: number, subskills: string[], napping?: boolean }[]) {
  const skills = team.slice(0, sleepRewards_teamResearchBonuses_ruleParameters.teamSize).filter(member => !member.napping).map(member => unlockedSubskills(member.level, member.subskills))
  return {
    researchExpBonus: skills.filter(subs => subs.includes('researchExp')).length,
    shardBonus: skills.filter(subs => subs.includes('shardBonus')).length,
  }
}

/** 研究收益按期望值保留小数；奖励副技能加法叠加，薰香再乘二，不影响糖果或技能梦碎。 */
export function boostedResearchReward(reward: SleepReward | undefined, bonuses: ResearchBonuses): SleepReward | undefined {
  if (!reward) return undefined
  if (!bonuses.researchExpBonus && !bonuses.shardBonus && !bonuses.focusIncense && !bonuses.luckIncense) return reward
  const count = (value = 0) => Math.min(sleepRewards_boostedResearchReward_ruleParameters.maxBonusHolders, Math.max(0, Math.floor(value)))
  return {
    candy: reward.candy,
    researchExp: reward.researchExp * (1 + sleepRewards_boostedResearchReward_ruleParameters.researchExpPerHolder * count(bonuses.researchExpBonus)) * (bonuses.focusIncense ? sleepRewards_boostedResearchReward_ruleParameters.incenseMultiplier : 1),
    shards: reward.shards * (1 + sleepRewards_boostedResearchReward_ruleParameters.shardsPerHolder * count(bonuses.shardBonus)) * (bonuses.luckIncense ? sleepRewards_boostedResearchReward_ruleParameters.incenseMultiplier : 1),
  }
}

export interface SleepReward {
  researchExp: number
  shards: number
  candy: number
}

const byId = new Map(rewards.map((row) => [row.id, row]))
const bySpeciesAndStars = new Map<string, (typeof rewards)[number]>()
for (const row of rewards) {
  const key = `${row.pokeId}-${row.stars}`
  if (!bySpeciesAndStars.has(key)) bySpeciesAndStars.set(key, row)
}

/** RAE 睡姿内码优先；普通睡姿用宝可梦与星级定位。 */
export function sleepReward(style: { pokeId: number, stars: number, styleId?: number }): SleepReward | undefined {
  return (style.styleId != null ? byId.get(style.styleId) : undefined)
    ?? bySpeciesAndStars.get(`${style.pokeId}-${style.stars}`)
}

/** Original game sleep-style order, independent of per-island generated row IDs. */
export function sleepStyleInternalId(style: { pokeId: number, stars: number, styleId?: number }): number {
  return style.styleId ?? bySpeciesAndStars.get(`${style.pokeId}-${style.stars}`)?.id ?? Number.MAX_SAFE_INTEGER
}

/** 当日按抽选顺序累计；特殊UP实际出现时完整奖励上限为11。 */
export function dailyResearchReward(reward: SleepReward | undefined, index: number, limit = sleepRewards_dailyResearchReward_ruleParameters.defaultFullRewardLimit): SleepReward | undefined {
  if (!reward || index < limit) return reward
  return { candy: sleepRewards_dailyResearchReward_ruleParameters.reducedCandy, shards: reward.shards / sleepRewards_dailyResearchReward_ruleParameters.reducedRewardDivisor, researchExp: reward.researchExp / sleepRewards_dailyResearchReward_ruleParameters.reducedRewardDivisor }
}
