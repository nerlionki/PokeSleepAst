import { INGREDIENTS, berryByName, pokeById } from './data'
import { MAIN_SKILLS, clampSkillLevel, mainSkillValue, skillByPokedexName } from './mainSkills'
import { SPECIAL_TEAM_POKEMON } from './teamRestrictions'
import { chargeStrength } from './skills'
import type { ProduceInput, ProduceResult } from '../types'

/** 用户确认：验证 Wiki 的 26 个候选等概率，未确认的技能不进入池。 */
export const METRONOME_POOL = [1,5,2,15,20,39,9,10,31,23,24,29,26,4,30,7,8,17,32,11,13,25,3,6,14,21] as const
export const BOOST = [[2,2,3,4,6],[3,3,4,5,7],[3,3,5,6,8],[4,4,6,7,9],[4,5,7,8,10],[5,6,8,9,11]]
export const CRESCENT_SELF = [[5,7,9,12,14],[9,12,15,16,19],[13,17,18,20,24],[17,19,25,28,29],[21,24,27,28,30],[25,29,30,31,32]]
export const CRESCENT_TEAM = [[1,1,1,1,2],[1,1,1,2,3],[1,1,2,3,4],[1,2,2,3,5],[1,2,3,5,7],[1,2,4,6,9]]

// RAE 验证概率，非官方公布值：https://pks.raenonx.cc/en/mainskill/info/16
export const DISGUISE_CRIT_CHANCE = 0.185
// 完整档位：https://wikiwiki.jp/poke_sleep/メインスキル/きのみバースト/りゅうせいぐん
export const DRACO_SELF = [[12,14,18,18,20],[21,24,29,30,33],[29,29,35,37,41],[38,39,42,45,49],[43,44,48,49,53],[48,50,55,55,58]]
export const DRACO_TEAM = [[1,1,1,2,2],[1,1,1,2,2],[1,2,2,3,3],[1,2,3,4,4],[2,3,4,5,5],[3,4,4,5,5]]
// 用户确认按 RAE 验证值，Wiki 的 25% 不覆盖该值：https://pks.raenonx.cc/en/mainskill/info/15
export const SPIT_UP_CHANCE = 0.265
export const SELECT_POOLS: Record<number, number[]> = { 28: [4,10,19], 33: [9,10,16], 36: [4,16,18], 38: [6,7,11] }

export interface EffectActor {
  poke: { id: number, mainSkill: string, berry: string }
  input: ProduceInput
  energy: number
  factor: number
  skillLv: number
  skillRate: number
  unitBerry: number
  result: ProduceResult
  /** 下次睡眠研究前尚未发生画皮大成功的概率；复制者也使用自己的状态。 */
  disguiseReady?: number
  stockpile?: number[]
}
export interface EffectContext {
  ingredient(actor: EffectActor, name: string, amount: number): void
  help(target: EffectActor, amount: number): void
  pot(amount: number): void
  crit(choices: { amount: number, probability: number }[]): void
  skillOnly(target: EffectActor, helps: number, probability: number): void
  charge(actor: EffectActor, amount: number): void
  zone?(amount: number): void
}

function reward(actor: EffectActor, key: 'dreamShards' | 'candies' | 'berryJuice', amount: number) {
  actor.result.rewards ??= { dreamShards: 0, candies: 0, berryJuice: 0 }
  actor.result.rewards[key] += amount
}

/** 技能效果采用期望状态近似，料理暴击另保留概率分支。 */
export function applyMainSkill(actor: EffectActor, team: EffectActor[], context: EffectContext, weight = 1) {
  const selected = skillByPokedexName(actor.poke.mainSkill, actor.poke.id)
  if (!selected || weight <= 0) return false
  const expand = (id: number, probability: number) => id === 12
    ? METRONOME_POOL.map(id => ({ id, probability: probability / METRONOME_POOL.length })) : [{ id, probability }]
  const copying = selected.id === 18 || selected.id === 19
  const candidates = copying ? team.filter(target => target !== actor) : []
  const choices = copying ? (candidates.length ? candidates.flatMap(target => {
    const skill = skillByPokedexName(target.poke.mainSkill, target.poke.id)
    const failed = SPECIAL_TEAM_POKEMON.has(target.poke.id) || !skill || [18,19,22,35,37,40].includes(skill.id)
    return expand(failed ? 1 : skill!.id, 1 / candidates.length)
  }) : [{ id: 1, probability: 1 }]) : expand(selected.id, 1)
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
    const pair = team.some(member => member !== actor && /正电|正電|负电|負電/.test(member.poke.mainSkill))
    switch (choice.id) {
      case 1: case 2: case 5: case 39:
        context.charge(actor, chargeStrength(name, level) * w)
        if (choice.id === 39) reward(actor, 'dreamShards', value('梦碎') * w)
        break
      case 15: {
        const table = MAIN_SKILLS.find(skill => skill.id === 15)!.extra![0]!.levels[level - 1]!
        let state = actor.stockpile ?? [1,0,0,0,0,0,0,0,0,0,0]
        let strength = 0
        // 概率状态保留到下次发动；小数权重表示该分支发动的概率。
        for (let remaining = w; remaining > 1e-10; remaining -= 1) {
          const probability = Math.min(1, remaining)
          const next = state.map(mass => mass * (1 - probability))
          state.forEach((mass, stack) => {
            const spit = stack === 10 ? 1 : SPIT_UP_CHANCE
            strength += mass * probability * spit * Number(table[stack])
            next[0]! += mass * probability * spit
            if (stack < 10) next[stack + 1]! += mass * probability * (1 - spit)
          })
          state = next
        }
        actor.stockpile = state
        context.charge(actor, strength)
        break
      }
      case 40:
        context.charge(actor, value('能量') * w)
        context.zone?.(Number(MAIN_SKILLS.find(skill => skill.id === 40)!.levels[level - 1]![1]!.replace('%', '')) / 100 * w)
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
      case 28: case 33: case 36: case 38:
        food(value('食材'), INGREDIENTS.filter(item => SELECT_POOLS[choice.id]!.includes(item.id)))
        break
      case 26: case 27:
        food(value('携带'))
        if (pair) {
          const index = actor.input.ingredientSlots[0]
          // 正电追加发动者第一个食材；未选择食材则无追加。
          const ingredient = index == null ? undefined : pokeById(actor.input.pokeId)?.ingredients[index]
          if (ingredient) context.ingredient(actor, ingredient.name, value('一致追加') * w)
        }
        break
      case 11: case 25: case 41:
        context.pot(value('锅容量') * w)
        if (choice.id === 41) crit.push({ amount: Number(MAIN_SKILLS.find(skill => skill.id === 41)!.levels[level - 1]![1]!.replace('%', '')) / 100, probability: w })
        if (choice.id === 25 && pair) for (const target of team) heal(target, value('活力') / team.length)
        break
      case 13:
        crit.push({ amount: Number(MAIN_SKILLS.find(skill => skill.id === 13)!.levels[level-1]![0]!.replace('%','')) / 100, probability: w })
        break
      case 20:
        for (const target of team) berry(target, target === actor ? value('基础') : value('追加'))
        break
      case 16: {
        // 官方：一次大成功后直到睡眠研究/手动登记前不能再次大成功。
        // https://www.pokemonsleep.net/news/313931363231383538363537383238383635/
        // 期望状态保留未成功概率，避免每次发动都独立追加大成功收益。
        const ready = actor.disguiseReady ?? 1
        const success = ready * (1 - (1 - DISGUISE_CRIT_CHANCE) ** w)
        actor.disguiseReady = ready - success
        for (const target of team) berry(target, (target === actor ? value('基础') : value('追加')) * (1 + 2 * success / w))
        break
      }
      case 22:
        context.charge(actor, value('能量') * w)
        // 固定扣除 12，与性格回复倍率无关，恶属性豁免，最低为 0。
        // https://pks.raenonx.cc/en/mainskill/info/22 （Energy Recovery: Static）
        for (const target of team) {
          if (berryByName(target.poke.berry)?.type !== '恶') target.energy = Math.max(0, target.energy - 12 * w)
        }
        break
      case 21:
        for (const target of team) {
          heal(target, value('活力'))
          berry(target, (target === actor ? CRESCENT_SELF : CRESCENT_TEAM)[level-1]![matchingSpecies]!)
        }
        break
      case 35: {
        const count = Math.min(2, team.length)
        const helps = value('帮忙') + (team.some(member => member.poke.id === 381) ? value('组合追加') : 0)
        // 满队使用 RAE 验证权重：https://pks.raenonx.cc/en/mainskill/info/35
        // 不足五人的分布未核实，按随机两名期望；组合默认已解锁。
        const ranked = [...team].sort((a, b) => a.energy - b.energy)
        const weights = team.length === 5 ? [0.9265, 0.61938, 0.15137, 0.15137, 0.15137] : ranked.map(() => count / team.length)
        const total = weights.reduce((sum, value) => sum + value, 0)
        const chances = team.map(target => {
          const ties = ranked.flatMap((member, index) => member.energy === target.energy ? [index] : [])
          return ties.reduce((sum, index) => sum + weights[index]!, 0) / ties.length * count / total
        })
        team.forEach((target, index) => {
          const chance = chances[index]!
          heal(target, value('活力') * chance)
          context.help(target, helps * w * chance)
        })
        break
      }
      case 37:
        for (const target of team) {
          const amount = (target === actor ? DRACO_SELF : DRACO_TEAM)[level - 1]![matchingSpecies]!
            + (target === actor && team.some(member => member.poke.id === 380) ? value('拉帝亚斯') : 0)
          berry(target, amount)
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
