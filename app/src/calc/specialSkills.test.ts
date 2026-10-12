import { describe, expect, it } from 'vitest'
import { applyMainSkill, DISGUISE_CRIT_CHANCE, type EffectActor, type EffectContext } from '../../../core/src/calc/skillEffects'
import { MAIN_SKILLS } from './mainSkills'
import { defaultSettings } from './defaults'
import { produce } from './produce'
import { simulateTeam } from './timeline'

function actor(id: number, skill: number, berry = '莓莓果', unitBerry = 100): EffectActor {
  return {
    poke: { id, mainSkill: MAIN_SKILLS.find(s => s.id === skill)!.name, berry },
    input: { pokeId: id, level: 30, nature: '勤奋', subskills: [], ingredientSlots: [0, 0, 0], skillLevel: 1, carryMode: 'unlimited' },
    energy: 100, factor: 1, skillLv: 1, skillRate: .04, unitBerry,
    result: { helps: 0, berries: 0, berryEnergy: 0, ingredients: {}, skillProcs: 0, skillEnergy: 0, sneaky: 0, curve: [] },
  }
}
const context: EffectContext = {
  ingredient: () => {}, help: () => {}, pot: () => {}, crit: () => {}, skillOnly: () => {},
  charge: (a, n) => { a.result.skillEnergy += n },
}

describe('special skill effects', () => {
  it('credits each member berry at its own value, with all amounts tripled on great success', () => {
    const a = actor(778, 16)
    const b = actor(25, 1, '金枕果', 200)
    expect(applyMainSkill(a, [a, b], context)).toBe(true)
    expect(a.result.berries).toBeCloseTo(8 * 1.37)
    expect(b.result.berries).toBeCloseTo(1.37)
    expect(a.result.berryEnergy + b.result.berryEnergy).toBeCloseTo(1370)
  })

  it('allows at most one expected great success before research, including repeated or weighted skills', () => {
    const a = actor(778, 16)
    for (let i = 0; i < 100; i++) applyMainSkill(a, [a], context)
    expect(a.result.berries).toBeCloseTo(800 + 16 * (1 - (1 - DISGUISE_CRIT_CHANCE) ** 100))
    const b = actor(778, 16)
    applyMainSkill(b, [b], context, 100)
    expect(b.result.berries).toBeCloseTo(a.result.berries)
    b.disguiseReady = 1
    const before = b.result.berries
    applyMainSkill(b, [b], context)
    expect(b.result.berries - before).toBeCloseTo(10.96)
  })

  it('does not multiply berry amounts by berry S or normal help berry counts', () => {
    const a = actor(778, 16)
    a.input.subskills = ['berryS']
    a.disguiseReady = 0
    a.skillLv = 6
    const b = actor(25, 1)
    applyMainSkill(a, [a, b], context)
    expect(a.result.berries).toBe(21)
    expect(b.result.berries).toBe(5)
  })

  it('charges strength and removes exactly 12 from non-dark members independent of nature', () => {
    const a = actor(491, 22, '异奇果')
    const dark = actor(197, 7, '异奇果')
    const b = actor(25, 1)
    b.factor = 1.2
    const low = actor(1, 10)
    low.factor = .88
    low.energy = 5
    expect(applyMainSkill(a, [a, dark, b, low], context)).toBe(true)
    expect(a.result.skillEnergy).toBe(2640)
    expect([a.energy, dark.energy, b.energy, low.energy]).toEqual([100, 100, 88, 0])
    a.skillLv = 7
    applyMainSkill(a, [a, dark, b], context, .5)
    expect(b.energy).toBe(82)
    expect(a.result.skillEnergy).toBe(2640 + 18515 / 2)
  })

  it('includes disguise berries in individual production', () => {
    const a = actor(778, 16)
    const settings = { ...defaultSettings(), meals: false }
    const enabled = produce(settings, a.input)
    const full = produce(settings, { ...a.input, carryMode: 'full' })
    expect(enabled.skillProcs).toBeGreaterThan(0)
    expect(enabled.berries).toBeGreaterThan(full.berries)
  })

  it('resets great-success availability on waking before consuming stored skills', () => {
    const input = { ...actor(778, 16).input, ingredientSlots: [null, null, null] as [null, null, null] }
    const settings = { ...defaultSettings(), meals: false, sleepStart: '08:00', sleepEnd: '09:00' }
    const sim = simulateTeam(settings, [input], 0, { alwaysProc: true, fixedEnergy: 100 })
    const before = sim.events.filter(e => e.minute < 540).length
    const after = sim.events.filter(e => e.minute >= 540).length
    expect(before).toBeGreaterThan(0)
    expect(after).toBeGreaterThan(0)
    const extra = 16 * (2 - (1 - DISGUISE_CRIT_CHANCE) ** before - (1 - DISGUISE_CRIT_CHANCE) ** after)
    // 食材槽空时，每次普通帮忙 1 果；技能 Lv1 基础 8 果，大成功额外 16 果。
    expect(sim.members[0]!.berries).toBeCloseTo(sim.members[0]!.helps + sim.members[0]!.skillProcs * 8 + extra)
  })

  it('reduces teammate energy and subsequent production in the team timeline', () => {
    const a = actor(491, 22, '异奇果')
    const b = actor(25, 1)
    const settings = { ...defaultSettings(), meals: false, sleepStart: '00:00', sleepEnd: '00:00' }
    const harmful = simulateTeam(settings, [a.input, b.input], 0, { alwaysProc: true })
    const disabled = simulateTeam(settings, [{ ...a.input, carryMode: 'full' }, b.input], 0, { alwaysProc: true })
    expect(harmful.members[1]!.curve.find(p => p.minute === 10)!.energy).toBeLessThan(disabled.members[1]!.curve.find(p => p.minute === 10)!.energy)
    expect(harmful.members[1]!.helps).toBeLessThan(disabled.members[1]!.helps)
  })
})
