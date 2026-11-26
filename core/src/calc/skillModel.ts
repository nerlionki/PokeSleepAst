import tables from '../data/skill-tables.resource'
import { berryByName, pokeById } from './data'
import { MAIN_SKILLS, clampSkillLevel, type MainSkill, skillByPokedexName } from './mainSkills'
import type { SkillAmount, SkillBonusTrigger, SkillChance, SkillCondition, SkillProfile, SkillTarget } from './skillModelTypes'

export const SKILL_EXECUTION = tables.modules.mainSkills.execution
export interface SkillModelState {
  disguiseReady?: number
  disguise?: boolean
  activationBonus?: SkillBonusTrigger
}
export function resetSkillModelState(actor: SkillModelState, event: 'sleepStart' | 'sleepEnd' | 'sleepResearch' | 'campChange') {
  const reset = SKILL_EXECUTION.stateResets.onceBonus
  if (reset.event === event) { actor.disguiseReady = reset.expected; actor.disguise = reset.sampled }
  if (event === 'sleepResearch' || event === 'campChange') actor.activationBonus = undefined
}

export function takeSkillActivationBonus(actor: SkillModelState, hasStoredSkill: boolean): boolean {
  if (actor.activationBonus !== 'collection' && !(hasStoredSkill && actor.activationBonus === 'storedSkill')) return false
  actor.activationBonus = undefined
  return true
}

export interface ModelActor { pokeId: number; skill: string; berry: string; energy: number; rate?: number }
export interface ModelContext {
  profile: SkillProfile; skill: MainSkill; level: number; actor: ModelActor; team: ModelActor[]
  random(): number; firstIngredient: string; target?: ModelActor; supportTeamSize?: number
}
export function ownedSelectionSkill(pokeId: number) {
  return MAIN_SKILLS.find(skill => skill.model.selection?.kind === 'choose' && skill.model.selection.owners?.includes(pokeId))
}
export function modelFirstIngredient(pokeId: number, slot: number | null | undefined) {
  const id = slot == null ? undefined : pokeById(pokeId)?.ingredients[slot]?.id
  return id == null ? '' : String(id)
}
export function modelCondition(condition: SkillCondition | undefined, ctx: ModelContext): boolean {
  if (!condition) return true
  if ('all' in condition) return condition.all.every(item => modelCondition(item, ctx))
  if ('firstIngredient' in condition) return Boolean(ctx.firstIngredient)
  if ('targetTypeNot' in condition) return berryByName((ctx.target ?? ctx.actor).berry)?.type !== condition.targetTypeNot
  return ctx.team.some(target => (!condition.excludeSelf || target !== ctx.actor)
    && ('teamPokemon' in condition ? condition.teamPokemon.includes(target.pokeId)
      : condition.teamSkillTags.some(tag => skillByPokedexName(target.skill, target.pokeId)?.model.tags.includes(tag))))
}
export function conditionNeedsTarget(condition: SkillCondition): boolean {
  return 'targetTypeNot' in condition || 'all' in condition && condition.all.some(conditionNeedsTarget)
}
export function modelAmount(value: SkillAmount | undefined, ctx: ModelContext): number {
  if (value == null) return 0
  if (typeof value === 'number') return value
  if ('column' in value) {
    const raw = ctx.skill.levels[ctx.level - 1]?.[ctx.skill.columns.indexOf(value.column)] ?? ''
    return value.percent ? Number(raw.replace('%', '')) / 100 || 0 : Number(raw) || 0
  }
  if ('range' in value) {
    const lo = modelAmount({ column: value.range[0] }, ctx), hi = modelAmount({ column: value.range[1] }, ctx)
    return ctx.profile === 'expected' ? (lo + hi) / 2 : Math.floor(lo + ctx.random() * (hi - lo + 1))
  }
  if ('table' in value) {
    const table = (tables.modules.skillEffects as unknown as Record<string, number[][]>)[value.table]
    const same = Math.min(SKILL_EXECUTION.sameSpeciesCap, Math.max(1, new Set(ctx.team.filter(member => member.berry === ctx.actor.berry).map(member => member.pokeId)).size)) - 1
    return table?.[ctx.level - 1]?.[same] ?? 0
  }
  if ('add' in value) return value.add.reduce<number>((sum, item) => sum + modelAmount(item, ctx), 0)
  if ('multiply' in value) return value.multiply.reduce<number>((product, item) => product * modelAmount(item, ctx), 1)
  if ('divide' in value) return modelAmount(value.divide[0], ctx) / modelAmount(value.divide[1], ctx)
  if ('maximum' in value) return Math.max(...value.maximum.map(item => modelAmount(item, ctx)))
  if ('level' in value) return ctx.level
  if ('expected' in value) return modelAmount(value[ctx.profile], ctx)
  if ('when' in value) return modelAmount(modelCondition(value.when, ctx) ? value.then : value.otherwise, ctx)
  if ('skill' in value) {
    const skill = MAIN_SKILLS.find(skill => skill.id === value.skill)
    return skill ? modelAmount(value.value, { ...ctx, skill, level: clampSkillLevel(skill.name, ctx.level) }) : 0
  }
  const { chance, hit, miss } = value.randomMultiplier
  return ctx.profile === 'sampled' ? ctx.random() < chance ? hit : miss : chance * hit + (1 - chance) * miss
}
/** Target rate is evaluated only after resolving the effect's own or inherited target. */
export function targetSkillProbability(chance: Extract<SkillChance, { targetSkillRolls: unknown }>, ctx: ModelContext): number {
  const { rate, trials } = chance.targetSkillRolls
  const target = ctx.target ?? ctx.actor
  const raw = rate === 'effective' ? target.rate : pokeById(target.pokeId)?.skillRate
  const p = Math.min(1, Math.max(0, raw ?? 0))
  const count = typeof trials === 'number' ? trials : modelAmount(trials, ctx)
  return 1 - (1 - p) ** count
}

export function* modelTargets(spec: SkillTarget | undefined, ctx: ModelContext, bound?: ModelActor): Generator<{ target: ModelActor; probability: number }> {
  const target = bound ?? ctx.actor
  if (!spec || spec.kind === 'self') { yield { target, probability: 1 }; return }
  if (spec.kind === 'team') { yield* ctx.team.map(target => ({ target, probability: 1 })); return }
  const team = spec.excludeSelf ? ctx.team.filter(member => member !== ctx.actor) : ctx.team
  const count = Math.min(spec.count ?? 1, team.length)
  if (!count) return
  if (ctx.profile === 'sampled') {
    const available = [...team]
    const pick = (rows: ModelActor[]) => rows[Math.floor(ctx.random() * rows.length)]!
    for (let i = 0; i < count; i++) {
      let chosen: ModelActor
      if (spec.sampled) {
        const ranked = [...available].sort((a, b) => a.energy - b.energy)
        const lowest = spec.sampled.randomLowestTies ? ranked.filter(member => member.energy === ranked[0]!.energy) : [ranked[0]!]
        chosen = ctx.random() < spec.sampled.lowestChance ? spec.sampled.randomLowestTies ? pick(lowest) : lowest[0]! : pick(available)
      } else chosen = pick(available)
      available.splice(available.indexOf(chosen), 1)
      yield { target: chosen, probability: 1 }
    }
    return
  }
  const config = spec.expected
  if (!config && spec.sampled && count === 1) {
    const minimum = Math.min(...team.map(target => target.energy))
    const lowest = team.filter(target => target.energy === minimum)
    const priority = spec.sampled.randomLowestTies ? lowest : lowest.slice(0, 1)
    const bias = spec.sampled.lowestChance
    yield* team.map(target => ({ target, probability: (1 - bias) / team.length + (priority.includes(target) ? bias / priority.length : 0) }))
    return
  }
  if (!config || config.supportSize) { yield* team.map(target => ({ target, probability: count / Math.max(team.length, config?.supportSize ? ctx.supportTeamSize ?? team.length : team.length) })); return }
  const ranked = [...team].sort((a, b) => a.energy - b.energy)
  const weights = config.rankWeights && team.length === config.fullTeamSize ? config.rankWeights
    : config.rankWeights ? ranked.map(() => count / team.length)
      : ranked.map((_, index) => index === 0 ? config.firstWeight! : config.otherWeight!)
  const total = weights.reduce((sum, value) => sum + value, 0)
  yield* team.map(target => {
    const ties = config.shareTies ? ranked.flatMap((member, index) => member.energy === target.energy ? [index] : []) : [ranked.indexOf(target)]
    return { target, probability: ties.reduce((sum, index) => sum + weights[index]!, 0) / ties.length * count / total }
  })
}
