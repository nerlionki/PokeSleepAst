import { afterEach, describe, expect, it, vi } from 'vitest'
import * as data from '../../../core/src/calc/data'
import { defaultSettings } from './defaults'
import { calculateCandy } from './candyPlan'
import { applySilverSeed, defaultTune, silverSeedCandidates, stepGoldSeed, undoSilverSeed, type MemberDraft } from './member'
import { napDailyExp, napTotalExp, trainPlan, type TrainInput } from './train'
import { candyExpAtLevel, xpCandy } from './xp'
import { carryLimit, simulateTeam } from './timeline'
import { exEffects } from '../../../core/src/calc/exEffects'
import { boostedResearchReward, teamResearchBonuses } from '../../../core/src/calc/sleepRewards'
import { sleepSimulationSteps, type SleepSimulationRequest } from '../../../core/src/calc/sleepSimulation'

afterEach(() => vi.restoreAllMocks())
const member: MemberDraft = { pokeId: 1, level: 50, nature: '勤奋', subskills: ['invS', 'skillLevelS', 'helpS', 'ingS', 'skillS'], ingredientSlots: [0, 0, 0], skillLevel: 1, tune: defaultTune() }
const training: TrainInput = { from: 1, to: 10, remaining: 0, nature: '勤奋', sleepOnTeam: true, napping: false,
  napDays: 7, earlyRetrieve: false, relaxTicket: false, sleepScore: 100, sleepExpBonus: 0,
  ownedCandy: 0, reserveCandy: 0, dailyCandy: 0, boost: 'none', boostCandy: 0, group: 'normal' }

describe('training nature and candy rules', () => {
  it('uses the published EXP table at each level and rounds each candy before boosting', () => {
    expect([24, 25, 30].map(level => ['勤奋', '胆小', '勇敢'].map(nature => candyExpAtLevel(level, nature)))).toEqual([[40, 47, 33], [35, 41, 29], [25, 30, 21]])
    const row = { id: 'test', pokeId: 1, method: 'manual' as const, start: 1, target: 2, use: 1, useAll: false, nature: 'up' as const, remaining: 95 }
    // 本级仅需54EXP，因此剩余95应报错；剩余48时上升性格增强为94，足够升级。
    expect(calculateCandy(row, 'mini').error).toBeTruthy()
    expect(calculateCandy({ ...row, remaining: 48 }, 'mini')).toMatchObject({ candies: 1, level: 2, shards: 56 })
  })
  it('treats remaining EXP as still needed and charges every candy', () => {
    expect(xpCandy({ from: 1, to: 2, remaining: 30, nature: '勤奋' })).toMatchObject({ exp: 30, candy: 1, shards: 14 })
    expect(xpCandy({ from: 1, to: 2, remaining: 55, nature: '勤奋' }).error).toBeTruthy()
    expect(xpCandy({ from: 1, to: 2, remaining: NaN, nature: '勤奋' }).error).toBeTruthy()
    expect(xpCandy({ from: 1, to: 3, nature: '勇敢' }).candy).toBe(4)
    expect(xpCandy({ from: 1, to: 3, nature: '胆小' }).candy).toBe(3)
  })
  it('applies nature to sleep and candy with separate incense scope', () => {
    expect(trainPlan({ ...training, nature: '胆小', sleepExpBonus: 2, sleepIncense: true, dailyCandy: 2 }).dailyExp).toBeCloseTo(118 * 1.28 * 2 + 94)
    expect(trainPlan({ ...training, nature: '勇敢', sleepIncense: true, ownedCandy: 2 }).feedExp).toBe(66)
    expect(trainPlan({ ...training, nature: '勇敢', sleepIncense: true }).dailyExp).toBe(164)
  })
  it('does not penalize EXP down natures on nap island', () => {
    expect(napDailyExp(false, '胆小')).toBe(177)
    expect(napDailyExp(true, '胆小')).toBe(708)
    expect(napDailyExp(true, '勇敢')).toBe(600)
    expect(napTotalExp(6, false, true, '胆小')).toBe(531)
    expect(trainPlan({ ...training, napping: true, nature: '胆小', sleepExpBonus: 5, sleepIncense: true }).dailyExp).toBe(177)
  })
  it('expires one relaxing ticket after seven days and feeds new candies only after collection', () => {
    expect(napTotalExp(14, true, false)).toBe(5250)
    expect(napTotalExp(6, false, false)).toBe(450)
    const result = trainPlan({ ...training, napping: true, dailyCandy: 100, napDays: 7 })
    expect(result.dailyExp).toBe(150)
    expect(result.days).toBe(7)
    expect(trainPlan({ ...training, napping: true, to: 2, napDays: 1 }).napExp).toBe(75)
  })
  it('switches candy bands during daily feeding and does not claim insufficient stock reaches the target immediately', () => {
    expect(trainPlan({ ...training, from: 24, to: 26, sleepOnTeam: false, dailyCandy: 2 }).days).toBe(17)
    const result = trainPlan({ ...training, ownedCandy: 1 })
    expect(result.paths.find(path => path.name === '不增强只喂糖')?.days).toBe(Infinity)
    expect(trainPlan({ ...training, to: 2, ownedCandy: 2 }).days).toBe(0)
    expect(trainPlan({ ...training, to: 2, ownedCandy: 1, boost: 'mini', boostCandy: 1 })).toMatchObject({ candy: 1, shards: 56, days: 0 })
  })
})

describe('inventory and seeds', () => {
  it('rounds camp inventory upward after all additions and applies Cyan EX only to its main berry', () => {
    expect(carryLimit(21, [], true)).toBe(26)
    expect(carryLimit(21, ['invS', 'invM', 'invL'], true, 'preset', 8, 5)).toBe(84)
    const settings = { ...defaultSettings(), island: 'cyanex' as const }
    expect(exEffects(settings, settings.berries[0]!).carryExtra).toBe(5)
    expect(exEffects(settings, settings.berries[1]!).carryExtra).toBe(0)
    expect(exEffects({ ...settings, exBuff: false }, settings.berries[0]!).carryExtra).toBe(0)
  })
  it('discards ordinary food that cannot fit in the remaining night inventory', () => {
    const poke = data.pokeById(1)!
    vi.spyOn(data, 'pokeById').mockReturnValue({ ...poke, carry: 1, interval: 1e9, ingredientRate: 1, skillRate: 0 })
    const settings = { ...defaultSettings(), meals: false, sleepStart: '00:00', sleepEnd: '23:59' }
    const result = simulateTeam(settings, [{ ...member, level: 1, subskills: [] }], 0).members[0]!
    expect(result.helps).toBe(1)
    expect(Object.values(result.ingredients).reduce((sum, count) => sum + count, 0)).toBe(1)
  })
  it('upgrades only unlocked skills by one rank and blocks duplicates even in locked slots', () => {
    expect(silverSeedCandidates(10, ['invS', 'invM', 'helpS', '', ''])).toEqual([])
    expect(silverSeedCandidates(10, ['invS', '', '', '', ''])).toEqual([{ index: 0, from: 'invS', to: 'invM' }])
    const upgraded = applySilverSeed(member, 0)!
    expect(upgraded.subskills[0]).toBe('invM')
    expect(upgraded.tune.silverSeeds).toBe(1)
    expect(applySilverSeed(upgraded, 0)?.subskills[0]).toBe('invL')
    expect(undoSilverSeed(upgraded)?.subskills).toEqual(member.subskills)
    expect(applySilverSeed({ ...member, level: 1 }, 0)).toBeNull()
  })
  it('prevents spending gold seeds when unlocked subskills already fill the level cap', () => {
    expect(stepGoldSeed({ skillLevel: 5, goldSeeds: 2 }, 1, 7, 2)).toBeNull()
    expect(stepGoldSeed({ skillLevel: 5, goldSeeds: 2 }, -1, 7, 2)).toEqual({ skillLevel: 4, goldSeeds: 1 })
  })
})

describe('research reward subskills and incense', () => {
  it('uses active unlocked team skills and multiplies only the appropriate reward', () => {
    expect(teamResearchBonuses([{ level: 10, subskills: ['researchExp', 'shardBonus'] }, { level: 25, subskills: ['researchExp', 'shardBonus'] }, { level: 25, subskills: ['researchExp', 'shardBonus'], napping: true }])).toEqual({ researchExpBonus: 2, shardBonus: 1 })
    expect(boostedResearchReward({ researchExp: 100, shards: 200, candy: 9 }, { researchExpBonus: 2, shardBonus: 1, focusIncense: true, luckIncense: true })).toEqual({ researchExp: 236, shards: 424, candy: 9 })
  })
  it('applies incense to the selected split session without changing draws or candy', () => {
    const request: SleepSimulationRequest = { island: 'greengrass', sleepType: '淺淺入夢', powers: [1e7, 1e7], iterations: 1, seed: 9, options: { rank: '大师20' } }
    const run = (input: SleepSimulationRequest) => { const steps = sleepSimulationSteps(input); let next = steps.next(); while (!next.done) next = steps.next(); return next.value }
    const plain = run(request)
    const boosted = run({ ...request, options: { ...request.options, focusIncense: true, luckIncense: true, incenseSession: 1 } })
    expect(boosted.map(row => row.candy)).toEqual(plain.map(row => row.candy))
    expect(boosted.map(row => row.count)).toEqual(plain.map(row => row.count))
    // 对两觉分别用同样种子重放，验证第二觉恰好翻倍、第一觉保持原值。
    const first = run({ ...request, powers: [request.powers[0]!] }).length
    expect(boosted.slice(0, first)).toEqual(plain.slice(0, first))
    for (let index = first; index < plain.length; index++) {
      expect(boosted[index]!.researchExp).toBe(plain[index]!.researchExp * 2)
      expect(boosted[index]!.shards).toBe(plain[index]!.shards * 2)
    }
  })
})
