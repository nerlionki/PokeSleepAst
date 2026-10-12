import { afterEach, describe, expect, it, vi } from 'vitest'
import * as data from '../../../core/src/calc/data'
import { energyMultiplier, instantInterval, levelInterval, subskillSpeedCut } from './helpSpeed'
import { defaultSettings } from './defaults'
import { clockOf, simulateTeam } from './timeline'
import { ribbonBonus } from '../../../core/src/calc/ribbon'

afterEach(() => vi.restoreAllMocks())

describe('confirmed helping frequency audit', () => {
  it('uses inverse 1.2 for Good Camp before the multiplier truncation', () => {
    expect(instantInterval(2700, 1, '勤奋', [], 0, 0, false, 'greengrass', false)).toBe(2700)
    // 1/1.2 截断为 0.8333，2700×0.8333 = 2249.91。
    expect(instantInterval(2700, 1, '勤奋', [], 0, 0, true, 'greengrass', false)).toBe(2249)
  })

  it('truncates the combined actual multiplier, with additive subskills', () => {
    // 0.912 × 0.9 × (1−0.07−0.05) × 0.45 ÷ 1.2 = 0.270864。
    // 截断为 0.2708，3000 × 0.2708 = 812.4，再向下取整。
    expect(instantInterval(3000, 45, '固执', ['helpS'], 1, 82, true, 'greengrass', false)).toBe(812)
  })

  it('applies the 35 percent cap only to subskills, not camp or ribbon', () => {
    expect(subskillSpeedCut(['helpS', 'helpM'], 5)).toBe(.35)
    expect(instantInterval(4000, 1, '勤奋', ['helpS','helpM'], 5, 0, true, 'greengrass', false, .25)).toBe(1624)
  })

  it('includes the ribbon before the single displayed-interval rounding', () => {
    // 3001 × 0.942 × 0.95 = 2685.5949；先取整再乘勋章会错误得到 2684。
    expect(levelInterval(3001, 30, '勤奋', [], 0, .05)).toBe(2685)
    expect(levelInterval(2400, 30, '内敛', ['helpS'], 0)).toBe(2260)
  })

  it.each([[499,2,0],[500,2,.11],[1000,1,.05],[2000,1,.12],[2000,2,.25],[2000,0,0]])('uses ribbon hours %s with %s remaining evolutions', (hours, left, cut) => {
    expect(ribbonBonus(hours,left).speedCut).toBe(cut)
  })

  it('retains the confirmed energy boundaries', () => {
    expect([0,.5,40,40.1,60,60.1,80,80.1,150].map(energyMultiplier)).toEqual([1,.66,.66,.58,.58,.52,.52,.45,.45])
  })

  it('formats fractional event minutes as a normal clock', () => {
    expect(clockOf(65.516)).toBe('01:05')
    expect(clockOf(1440.25)).toBe('00:00')
  })

  it.each([211,40])('keeps exact completion times for a %s-second interval throughout the day', interval => {
    const poke = data.POKEDEX.find(p => p.id === 25)!
    vi.spyOn(data,'pokeById').mockReturnValue({...poke, interval, ingredientRate:0, skillRate:1})
    const input = {pokeId:25,level:1,nature:'勤奋',subskills:[],ingredientSlots:[0,0,0] as [number,number,number],skillLevel:1,carryMode:'unlimited' as const}
    const result = simulateTeam({...defaultSettings(),meals:false,sleepStart:'00:00',sleepEnd:'00:00'},[input],0,{alwaysProc:true,fixedEnergy:0})
    // 沿用已有 t=0 帮忙队列起点；后续时刻不能逐次向上取整到分钟。
    expect(result.members[0]!.helps).toBe(Math.ceil(86400/interval))
    expect(result.events[1]!.minute).toBeCloseTo(interval/60)
    expect(result.events.at(-1)!.minute).toBeCloseTo((result.events.length-1)*interval/60)
  })
})
