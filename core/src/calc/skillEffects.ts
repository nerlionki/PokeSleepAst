import { INGREDIENTS, pokeById } from './data'
import { MAIN_SKILLS, clampSkillLevel, mainSkillValue, skillByPokedexName } from './mainSkills'
import { chargeStrength } from './skills'
import type { ProduceInput, ProduceResult } from '../types'

/** 用户确认：验证 Wiki 的 26 个候选等概率，未确认的技能不进入池。 */
export const METRONOME_POOL = [1,5,2,15,20,39,9,10,31,23,24,29,26,4,30,7,8,17,32,11,13,25,3,6,14,21] as const
const BOOST = [[2,2,3,4,6],[3,3,4,5,7],[3,3,5,6,8],[4,4,6,7,9],[4,5,7,8,10],[5,6,8,9,11]]
const CRESCENT_SELF = [[5,7,9,12,14],[9,12,15,16,19],[13,17,18,20,24],[17,19,25,28,29],[21,24,27,28,30],[25,29,30,31,32]]
const CRESCENT_TEAM = [[1,1,1,1,2],[1,1,1,2,3],[1,1,2,3,4],[1,2,2,3,5],[1,2,3,5,7],[1,2,4,6,9]]

export interface EffectActor {
  poke: { id: number, mainSkill: string, berry: string }
  input: ProduceInput
  energy: number
  factor: number
  skillLv: number
  skillRate: number
  unitBerry: number
  result: ProduceResult
}
export interface EffectContext {
  ingredient(actor: EffectActor, name: string, amount: number): void
  help(target: EffectActor, amount: number): void
  pot(amount: number): void
  crit(choices: { amount: number, probability: number }[]): void
  skillOnly(target: EffectActor, helps: number, probability: number): void
  charge(actor: EffectActor, amount: number): void
}

function reward(actor: EffectActor, key: 'dreamShards' | 'candies' | 'berryJuice', amount: number) {
  actor.result.rewards ??= { dreamShards: 0, candies: 0, berryJuice: 0 }
  actor.result.rewards[key] += amount
}

/** 技能效果采用期望状态近似，料理暴击另保留概率分支。 */
export function applyMainSkill(actor: EffectActor, team: EffectActor[], context: EffectContext, weight = 1) {
  const selected = skillByPokedexName(actor.poke.mainSkill)
  if (!selected || weight <= 0) return false
  const choices = selected.id === 12 ? METRONOME_POOL.map(id => ({ id, probability: 1 / METRONOME_POOL.length })) : [{ id: selected.id, probability: 1 }]
  const crit: { amount: number, probability: number }[] = []
  for (const choice of choices) {
    const name = MAIN_SKILLS.find(skill => skill.id === choice.id)!.name
    const level = clampSkillLevel(name, actor.skillLv)
    const w = weight * choice.probability
    const value = (column: string) => mainSkillValue(name, level, column)
    const heal = (target: EffectActor, amount: number) => { target.energy = Math.min(150, target.energy + amount * w * target.factor) }
    const food = (amount: number, pool = INGREDIENTS) => { for (const ingredient of pool) context.ingredient(actor, ingredient.name, amount * w / pool.length) }
    const berry = (target: EffectActor, amount: number) => {
      target.result.berries += amount * w
      target.result.berryEnergy += amount * w * target.unitBerry
    }
    const matchingSpecies = Math.min(5, Math.max(1, new Set(team.filter(member => member.poke.berry === actor.poke.berry).map(member => member.poke.id)).size)) - 1
    const pair = team.some(member => /正电|正電|负电|負電/.test(member.poke.mainSkill))
    switch (choice.id) {
      case 1: case 2: case 5: case 15: case 39:
        context.charge(actor, chargeStrength(name, level) * w)
        if (choice.id === 39) reward(actor, 'dreamShards', value('梦碎') * w)
        break
      case 3: reward(actor, 'dreamShards', value('梦碎') * w); break
      case 6: reward(actor, 'dreamShards', (value('最低') + value('最高')) / 2 * w); break
      case 7: heal(actor, value('活力')); break
      case 4:
        for (const target of team) heal(target, value('活力') / team.length)
        break
      case 8: case 32:
        for (const target of team) heal(target, value('活力'))
        if (choice.id === 32) reward(actor, 'berryJuice', 0.185 * w)
        break
      case 17: {
        heal(actor, value('自己'))
        const ranked = [...team].sort((a,b) => a.energy - b.energy)
        const weights = ranked.map((_, index) => index === 0 ? 0.72 : 0.07)
        const total = weights.reduce((a,b) => a+b, 0)
        ranked.forEach((target,index) => heal(target, value('同伴') * 0.45 * weights[index]! / total))
        break
      }
      case 9:
        for (const target of team) context.help(target, value('帮忙') * w / team.length)
        break
      case 14:
        for (const target of team) context.help(target, BOOST[level-1]![matchingSpecies]! * w)
        break
      case 10: case 29: case 31:
        food(value('食材'))
        if (choice.id === 29) reward(actor, 'candies', value('糖果') / 3 * w)
        if (choice.id === 31) crit.push({ amount: Number(MAIN_SKILLS.find(skill => skill.id === 31)!.levels[level-1]![1]!.replace('%','')) / 100, probability: w })
        break
      case 23:
        food(value('食材') * 0.86, INGREDIENTS.filter(item => [2,7,15,17].includes(item.id)))
        reward(actor, 'dreamShards', (value('梦碎') * 0.112 + value('大成功') * 0.028) * w)
        break
      case 24:
        food(value('食材') * (1 + 1/6), INGREDIENTS.filter(item => [4,10,12,16].includes(item.id)))
        break
      case 26:
        food(value('携带'))
        if (pair) {
          const index = actor.input.ingredientSlots[0]
          // 正电追加发动者第一个食材；未选择食材则无追加。
          const ingredient = index == null ? undefined : pokeById(actor.input.pokeId)?.ingredients[index]
          if (ingredient) context.ingredient(actor, ingredient.name, value('一致追加') * w)
        }
        break
      case 11: case 25:
        context.pot(value('锅容量') * w)
        if (choice.id === 25 && pair) for (const target of team) heal(target, value('活力') / team.length)
        break
      case 13:
        crit.push({ amount: Number(MAIN_SKILLS.find(skill => skill.id === 13)!.levels[level-1]![0]!.replace('%','')) / 100, probability: w })
        break
      case 20:
        for (const target of team) berry(target, target === actor ? value('基础') : value('追加'))
        break
      case 21:
        for (const target of team) {
          heal(target, value('活力'))
          berry(target, (target === actor ? CRESCENT_SELF : CRESCENT_TEAM)[level-1]![matchingSpecies]!)
        }
        break
      case 30:
        for (const target of team) {
          heal(target, value('活力') / team.length)
          context.skillOnly(target, value('技能帮忙'), w / team.length)
        }
        break
      default: return false
    }
  }
  if (crit.length) context.crit(crit)
  return true
}
