import { describe, expect, it } from 'vitest'
import { applyMainSkill, type EffectActor, type EffectContext } from '../../../core/src/calc/skillEffects'
import { MAIN_SKILLS } from './mainSkills'
import { chargeStrength } from './skills'
function actor(pokeId: number, skill: number, level = 7): EffectActor {
 return { poke: { id: pokeId, mainSkill: MAIN_SKILLS.find(s => s.id === skill)!.name, berry: '莓莓果' }, input: { pokeId, level: 60, nature: '勤奋', subskills: [], ingredientSlots: [0,0,0], skillLevel: level }, energy: 0, factor: 1, skillLv: level, skillRate: .04, unitBerry: 100, result: { helps:0, berries:0, berryEnergy:0, ingredients:{},skillProcs:0,skillEnergy:0,sneaky:0,curve:[] } }
}
function run(a: EffectActor, team: EffectActor[]) {
 const out = { energy:0, food:0, pot:0 }
 const context: EffectContext = { ingredient:(_,__,n)=>{out.food+=n}, help:()=>{}, pot:n=>{out.pot+=n}, crit:()=>{}, skillOnly:()=>{}, charge:(_,n)=>{out.energy+=n} }
 expect(applyMainSkill(a,team,context)).toBe(true);return out
}
describe('skill copy',()=>{
 it.each([18,19])('solo %s fails to fixed charge S',id=>{const a=actor(132,id);expect(run(a,[a]).energy).toBe(3212);expect(chargeStrength(a.poke.mainSkill,7)).toBe(3212)})
 it('selects teammates equally, including failed special and copy targets',()=>{const a=actor(132,18);const food=actor(25,10);const special=actor(151,10);const copy=actor(122,19);const out=run(a,[a,food,special,copy]);expect(out.food).toBeCloseTo(24/3);expect(out.energy).toBeCloseTo(3212*2/3)})
 it.each([150,151,243,244,245,380,381,488,491])('special %s always fails even with a normal resolved skill',id=>{const a=actor(122,19);expect(run(a,[a,actor(id,10)]).energy).toBe(3212)})
 it('uses own level with copied skill maximum',()=>{const a=actor(132,18,1);expect(run(a,[a,actor(25,1,7)]).energy).toBe(400);a.skillLv=7;const healer=actor(40,8);run(a,[a,healer]);expect(a.energy).toBe(18.1)})
 it('copies metronome as the full existing pool',()=>{const a=actor(122,19);const out=run(a,[a,actor(175,12)]);expect(out.food).toBeGreaterThan(0);expect(out.energy).toBeGreaterThan(0);expect(out.pot).toBeGreaterThan(0)})
})
