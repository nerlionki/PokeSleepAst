import { describe, expect, it } from 'vitest'
import { SPECIAL_TEAM_POKEMON, teamRestrictionError } from '../../../core/src/calc/teamRestrictions'
import { simulateTeam } from './timeline'
import { defaultSettings } from './defaults'

const team = (...ids: number[]) => ids.map(pokeId => ({ pokeId }))
describe('special team membership', () => {
  it('allows each special alone with ordinary members', () => {
    for (const id of SPECIAL_TEAM_POKEMON) expect(teamRestrictionError(team(25, id, 1))).toBe('')
  })
  it('allows only one Latias and one Latios together', () => {
    expect(teamRestrictionError(team(25, 380, 381, 1))).toBe('')
    expect(teamRestrictionError(team(381, 380))).toBe('')
    expect(teamRestrictionError(team(380, 381, 151))).not.toBe('')
  })
  it('rejects every other special pairing and duplicates', () => {
    for (const a of SPECIAL_TEAM_POKEMON) for (const b of SPECIAL_TEAM_POKEMON) {
      if (a === 380 && b === 381 || a === 381 && b === 380) continue
      expect(teamRestrictionError(team(a, b))).not.toBe('')
    }
    expect(teamRestrictionError(team(25, 25, 25))).toBe('')
  })
  it('rejects illegal rosters at the simulation boundary', () => {
    const members = team(151, 243).map(member => ({ ...member, level: 60, nature: '勤奋', subskills: [], ingredientSlots: [0, 0, 0] as [number, number, number], skillLevel: 1 }))
    expect(() => simulateTeam(defaultSettings(), members, 0)).toThrow('特殊宝可梦')
  })
})
