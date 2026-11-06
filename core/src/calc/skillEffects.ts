import extracted0 from '../data/skill-tables.resource'
import { cloneData } from './dataClone'
import { INGREDIENTS } from './data'
import { MAIN_SKILLS, clampSkillLevel, skillByPokedexName, type MainSkill } from './mainSkills'
import { itemById } from './itemCatalog'
import { SKILL_EXECUTION, modelAmount, modelCondition, conditionNeedsTarget, modelTargets, modelFirstIngredient, type ModelActor, type ModelContext } from './skillModel'
import type { SkillEffect } from './skillModelTypes'
import type { ProduceInput, ProduceResult } from '../types'
const skillEffects_config_extracted0 = extracted0.modules.skillEffects

/** 用户确认：验证 Wiki 的 26 个候选等概率，未确认的技能不进入池。 */
export const METRONOME_POOL = (cloneData(skillEffects_config_extracted0.METRONOME_POOL) as unknown as readonly [1,5,2,15,20,39,9,10,31,23,24,29,26,4,30,7,8,17,32,11,13,25,3,6,14,21])
export const BOOST = cloneData(skillEffects_config_extracted0.BOOST)
export const CRESCENT_SELF = cloneData(skillEffects_config_extracted0.CRESCENT_SELF)
export const CRESCENT_TEAM = cloneData(skillEffects_config_extracted0.CRESCENT_TEAM)

// RAE 验证概率，非官方公布值：https://pks.raenonx.cc/en/mainskill/info/16
export const DISGUISE_CRIT_CHANCE = (skillEffects_config_extracted0.DISGUISE_CRIT_CHANCE as 0.185)
// 完整档位：https://wikiwiki.jp/poke_sleep/メインスキル/きのみバースト/りゅうせいぐん
export const DRACO_SELF = cloneData(skillEffects_config_extracted0.DRACO_SELF)
export const DRACO_TEAM = cloneData(skillEffects_config_extracted0.DRACO_TEAM)
// 用户确认按 RAE 验证值，Wiki 的 25% 不覆盖该值：https://pks.raenonx.cc/en/mainskill/info/15
export const SPIT_UP_CHANCE = (skillEffects_config_extracted0.SPIT_UP_CHANCE as 0.265)
export const SELECT_POOLS: Record<number, number[]> = (cloneData(skillEffects_config_extracted0.SELECT_POOLS) as unknown as Record<number, number[]>)

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
  modifiers?(actor: EffectActor, skillName: string): { ingredient: number; berry: number; shards: number; healing: number }
  ingredient(actor: EffectActor, name: string, amount: number): void
  help(target: EffectActor, amount: number): void
  pot(amount: number): void
  crit(choices: { amount: number, probability: number }[]): void
  skillOnly(target: EffectActor, helps: number, probability: number): void
  charge(actor: EffectActor, amount: number): void
  zone?(amount: number): void
}


function reward(actor: EffectActor, key: 'dreamShards' | 'candies', amount: number) {
  actor.result.rewards ??= { dreamShards: 0, candies: 0, berryJuice: 0 }
  actor.result.rewards[key] += amount
}
function giveItem(actor: EffectActor, id: number, amount: number) {
  actor.result.rewards ??= { dreamShards: 0, candies: 0, berryJuice: 0 }
  const rewards = actor.result.rewards
  rewards.items ??= {}
  rewards.items[id] = (rewards.items[id] ?? 0) + amount
  const legacy = itemById(id)?.legacyRewardKey
  if (legacy) rewards[legacy] += amount
}

/** Execute validated, data-defined effects with expected-state semantics. */
export function applySkillModelEffects(actor: EffectActor, team: EffectActor[], context: EffectContext, skill: MainSkill, level: number, weight = 1,
  sharedCrit?: { amount: number, probability: number }[]) {
  const crit = sharedCrit ?? []
  const models = team.map(member => ({ pokeId: member.poke.id, skill: member.poke.mainSkill, berry: member.poke.berry, get energy() { return member.energy } }))
  const self = models[team.indexOf(actor)] ?? { pokeId: actor.poke.id, skill: actor.poke.mainSkill, berry: actor.poke.berry, get energy() { return actor.energy } }
  const original = (model: ModelActor) => model === self ? actor : team[models.indexOf(model)]!
  const modifiers = context.modifiers?.(actor, skill.name) ?? { ingredient: 1, berry: 1, shards: 1, healing: 1 }
  const base: ModelContext = { profile: 'expected', skill, level, actor: self, team: models, random: () => 0,
    firstIngredient: modelFirstIngredient(actor.input.pokeId, actor.input.ingredientSlots[0]), supportTeamSize: actor.input.supportTeamSize }
  const execute = (effects: SkillEffect[], w: number, bound?: ModelActor, multiplier = 1) => {
    for (const effect of effects) {
      if (effect.profiles && !effect.profiles.includes('expected')) continue
      if (effect.condition && !conditionNeedsTarget(effect.condition) && !modelCondition(effect.condition, base)) continue
      let mass = w
      if (effect.chance) mass *= effect.chance.expectedProbability ?? (effect.chance.test === 'gte' ? 1 - effect.chance.probability : effect.chance.probability)
      if (mass <= 0) continue
      for (const { target, probability } of modelTargets(effect.target, base, bound)) {
        const ctx = { ...base, target }
        if (!modelCondition(effect.condition, ctx)) continue
        const targetActor = original(target), p = mass * probability
        const value = (amount = effect.amount) => modelAmount(amount, ctx) * multiplier
        switch (effect.op) {
          case 'sequence': execute(effect.effects!, p, target, multiplier); break
          case 'charge': context.charge(actor, value() * p); break
          case 'currency': reward(actor, effect.currency!, value() * p * (effect.currency === 'dreamShards' ? modifiers.shards : 1)); break
          case 'giveItem': giveItem(actor, effect.itemId!, value() * p); break
          case 'heal': targetActor.energy = Math.min(SKILL_EXECUTION.energyCap, targetActor.energy + value() * p * targetActor.factor * modifiers.healing); break
          case 'help': context.help(targetActor, value() * p); break
          case 'skillOnlyHelp': context.skillOnly(targetActor, value(), p); break
          case 'pot': context.pot(value() * p); break
          case 'crit': crit.push({ amount: value(), probability: p }); break
          case 'zone': context.zone?.(value() * p); break
          case 'drainEnergy': targetActor.energy = Math.max(0, targetActor.energy - value() * p); break
          case 'ingredients': {
            const pool = effect.pool ? INGREDIENTS.filter(item => effect.pool!.includes(item.id)) : INGREDIENTS
            for (const item of pool) context.ingredient(actor, item.name, value() * p * modifiers.ingredient / pool.length)
            break
          }
          case 'firstIngredient': if (base.firstIngredient) context.ingredient(actor, base.firstIngredient, value() * p * modifiers.ingredient); break
          case 'berries': {
            const amount = value(target === self ? effect.selfAmount : effect.otherAmount) * modifiers.berry * p
            targetActor.result.berries += amount
            targetActor.result.skillBerries = (targetActor.result.skillBerries ?? 0) + amount
            targetActor.result.berryEnergy += amount * targetActor.unitBerry
            break
          }
          case 'onceBonus': {
            const ready = actor.disguiseReady ?? SKILL_EXECUTION.stateResets.onceBonus.expected
            const success = ready * (1 - (1 - effect.releaseChance!) ** p)
            actor.disguiseReady = ready - success
            execute(effect.effects!, p, bound, multiplier * (1 + effect.bonus! * success / p))
            break
          }
          case 'accumulateRelease': {
            const row = skill.extra![effect.extraTable!]!.levels[level - 1]!
            let state = actor.stockpile ?? [1, ...Array<number>(effect.maxStacks!).fill(0)]
            let strength = 0
            for (let remaining = p; remaining > 1e-10; remaining -= 1) {
              const chance = Math.min(1, remaining), next = state.map(mass => mass * (1 - chance))
              state.forEach((mass, stack) => {
                const release = stack === effect.maxStacks ? 1 : effect.releaseChance!
                strength += mass * chance * release * Number(row[stack])
                next[0]! += mass * chance * release
                if (stack < effect.maxStacks!) next[stack + 1]! += mass * chance * (1 - release)
              })
              state = next
            }
            actor.stockpile = state
            context.charge(actor, strength * multiplier)
            break
          }
        }
      }
    }
  }
  execute(skill.model.effects, weight)
  if (!sharedCrit && crit.length) context.crit(crit)
}

export function applyMainSkill(actor: EffectActor, team: EffectActor[], context: EffectContext, weight = 1) {
  const selected = skillByPokedexName(actor.poke.mainSkill, actor.poke.id)
  if (!selected || weight <= 0) return false
  const expand = (skill: MainSkill, probability: number, depth = 0): { skill: MainSkill; probability: number }[] => {
    if (depth > SKILL_EXECUTION.recursionLimit) return []
    const selection = skill.model.selection
    const own = skill.model.effects.length ? [{ skill, probability }] : []
    const next = (id: number, p: number) => { const child = MAIN_SKILLS.find(skill => skill.id === id); return child ? expand(child, p, depth + 1) : [] }
    if (selection?.kind === 'random') return [...own, ...selection.pool!.flatMap(id => next(id, probability / selection.pool!.length))]
    if (selection?.kind === 'choose') return [...own, ...next(selection.pool!.includes(actor.input.mewSkill ?? NaN) ? actor.input.mewSkill! : selection.fallbackSkillId!, probability)]
    if (selection?.kind === 'copy') {
      const targets = team.filter(target => target !== actor)
      if (!targets.length) return [...own, ...next(selection.fallbackSkillId!, probability)]
      return [...own, ...targets.flatMap(target => {
        const skill = skillByPokedexName(target.poke.mainSkill, target.poke.id)
        const failed = selection.blockedPokemon!.includes(target.poke.id) || !skill?.model.copyable
        return next(failed ? selection.fallbackSkillId! : skill!.id, probability / targets.length)
      })]
    }
    return [{ skill, probability }]
  }
  const crit: { amount: number, probability: number }[] = []
  for (const { skill, probability } of expand(selected, 1)) applySkillModelEffects(actor, team, context, skill, clampSkillLevel(skill.name, actor.skillLv), weight * probability, crit)
  if (crit.length) context.crit(crit)
  return true
}
