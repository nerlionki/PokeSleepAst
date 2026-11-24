import { resetSkillModelState } from './skillModel'
import { itemById, itemHealEnergy, ITEM_ROLES } from './itemCatalog'
import { ingredientEnergyValue } from './activityIngredients'
import runtimeParameters from '../data/runtime-parameters.resource'
import ruleCatalogs from '../data/rule-catalogs.resource'
import ruleParameters from '../data/rule-parameters.resource'
import extracted0 from '../data/client-defaults.resource'
import { cloneData } from './dataClone'
import { activityBerrySettings, activityValues, snapshotActivity, activityRecipeCategories, assertActivitySupported, hasSkillRateBoostActivity, type ActivityValues } from './activities'
import type { BoxPokemon, ProduceInput } from '../types'
import { RECIPES, pokeById } from './data'
import { berryUnitEnergy } from './berry'
import { mealRecover, sleepRecoveredEnergy } from './energy'
import { energyMultiplier, instantInterval } from './helpSpeed'
import { exEffects } from './exEffects'
import { berriesPerHelp, findingChance, selectedIngredientDrops } from './ingredients'
import { addIngredient as add, recipeById } from './catalogIds'
import { resolveMemberSkill } from './mew'
import { effectiveSkillLevel, unlockedSubskills } from './member'
import { skillMaxFor } from './mainSkills'
import { natureStatFactor, withEffectiveNature } from './natureLabels'
import { ribbonBonus, stagesLeft } from './ribbon'
import { carryLimit, teamHelpingBonus } from './timeline'
import { FULL_INVENTORY_SKILL_HELPS, skillStorageLimit } from './specialty'
import { allocateIngredients, canCookRecipe, mealEnergy, recipeLevelOf, recipeEnergy, takeRecipeIngredients } from './cook'
import { cookingPotCapacity } from './cookingSkillState'
import { teamRestrictionError } from './teamRestrictions'
import { scoreSkill, scoreSkillRoles, type ScoreActor } from './scoreSkills'
import { createMealSupply, DAY_MINUTES, type MealSupplyOptions, type MealSupplyResult } from './mealSupply'
import { hm, scoreBounds, scoreCandidates, scoreSleeps, seededRandom, validateScoreOptions,
  type ScoreAction, type ScorePolicy, type ScoreRequest, type ScoreSegment, type ScoreTrace, type SleepSession } from './scorePlan'
const scoreSimulation_config_extracted0 = extracted0.modules.scoreSimulation
const scoreSimulation_simulateScore_runtimeParameters = runtimeParameters.modules.scoreSimulation.simulateScore.values
const scoreSimulation_simulateScore_ruleParameters = ruleParameters.modules.scoreSimulation.simulateScore
const scoreSimulation_config_ruleCatalogs = ruleCatalogs.modules.scoreSimulation
const scoreSimulation_sellFor_ruleParameters = ruleParameters.modules.scoreSimulation.sellFor
const scoreSimulation_creditFood_ruleParameters = ruleParameters.modules.scoreSimulation.creditFood
const scoreSimulation_help_ruleParameters = ruleParameters.modules.scoreSimulation.help
const scoreSimulation_release_runtimeParameters = runtimeParameters.modules.scoreSimulation.release.values
const scoreSimulation_release_ruleParameters = ruleParameters.modules.scoreSimulation.release
const scoreSimulation_settle_runtimeParameters = runtimeParameters.modules.scoreSimulation.settle.values
const scoreSimulation_settle_ruleParameters = ruleParameters.modules.scoreSimulation.settle
const scoreSimulation_cook_runtimeParameters = runtimeParameters.modules.scoreSimulation.cook.values
const scoreSimulation_cook_ruleParameters = ruleParameters.modules.scoreSimulation.cook
// The official v3.3.0 update confirms the throttle. The 24h window and 30/45
// thresholds come from community observations; 0.5 is the approved model factor.
// https://www.pokemonsleep.net/en/news/333730373237363430383636323236313737/
// https://www.reddit.com/r/PokemonSleep/comments/1xtk5u0/for_those_who_dont_know_there_is_a_soft_skill/
// https://www.reddit.com/r/PokemonSleep/comments/1rk5z1c/a_skill_trigger_study/
export const SCORE_SKILL_DECAY = ruleParameters.modules.scoreSimulation.skillDecay ?? {
  windowMinutes: 1440, normalThreshold: 30, boostedThreshold: 45, probabilityMultiplier: 0.5,
}

export class ScoreSkillReleaseHistory {
  private readonly times: number[] = []
  private expired = 0

  get total() { return this.times.length }

  record(minute: number) { this.times.push(minute) }

  multiplier(minute: number, threshold: number, decay: number) {
    if (decay >= 1) return 1
    const cutoff = minute - SCORE_SKILL_DECAY.windowMinutes
    while (this.expired < this.times.length && this.times[this.expired]! <= cutoff) this.expired++
    return this.times.length - this.expired >= threshold ? decay : 1
  }
}


interface Actor extends ScoreActor {
  activity: ActivityValues
  pokemon: BoxPokemon, input: ProduceInput, poke: NonNullable<ReturnType<typeof pokeById>>
  subs: string[], carry: number, drops: { id: number, amount: number }[], ingredientRate: number, berryCount: number
  ribbonSpeed: number, islandSpeed: number, favoredBerry: boolean
  intervals: Map<number, Map<number, number>>
  unit: number, next: number, decay: number, heldBerries: number, heldFood: Record<string, number>, stock: number
  failures: number, syncHelps: number, pity: number, fullSkillHelps: number, hours: number, dailyHours: number[], exp: number
}
export const SCORE_ASSUMPTIONS = cloneData(scoreSimulation_config_extracted0.SCORE_ASSUMPTIONS)
const sumBag = (bag: Record<string, number>) => Object.values(bag).reduce((a, b) => a + b, 0)
const foodEnergy = (name: string) => ingredientEnergyValue(name) ?? 0

/** 始终按事件顺序推进，成员状态以 UID 保存。结束边界不领取携带物。 */
export function simulateScore(request: ScoreRequest, policy: ScorePolicy, seed: number, rollback = 1, record = true,
  skillDecayMultiplier = SCORE_SKILL_DECAY.probabilityMultiplier, meal?: MealSupplyOptions): ScoreTrace & { mealSupply?: MealSupplyResult } {
  const { options: o } = request
  const sourceSettings = snapshotActivity(request.settings, 'week')
  let settings = activityBerrySettings(sourceSettings, sourceSettings.activity, scoreBounds(o).start)
  const invalid = validateScoreOptions(o, settings, !meal)
  if (invalid) throw new Error(invalid)
  const { start, end } = scoreBounds(o)
  const random = seededRandom(seed)
  const candidates = scoreCandidates(request.box).candidates
  const actors = new Map<string, Actor>()
  for (const original of candidates) {
    const pokemon = withEffectiveNature(original)
    const poke = pokeById(pokemon.pokeId)!
    const selected = resolveMemberSkill(poke, pokemon)
    const subs = unlockedSubskills(pokemon.level, pokemon.subskills)
    const ex = exEffects(settings, poke.berry, poke.specialty)
    const ribbon = ribbonBonus(pokemon.tune?.ribbonHours ?? 0, stagesLeft(poke.id))
    const input: ProduceInput = { ...pokemon, ribbonHours: pokemon.tune?.ribbonHours ?? 0 }
    const drops = selectedIngredientDrops(poke.ingredients, pokemon.ingredientSlots, pokemon.level)
    actors.set(pokemon.uid, { activity: activityValues(settings.activity, settings.island, poke, start), uid: pokemon.uid, pokemon, input, poke, subs, pokeId: poke.id, berry: poke.berry, skill: selected.name,
      ribbonSpeed: ribbon.speedCut, islandSpeed: ex.speed, favoredBerry: settings.berries.includes(poke.berry),
      intervals: new Map(),
      skillLevel: Math.min(skillMaxFor(selected.name), effectiveSkillLevel(pokemon.level, pokemon.skillLevel, pokemon.subskills, selected.name) + ex.skillLevels),
      rate: selected.rate * natureStatFactor(pokemon.nature, 'skill') * (1 + (subs.includes('skillS') ? scoreSimulation_simulateScore_ruleParameters.findingS : 0) + (subs.includes('skillM') ? scoreSimulation_simulateScore_ruleParameters.findingM : 0)) * ex.skillMultiplier,
      energy: (scoreSimulation_simulateScore_runtimeParameters.p003 as 100), factor: natureStatFactor(pokemon.nature, 'energy'), disguise: o.initialDisguise[pokemon.uid] ?? true, stockpile: 0,
      firstFood: drops.length ? String(drops[0]!.id) : '', drops, ingredientRate: Math.min(1, findingChance(poke.ingredientRate, pokemon.nature, 'ingredient',
        subs.includes('ingS'), subs.includes('ingM'), scoreSimulation_simulateScore_ruleParameters.findingS, scoreSimulation_simulateScore_ruleParameters.findingM)),
      carry: carryLimit(poke.carry, subs, settings.goodCamp, 'preset', ribbon.carry, ex.carryExtra + activityValues(settings.activity, settings.island, poke, start).carryCapacityBonus, activityValues(settings.activity, settings.island, poke, start).carryCapacityMultiplier), berryCount: berriesPerHelp(poke.specialty, subs, ruleParameters.modules.scoreSimulation.berryCount.berryS),
      unit: berryUnitEnergy(poke.berry, pokemon.level, settings.areaBonus, ex.berryMultiplier), next: Infinity, decay: start,
      heldBerries: 0, heldFood: {}, stock: 0, failures: 0, syncHelps: 0, fullSkillHelps: 0,
      pity: scoreSimulation_config_ruleCatalogs.simulateScoreList1.values.includes(poke.specialty) ? Math.ceil(scoreSimulation_simulateScore_ruleParameters.skillSpecialistPitySeconds / poke.interval) : scoreSimulation_simulateScore_ruleParameters.otherPityHelps,
      hours: 0, dailyHours: Array((scoreSimulation_simulateScore_runtimeParameters.p004 as 7)).fill(0), exp: 0 })
  }
  const bases = new Map([...actors].map(([uid, m]) => [uid, {
    rate: m.rate / exEffects(settings, m.berry, m.poke.specialty).skillMultiplier,
    skillLevel: effectiveSkillLevel(m.pokemon.level, m.pokemon.skillLevel, m.pokemon.subskills, m.skill),
    berryCount: m.berryCount,
  }]))
  const warnings = new Set<string>()
  const actions: ScoreAction[] = []
  const segments: ScoreSegment[] = []
  const bag = { ...o.bag }, received: Record<string, number> = {}, consumed: Record<string, number> = {}, sold: Record<string, number> = {}
  const supply = meal && createMealSupply(bag, scoreSimulation_creditFood_ruleParameters.bagCapacity, meal)
  const items: Record<number, ScoreTrace['juice']> = {}
  const stock = (id: number) => items[id] ??= { initial: 0, received: 0, used: 0, lost: 0, remain: 0 }
  const juice = items[ITEM_ROLES.berryJuice] = { initial: o.initialJuice, received: 0, used: 0, lost: 0, remain: o.initialJuice }
  const pillowId = ITEM_ROLES.energyPillow
  const pillowEffect = pillowId == null ? undefined : itemById(pillowId)?.useEffect
  if (pillowEffect) {
    const count = o.initialPillows ?? 0
    items[pillowId] = { initial: count, received: 0, used: 0, lost: 0, remain: count }
  }
  let berry = 0, zoneEnergy = 0, skill = 0, cooking = 0, zone = o.initialZone / 100, extraPot = o.initialPot, crit = o.initialCrit / 100
  let active: Actor[] = [], currentKey = '', lastRotation = start, currentMinute = start, depth = 0
  let activeHelping = teamHelpingBonus([], settings.helpingBonus)
  let usedRecoveryAt = -1
  let restingHealer: { healer: Actor, original: Actor[], substitute: Actor, full: boolean } | undefined
  let fiveSelfHealFallback: { source: string, team: Actor[], healer: Actor } | undefined
  const roles = new Map([...actors.values()].map(actor => [actor, scoreSkillRoles(actor.skill, actor.pokeId)]))
  const selfHealProcs = new Set<Actor>()
  const skillReleases = new ScoreSkillReleaseHistory()
  let releaseThreshold = SCORE_SKILL_DECAY.normalThreshold
  let suppressedSkillRolls = 0
  let decayApplied = false
  const sessions = scoreSleeps(o, settings)
  const lookahead = policy.lookaheadNodes ?? 1
  const sleepProducers = new Map<SleepSession, Set<Actor>>()
  const sessionsStarting = new Map(sessions.map(session => [session.start, session]))
  const sessionsWaking = new Map(sessions.map(session => [session.end, session]))
  const sessionsSettling = new Map<number, SleepSession[]>()
  for (const session of sessions) {
    if (!sessionsSettling.has(session.settle)) sessionsSettling.set(session.settle, [])
    sessionsSettling.get(session.settle)!.push(session)
  }
  const mealMinutes = o.meals.map(hm)
  const nextMealIndex = (minute: number) => Math.max(0, mealMinutes.findIndex(time => time >= minute % 1440))
  const settled = new Set<SleepSession>()
  const dayScores = new Map<number, number>()
  const configuredRecipe = (minute: number) => {
    if (!policy.mealRecipeIds) return recipeById(policy.recipeId)
    return recipeById(policy.mealRecipeIds[nextMealIndex(minute)])
  }
  let targetRecipe = configuredRecipe(start)
  let recipeCategories: readonly string[] = [o.category]
  const cookedByDay: Record<number, Record<number, number>> = {}
  const note = (action: ScoreAction) => { if (record) actions.push(action) }
  const select = (uids: string[]) => {
    if (uids.length > (scoreSimulation_simulateScore_runtimeParameters.p005 as 5) || new Set(uids).size !== uids.length) throw new Error('规划队伍存在重复个体或超过 5 只')
    const members = uids.map(uid => actors.get(uid))
    if (members.some(m => !m)) throw new Error('规划队伍包含无效个体')
    const valid = members as Actor[]
    const error = teamRestrictionError(valid.map(m => m.pokemon))
    if (error) throw new Error(error)
    return valid
  }
  const interval = (m: Actor, team = active, energy = m.energy) => {
    const helping = team === active ? activeHelping : teamHelpingBonus(team.map(a => a.pokemon), settings.helpingBonus)
    let byEnergy = m.intervals.get(helping)
    if (!byEnergy) m.intervals.set(helping, byEnergy = new Map())
    const multiplier = energyMultiplier(energy)
    let result = byEnergy.get(multiplier)
    if (result === undefined) {
      result = instantInterval(m.poke.interval, m.pokemon.level, m.pokemon.nature, m.subs, helping, energy, settings.goodCamp,
        settings.island, m.favoredBerry, m.ribbonSpeed, m.islandSpeed) / 60 * m.activity.helpIntervalMultiplier
      byEnergy.set(multiplier, result)
    }
    return result
  }
  function refreshActivities(minute: number) {
    assertActivitySupported(settings.activity, 'production', minute, settings.island)
    const globalActivity = activityValues(settings.activity, settings.island, undefined, minute)
    recipeCategories = activityRecipeCategories(globalActivity, o.category)
    const configured = configuredRecipe(minute)
    targetRecipe = configured && recipeCategories.some(category => category === configured.category) ? configured : undefined
    const intervals = new Map([...actors].map(([uid, m]) => [uid, interval(m)]))
    // Always derive from the user's berries so an expired event does not remain favored.
    settings = activityBerrySettings(sourceSettings, sourceSettings.activity, minute)
    for (const [uid, m] of actors) {
      const before = intervals.get(uid)!
      const base = bases.get(uid)!
      const ex = exEffects(settings, m.berry, m.poke.specialty)
      m.islandSpeed = ex.speed
      m.favoredBerry = settings.berries.includes(m.berry)
      m.activity = activityValues(settings.activity, settings.island, m.poke, minute)
      m.intervals.clear()
      m.rate = Math.min(1, base.rate * ex.skillMultiplier * m.activity.skillRateMultiplier)
      m.skillLevel = Math.min(skillMaxFor(m.skill), base.skillLevel + ex.skillLevels + m.activity.skillLevelBonus)
      m.unit = berryUnitEnergy(m.berry, m.pokemon.level, settings.areaBonus, ex.berryMultiplier) * m.activity.berryEnergyMultiplier
      m.carry = carryLimit(m.poke.carry, m.subs, settings.goodCamp, 'preset', ribbonBonus(m.input.ribbonHours ?? 0, stagesLeft(m.pokeId)).carry, ex.carryExtra + m.activity.carryCapacityBonus, m.activity.carryCapacityMultiplier)
      m.berryCount = base.berryCount + m.activity.berryCountBonus
      if (Number.isFinite(m.next) && m.next > minute) m.next = minute + (m.next - minute) * interval(m) / before
    }
    releaseThreshold = hasSkillRateBoostActivity(settings.activity, settings.island, minute)
      ? SCORE_SKILL_DECAY.boostedThreshold : SCORE_SKILL_DECAY.normalThreshold
  }
  const creditBerries = (m: Actor, count: number) => {
    const base = count * m.unit
    berry += base
    if (m.poke.berryType === '超能') zoneEnergy += base * zone
  }
  const reserve = (name: string, includeCurrent = true) => {
    if (!policy.mealRecipeIds) return (targetRecipe?.ingredients.find(i => String(i.id) === name)?.count ?? 0) * policy.reserveMeals
    return mealMinutes.reduce((total, meal) => {
      const time = Math.floor((currentMinute - 240) / 1440) * 1440 + meal
      if (time < currentMinute || !includeCurrent && time === currentMinute || time >= end) return total
      return total + (configuredRecipe(time)?.ingredients.find(ingredient => String(ingredient.id) === name)?.count ?? 0)
    }, 0)
  }
  let bagCount = sumBag(bag)
  function sellFor(inventory: Record<string, number>, amount: number, inventoryCount = sumBag(inventory)) {
    let shortage = Math.max(0, inventoryCount + amount - scoreSimulation_sellFor_ruleParameters.bagCapacity)
    const sales: Record<string, number> = {}
    if (!shortage) return sales
    const names = Object.keys(inventory).sort((a, b) => foodEnergy(a) - foodEnergy(b))
    for (const protectReserve of [true, false]) {
      for (const name of names) {
        const free = Math.max(0, (inventory[name] ?? 0) - (protectReserve ? reserve(name) : 0))
        const count = Math.min(shortage, free)
        if (!count) continue
        inventory[name]! -= count
        shortage -= count
        add(sales, name, count)
        if (!shortage) return sales
      }
    }
    return sales
  }
  function creditFood(name: string, amount: number, uid: string, natural = true) {
    amount = Math.max(0, Math.floor(amount))
    if (!amount) return
    if (supply) { supply.credit(name, amount, uid, currentMinute - start, natural); return }
    // 调用仅发生在可操作节点；先卖出，再接收，单批大于上限时分批处理。
    for (let left = amount; left > 0;) {
      const part = Math.min(scoreSimulation_creditFood_ruleParameters.bagCapacity, left)
      if (bagCount + part > scoreSimulation_sellFor_ruleParameters.bagCapacity) {
        const sales = sellFor(bag, part, bagCount)
        for (const [food, count] of Object.entries(sales)) add(sold, food, count)
        const soldCount = sumBag(sales)
        bagCount -= soldCount
        if (record && soldCount) note({ minute: currentMinute, kind: 'sell', text: `卖出 ${soldCount} 个食材腾出空间`, foods: sales })
      }
      bagCount += part
      add(bag, name, part); add(received, name, part); left -= part
    }
  }
  function skillRollMultiplier() {
    const multiplier = skillReleases.multiplier(currentMinute, releaseThreshold, skillDecayMultiplier)
    if (multiplier < 1) decayApplied = true
    return multiplier
  }
  function help(m: Actor, extra = false) {
    const full = m.heldBerries + sumBag(m.heldFood) >= m.carry
    const canRollSkill = !full || m.fullSkillHelps < FULL_INVENTORY_SKILL_HELPS
    if (!extra && full) {
      creditBerries(m, m.berryCount)
      m.fullSkillHelps = Math.min(FULL_INVENTORY_SKILL_HELPS, m.fullSkillHelps + 1)
    }
    else if (m.drops.length && random() < m.ingredientRate) {
      const drop = m.drops[Math.floor(random() * m.drops.length)]!
      const ex = exEffects(settings, m.berry, m.poke.specialty)
      const bonus = !extra && ex.ingredientExtra ? 1 + Number(ex.ingredientExtra > 1 && random() < scoreSimulation_help_ruleParameters.fractionalExExtraChance) : 0
      const count = extra ? drop.amount : Math.min(drop.amount + bonus + m.activity.ingredientCountBonus, Math.max(0, m.carry - m.heldBerries - sumBag(m.heldFood)))
      if (extra) creditFood(String(drop.id), count, m.uid, false); else {
        add(m.heldFood, drop.id, count)
        for (const [name, bonus] of Object.entries(m.activity.fixedIngredientDrops)) add(m.heldFood, name, Math.min(bonus, Math.max(0, m.carry - m.heldBerries - sumBag(m.heldFood))))
      }
    } else if (extra) creditBerries(m, m.berryCount)
    else m.heldBerries += m.berryCount
    if (!extra && canRollSkill && m.stock < skillStorageLimit(m.poke.specialty)) {
      m.syncHelps++
      const pity = m.failures + m.syncHelps >= m.pity
      const multiplier = pity ? 1 : skillRollMultiplier()
      if (multiplier < 1) suppressedSkillRolls++
      if (pity || random() < m.rate * multiplier) {
        m.stock++; m.failures = 0; m.syncHelps = 0
        if (roles.get(m)?.selfHeal) selfHealProcs.add(m)
      }
    }
  }
  function release(m: Actor) {
    if (depth > (scoreSimulation_release_runtimeParameters.p001 as 8)) { warnings.add('技能连锁截断'); return }
    depth++
    const previous = record ? new Map(active.map(a => [a.uid, a.energy])) : undefined
    if (record) note({ minute: currentMinute, kind: 'skill', text: `${m.pokemon.name || m.poke.name}发动${m.skill}`, members: [m.uid] })
    scoreSkill(m, active, {
      random,
      modifiers: skillName => {
        const effects = activityValues(settings.activity, settings.island, { ...m.poke, mainSkill: skillName }, currentMinute)
        return { ingredient: effects.skillIngredientMultiplier, berry: effects.skillBerryMultiplier, healing: effects.skillHealingMultiplier }
      },
      heal: (target, amount) => { const a = target as Actor; a.energy = Math.min(scoreSimulation_release_ruleParameters.energyCap, a.energy + amount); a.decay = currentMinute },
      charge: amount => { skill += amount * (1 + settings.areaBonus) * m.activity.skillStrengthMultiplier },
      berries: (target, amount) => creditBerries(target as Actor, amount), ingredient: (name, amount) => creditFood(name, amount, m.uid, false),
      helps: (target, count, only) => {
        const a = target as Actor
        if (only) { for (let i = 0; i < count; i++) if (random() < a.rate) { release(a); break } }
        else for (let i = 0; i < count; i++) help(a, true)
      },
      pot: amount => { extraPot = Math.min(scoreSimulation_release_ruleParameters.extraPotCap, extraPot + amount) }, crit: amount => { crit = Math.min(scoreSimulation_release_ruleParameters.skillCritCap, crit + amount) },
      zone: amount => { zone = Math.min(scoreSimulation_release_ruleParameters.berryZoneCap, zone + amount) },
      giveItem: (id, amount) => {
        const item = itemById(id), held = stock(id)
        const accepted = Math.max(0, Math.min(amount, (item?.maxHeld ?? Infinity) - held.remain))
        held.remain += accepted; held.received += accepted; held.lost += amount - accepted
      },
      warning: text => warnings.add(text),
    })
    if (previous) {
      const changed = active.filter(a => Math.abs(a.energy - previous.get(a.uid)!) > (scoreSimulation_release_runtimeParameters.p003 as 0.01))
      if (changed.length) note({ minute: currentMinute, kind: 'energy', text: `活力：${changed.map(a => `${a.pokemon.name || a.poke.name} ${previous.get(a.uid)!.toFixed(1)}→${a.energy.toFixed(1)}`).join('；')}`, members: changed.map(a => a.uid) })
    }
    depth--
  }
  function releaseStock(members: readonly Actor[]) {
    for (const m of members) {
      const stock = m.stock
      m.stock = 0
      for (let i = 0; i < stock; i++) {
        skillReleases.record(currentMinute)
        release(m)
      }
    }
  }
  function collect(members: readonly Actor[], beforeRotation = false) {
    if (!members.length) return
    if (beforeRotation) releaseStock(members)
    const food: Record<string, number> = {}
    let fruits = 0
    for (const m of members) {
      fruits += m.heldBerries; creditBerries(m, m.heldBerries); m.heldBerries = 0
      for (const [name, count] of Object.entries(m.heldFood)) { if (record) add(food, name, count); creditFood(name, count, m.uid) }
      m.heldFood = {}
      m.fullSkillHelps = 0
      if (!beforeRotation) {
        m.failures = Math.min(m.pity - 1, m.failures + m.syncHelps); m.syncHelps = 0
      }
    }
    if (record) note({ minute: currentMinute, kind: 'collect', text: `收取树果 ${fruits} 颗、食材 ${sumBag(food)} 个`, members: members.map(m => m.uid), foods: food })
    if (!beforeRotation) releaseStock(members)
  }
  const teamKey = (team: readonly Actor[]) => JSON.stringify(team.map(m => m.uid).sort())
  function rotate(team: Actor[], purpose: string) {
    const key = teamKey(team)
    if (key === currentKey) return false
    const leaving = active.filter(member => !team.includes(member))
    const entering = team.filter(member => !active.includes(member))
    const energyBefore = record && active.length ? Object.fromEntries(active.map(member => [member.uid, member.energy])) : undefined
    const reason = active.length && entering.some(member => roles.get(member)?.teamHeal) ? '换入奶妈'
      : leaving.some(member => roles.get(member)?.teamHeal) ? '换下奶妈'
        : crit >= scoreSimulation_release_ruleParameters.skillCritCap && leaving.some(member => roles.get(member)?.crit) ? '料理暴击加成已满' : undefined
    if (active.length) {
      collect(leaving.filter(m => m.stock || m.heldBerries || sumBag(m.heldFood)), true)
      segments[segments.length - 1]!.end = currentMinute
      for (const m of new Set([...active, ...team])) { m.stock = 0; m.failures = Math.max(0, m.failures + m.syncHelps - rollback); m.syncHelps = 0 }
    }
    sourceSettings.activity = { ...sourceSettings.activity, teamPokemonIds: team.map(m => m.pokeId) }
    settings.activity = sourceSettings.activity
    for (const m of team) if (!active.includes(m)) { m.next = currentMinute; m.decay = currentMinute }
    active = team; currentKey = key
    activeHelping = teamHelpingBonus(active.map(a => a.pokemon), settings.helpingBonus)
    for (const m of active) if (m.next <= currentMinute) m.next = currentMinute + interval(m)
    segments.push({ start: currentMinute, end, members: team.map(m => m.uid), purpose })
    note({ minute: currentMinute, kind: 'team', text: `上场：${purpose}`, members: team.map(m => m.uid), reason, energyBefore })
    return true
  }
  function estimatedProduction(m: Actor, minutes: number, team: Actor[], energy = m.energy) {
    return minutes / interval(m, team, energy) * (m.berryCount * m.unit * (1 - m.ingredientRate) +
      m.ingredientRate * Math.max(0, ...m.drops.map(drop => drop.amount * foodEnergy(String(drop.id)))))
  }
  function estimatedTeamProduction(team: Actor[], minutes: number, recoveryMinutes = minutes, collectionMinutes = o.collectMinutes) {
    const recovery = new Map<Actor, number>()
    const multiplier = skillRollMultiplier()
    for (const m of team.filter(actor => roles.get(actor)?.teamHeal)) {
      const sampleTeam = team.map(actor => ({ ...actor }))
      const healer = sampleTeam[team.indexOf(m)]!
      const storage = skillStorageLimit(m.poke.specialty) * Math.ceil(minutes / collectionMinutes)
      const triggers = Math.min(storage, m.rate * multiplier * minutes / interval(m, team))
      scoreSkill(healer, sampleTeam, {
        random: () => 0.5,
        heal(target, amount) {
          const actor = team.find(member => member.uid === target.uid)!
          recovery.set(actor, (recovery.get(actor) ?? 0) + amount * triggers * m.activity.skillHealingMultiplier)
        },
        charge() {}, berries() {}, ingredient() {}, helps() {}, pot() {}, crit() {}, zone() {}, giveItem() {}, warning() {},
      })
    }
    return team.reduce((sum, m) => {
      const energy = Math.min(scoreSimulation_release_ruleParameters.energyCap, m.energy + (recovery.get(m) ?? 0))
      return sum + estimatedProduction(m, minutes, team) +
        estimatedProduction(m, recoveryMinutes, team, energy) - estimatedProduction(m, recoveryMinutes, team)
    }, 0)
  }
  const legalTeam = (members: Actor[]) => !teamRestrictionError(members.map(m => m.pokemon))
  function replaceCappedCrit(team: Actor[], preferred: Actor[]) {
    if (crit < scoreSimulation_release_ruleParameters.skillCritCap - Number.EPSILON) return team
    const updated = [...team]
    const candidates = [...new Set([...preferred, ...actors.values()])]
    for (const m of team.filter(member => roles.get(member)?.crit && !roles.get(member)?.teamHeal)) {
      const position = updated.indexOf(m)
      const substitute = candidates.find(member => !updated.includes(member) && !roles.get(member)?.crit &&
        legalTeam(updated.map((actor, index) => index === position ? member : actor)))
      if (substitute) updated[position] = substitute
    }
    return updated
  }
  function daytime() {
    const stockedForMeals = (inventory: Record<string, number>) => mealMinutes.every(time =>
      configuredRecipe(Math.floor((currentMinute - 240) / 1440) * 1440 + time)?.ingredients
        .every(ingredient => (inventory[ingredient.id] ?? 0) >= reserve(String(ingredient.id))) ?? true)
    let stocked = policy.day.length === 1 || (policy.mealRecipeIds ? stockedForMeals(bag)
      : !targetRecipe || canCookRecipe(targetRecipe, bag, Infinity, Math.max(1, policy.reserveMeals)))
    if (stocked && policy.day.length > 1 && policy.mealRecipeIds) {
      const planned = policy.day[0]!
      const projected = { ...bag }
      for (const member of active) if (!planned.includes(member.uid)) {
        for (const [name, count] of Object.entries(member.heldFood)) {
          sellFor(projected, count)
          add(projected, name, count)
        }
      }
      stocked = stockedForMeals(projected)
    }
    const preferred = select(stocked ? policy.day[0]! : policy.foodTeamByMeal?.[nextMealIndex(currentMinute)] ?? policy.day[1]!)
    if (!policy.dayAlternates) return preferred
    const cap = scoreSimulation_release_ruleParameters.energyCap
    const low = 80
    const nextSleepStart = sessions.find(session => session.start > currentMinute)?.start ?? end
    const decisionInterval = Math.ceil(policy.rotateMinutes / o.collectMinutes) * o.collectMinutes
    const minutes = Math.min(decisionInterval * lookahead, nextSleepStart - currentMinute, end - currentMinute)
    const alternatives = select(policy.dayAlternates[stocked ? 0 : 1]!)
    const team = replaceCappedCrit(preferred, alternatives)
    const healer = team.find(m => roles.get(m)?.teamHeal)
    if (!healer && team.length === 5 && team.every(m => roles.get(m)?.selfHeal)) {
      const key = teamKey(team)
      if (fiveSelfHealFallback?.source === key && active.includes(fiveSelfHealFallback.healer)) {
        const fallback = fiveSelfHealFallback
        if (fallback.team.some(m => m !== fallback.healer && m.energy < cap) ||
            estimatedTeamProduction(fallback.team, minutes) >= estimatedTeamProduction(team, minutes)) return fallback.team
        fiveSelfHealFallback = undefined
        selfHealProcs.clear()
        return team
      }
      const needsRecovery = team.filter(m => active.includes(m) && m.energy <= low && !selfHealProcs.has(m))
      if (needsRecovery.length) {
        const replaceable = needsRecovery.length === team.length ? team : team.filter(m => !needsRecovery.includes(m))
        const best = [...actors.values()].filter(m => !team.includes(m) && roles.get(m)?.teamHeal)
          .flatMap(member => replaceable.map(out => ({
            healer: member, team: team.map(m => m === out ? member : m),
          }))).filter(candidate => legalTeam(candidate.team))
          .map(candidate => ({ ...candidate, value: estimatedTeamProduction(candidate.team, minutes) }))
          .sort((a, b) => b.value - a.value)[0]
        if (best) {
          fiveSelfHealFallback = { source: key, team: best.team, healer: best.healer }
          return best.team
        }
      }
    }
    fiveSelfHealFallback = undefined
    if (!policy.allowHealerRest || !healer || team.length !== 5) return team
    const others = team.filter(m => m !== healer)
    if (restingHealer) {
      const rest = restingHealer
      const newcomers = others.filter(m => !rest.original.includes(m))
      const critical = rest.original.filter(m => others.includes(m) && m.energy <= low)
      const forceReturn = rest.full && newcomers.some(m => m.energy < cap)
      const replacementTeam = [...others, rest.substitute]
      if (healer === rest.healer && !forceReturn && legalTeam(replacementTeam) && !others.includes(rest.substitute)) {
        if (!critical.length) return replacementTeam
        const target = critical[0]!
        if (critical.length === 1 && active.includes(target)) {
          const replaceScore = estimatedTeamProduction(replacementTeam, minutes)
          const healerScore = estimatedTeamProduction(team, minutes)
          const initial = estimatedProduction(target, minutes, replacementTeam)
          const available = [
            ...(o.useJuice && juice.remain > 0 ? [ITEM_ROLES.berryJuice] : []),
            ...(o.usePillows && pillowEffect && stock(pillowId).remain > 0 ? [pillowId] : []),
          ]
          const best = available.map(id => {
            const energy = itemHealEnergy(itemById(id)!.useEffect!, target.energy, target.factor)
            const score = replaceScore + estimatedProduction(target, minutes, replacementTeam, energy) - initial
            return { id, energy, score }
          }).filter(option => option.energy > low && option.score > healerScore)
            .sort((a, b) => b.score - a.score || a.energy - b.energy)[0]
          if (best) {
            useRecoveryItem(target, best.id)
            return replacementTeam
          }
        }
      }
      restingHealer = undefined
      return team
    }
    const full = others.every(m => m.energy >= cap)
    const mixedRecovery = others.some(m => m.factor < 1) && others.some(m => m.factor >= 1)
    if ((!full && !mixedRecovery) || others.some(m => m.energy <= low)) return team
    const keep = estimatedTeamProduction(team, minutes)
    const replacement = alternatives.filter(m => !team.includes(m) && legalTeam([...others, m]))
      .map(m => ({ member: m, value: estimatedTeamProduction([...others, m], minutes) }))
      .sort((a, b) => b.value - a.value).find(candidate => candidate.value > keep)?.member
    if (!replacement) return team
    restingHealer = { healer, original: others, substitute: replacement, full }
    return [...others, replacement]
  }
  function useRecoveryItem(member: Actor, id: number) {
    const item = itemById(id)!
    const held = stock(id)
    const energy = itemHealEnergy(item.useEffect!, member.energy, member.factor)
    if (held.remain <= 0 || energy <= member.energy) return
    const recovered = energy - member.energy
    member.energy = energy
    member.decay = currentMinute
    held.remain--
    held.used++
    usedRecoveryAt = currentMinute
    note({ minute: currentMinute, kind: id === ITEM_ROLES.berryJuice ? 'juice' : 'item', text: item.name,
      itemId: id, energyRecovered: recovered, members: [member.uid] })
  }
  function settle(session: SleepSession, afterEnd = false) {
    if (settled.has(session)) return
    settled.add(session)
    const score = Math.max(0, Math.min(session.score, (scoreSimulation_settle_runtimeParameters.p001 as 100) - (dayScores.get(session.day) ?? 0)))
    dayScores.set(session.day, (dayScores.get(session.day) ?? 0) + score)
    const team = select(o.device ? policy.settle[session.slot]! : policy.sleep[session.slot]!)
    const bonuses = team.filter(m => m.subs.includes('energyRecover')).length
    const expBonus = 1 + team.filter(m => m.subs.includes('sleepExp')).length * scoreSimulation_settle_ruleParameters.sleepExpBonus
    for (const m of team) {
      m.energy = sleepRecoveredEnergy(m.energy, score, m.input, settings.incense, bonuses)
      m.decay = currentMinute
      m.exp += score * expBonus * natureStatFactor(m.pokemon.nature, 'exp') * activityValues(settings.activity, settings.island, m.poke, session.start).sleepExpMultiplier
    }
    const sleepTeam = [...(sleepProducers.get(session) ?? select(policy.sleep[session.slot]!))]
    for (const m of sleepTeam) resetSkillModelState(m, 'sleepStart')
    for (const m of actors.values()) if (!team.includes(m) && !sleepTeam.includes(m) && !active.includes(m)) {
      m.energy = sleepRecoveredEnergy(m.energy, Math.ceil(score * scoreSimulation_settle_ruleParameters.inactiveRecoveryShare), m.input, settings.incense, 0)
    }
    note({ minute: session.settle, kind: 'settle', text: `${afterEnd ? '周期外' : ''}睡眠研究结算 ${score} 分；经验与活力分配给结算队`, members: team.map(m => m.uid) })
  }
  function cook() {
    assertActivitySupported(settings.activity, 'cooking', currentMinute, settings.island)
    const activity = activityValues(settings.activity, settings.island, undefined, currentMinute)
    const sunday = Math.floor((currentMinute - (scoreSimulation_cook_runtimeParameters.p001 as 240)) / 1440) === (scoreSimulation_cook_runtimeParameters.p002 as 6)
    const pot = cookingPotCapacity(settings.potSize + activity.potCapacityBonus, sunday, settings.goodCamp, extraPot, activity.potSizeMultiplier)
    const can = (r: typeof RECIPES[number]) => canCookRecipe(r, bag, pot)
    const ranked = RECIPES.filter(r => !r.mix && activityRecipeCategories(activity, o.category).includes(r.category)).filter(can).sort((a, b) => recipeEnergy(b, settings, activity.recipeEnergyModifiers) - recipeEnergy(a, settings, activity.recipeEnergyModifiers))
    const chosen = targetRecipe && activityRecipeCategories(activity, o.category).includes(targetRecipe.category) && can(targetRecipe) ? targetRecipe : ranked[0]
    const missing = targetRecipe && Object.fromEntries(targetRecipe.ingredients
      .map(ingredient => [String(ingredient.id), Math.max(0, ingredient.count - (bag[ingredient.id] ?? 0))] as const)
      .filter(([, count]) => count > 0))
    const reason = missing && Object.keys(missing).length ? '目标料理食材不足'
      : targetRecipe && targetRecipe.pot > pot ? '目标料理锅容量不足' : undefined
    const dayStart = Math.floor(currentMinute / 1440) * 1440
    const hasLaterMeal = mealMinutes.some(time => {
      const today = dayStart + time
      return (today > currentMinute ? today : today + 1440) < end
    })
    // 搜索保留策略：还有餐次时，可跳过低价值餐以等待目标食谱。
    if ((!chosen || targetRecipe && chosen.id !== targetRecipe.id && policy.reserveMeals > 0) && hasLaterMeal) {
      note({ minute: currentMinute, kind: 'skip', text: `跳餐：为${targetRecipe?.name ?? '后续料理'}保留食材、扩锅 ${extraPot} 与技能暴击 ${(crit * 100).toFixed(0)}%`,
        foods: missing || undefined, reason }); return
    }
    if (!bagCount) { note({ minute: currentMinute, kind: 'skip', text: '跳餐：没有可用食材' }); return }
    const required = takeRecipeIngredients(chosen, bag)
    const requiredCount = sumBag(required.consumed)
    const filler = allocateIngredients(required.remain, !chosen || policy.fill ? pot - requiredCount : 0,
      0, activity.extraIngredientEnergyMultipliers, { reserve: key => hasLaterMeal && (policy.reserveMeals > 0 || policy.mealRecipeIds)
        ? reserve(key, false) : 0 })
    const foods = required.consumed
    for (const [key, count] of Object.entries(filler.consumed)) add(foods, key, count)
    const used = requiredCount + filler.used
    const raw = (chosen ? recipeEnergy(chosen, settings, activity.recipeEnergyModifiers) : 0) + filler.energy
    Object.assign(bag, filler.remain)
    if (!used) { note({ minute: currentMinute, kind: 'skip', text: '跳餐：保留下一餐所需食材' }); return }
    bagCount -= used
    const chance = Math.min(1, (sunday ? scoreSimulation_cook_ruleParameters.sundayCritChance : scoreSimulation_cook_ruleParameters.normalCritChance) + crit + activity.cookingCritBonus)
    const hit = chance >= 1 || random() < chance
    const energy = mealEnergy(raw, settings.areaBonus, (hit ? (sunday ? scoreSimulation_cook_ruleParameters.sundayCritMultiplier : scoreSimulation_cook_ruleParameters.normalCritMultiplier) * activity.cookingCritMultiplier : 1) * activity.cookingEnergyMultiplier)
    cooking += energy; extraPot = 0; if (hit) crit = 0
    if (chosen?.id != null) {
      const day = Math.floor((currentMinute - 240) / 1440)
      const counts = cookedByDay[day] ??= {}
      counts[chosen.id] = (counts[chosen.id] ?? 0) + 1
    }
    for (const [name, amount] of Object.entries(foods)) add(consumed, name, amount)
    for (const m of active) { m.energy = Math.min(scoreSimulation_cook_ruleParameters.energyCap, m.energy + mealRecover(m.energy, activity.mealRecoveryBonus, activity.mealRecoveryMultiplier)); m.decay = currentMinute }
    note({ minute: currentMinute, kind: 'cook', text: `${chosen?.name ?? '拌拌料理'}${chosen ? ` Lv.${recipeLevelOf(settings, chosen.id)}` : ''} · ${used}/${pot} 个食材 · 暴击率 ${(chance * 100).toFixed(0)}%${hit ? ' · 暴击' : ''}`, foods, energy, recipeId: chosen?.id, reason })
  }
  const initialSleep = sessions.find(s => start >= s.start && start < s.end)
  let sleep = initialSleep
  refreshActivities(start)
  rotate(initialSleep ? select(policy.sleep[initialSleep.slot]!) : daytime(), initialSleep ? `睡眠生产队 ${initialSleep.slot + 1}` : '白天生产队')
  if (initialSleep) sleepProducers.set(initialSleep, new Set(active))
  supply?.prepare(0)
  let mealIndex = -1
  for (let t = start; t < end + Number(Boolean(supply)) && !supply?.complete; t++) {
    currentMinute = t
    if (t % 1440 === (scoreSimulation_simulateScore_runtimeParameters.p006 as 240)) refreshActivities(t)
    const entering = sessionsStarting.get(t)
    const waking = sessionsWaking.get(t)
    if (waking || entering) sleep = entering
    const canCollect = !sleep || sleep.collect
    if (policy.mealRecipeIds) {
      const index = nextMealIndex(t)
      if (index !== mealIndex) {
        mealIndex = index
        const recipe = recipeById(policy.mealRecipeIds[index])
        targetRecipe = recipe && recipeCategories.some(category => category === recipe.category) ? recipe : undefined
      }
    }
    // 同刻顺序：衰减、研究、完成帮忙、收菜/技能、换队、道具、料理。
    for (const m of active) {
      if (t - m.decay >= (scoreSimulation_simulateScore_runtimeParameters.p007 as 10)) { m.energy = Math.max(0, m.energy - ruleParameters.modules.scoreSimulation.energyDecay.perTick); m.decay = t }
    }
    if (t > start) for (const s of sessionsSettling.get(t) ?? []) settle(s)
    for (const m of active) while (m.next <= t && (supply || m.next < end) && !supply?.complete) {
      help(m); m.next += interval(m)
      if (supply) collect([m])
    }
    if (supply && t === start + DAY_MINUTES) supply.captureFirstDay()
    const collection = !supply && t > start && (Boolean(waking) || Boolean(entering) || canCollect && (sleep ? (t - sleep.start) % o.sleeps[sleep.slot]!.collectMinutes === 0 : (t - start) % o.collectMinutes === 0))
    if (collection) {
      if (waking || sleep && !entering) collect(active)
      else if (!entering && (policy.collectMode ?? 'all') === 'all') collect(active)
      else if (!entering && policy.collectMode === 'targeted') collect(active.filter(m =>
        m.stock > 0 || m.drops.some(drop => (bag[drop.id] ?? 0) < reserve(String(drop.id)))))
      else if (!entering) collect(active.filter(m => m.stock > 0 &&
        (roles.get(m)?.teamHeal || roles.get(m)?.crit || roles.get(m)?.pot)))
    }
    const nightNode = sleep && !entering && collection
    const nightAlternative = sleep && nightNode ? policy.sleepAfterCollect?.[sleep.slot] : undefined
    let nextSleep: Actor[] | undefined
    if (sleep && nightAlternative) {
      const team = select(policy.sleep[sleep.slot]!)
      const alternate = select(nightAlternative)
      const collectionMinutes = o.sleeps[sleep.slot]!.collectMinutes
      const minutes = Math.min(collectionMinutes * lookahead, sleep.end - t, end - t)
      const recoveryMinutes = Math.min(o.collectMinutes * lookahead, end - t - minutes)
      const chosen = estimatedTeamProduction(alternate, minutes, recoveryMinutes, collectionMinutes) > estimatedTeamProduction(team, minutes, recoveryMinutes, collectionMinutes)
        ? alternate : team
      nextSleep = teamKey(chosen) === currentKey ? active : chosen
    }
    if (nightNode && policy.dayAlternates) nextSleep = replaceCappedCrit(nextSleep ?? active, active)
    if (!active.length || entering || waking || nextSleep || !sleep && collection && t - lastRotation >= policy.rotateMinutes) {
      if (waking) { restingHealer = undefined; fiveSelfHealFallback = undefined; selfHealProcs.clear() }
      const chosen = sleep ? nextSleep ?? select(policy.sleep[sleep.slot]!) : daytime()
      const changed = rotate(chosen, sleep ? `睡眠生产队 ${sleep.slot + 1}` : '白天生产队')
      if (changed) lastRotation = t
      if (sleep && (entering || changed)) {
        const producers = sleepProducers.get(sleep) ?? new Set<Actor>()
        for (const member of active) producers.add(member)
        sleepProducers.set(sleep, producers)
      }
    }
    if (o.useJuice && usedRecoveryAt !== t && (collection || t === start && !sleep) && juice.remain > 0) {
      const target = [...active].filter(m => m.energy < Math.min((scoreSimulation_simulateScore_runtimeParameters.p010 as 100), policy.juiceAt)).sort((a, b) => a.energy - b.energy)[0]
      if (target) {
        useRecoveryItem(target, ITEM_ROLES.berryJuice)
      }
    }
    if (!supply && canCollect && mealMinutes.includes(t % 1440)) cook()
  }
  // 分钟边界之后、结束之前完成的帮忙仍计生产；不产生末尾领取事件。
  if (!supply) for (const m of active) while (m.next < end) { currentMinute = m.next; help(m); m.next += interval(m) }
  // 最后一段睡眠允许延迟结算；仅恢复与经验，没有结束后的帮忙/收菜/技能/料理。
  if (!supply) for (const s of sessions) if (s.settle >= end && s.start >= start && s.start < end) { currentMinute = s.settle; settle(s, true) }
  if (segments.length) segments[segments.length - 1]!.end = end
  // At a rotation minute the outgoing roster has already produced for that tick.
  for (const segment of segments) {
    const from = segment.start === start ? start : segment.start + 1
    const to = segment.end === end ? end : segment.end + 1
    for (const uid of segment.members) {
      const actor = actors.get(uid)!
      actor.hours += (to - from) / 60
      for (let minute = from; minute < to;) {
        const day = Math.floor((minute - scoreSimulation_simulateScore_runtimeParameters.p008) / 1440)
        const next = Math.min(to, (day + 1) * 1440 + scoreSimulation_simulateScore_runtimeParameters.p008)
        if (day >= 0 && day < actor.dailyHours.length) actor.dailyHours[day]! += (next - minute) / 60
        minute = next
      }
    }
  }
  const members = [...actors.values()].filter(m => m.hours || m.exp).map(m => ({ uid: m.uid, hours: m.hours, dailyHours: m.dailyHours,
    energy: m.energy, exp: m.exp, heldBerries: m.heldBerries, heldFood: m.heldFood, stock: m.stock }))
  const total = berry + zoneEnergy + skill + cooking
  return { berry, zone: zoneEnergy, skill, cooking, total, bag, received, consumed, sold, items, juice, members, actions, segments,
    cookedByDay, skillReleases: skillReleases.total, suppressedSkillRolls, decayApplied, warnings: [...warnings],
    ...(supply ? { mealSupply: supply.result() } : {}) }
}
