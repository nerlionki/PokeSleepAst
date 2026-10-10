import { describe, expect, it, vi, afterEach } from 'vitest'
import { MEW_SKILLS, normalizeMewSkill, resolveMemberSkill } from '../../../core/src/calc/mew'
import { CookingSkillState } from '../../../core/src/calc/cookingSkillState'
import { applyMainSkill, METRONOME_POOL, type EffectActor, type EffectContext } from '../../../core/src/calc/skillEffects'
import { MAIN_SKILLS } from '../../../core/src/calc/mainSkills'
import { defaultSettings } from './defaults'
import { simulateTeam } from './timeline'
import { cookMeals, recipeLevelMult } from './cook'
import { parseBoxImport } from './boxio'
import { produce } from './produce'
import * as data from '../../../core/src/calc/data'

afterEach(() => vi.restoreAllMocks())
function actor(id: number): EffectActor {
  return { poke: { id: 151, mainSkill: MAIN_SKILLS.find(s => s.id === id)!.name, berry: '莓莓果' },
    input: { pokeId: 151, level: 60, nature: '勤奋', subskills: [], ingredientSlots: [0, 0, 0], skillLevel: 8 },
    energy: 0, factor: 1, skillLv: 8, skillRate: .04, unitBerry: 100,
    result: { helps: 0, berries: 0, berryEnergy: 0, ingredients: {}, skillProcs: 0, skillEnergy: 0, sneaky: 0, curve: [] } }
}
function effects(a: EffectActor) {
  const state = new CookingSkillState()
  const calls = { food: 0, helps: 0, skillOnly: 0, charge: 0 }
  const context: EffectContext = {
    ingredient: (_, _name, n) => { calls.food += n }, help: (_, n) => { calls.helps += n },
    pot: n => state.addPot(n), crit: c => state.addCrit(c),
    skillOnly: (_, n, probability) => { calls.skillOnly += n * probability }, charge: (_, n) => { calls.charge += n },
  }
  expect(applyMainSkill(a, [a], context)).toBe(true)
  return { state, calls }
}
describe('Mew editable skill', () => {
  it('has twelve choices, defaults to metronome and uses selected rates', () => {
    expect(MEW_SKILLS).toHaveLength(12)
    expect(normalizeMewSkill(999)).toBe(12)
    const mew = data.pokeById(151)!
    expect(resolveMemberSkill(mew, { mewSkill: 7 }).rate).toBe(.064)
    expect(resolveMemberSkill(mew, { mewSkill: 8 }).rate).toBe(.0337)
    expect(resolveMemberSkill(data.pokeById(25)!, { mewSkill: 8 }).rate).toBe(data.pokeById(25)!.skillRate)
  })
  it('native import preserves selection and omni level', () => {
    const a = actor(8).input
    const out = parseBoxImport({ schemaVersion: 1, pokemon: [{ ...a, uid: 'mew', mewSkill: 8 }] })
    expect(out.pokemon[0]).toMatchObject({ mewSkill: 8, skillLevel: 8 })
  })
  it('individual Mew uses solo cooking and separates remaining food', () => {
    const input = { ...actor(10).input, mewSkill: 10 }
    const result = produce(defaultSettings(), input)
    expect(result.cooking).toBeDefined()
    expect(result.cooking!.energy).toBeGreaterThan(0)
    expect(produce(defaultSettings(), { ...input, pokeId: 25 }).cooking).toBeUndefined()
  })
  it('excludes direct and extra-help skill food only from solo cooking', () => {
    const settings = { ...defaultSettings(), sleepStart: '00:00', sleepEnd: '00:00' }
    const mew = data.pokeById(151)!
    vi.spyOn(data, 'pokeById').mockReturnValue({ ...mew, ingredientRate: 0 })
    const input = { ...actor(10).input, mewSkill: 10 }
    const solo = produce(settings, input)
    expect(solo.cooking!.energy).toBe(0)
    expect(Object.values(solo.ingredients).reduce((a, b) => a + b, 0)).toBeCloseTo(0)
    expect(Object.values(solo.skillIngredients!).reduce((a, b) => a + b, 0)).toBeGreaterThan(0)
    expect(simulateTeam(settings, [input], 0).meals.reduce((sum, m) => sum + m.energy, 0)).toBeGreaterThan(0)
    vi.mocked(data.pokeById).mockReturnValue({ ...mew, ingredientRate: 1 })
    const support = produce(settings, { ...input, mewSkill: 9 })
    expect(Object.values(support.skillIngredients!).reduce((a, b) => a + b, 0)).toBeGreaterThan(0)
  })
  it('applies the same solo cooking accounting to other metronome species', () => {
    const result = produce(defaultSettings(), { ...actor(12).input, pokeId: 175, skillLevel: 7 })
    expect(result.cooking).toBeDefined()
    expect(result.skillIngredients).toBeDefined()
  })
  it.each([151, 175])('individual %s maintains full energy throughout day and sleep', pokeId => {
    const input = { ...actor(12).input, pokeId, mewSkill: 8, wakeEnergy: 100 }
    const result = produce({ ...defaultSettings(), sleepScore: 0 }, input)
    expect(result.curve.length).toBeGreaterThan(0)
    expect(result.curve.every(point => point.energy === 100)).toBe(true)
    expect(result.curve.some(point => point.asleep)).toBe(true)
    expect(simulateTeam({ ...defaultSettings(), sleepScore: 0 }, [input], 0).members[0]!.curve.some(point => point.energy !== 100)).toBe(true)
  })
  it.each(MEW_SKILLS.map(s => s.id))('implements selected skill %s', id => {
    const a = actor(id)
    const { calls, state } = effects(a)
    const rewards = a.result.rewards
    expect(calls.food + calls.helps + calls.charge + a.energy + a.result.berryEnergy + state.extraPot
      + state.cook(false).chance - .1 + (rewards?.dreamShards ?? 0)).toBeGreaterThan(0)
  })
  it('caps healing at the selected skill maximum without changing omni level', () => {
    const a = actor(8)
    effects(a)
    expect(a.energy).toBe(18.1)
    expect(a.input.skillLevel).toBe(8)
  })
  it('metronome implements all 26 branches and exposes separate rewards', () => {
    expect(new Set(METRONOME_POOL).size).toBe(26)
    for (const id of METRONOME_POOL) effects(actor(id))
    const a = actor(12)
    const { calls } = effects(a)
    expect(calls.food).toBeGreaterThan(0)
    expect(calls.charge).toBeGreaterThan(0)
    expect(a.result.rewards!.berryJuice).toBeCloseTo(.185 / 26)
    expect(a.result.rewards!.dreamShards).toBeGreaterThan(0)
  })
})
describe('continuous cooking', () => {
  it('Sunday reaches 100% at skill bonus 70%, then only skill bonus resets', () => {
    const s = new CookingSkillState()
    s.addCrit([{ amount: .8, probability: 1 }])
    expect(s.cook(true)).toEqual({ chance: 1, multiplier: 3 })
    expect(s.cook(true).chance).toBeCloseTo(.3)
  })
  it('retains the bonus on the non-critical probability branch', () => {
    const s = new CookingSkillState()
    s.addCrit([{ amount: .2, probability: 1 }])
    expect(s.cook(false).chance).toBeCloseTo(.3)
    expect(s.cook(false).chance).toBeCloseTo(.3 * .1 + .7 * .3)
  })
  it('caps extra capacity before applying Sunday to base and camp to both', () => {
    const s = new CookingSkillState()
    s.addPot(250)
    expect(s.potSize(81, true, true)).toBe(543)
    s.cook(false)
    expect(s.extraPot).toBe(0)
  })
  it('uses actual level table and actual filler energy without level bonus', () => {
    expect(recipeLevelMult(11)).toBeCloseTo(1.19)
    expect(recipeLevelMult(70)).toBeCloseTo(3.58)
    const settings = { ...defaultSettings(), potSize: 8, mealCategory: 'curry' as const, recipeLevels: { 特選蘋果咖哩: 70 } }
    const base = cookMeals({ 特选苹果: 7 }, settings, 1).meals[0]!
    const extra = cookMeals({ 特选苹果: 8 }, settings, 1).meals[0]!
    expect(extra.energy - base.energy).toBeCloseTo(90 * 1.1, 0)
    expect(cookMeals({}, settings, 100).meals).toHaveLength(21)
  })
  it('schedules at most 21 meals and never uses food from after a meal', () => {
    const poke = data.pokeById(151)!
    vi.spyOn(data, 'pokeById').mockReturnValue({ ...poke, interval: 60, ingredientRate: 1 })
    const input = { ...actor(10).input, mewSkill: 10, carryMode: 'unlimited' as const }
    const sim = simulateTeam({ ...defaultSettings(), period: 'week', sleepStart: '00:00', sleepEnd: '00:00' }, [input], 0)
    expect(sim.meals).toHaveLength(21)
    expect(sim.meals.map(m => m.minute! % 1440)).toEqual(Array.from({ length: 7 }, () => [480, 720, 1080]).flat())
    const sleeping = simulateTeam({ ...defaultSettings(), sleepStart: '00:00', sleepEnd: '09:00' }, [input], 0)
    expect(sleeping.meals.find(m => m.minute === 480)).toBeUndefined()
    expect(sleeping.meals.every(m => m.minute! >= 720)).toBe(true)
  })
})
