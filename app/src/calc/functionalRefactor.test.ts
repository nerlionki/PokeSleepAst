import { describe, expect, it } from 'vitest'
import golden from './refactor.golden.json'
import { cookMeal, cookMeals, allocateIngredients } from './cook'
import { trainPlan, type TrainInput } from '../../../core/src/calc/train'
import { advanceTraining, advanceTrainingState, feedTraining, feedTrainingState, expTo, groupMult } from './xp'
import { defaultSettings } from './defaults'
import { produce } from './produce'
import { INGREDIENTS } from './data'
import { createCandyRowFromBox } from '../../../core/src/calc/planning'
import type { BoxPokemon } from '../../../core/src/types'
import type { Settings } from '../../../core/src/types'

const serializable = (value: unknown) => JSON.parse(JSON.stringify(value, (_key, item) => typeof item === 'number' && !Number.isFinite(item) ? String(item) : item))
function freeze<T>(value: T): T {
  if (value && typeof value === 'object') {
    Object.values(value).forEach(freeze)
    Object.freeze(value)
  }
  return value
}

describe('functional calculation regression', () => {
  it.each(golden.cook.map((sample, index) => ({ ...sample, index })))('preserves cooking baseline $index without changing inputs', sample => {
    const bag = freeze({ ...sample.bag })
    const settings = freeze(structuredClone(sample.settings)) as Settings
    expect(cookMeals(bag, settings, sample.meals, sample.sunday, sample.options)).toEqual(sample.expected)
  })
  it.each(golden.train.map((sample, index) => ({ ...sample, index })))('preserves training baseline $index without changing inputs', sample => {
    expect(serializable(trainPlan(freeze({ ...sample.input }) as TrainInput))).toEqual(sample.expected)
  })
  it('composes one-meal transitions into the same multi-meal plan', () => {
    const bag = freeze(Object.fromEntries(INGREDIENTS.map(ingredient => [ingredient.name, 100])))
    const settings = freeze(defaultSettings())
    const first = cookMeal(bag, settings)
    const second = cookMeal(first.remain, settings)
    expect(cookMeals(bag, settings, 2)).toEqual({ meals: [first.meal, second.meal], remain: second.remain })
  })
  it('allocates fractional stock in energy order and preserves unknown ingredient fallback', () => {
    const bag = freeze({ unknown: 2.5 })
    expect(allocateIngredients(bag, 5, 30)).toEqual({ remain: { unknown: .5 }, used: 2, energy: 60 })
    expect(allocateIngredients(bag, 0)).toEqual({ remain: { unknown: 2.5 }, used: 0, energy: 0 })
  })
  it.each(['normal', 'pseudo', 'legendary', 'mythical'] as const)('returns independent feeding and EXP states for %s', group => {
    const initial = freeze({ level: 24, exp: expTo(24) * groupMult(group) })
    const fed = feedTrainingState(initial, 100, 30, '勤奋', group, true, 4)
    expect(initial.level).toBe(24)
    const legacy = { ...initial }
    const legacyResult = feedTraining(legacy, 100, 30, '勤奋', group, true, 4)
    expect(legacy).toEqual(fed.progress)
    expect(legacyResult).toEqual({ candies: fed.candies, shards: fed.shards, exp: fed.exp })
    const advanced = advanceTrainingState(initial, 10000, 30, group)
    const old = { ...initial }
    advanceTraining(old, 10000, 30, group)
    expect(old).toEqual(advanced)
    expect(feedTrainingState(initial, 0, 30, '勤奋', group).progress).not.toBe(initial)
  })
  it('keeps invalid training errors and unreachable paths explicit', () => {
    const base = golden.train[1]!.input as TrainInput
    expect(trainPlan({ ...base, from: 0 }).error).toBe('等级范围无效')
    const result = trainPlan({ ...base, napping: false, sleepOnTeam: false, ownedCandy: 0, dailyCandy: 0 })
    expect(result.days).toBe(Infinity)
  })
  it('makes Box conversion deterministic with a caller-supplied identity', () => {
    const pokemon = freeze<BoxPokemon>({ uid: 'source', pokeId: 25, level: 24, nature: '勤奋', subskills: [], ingredientSlots: [0, 1, 2], skillLevel: 1, name: '', napping: false })
    const row = createCandyRowFromBox(pokemon, 'integration-id')
    expect(row).toMatchObject({ id: 'integration-id', pokeId: 25, start: 24, target: 25 })
    expect(createCandyRowFromBox(pokemon, 'integration-id')).toEqual(row)
    expect(pokemon.uid).toBe('source')
  })
  it('does not share empty production containers between callers', () => {
    const settings = defaultSettings()
    const input = { pokeId: -1, level: 1, nature: '勤奋', subskills: [], ingredientSlots: [0, 0, 0] as [number, number, number], skillLevel: 1, carry: 0, wakeEnergy: 100 }
    const first = produce(settings, input)
    const second = produce(settings, input)
    first.ingredients.test = 123
    expect(second.ingredients).toEqual({})
    expect(first.curve).not.toBe(second.curve)
  })
})
