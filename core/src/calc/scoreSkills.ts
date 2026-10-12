import { INGREDIENTS, berryByName } from './data'
import { MAIN_SKILLS, clampSkillLevel, mainSkillValue, skillByPokedexName } from './mainSkills'
import { BOOST, CRESCENT_SELF, CRESCENT_TEAM, DISGUISE_CRIT_CHANCE, DRACO_SELF, DRACO_TEAM, METRONOME_POOL, SELECT_POOLS, SPIT_UP_CHANCE } from './skillEffects'
import { SPECIAL_TEAM_POKEMON } from './teamRestrictions'

export interface ScoreActor {
  uid: string, pokeId: number, berry: string, skill: string, skillLevel: number, rate: number
  energy: number, factor: number, disguise: boolean, stockpile: number, firstFood: string
}
export interface ScoreSkillContext {
  random(): number
  heal(target: ScoreActor, amount: number): void
  charge(amount: number): void
  berries(target: ScoreActor, amount: number): void
  ingredient(name: string, amount: number): void
  helps(target: ScoreActor, count: number, skillOnly?: boolean): void
  pot(amount: number): void
  crit(amount: number): void
  zone(amount: number): void
  juice(): void
  warning(text: string): void
}
/** 规划使用整数事件；共用技能表与候选池，不改变现有期望值对比模型。 */
export function scoreSkill(actor: ScoreActor, team: ScoreActor[], ctx: ScoreSkillContext, selectedId?: number, depth = 0): void {
  if (depth > 8) { ctx.warning('技能连锁超过模拟深度，结果存在截断'); return }
  const selected = selectedId == null ? skillByPokedexName(actor.skill, actor.pokeId) : MAIN_SKILLS.find(s => s.id === selectedId)
  if (!selected) { ctx.warning(`未支持主技能：${actor.skill}`); return }
  const pick = <T>(items: readonly T[]) => items[Math.floor(ctx.random() * items.length)]!
  const level = clampSkillLevel(selected.name, actor.skillLevel)
  const value = (name: string) => mainSkillValue(selected.name, level, name)
  const percent = (name: string) => Number(selected.levels[level - 1]?.[selected.columns.indexOf(name)]?.replace('%', '')) / 100 || 0
  const randomTarget = () => pick(team)
  const heal = (target: ScoreActor, amount: number) => ctx.heal(target, amount * target.factor)
  const food = (amount: number, ids?: readonly number[]) => {
    const pool = ids ? INGREDIENTS.filter(i => ids.includes(i.id)) : INGREDIENTS
    // 食材获取抽选三种不同食材；精选池按整份随机抽选，保证整数库存。
    if (ids) { ctx.ingredient(pick(pool).name, amount); return }
    const available = [...pool]
    for (let i = 0; i < Math.min(3, pool.length); i++) {
      const index = Math.floor(ctx.random() * available.length)
      const ingredient = available.splice(index, 1)[0]!
      ctx.ingredient(ingredient.name, Math.floor(amount / 3) + Number(i < amount % 3))
    }
  }
  const same = Math.min(5, Math.max(1, new Set(team.filter(m => m.berry === actor.berry).map(m => m.pokeId)).size)) - 1
  // 按技能识别同伴：同号组合及正电拍拍＋低调颤弦蝾螈均生效，不按物种限制。
  const pair = team.some(m => m !== actor && /正电|正電|负电|負電/.test(m.skill))
  switch (selected.id) {
    case 1: case 2: case 39:
      ctx.charge(value('能量')); break
    case 5:
      ctx.charge(Math.floor(value('最低') + ctx.random() * (value('最高') - value('最低') + 1))); break
    case 15:
      if (actor.stockpile >= 10 || ctx.random() < SPIT_UP_CHANCE) {
        ctx.charge(Number(selected.extra![0]!.levels[level - 1]![actor.stockpile])); actor.stockpile = 0
      } else actor.stockpile++
      break
    case 22:
      ctx.charge(value('能量'))
      for (const target of team) if (berryByName(target.berry)?.type !== '恶') target.energy = Math.max(0, target.energy - 12)
      break
    case 40:
      ctx.charge(value('能量')); ctx.zone(percent('树果领域')); break
    case 3: case 6: break // 梦碎不计卡比兽能量。
    case 7: heal(actor, value('活力')); break
    case 4: heal(randomTarget(), value('活力')); break
    case 8: case 32:
      for (const target of team) heal(target, value('活力'))
      if (selected.id === 32 && ctx.random() < 0.185) ctx.juice()
      break
    case 17: {
      heal(actor, value('自己'))
      if (ctx.random() < 0.45) {
        const ranked = [...team].sort((a, b) => a.energy - b.energy)
        const low = ranked.filter(m => m.energy === ranked[0]!.energy)
        heal(ctx.random() < 0.72 ? pick(low) : randomTarget(), value('同伴'))
      }
      break
    }
    case 9: ctx.helps(randomTarget(), value('帮忙')); break
    case 14: for (const target of team) ctx.helps(target, BOOST[level - 1]![same]!); break
    case 10: case 29: case 31:
      food(value('食材'))
      if (selected.id === 31) ctx.crit(percent('暴击'))
      break
    case 23:
      if (ctx.random() >= 0.14) food(value('食材'), [2, 7, 15, 17])
      break
    case 24: food(value('食材') * (ctx.random() < 1 / 6 ? 2 : 1), [4, 10, 12, 16]); break
    case 28: case 33: case 36: case 38: food(value('食材'), SELECT_POOLS[selected.id]); break
    case 26: case 27:
      food(value('携带')); if (pair && actor.firstFood) ctx.ingredient(actor.firstFood, value('一致追加')); break
    case 11: case 25:
      ctx.pot(value('锅容量'))
      if (selected.id === 25 && pair) heal(randomTarget(), value('活力'))
      break
    case 13: ctx.crit(percent('暴击')); break
    case 16: {
      const hit = actor.disguise && ctx.random() < DISGUISE_CRIT_CHANCE
      if (hit) actor.disguise = false
      for (const target of team) ctx.berries(target, (target === actor ? value('基础') : value('追加')) * (hit ? 3 : 1))
      break
    }
    case 20:
      for (const target of team) ctx.berries(target, target === actor ? value('基础') : value('追加'))
      break
    case 21:
      for (const target of team) { heal(target, value('活力')); ctx.berries(target, (target === actor ? CRESCENT_SELF : CRESCENT_TEAM)[level - 1]![same]!) }
      break
    case 35: {
      const available = [...team]
      for (let i = 0; i < Math.min(2, team.length); i++) {
        const ranked = [...available].sort((a, b) => a.energy - b.energy)
        const target = ctx.random() < 0.72 ? ranked[0]! : pick(available)
        available.splice(available.indexOf(target), 1)
        heal(target, value('活力')); ctx.helps(target, value('帮忙') + (team.some(m => m.pokeId === 381) ? value('组合追加') : 0))
      }
      break
    }
    case 37:
      for (const target of team) ctx.berries(target, (target === actor ? DRACO_SELF : DRACO_TEAM)[level - 1]![same]!
        + (target === actor && team.some(m => m.pokeId === 380) ? value('拉帝亚斯') : 0))
      break
    case 30: {
      const target = randomTarget(); heal(target, value('活力')); ctx.helps(target, value('技能帮忙'), true); break
    }
    case 12: scoreSkill(actor, team, ctx, pick(METRONOME_POOL), depth + 1); break
    case 18: case 19: {
      const targets = team.filter(m => m !== actor)
      const target = targets.length ? pick(targets) : undefined
      const id = target ? skillByPokedexName(target.skill, target.pokeId)?.id : undefined
      const failed = !target || !id || SPECIAL_TEAM_POKEMON.has(target.pokeId) || [18, 19, 22, 35, 37, 40].includes(id)
      scoreSkill(actor, team, ctx, failed ? 1 : id, depth + 1)
      break
    }
    default: ctx.warning(`未支持主技能：${selected.name}`)
  }
}
