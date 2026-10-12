import { afterEach, describe, expect, it, vi } from 'vitest'
import * as data from '../../../core/src/calc/data'
import { berryEnergyAt, berryUnitEnergy } from './berry'
import { defaultSettings } from './defaults'
import { energyCurve, mealRecover, sleepRecoveredEnergy } from './energy'
import { energyMultiplier } from './helpSpeed'
import { splitHelps } from './produce'
import { simulateTeam } from './timeline'
import { trainPlan } from './train'
import { xpCandy } from './xp'

const input = { pokeId: 25, level: 30, nature: '勤奋', subskills: [] as string[], ingredientSlots: [0, 0, 0] as [number, number, number], skillLevel: 1 }
afterEach(() => vi.restoreAllMocks())

describe('confirmed game mechanics, October 2026', () => {
  it('uses the published low-level berry value and rounds each berry before favorite bonuses', () => {
    const berry = data.BERRIES.find(row => row.energyLv1 === 24)!
    expect(berryEnergyAt(berry.name, 10)).toBe(33)
    expect(berryUnitEnergy(berry.name, 10, 0.05, 2)).toBe(70)
  })

  it('keeps positive low energy productive, with exact 40/60/80 boundaries', () => {
    expect([0, 0.5, 1, 20, 40, 60, 80, 81].map(energyMultiplier)).toEqual([1, 0.66, 0.66, 0.66, 0.66, 0.58, 0.52, 0.45])
    expect([10, 20, 30, 40, 50, 60, 70, 80, 100, 149, 150].map(mealRecover)).toEqual([9, 8, 7, 6, 5, 4, 3, 2, 1, 1, 0])
    expect(mealRecover(10.5)).toBe(9)
  })

  it('applies recovery bonuses to the whole sleeping team and caps only the holder at 105', () => {
    expect(sleepRecoveredEnergy(0, 80, { ...input, nature: '怕寂寞' }, false, 1)).toBeCloseTo(80.256)
    expect(sleepRecoveredEnergy(0, 50, input, true, 1)).toBe(100)
    expect(sleepRecoveredEnergy(0, 100, { ...input, subskills: ['energyRecover'] }, false, 1)).toBe(105)
    expect(sleepRecoveredEnergy(140, 100, input, false, 1)).toBe(140)
    expect(sleepRecoveredEnergy(0, 80, { ...input, level: 1, subskills: ['energyRecover'] }, false)).toBe(80)
  })

  it('loses energy while sleeping and restores it at the first waking tick', () => {
    const settings = { ...defaultSettings(), meals: false, sleepStart: '23:00', sleepEnd: '07:05', sleepScore: 80 }
    const curve = energyCurve(settings, input)
    expect(curve.find(point => point.minute === 60)!.energy).toBe(74)
    expect(curve.find(point => point.minute === 420)!.energy).toBe(38)
    expect(curve.find(point => point.minute === 430)!.energy).toBe(100)
    const sim = simulateTeam(settings, [{ ...input, wakeEnergy: 80 }], 0)
    expect(sim.members[0]!.curve.find(point => point.minute === 60)!.energy).toBe(74)
    expect(sim.members[0]!.curve.find(point => point.minute === 430)!.energy).toBe(100)
  })

  it('does not fabricate one skill or ingredient help when expected gains are smaller', () => {
    const result = splitHelps(1, 0.2, 0.1, [{ name: 'test', amount: 1 }], false)
    expect(result.skillProcs).toBe(0.1)
    expect(result.ingredients.test).toBe(0.2)
    const poke = data.POKEDEX.find(row => row.id === 25)!
    vi.spyOn(data, 'pokeById').mockReturnValue({ ...poke, interval: 144000, skillRate: 0.000001 })
    const sim = simulateTeam({ ...defaultSettings(), meals: false, sleepStart: '00:00', sleepEnd: '00:00' }, [input], 0)
    expect(sim.members[0]!.skillProcs).toBe(0)
  })

  it('refuses to calculate a free upgrade when future experience data is absent', () => {
    const missing = xpCandy({ from: 70, to: 80, nature: '勤奋' })
    expect(missing.error).toBeTruthy()
    expect(Number.isNaN(missing.exp)).toBe(true)
    expect(Number.isNaN(missing.candy)).toBe(true)
    const plan = trainPlan({ from: 70, to: 80, remaining: 0, nature: '勤奋', sleepOnTeam: true, napping: false, napDays: 7, earlyRetrieve: false, relaxTicket: false, sleepScore: 100, sleepExpBonus: 0, ownedCandy: 0, reserveCandy: 0, dailyCandy: 0, boost: 'none', boostCandy: 0, group: 'normal' })
    expect(plan.error).toBeTruthy()
    expect(Number.isNaN(plan.days)).toBe(true)
    expect(plan.paths).toEqual([])
  })
})
