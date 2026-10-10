import { describe, expect, it } from 'vitest'
import { DEFAULT_WHISTLE, normalizeWhistleOptions, planWhistle, whistleMember } from '../../../core/src/calc/whistle'
import { defaultSettings } from './defaults'
import { NATURES, pokeById, POKEDEX } from './data'
import { unlockedSubskills } from '../../../core/src/calc/member'
import type { BoxPokemon } from '../../../core/src/types'

function member(uid: string, pokeId = 25, subs: string[] = [], level = 60): BoxPokemon {
  return { uid, pokeId, level, nature: NATURES[20]!.name, subskills: subs,
    ingredientSlots: [0, 0, 0], skillLevel: 1, name: '', napping: false }
}
const options = { currentEnergy: 1000, targetEnergy: 100000 }

describe('whistle planning', () => {
  it('finds the same optimum as exhaustive search including team Helping Bonus', () => {
    const settings = { ...defaultSettings(), areaBonus: 0.35, helpingBonus: 1 }
    const box = [member('a', 25, ['berryS', 'helpM']), member('b', 26, ['helpingBonus']),
      member('c', 6, ['helpingBonus', 'helpM']), member('d', 9, ['berryS']),
      member('e', 154, ['helpingBonus', 'berryS']), member('f', 157, ['berryS', 'helpM']),
      member('g', 160, ['berryS', 'helpS']), member('h', 1)]
    let exhaustive = -1
    for (let mask = 0; mask < 1 << box.length; mask++) {
      const team = box.filter((_, index) => mask & 1 << index)
      if (team.length !== 5) continue
      const bonus = Math.min(5, team.filter(p => unlockedSubskills(p.level, p.subskills).includes('helpingBonus')).length + 1)
      exhaustive = Math.max(exhaustive, team.reduce((sum, p) => sum + whistleMember(settings, p, bonus).berryEnergy, 0))
    }
    const actual = planWhistle(settings, box, options)
    expect(actual.excluded).toEqual([])
    expect(actual.berryEnergy).toBe(exhaustive)
    expect(actual.members).toHaveLength(5)
    expect(new Set(actual.members.map(m => m.pokemon.uid)).size).toBe(5)
  })

  it('uses fixed, rounded berry and ingredient yields; repeated ingredient slots round separately', () => {
    const settings = defaultSettings()
    const p = member('a', 26)
    const result = whistleMember(settings, p, 0)
    const poke = pokeById(26)!
    expect(result.helps).toBeCloseTo(10800 / result.interval / 0.45)
    expect(result.berries).toBe(Math.round(result.helps * (1 - result.ingredientRate) * 2))
    expect(Object.values(result.ingredients)[0]).toBe([1, 2, 4].reduce((sum, quantity) => sum + Math.round(result.helps * result.ingredientRate / 3 * quantity), 0))
    expect(poke.ingredients[0]!.amounts).toEqual([1, 2, 4])
    expect(planWhistle(settings, [p], options)).toEqual(planWhistle(settings, [p], options))
  })

  it('reproduces the published Raichu Lv.64 AAB measurement', () => {
    const p = { ...member('measured', 26, ['helpM', 'invS', 'berryS'], 64), ingredientSlots: [0, 0, 1] as [number, number, number] }
    const actual = whistleMember(defaultSettings(), p, 0)
    expect(actual.interval).toBe(27 * 60 + 33)
    expect(actual.berries).toBe(34)
    expect(actual.ingredients).toEqual({ 特选苹果: 3, 暖暖姜: 3 })
  })

  it('ignores camp, actual energy, skills, inventory and event production bonuses', () => {
    const p = member('a', 26)
    const settings = defaultSettings()
    const base = whistleMember(settings, p, 0)
    expect(whistleMember({ ...settings, goodCamp: true, sleepScore: 0, eventMult: 3, whistleHelps: 20, period: 'week' },
      { ...p, skillLevel: 7, tune: { evolutions: 0, goldSeeds: 0, silverSeeds: 0, sleepHours: 0, carryMode: 'full', exp: 0, ribbonHours: 0 } }, 0)).toEqual({ ...base, pokemon: expect.any(Object) })
    const ex = { ...settings, island: 'greenex' as const, berries: [base.berry], exWeeklyBonus: 'ingredients' as const }
    const exBase = whistleMember(ex, p, 0)
    expect(exBase.interval).toBe(base.interval)
    expect(exBase.ingredients).toEqual(base.ingredients)
    expect(whistleMember({ ...ex, exWeeklyBonus: 'berries' }, p, 0).berryEnergy).toBeCloseTo(exBase.berryEnergy * 1.2)
  })

  it('accounts for ribbon speed and unlocked subskills only', () => {
    const settings = defaultSettings()
    const p = member('a', 1, ['helpingBonus', 'helpM', 'berryS'], 9)
    expect(whistleMember(settings, p, 0).helpingBonus).toBe(false)
    expect(whistleMember(settings, { ...p, level: 10 }, 1).helpingBonus).toBe(true)
    const plain = whistleMember(settings, p, 0)
    const ribbon = whistleMember(settings, { ...p, tune: { evolutions: 0, goldSeeds: 0, silverSeeds: 0, sleepHours: 0, carryMode: 'preset', exp: 0, ribbonHours: 2000 } }, 0)
    expect(ribbon.interval).toBeLessThan(plain.interval)
  })

  it('uses the linear berry-energy floor at low levels and rounds area before favorites', () => {
    const settings = { ...defaultSettings(), berries: ['萄葡果'], areaBonus: 0.05 }
    const actual = whistleMember(settings, member('a', 25, [], 10), 0)
    expect(actual.berryUnitEnergy).toBe(Math.ceil(34 * 1.05) * 2)
  })

  it('returns the minimum integer whistle count without cooking ingredients', () => {
    const settings = defaultSettings()
    const box = [member('a')]
    const energy = planWhistle(settings, box, options).berryEnergy
    const actual = planWhistle(settings, box, { currentEnergy: 1000, targetEnergy: 1000 + energy * 3 + 1 })
    expect(actual.whistles).toBe(4)
    expect(actual.finalEnergy).toBe(1000 + energy * 4)
    for (const [name, amount] of Object.entries(actual.ingredients)) expect(actual.totalIngredients[name]).toBe(amount * 4)
    expect(planWhistle(settings, box, { currentEnergy: 1000, targetEnergy: 1000 }).whistles).toBe(0)
  })

  it('does not add a whistle from floating-point error at an exact EX target', () => {
    const p = member('ex', 26)
    const settings = { ...defaultSettings(), island: 'greenex' as const, berries: [pokeById(26)!.berry], exWeeklyBonus: 'berries' as const, areaBonus: 0.35 }
    const energy = planWhistle(settings, [p], options).berryEnergy
    const actual = planWhistle(settings, [p], { currentEnergy: 0, targetEnergy: Math.round(energy * 5) })
    expect(actual.whistles).toBe(5)
    expect(actual.finalEnergy).toBe(Math.round(energy * 5))
  })

  it('handles empty and small boxes and excludes invalid or duplicate individuals', () => {
    const settings = defaultSettings()
    expect(planWhistle(settings, [], options).whistles).toBeNull()
    expect(planWhistle(settings, [], DEFAULT_WHISTLE).whistles).toBe(0)
    const box = [member('a'), member('a'), member('b', 999999), { ...member('c'), ocrMissing: ['nature' as const] }]
    const actual = planWhistle(settings, box, options)
    expect(actual.members).toHaveLength(1)
    expect(actual.excluded).toHaveLength(3)
    expect(planWhistle(settings, [{ ...member('d'), ocrMissing: ['skillLevel'] }], options).members).toHaveLength(1)
    const all = POKEDEX.find(p => p.specialty === '全部')!
    expect(planWhistle(settings, [{ ...member('e', all.id), ingredientSlots: [null, null, null] }], options).members).toHaveLength(1)
  })

  it('rejects invalid target inputs and restores old or malformed saved settings safely', () => {
    for (const value of [-1, NaN, Infinity, 1.5]) expect(() => planWhistle(defaultSettings(), [], { ...options, targetEnergy: value })).toThrow()
    expect(normalizeWhistleOptions()).toEqual(DEFAULT_WHISTLE)
    expect(normalizeWhistleOptions({ currentEnergy: -1, targetEnergy: NaN })).toEqual(DEFAULT_WHISTLE)
    expect(normalizeWhistleOptions(options)).toEqual(options)
  })
})
