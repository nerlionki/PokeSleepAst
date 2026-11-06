import { INGREDIENTS } from './data'
import { MAIN_SKILLS, clampSkillLevel, skillByPokedexName } from './mainSkills'
import { SKILL_EXECUTION, modelAmount, modelCondition, conditionNeedsTarget, modelTargets, type ModelContext } from './skillModel'
import type { SkillEffect } from './skillModelTypes'

export interface ScoreActor {
  uid: string, pokeId: number, berry: string, skill: string, skillLevel: number, rate: number
  energy: number, factor: number, disguise: boolean, stockpile: number, firstFood: string
}
export interface ScoreSkillContext {
  modifiers?(skillName: string): { ingredient: number; berry: number; healing: number }
  random(): number
  heal(target: ScoreActor, amount: number): void
  charge(amount: number): void
  berries(target: ScoreActor, amount: number): void
  ingredient(name: string, amount: number): void
  helps(target: ScoreActor, count: number, skillOnly?: boolean): void
  pot(amount: number): void
  crit(amount: number): void
  zone(amount: number): void
  giveItem(id: number, amount: number): void
  warning(text: string): void
}

/** Execute the same validated effects with seeded integer-event semantics. */
export function scoreSkill(actor: ScoreActor, team: ScoreActor[], ctx: ScoreSkillContext, selectedId?: number, depth = 0): void {
  if (depth > SKILL_EXECUTION.recursionLimit) { ctx.warning('技能连锁超过模拟深度，结果存在截断'); return }
  const selected = selectedId == null ? skillByPokedexName(actor.skill, actor.pokeId) : MAIN_SKILLS.find(skill => skill.id === selectedId)
  if (!selected) { ctx.warning('未支持主技能：' + actor.skill); return }
  const pick = <T>(rows: readonly T[]) => rows[Math.floor(ctx.random() * rows.length)]!
  const modifiers = (selected.model.effects.some(effect => !effect.profiles || effect.profiles.includes('sampled')) ? ctx.modifiers?.(selected.name) : undefined) ?? { ingredient: 1, berry: 1, healing: 1 }
  const level = clampSkillLevel(selected.name, actor.skillLevel)
  const base: ModelContext = { profile: 'sampled', skill: selected, level, actor, team, random: ctx.random, firstIngredient: actor.firstFood }
  const execute = (effects: SkillEffect[], bound?: ScoreActor, multiplier = 1) => {
    for (const effect of effects) {
      if (effect.profiles && !effect.profiles.includes('sampled')) continue
      if (effect.condition && !conditionNeedsTarget(effect.condition) && !modelCondition(effect.condition, base)) continue
      if (effect.chance) {
        const roll = ctx.random(), pass = effect.chance.test === 'gte' ? roll >= effect.chance.probability : roll < effect.chance.probability
        if (!pass) continue
      }
      for (const { target } of modelTargets(effect.target, base, bound)) {
        const targetActor = target as ScoreActor, model = { ...base, target }
        if (!modelCondition(effect.condition, model)) continue
        const value = (amount = effect.amount) => modelAmount(amount, model) * multiplier
        switch (effect.op) {
          case 'sequence': execute(effect.effects!, targetActor, multiplier); break
          case 'charge': ctx.charge(value()); break
          case 'currency': break // Currency rewards do not contribute to the score planner.
          case 'giveItem': ctx.giveItem(effect.itemId!, value()); break
          case 'heal': ctx.heal(targetActor, value() * targetActor.factor * modifiers.healing); break
          case 'help': ctx.helps(targetActor, value()); break
          case 'skillOnlyHelp': ctx.helps(targetActor, value(), true); break
          case 'pot': ctx.pot(value()); break
          case 'crit': ctx.crit(value()); break
          case 'zone': ctx.zone(value()); break
          case 'drainEnergy': targetActor.energy = Math.max(0, targetActor.energy - value()); break
          case 'firstIngredient': {
            const amount = Math.floor(value() * modifiers.ingredient)
            if (actor.firstFood && amount) ctx.ingredient(actor.firstFood, amount)
            break
          }
          case 'ingredients': {
            const bonus = modelAmount(effect.roundingBonus, model)
            const amount = effect.roundingBonus ? Math.floor((value() + bonus) * modifiers.ingredient) - Math.floor(bonus * modifiers.ingredient) : Math.floor(value() * modifiers.ingredient)
            const pool = effect.pool ? INGREDIENTS.filter(item => effect.pool!.includes(item.id)) : INGREDIENTS
            if (effect.pool) { ctx.ingredient(pick(pool).name, amount); break }
            const available = [...pool], draws = effect.draws!
            for (let i = 0; i < Math.min(draws, pool.length); i++) {
              const index = Math.floor(ctx.random() * available.length), item = available.splice(index, 1)[0]!
              ctx.ingredient(item.name, Math.floor(amount / draws) + Number(i < amount % draws))
            }
            break
          }
          case 'berries': ctx.berries(targetActor, Math.floor(value(target === actor ? effect.selfAmount : effect.otherAmount) * modifiers.berry)); break
          case 'onceBonus': {
            const hit = actor.disguise && ctx.random() < effect.releaseChance!
            if (hit) actor.disguise = false
            execute(effect.effects!, bound, multiplier * (hit ? 1 + effect.bonus! : 1))
            break
          }
          case 'accumulateRelease':
            if (actor.stockpile >= effect.maxStacks! || ctx.random() < effect.releaseChance!) {
              ctx.charge(Number(selected.extra![effect.extraTable!]!.levels[level - 1]![actor.stockpile])); actor.stockpile = 0
            } else actor.stockpile++
            break
        }
      }
    }
  }
  execute(selected.model.effects)
  const selection = selected.model.selection
  if (selection?.kind === 'random') { scoreSkill(actor, team, ctx, pick(selection.pool!), depth + 1); return }
  if (selection?.kind === 'choose') { scoreSkill(actor, team, ctx, selection.fallbackSkillId, depth + 1); return }
  if (selection?.kind === 'copy') {
    const targets = team.filter(target => target !== actor), target = targets.length ? pick(targets) : undefined
    const copied = target ? skillByPokedexName(target.skill, target.pokeId) : undefined
    const failed = !target || !copied?.model.copyable || selection.blockedPokemon!.includes(target.pokeId)
    scoreSkill(actor, team, ctx, failed ? selection.fallbackSkillId : copied!.id, depth + 1)
    return
  }
}
