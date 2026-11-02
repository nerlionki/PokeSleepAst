import runtimeParameters from '../data/runtime-parameters.resource'
import ruleCatalogs from '../data/rule-catalogs.resource'
import ruleParameters from '../data/rule-parameters.resource'
import { resolveMemberSkill } from './mew'
import { activityBerrySettings, activityValues, snapshotActivity } from './activities'
import { simulateTeam } from './timeline'
import type { ProduceInput, ProduceResult, Settings } from '../types'
import { exEffects } from './exEffects'
import { skillMaxFor, skillByPokedexName } from './mainSkills'
import { berryUnitEnergy } from './berry'
import { pokeById } from './data'
import { instantInterval } from './helpSpeed'
import { slotDrop } from './ingredients'
import { effectiveSkillLevel, unlockedSubskills } from './member'
import { natureStatFactor } from './natureLabels'
import { ribbonBonus, stagesLeft } from './ribbon'
import { chargeStrength } from './skills'
const produce_berryPerHelp_ruleParameters = ruleParameters.modules.produce.berryPerHelp
const produce_findingRate_ruleParameters = ruleParameters.modules.produce.findingRate
const produce_splitHelps_runtimeParameters = runtimeParameters.modules.produce.splitHelps.values
const produce_config_ruleCatalogs = ruleCatalogs.modules.produce
const produce_produce_ruleParameters = ruleParameters.modules.produce.produce
const produce_produce_runtimeParameters = runtimeParameters.modules.produce.produce.values


const emptyProduceResult = (): ProduceResult => ({ helps: 0, berries: 0, berryEnergy: 0, ingredients: {}, skillProcs: 0, skillEnergy: 0, sneaky: 0, curve: [] })

function berryPerHelp(specialty: string, subskills: string[]): number {
  let n = specialty === '树果型' || specialty === '全部' ? produce_berryPerHelp_ruleParameters.specialistBerries : produce_berryPerHelp_ruleParameters.normalBerries
  if (subskills.includes('berryS')) n += ruleParameters.modules.produce.berryPerHelp.berrySFruitBonus
  return n
}

export function findingRate(base: number, nature: string, stat: 'ingredient' | 'skill', subskills: string[], small: string, medium: string): number {
  const bonus = 1 + (subskills.includes(small) ? produce_findingRate_ruleParameters.findingS : 0) + (subskills.includes(medium) ? produce_findingRate_ruleParameters.findingM : 0)
  return Math.min(1, base * natureStatFactor(nature, stat) * bonus)
}

function cutDecimal(value: number, places: number): number {
  const scale = 10 ** places
  return Math.floor(value * scale) / scale
}

/**
 * 一次帮忙只出一种：树果，或已解锁的某一槽食材。技能不占用这次帮忙。
 * 食材次数、技能次数按期望计算，不人为补足一次。
 */
export function splitHelps(
  helps: number,
  ingRate: number,
  skillRate: number,
  slots: { name: string, amount: number }[],
  snacking: boolean,
  slotCount = slots.length,
): { berryHelps: number, ingredients: Record<string, number>, skillProcs: number } {
  let skillProcs = cutDecimal(helps * skillRate, 1)
  if (snacking) skillProcs = 0
  let foodHelps = slots.length ? cutDecimal(helps * ingRate * slots.length / Math.max(slots.length, slotCount), 2) : 0
  if (snacking) foodHelps = 0
  const berryHelps = Math.max(0, cutDecimal(helps - foodHelps, 2))
  const ingredients: Record<string, number> = {}
  if (foodHelps > 0 && slots.length) {
    for (const slot of slots) {
      let count = cutDecimal(foodHelps / slots.length * slot.amount, 1)
      if (count >= (produce_splitHelps_runtimeParameters.p001 as 100)) count = Math.floor(count)
      ingredients[slot.name] = (ingredients[slot.name] ?? 0) + count
    }
  }
  return { berryHelps, ingredients, skillProcs }
}

/**
 * 个体对比用的日产量。按全天维持传入活力（对比页传满活力）的固定间隔取期望值。
 * 产量拆法对齐 pokeSleepCalc 的 getOneDayHelpCount / getOneDayEnergy。
 */
export function produce(settings: Settings, input: ProduceInput, helpingBonus = settings.helpingBonus, slice?: { minute: number, minutes: number }, comparison?: { naturalOnly?: boolean; skipCooking?: boolean }): ProduceResult {
  const snapshot = snapshotActivity(settings)
  settings = snapshot
  const species = pokeById(input.pokeId)
  const selected = species ? resolveMemberSkill(species, input) : null
  const poke = species && selected ? { ...species, mainSkill: selected.name, skillRate: selected.rate } : undefined
  if (!poke) return emptyProduceResult()
  // 纯能量/回复技能在固定活力比较中可使用等价快速公式，其余统一技能结算。
  if (!comparison?.naturalOnly && input.carryMode !== 'full' && (input.pokeId === 151 || !produce_config_ruleCatalogs.produceList0.values.includes(skillByPokedexName(poke.mainSkill)?.id ?? 0))) {
    const sim = simulateTeam(settings, [input], helpingBonus, { expectedProcs: true, fixedEnergy: input.wakeEnergy ?? produce_produce_ruleParameters.fixedComparisonEnergy, skipCooking: comparison?.skipCooking })
    const result = sim.members[0]!
    return { ...result, cooking: { energy: sim.meals.reduce((sum, meal) => sum + meal.energy, 0), remain: sim.remain } }
  }
  const subs = unlockedSubskills(input.level, input.subskills)
  if (!slice && (snapshot.activity.catalog.activities.length || Object.keys(snapshot.activity.overrides ?? {}).length)) {
    const end = (settings.period === 'week' ? (produce_produce_runtimeParameters.p001 as 7) : 1) * 1440
    const boundaries = [0, ...Array.from({ length: settings.period === 'week' ? (produce_produce_runtimeParameters.p002 as 7) : 1 }, (_, day) => day * 1440 + (produce_produce_runtimeParameters.p003 as 240)), end]
    const keys = (produce_config_ruleCatalogs.produceList1.values as unknown as readonly ["helpIntervalMultiplier","berryCountBonus","berryEnergyMultiplier","ingredientCountBonus","skillRateMultiplier","skillLevelBonus","skillStrengthMultiplier"])
    const signatures = boundaries.slice(0, -1).map(minute => { const row = activityValues(snapshot.activity, settings.island, poke, minute); return JSON.stringify([keys.map(key => row[key]), activityBerrySettings(snapshot, snapshot.activity, minute).berries]) })
    if (new Set(signatures).size > 1) {
    const result = emptyProduceResult()
    for (let i = 0; i < boundaries.length - 1; i++) {
      const row = produce(settings, input, helpingBonus, { minute: boundaries[i]!, minutes: boundaries[i + 1]! - boundaries[i]! }, comparison)
      for (const key of (produce_config_ruleCatalogs.produceList2.values as unknown as readonly ["helps","berries","berryEnergy","skillProcs","skillEnergy","sneaky"])) result[key] += row[key]
      for (const [name, amount] of Object.entries(row.ingredients)) result.ingredients[name] = (result.ingredients[name] ?? 0) + amount
    }
    return result
    }
  }
  const activity = activityValues(snapshot.activity, settings.island, poke, slice?.minute ?? (produce_produce_runtimeParameters.p004 as 240))
  settings = activityBerrySettings(snapshot, snapshot.activity, slice?.minute ?? 240)
  const ribbon = ribbonBonus(input.ribbonHours ?? 0, stagesLeft(poke.id))
  const energy = Math.min(produce_produce_ruleParameters.energyCap, Math.max(0, input.wakeEnergy ?? settings.sleepScore))
  const favored = settings.berries.includes(poke.berry)
  const ex = exEffects(settings, poke.berry, poke.specialty)
  const seconds = instantInterval(
    poke.interval,
    input.level,
    input.nature,
    subs,
    helpingBonus,
    energy,
    settings.goodCamp,
    settings.island,
    favored,
    ribbon.speedCut,
    ex.speed,
  ) * activity.helpIntervalMultiplier
  const days = settings.period === 'week' ? (produce_produce_runtimeParameters.p005 as 7) : 1
  const helps = seconds > 0 ? ((slice?.minutes ?? days * 1440) * 60) / seconds : 0
  const ingRate = findingRate(poke.ingredientRate, input.nature, 'ingredient', subs, 'ingS', 'ingM')
  const skillRate = Math.min(1, findingRate(poke.skillRate, input.nature, 'skill', subs, 'skillS', 'skillM') * ex.skillMultiplier * activity.skillRateMultiplier)
  const per = berryPerHelp(poke.specialty, subs) + activity.berryCountBonus
  const snacking = input.carryMode === 'full'
  const unlocked = input.level >= (produce_produce_runtimeParameters.p006 as 60) ? 3 : input.level >= (produce_produce_runtimeParameters.p007 as 30) ? 2 : 1
  const slots = input.ingredientSlots.slice(0, unlocked).flatMap((lineIndex, slot) => {
    if (lineIndex == null) return []
    const drop = slotDrop(poke.ingredients, slot, lineIndex)
    return drop ? [{ name: drop.name, amount: drop.amount + ex.ingredientExtra + activity.ingredientCountBonus }] : []
  })
  const split = splitHelps(helps, ingRate, skillRate, slots, snacking, comparison?.naturalOnly ? unlocked : slots.length)
  const berries = cutDecimal(split.berryHelps * per, 1)
  const unit = berryUnitEnergy(poke.berry, input.level, settings.areaBonus, ex.berryMultiplier) * activity.berryEnergyMultiplier
  const skillLv = Math.min(skillMaxFor(poke.mainSkill), effectiveSkillLevel(input.level, input.skillLevel, input.subskills, poke.mainSkill) + ex.skillLevels + activity.skillLevelBonus)
  return {
    helps,
    berries,
    berryEnergy: Math.floor(berries * unit),
    ingredients: split.ingredients,
    skillProcs: split.skillProcs,
    skillEnergy: Math.floor(split.skillProcs * chargeStrength(poke.mainSkill, skillLv) * (1 + settings.areaBonus) * activity.skillStrengthMultiplier),
    sneaky: snacking ? helps : 0,
    curve: [],
  }
}
