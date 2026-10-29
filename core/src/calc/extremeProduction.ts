import { NATURES, pokeById } from './data'
import type { CarryMode, IngredientSlots, ProduceInput, Settings } from '../types'
import { slotDrop } from './ingredients'
import { natureHelpFactor, subskillSpeedCut } from './helpSpeed'
import { carryLimit } from './timeline'
import { skillMaxFor, clampSkillLevel } from './mainSkills'
import { produce, findingRate } from './produce'
import { applyMainSkill, type EffectActor } from './skillEffects'
import { resolveMemberSkill } from './mew'
import { compareHelpingBonus } from './member'

export interface ExtremeYield {
  input: ProduceInput
  total: number
  ordinary: number
  skill: number
}
export function extremeInput(pokeId: number, carryMode: CarryMode = 'unlimited'): ProduceInput {
  const poke = pokeById(pokeId)
  if (!poke) throw Error('未知宝可梦')
  return { pokeId, level: 70, nature: '勤奋', subskills: ['helpingBonus', 'berryS', 'helpM', 'skillM', ''],
    ingredientSlots: [0, 1, 2], skillLevel: skillMaxFor(poke.mainSkill), carryMode,
    wakeEnergy: 100, ribbonHours: 2000, supportTeamSize: 5 }
}

/** Enumerate legal panels, collapsing food choices with identical yield vectors.
 * User-confirmed: Helping Bonus occupies one of the four unlocked Lv70 slots
 * and uses the five-stack individual-comparison convention. Optimize three
 * other active skills; leave the locked Lv80 slot empty.
 * Five Helping Bonuses already exceed the speed cap with Helping Speed M, so
 * Helping Speed S cannot improve any panel containing M and is dominated by M.
 */
function combinations<T>(items: T[], count: number, prefix: T[] = []): T[][] {
  if (!count) return [prefix]
  return items.flatMap((item, index) => combinations(items.slice(index + 1), count - 1, [...prefix, item]))
}
export function extremeIngredientSlots(pokeId: number, target?: number): IngredientSlots[] {
  const poke = pokeById(pokeId)!
  const all = poke.specialty === '全部'
  const columns = [0, 1, 2].map(slot => {
    const indices: (number | null)[] = poke.ingredients.flatMap((_, index) => (all || index <= slot) && slotDrop(poke.ingredients, slot, index) ? [index] : [])
    if (all && slot) indices.push(null)
    return indices
  })
  const seen = new Set<string>(), result: IngredientSlots[] = []
  for (const a of columns[0]!) for (const b of columns[1]!) for (const c of columns[2]!) {
    const slots: IngredientSlots = [a, b, c]
    const key = JSON.stringify(slots.map((index, slot) => {
      const drop = index == null ? null : slotDrop(poke.ingredients, slot, index)
      return drop ? target === undefined ? drop.amount : drop.id === target ? drop.amount : 0 : null
    }))
    if (!seen.has(key)) { seen.add(key); result.push(slots) }
  }
  return result
}

interface Panel { nature: string; subskills: string[]; vector: number[]; carry: number }
function panels(objective: 'berries' | 'ingredients', mode: CarryMode): Panel[] {
  const ids = objective === 'berries' ? ['berryS', 'helpM', 'skillM', 'skillS', 'invS', 'invM', 'invL'] : ['helpM', 'ingS', 'ingM', 'skillM', 'skillS']
  const variants = combinations(ids, 3).map(skills => ['helpingBonus', ...skills])
  const unique = new Map<string, Panel>()
  for (const nature of NATURES) for (const active of variants) {
    const speed = natureHelpFactor(nature.name) * (1 - subskillSpeedCut(active, compareHelpingBonus(70, active, 0)))
    const food = findingRate(.1, nature.name, 'ingredient', active, 'ingS', 'ingM') / .1
    const skill = findingRate(.1, nature.name, 'skill', active, 'skillS', 'skillM') / .1
    const fruit = active.includes('berryS') ? 1 : 0
    // Inventory is not monotone for berry production: compare only equal caps.
    const carry = mode === 'normal' ? carryLimit(0, active, false, 'normal') : 0
    const vector = [1 / speed, objective === 'berries' ? -food : food, mode === 'full' ? 0 : skill, objective === 'berries' ? fruit : 0]
    const key = JSON.stringify([vector, carry])
    if (!unique.has(key)) unique.set(key, { nature: nature.name, subskills: [...active, ''], vector, carry })
  }
  const rows = [...unique.values()]
  return rows.filter(row => !rows.some(other => other.carry === row.carry && other.vector.every((value, index) => value >= row.vector[index]!) && other.vector.some((value, index) => value > row.vector[index]!)))
}
const panelCache = new Map<string, Panel[]>()
export function extremePanelLabel(input: ProduceInput) {
  const poke = pokeById(input.pokeId)!
  const ingredients = input.ingredientSlots.map(index => index == null ? '空' : poke.ingredients[index]?.name ?? '空').join(' / ')
  return `${input.nature} · 食材 ${ingredients}`
}
export async function runRanking<T>(steps: Generator<void, T>, active: () => boolean): Promise<T | undefined> {
  while (active()) {
    const started = Date.now()
    do {
      const next = steps.next()
      if (next.done) return next.value
    } while (active() && Date.now() - started < 12)
    await new Promise<void>(resolve => setTimeout(resolve, 0))
  }
  steps.return(undefined as T)
}
export function* extremeInputs(pokeId: number, objective: 'berries' | 'ingredients', mode: CarryMode, target?: number) {
  const key = `${objective}/${mode}`
  if (!panelCache.has(key)) panelCache.set(key, panels(objective, mode))
  const slots = mode === 'full' ? [extremeIngredientSlots(pokeId)[0]!] : extremeIngredientSlots(pokeId, target)
  for (const panel of panelCache.get(key)!) for (const ingredientSlots of slots) {
    yield { ...extremeInput(pokeId, mode), nature: panel.nature, subskills: panel.subskills, ingredientSlots }
  }
}

/** Continuous-harvest ingredient comparison. Direct ingredient skill awards are
 * deliberately discarded; applyMainSkill's self-help callback is retained.
 * Uses the same skill tables and five-person self-target denominator as teams.
 */
export function ingredientYield(settings: Settings, input: ProduceInput, ingredientId: number): ExtremeYield {
  const poke = pokeById(input.pokeId)!
  const helpingBonus = compareHelpingBonus(input.level, input.subskills, 0)
  const result = produce(settings, input, helpingBonus, undefined, { naturalOnly: true })
  const name = poke.ingredients.find(item => item.id === ingredientId)?.name
  if (!name) return { input, total: 0, ordinary: 0, skill: 0 }
  const ordinary = result.ingredients[name] ?? 0
  const selected = resolveMemberSkill(poke, input)
  let skill = 0
  const ingRate = findingRate(poke.ingredientRate, input.nature, 'ingredient', input.subskills.slice(0, 4), 'ingS', 'ingM')
  const actor: EffectActor = { poke: { ...poke, mainSkill: selected.name }, input, energy: 100, factor: 1,
    skillLv: clampSkillLevel(selected.name, input.skillLevel), skillRate: result.helps ? result.skillProcs / result.helps : 0,
    unitBerry: 0, result }
  applyMainSkill(actor, [actor], {
    ingredient() {}, pot() {}, crit() {}, charge() {}, skillOnly() {},
    help(target, helps) {
      if (target !== actor) return
      for (const [slot, index] of input.ingredientSlots.entries()) {
        const drop = index == null ? null : slotDrop(poke.ingredients, slot, index)
        if (drop?.id === ingredientId) skill += helps * ingRate / input.ingredientSlots.length * drop.amount
      }
    },
  }, result.skillProcs)
  return { input, total: ordinary + skill, ordinary, skill }
}
