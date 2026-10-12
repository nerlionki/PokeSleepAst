import { describe, expect, it } from 'vitest'
import { defaultSettings } from './defaults'
import { pokeById, berryByName } from '../../../core/src/calc/data'
import { defaultScoreOptions, normalizeScoreOptions, extremeSleep, scoreBounds, scoreCandidates, scoreSleeps, type ScorePolicy, type ScoreRequest } from '../../../core/src/calc/scorePlan'
import { simulateScore } from '../../../core/src/calc/scoreSimulation'
import { scoreSearchSteps } from '../../../core/src/calc/scoreSearch'
import { scoreSkill, type ScoreActor, type ScoreSkillContext } from '../../../core/src/calc/scoreSkills'
import { MAIN_SKILLS } from './mainSkills'
import type { BoxPokemon } from '../../../core/src/types'

const member = (uid: string, pokeId = 25): BoxPokemon => ({ uid, pokeId, level: 30, nature: '勤奋', subskills: [], ingredientSlots: [0, 0, 0], skillLevel: 1, name: '', napping: false })
function fixture(days = 1): { request: ScoreRequest, policy: ScorePolicy } {
  const settings = defaultSettings(), options = { ...defaultScoreOptions(settings), days }
  return { request: { settings, box: [member('a')], options }, policy: { day: [['a']], sleep: [['a'], ['a']], settle: [['a'], ['a']], recipe: '', reserveMeals: 0, rotateMinutes: 60, fill: true, juiceAt: 80 } }
}
function actor(id: number, skill: number): ScoreActor {
  const poke = pokeById(id)!
  return { uid: String(id), pokeId: id, berry: poke.berry, skill: MAIN_SKILLS.find(s => s.id === skill)!.name, skillLevel: 1, rate: 1, energy: 100, factor: 1, disguise: true, stockpile: 0, firstFood: '' }
}
const context = (random = () => 0): ScoreSkillContext => ({ random, heal: (a, n) => { a.energy += n }, charge: () => {}, berries: () => {}, ingredient: () => {}, helps: () => {}, pot: () => {}, crit: () => {}, zone: () => {}, juice: () => {}, warning: () => {} })

describe('score planning chronology', () => {
  it('discards legacy energy overrides and always starts each member at 100 energy', () => {
    const { request, policy } = fixture()
    const baseline = simulateScore(request, policy, 42)
    const legacy = { ...request.options, initialEnergy: { a: 0 }, seed: 123 }
    const restored = normalizeScoreOptions(legacy, request.settings)
    expect(restored).not.toHaveProperty('initialEnergy')
    expect(restored.seed).toBe(defaultScoreOptions().seed)
    expect(legacy.initialEnergy).toEqual({ a: 0 })
    request.options = { ...legacy, seed: request.options.seed }
    expect(simulateScore(request, policy, 42)).toEqual(baseline)
  })
  it('uses a complete week ending exclusively at next Monday 04:00', () => {
    const o = defaultScoreOptions()
    expect(scoreBounds(o)).toEqual({ start: 240, end: 10320 })
    const { request, policy } = fixture(7)
    const trace = simulateScore(request, policy, 1)
    expect(trace.members[0]!.hours).toBeCloseTo(168)
    expect(trace.actions.filter(a => a.kind !== 'settle').every(a => a.minute < 10320)).toBe(true)
    expect(trace.members[0]!.heldBerries + Object.values(trace.members[0]!.heldFood).reduce((a, b) => a + b, 0)).toBeGreaterThan(0)
    expect(trace.actions.some(a => a.kind === 'collect' && a.minute === 10320)).toBe(false)
  })
  it('keeps all ingredient entries integer and conserves bag after production, sales, and meals', () => {
    const { request, policy } = fixture(7)
    request.box = [member('a', 1)]
    request.options.bag = { '特选苹果': 800 }
    const trace = simulateScore(request, policy, 9)
    for (const name of new Set([...Object.keys(request.options.bag), ...Object.keys(trace.received)])) {
      expect(trace.bag[name] ?? 0).toBe((request.options.bag[name] ?? 0) + (trace.received[name] ?? 0) - (trace.consumed[name] ?? 0) - (trace.sold[name] ?? 0))
    }
    expect(Object.values(trace.bag).every(Number.isInteger)).toBe(true)
    expect(Object.values(trace.bag).reduce((a, b) => a + b, 0)).toBeLessThanOrEqual(800)
    expect(request.options.bag['特选苹果']).toBe(800)
  })
  it('initial Snorlax strength does not alter simulated production and seeds reproduce exact traces', () => {
    const { request, policy } = fixture()
    const trace = simulateScore(request, policy, 42)
    request.options.initialStrength = 123456
    expect(simulateScore(request, policy, 42)).toEqual(trace)
  })
  it('settlement-only members gain experience without production hours', () => {
    const { request, policy } = fixture()
    request.box.push(member('b', 133)); request.options.device = true
    policy.settle = [['b'], ['b']]
    const trace = simulateScore(request, policy, 42)
    const b = trace.members.find(m => m.uid === 'b')!
    expect(b.hours).toBe(0); expect(b.exp).toBeGreaterThan(0)
    expect(trace.segments.every(s => !s.members.includes('b'))).toBe(true)
  })
  it('only allows sleep collection with a device and correct day/night defaults', () => {
    const o = defaultScoreOptions(), s = o.sleeps[0]
    s.start = '13:00'; s.end = '14:00'
    expect(extremeSleep(o, s)).toBe(false)
    o.device = true; expect(extremeSleep(o, s)).toBe(true)
    s.start = '22:00'; expect(extremeSleep(o, s)).toBe(false)
    s.extreme = 'on'; expect(extremeSleep(o, s)).toBe(true)
  })
  it('caps split sleep scores by game day rather than restoring 100 twice', () => {
    const { request, policy } = fixture()
    request.options.splitSleep = true
    request.options.sleeps[0].start = '00:00'; request.options.sleeps[0].end = '07:00'
    request.options.sleeps[1].start = '13:00'; request.options.sleeps[1].end = '15:00'
    const sessions = scoreSleeps(request.options, request.settings)
    expect(sessions.every(s => s.score <= 100)).toBe(true)
    const trace = simulateScore(request, policy, 1)
    expect(trace.members[0]!.exp).toBeLessThanOrEqual(200)
  })
  it('rejects unconfirmed OCR and napping members instead of using defaults', () => {
    const p = member('a'); p.ocrMissing = ['skillLevel']
    const q = member('b'); q.napping = true
    expect(scoreCandidates([p, q]).candidates).toHaveLength(0)
  })
  it('resumes a completed evaluation checkpoint without double-counting or changing result', () => {
    const { request } = fixture()
    const steps = scoreSearchSteps(request)
    const first = steps.next()
    expect(first.done).toBe(false)
    if (first.done) throw new Error('missing checkpoint')
    const resumed = scoreSearchSteps({ ...request, checkpoint: first.value })
    let a = steps.next(), b = resumed.next()
    while (!a.done) a = steps.next()
    while (!b.done) b = resumed.next()
    expect(b.value.solutions.map(s => s.mean)).toEqual(a.value.solutions.map(s => s.mean))
    expect(b.value.simulations).toBe(a.value.simulations)
  }, 60000)
})
describe('score special skills use real state', () => {
  it('amped Toxtricity + Minun activates both extra effects by their actual skills', () => {
    const a = actor(849, 27), b = actor(312, 25)
    a.skill = pokeById(849)!.mainSkill
    b.skill = pokeById(312)!.mainSkill
    a.firstFood = '特选苹果'; a.energy = 50
    const drops: number[] = []
    const ctx = { ...context(), ingredient: (name: string, n: number) => { if (name === '特选苹果') drops.push(n) } }
    scoreSkill(a, [a, b], ctx)
    expect(drops).toContain(6)
    scoreSkill(b, [a, b], ctx)
    expect(a.energy).toBe(58)
  })
  it('Plusle + low-key Toxtricity activates both extra effects by their actual skills', () => {
    const a = actor(311, 26), b = actor(8001, 25)
    a.firstFood = '特选苹果'; a.energy = 50
    b.skill = pokeById(8001)!.mainSkill
    const drops: number[] = []
    const ctx = { ...context(), ingredient: (name: string, n: number) => { if (name === '特选苹果') drops.push(n) } }
    scoreSkill(a, [a, b], ctx)
    expect(drops).toContain(6)
    scoreSkill(b, [a, b], ctx)
    expect(a.energy).toBe(58)
    a.energy = 50; scoreSkill(b, [b, a], ctx)
    expect(b.energy).toBe(108)
  })
  it('positive + positive also activates the extra first ingredient', () => {
    const a = actor(311, 26), b = actor(311, 26)
    b.uid = 'second'; a.firstFood = '特选苹果'
    const drops: number[] = []
    scoreSkill(a, [a, b], { ...context(), ingredient: (name, n) => { if (name === '特选苹果') drops.push(n) } })
    expect(drops).toContain(6)
    drops.length = 0
    scoreSkill(a, [a], { ...context(), ingredient: (name, n) => { if (name === '特选苹果') drops.push(n) } })
    expect(drops).not.toContain(6)
  })
  it('negative + negative also activates the random-member recovery', () => {
    const a = actor(312, 25), b = actor(312, 25)
    b.uid = 'second'; a.energy = 50
    scoreSkill(a, [a, b], context())
    expect(a.energy).toBe(58)
    a.energy = 50; scoreSkill(a, [a], context()); expect(a.energy).toBe(50)
  })
  it('Darkrai drains only non-dark active members, with floor zero', () => {
    const dark = actor(491, 22), other = actor(25, 1)
    other.energy = 5
    expect(berryByName(dark.berry)?.type).toBe('恶')
    scoreSkill(dark, [dark, other], context())
    expect(dark.energy).toBe(100); expect(other.energy).toBe(0)
  })
  it('Mimikyu can only have one great success before explicit research reset', () => {
    const a = actor(778, 16), counts: number[] = []
    const ctx = { ...context(), berries: (_target: ScoreActor, n: number) => counts.push(n) }
    scoreSkill(a, [a], ctx); scoreSkill(a, [a], ctx)
    expect(counts).toEqual([24, 8]); expect(a.disguise).toBe(false)
    a.disguise = true; scoreSkill(a, [a], ctx); expect(counts[2]).toBe(24)
  })
  it('Shuckle heals immediately but generates an integer juice item, not expected fractions', () => {
    const a = actor(213, 32); let count = 0
    scoreSkill(a, [a], { ...context(), juice: () => { count++ } })
    expect(a.energy).toBe(105); expect(count).toBe(1)
  })
})
