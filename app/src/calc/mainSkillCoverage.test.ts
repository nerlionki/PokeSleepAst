import { describe, expect, it } from 'vitest'
import { MAIN_SKILLS, skillByPokedexName } from './mainSkills'
import { applyMainSkill, SPIT_UP_CHANCE, type EffectActor, type EffectContext } from '../../../core/src/calc/skillEffects'
import { resolveMemberSkill } from '../../../core/src/calc/mew'
import { pokeById } from './data'
import { defaultSettings } from './defaults'
import { produce } from './produce'
import { simulateTeam } from './timeline'
import { calculateBoxOverview } from '../../../core/src/calc/boxOverview'

function actor(skill: number, pokeId = 25, berry = '金枕果'): EffectActor {
  return { poke: { id: pokeId, berry, mainSkill: MAIN_SKILLS.find(s => s.id === skill)!.name }, input: { pokeId, level: 60, nature: '勤奋', subskills: [], ingredientSlots: [0,0,0], skillLevel: 6, carryMode: 'unlimited' }, energy: 0, factor: 1, skillLv: 6, skillRate: .04, unitBerry: 100, result: { helps: 0, berries: 0, berryEnergy: 0, ingredients: {}, skillProcs: 0, skillEnergy: 0, sneaky: 0, curve: [] } }
}
function context(): EffectContext {
  return { ingredient: (a, name, count) => { a.result.ingredients[name] = (a.result.ingredients[name] ?? 0) + count }, help: (a, n) => { a.result.helps += n }, pot: () => {}, crit: () => {}, skillOnly: () => {}, charge: (a, n) => { a.result.skillEnergy += n } }
}

describe('main skill coverage', () => {
  it.each(MAIN_SKILLS.filter(s => s.id !== 34).map(s => [s.id, s.name] as const))('settles skill %s %s without falling back', (id) => {
    const a = actor(id)
    expect(applyMainSkill(a, [a], context())).toBe(true)
  })

  it.each([[27,36],[28,36],[557,28],[558,28],[701,38],[742,33],[743,33],[849,27]])('resolves species %s to variant %s', (id, expected) => {
    const poke = pokeById(id)!
    expect(skillByPokedexName(resolveMemberSkill(poke, {}).name)?.id).toBe(expected)
  })

  it.each([[28, ['窝心洋芋','纯粹油','嫩亮酪梨']], [33, ['甜甜蜜','纯粹油','萌绿玉米']], [36, ['窝心洋芋','萌绿玉米','沉甸甸南瓜']], [38, ['火辣香草','豆制肉','暖暖姜']]] as const)('restricts ingredient-select %s to its three-item pool', (id, names) => {
    const a = actor(id)
    applyMainSkill(a, [a], context())
    expect(Object.keys(a.result.ingredients).sort()).toEqual([...names].sort())
    expect(Object.values(a.result.ingredients).reduce((a,b) => a+b, 0)).toBeCloseTo(16)
  })

  it('requires another Plus/Minus member, and copies the strong quantity using the copier ingredient', () => {
    const plus = actor(26,311)
    applyMainSkill(plus,[plus],context())
    expect(plus.result.ingredients['醒脑咖啡豆']).toBeCloseTo(16 / 19)
    const minus = actor(25,312)
    applyMainSkill(minus,[minus],context())
    expect(minus.energy).toBe(0)
    applyMainSkill(minus,[minus,plus],context())
    expect(minus.energy + plus.energy).toBe(30)
    const copier = actor(18,132)
    const strong = actor(27,849)
    applyMainSkill(copier,[copier,strong],context())
    expect(copier.result.ingredients['纯粹油']).toBeCloseTo(16 / 19 + 13)
    expect(copier.result.ingredients['哞哞鲜奶']).toBeCloseTo(16 / 19)
  })

  it('heals two targets and grants their help, with unlocked Latios bonus', () => {
    const a = actor(35,380,'番荔果')
    const b = actor(37,381,'番荔果')
    applyMainSkill(a,[a,b],context())
    expect([a.energy,b.energy]).toEqual([22,22])
    expect([a.result.helps,b.result.helps]).toEqual([7,7])
  })

  it('keeps total two-target recovery and treats equal-energy targets equally in a full team', () => {
    const team = [actor(35,380),actor(1,25),actor(1,1),actor(1,4),actor(1,7)]
    applyMainSkill(team[0]!,team,context())
    team.forEach(a => expect(a.energy).toBeCloseTo(8.8))
    expect(team.reduce((sum,a) => sum + a.energy,0)).toBeCloseTo(44)
  })

  it('counts distinct dragon species and gives the Latias combination berries to the caster', () => {
    const a = actor(37,381,'番荔果')
    const b = actor(35,380,'番荔果')
    const c = actor(7,334,'番荔果')
    const duplicate = actor(7,334,'番荔果')
    applyMainSkill(a,[a,b,c,duplicate],context())
    expect(a.result.berries).toBe(65)
    expect([b.result.berries,c.result.berries,duplicate.result.berries]).toEqual([4,4,4])
  })

  it('retains stockpile probabilities across triggers and forces a spit at ten stacks', () => {
    const a = actor(15,425)
    a.skillLv = 1
    applyMainSkill(a,[a],context())
    expect(a.result.skillEnergy).toBe(600 * SPIT_UP_CHANCE)
    expect(a.stockpile![1]).toBeCloseTo(1 - SPIT_UP_CHANCE)
    applyMainSkill(a,[a],context())
    expect(a.result.skillEnergy).toBeCloseTo(600 * SPIT_UP_CHANCE + SPIT_UP_CHANCE * (SPIT_UP_CHANCE * 600 + (1-SPIT_UP_CHANCE) * 1020))
    a.stockpile = [0,0,0,0,0,0,0,0,0,0,1]
    const before = a.result.skillEnergy
    applyMainSkill(a,[a],context())
    expect(a.result.skillEnergy - before).toBe(12120)
    expect(a.stockpile).toEqual([1,0,0,0,0,0,0,0,0,0,0])
  })

  it('handles fractional stockpile selection without unconditionally advancing the state', () => {
    const a = actor(15,425)
    a.skillLv = 1
    applyMainSkill(a,[a],context(),.5)
    expect(a.result.skillEnergy).toBeCloseTo(600 * SPIT_UP_CHANCE / 2)
    expect(a.stockpile!.reduce((a,b) => a+b,0)).toBeCloseTo(1)
    expect(a.stockpile![1]).toBeCloseTo((1-SPIT_UP_CHANCE)/2)
  })

  it('applies Psystrike area strength and a persistent, capped psychic berry zone', () => {
    const mewtwo = actor(40,150).input
    const psychic = { ...actor(2,196).input, carryMode: 'full' as const }
    const settings = { ...defaultSettings(), areaBonus: .5, meals: false, sleepStart: '00:00', sleepEnd: '00:00' }
    const sim = simulateTeam(settings,[mewtwo,psychic],0,{alwaysProc:true,fixedEnergy:100})
    expect(sim.members[0]!.skillEnergy).toBeCloseTo(sim.members[0]!.skillProcs * 7274 * 1.5)
    const base = simulateTeam(settings,[{...mewtwo,carryMode:'full'},psychic],0,{alwaysProc:true,fixedEnergy:100})
    expect(sim.members[1]!.berryEnergy).toBeGreaterThan(base.members[1]!.berryEnergy)
    expect(sim.members[1]!.berryEnergy).toBeLessThanOrEqual(base.members[1]!.berryEnergy * 1.24 + 1e-6)
  })

  it('includes skill ingredients and berries in individual output and Box rankings', () => {
    const input = actor(36,27).input
    const result = produce({...defaultSettings(),meals:false},input)
    expect(result.skillIngredients!['窝心洋芋']).toBeGreaterThan(0)
    expect(result.ingredients['窝心洋芋']).toBeGreaterThanOrEqual(result.skillIngredients!['窝心洋芋']!)
    const box = {...input,uid:'select',name:'',napping:false}
    expect(calculateBoxOverview([box]).ingredients.find(i => i.name === '窝心洋芋')!.rows[0]!.amount).toBeGreaterThan(0)
    const berryInput = actor(20,252).input
    const berryOutput = produce({...defaultSettings(),berries:[],meals:false},berryInput)
    const berryBox = {...berryInput,uid:'burst',name:'',napping:false}
    expect(calculateBoxOverview([berryBox]).berries.find(b => b.name === pokeById(252)!.berry)!.rows[0]!.amount).toBe(berryOutput.berryEnergy)
  })
})
