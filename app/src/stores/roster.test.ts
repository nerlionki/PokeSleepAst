import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useRosterStore } from './roster'
import { useBoxStore } from './box'

vi.mock('../storage', () => ({ loadJson: async (_key: string, fallback: unknown) => fallback, saveJson: async () => {} }))
beforeEach(() => setActivePinia(createPinia()))
describe('special roster entry points', () => {
  it('rejects incompatible Box members and duplication without replacing slots', () => {
    const box = useBoxStore(), roster = useRosterStore()
    const add = (uid: string, pokeId: number) => box.create({ uid, pokeId, level: 60, nature: '勤奋', subskills: [], ingredientSlots: [0, 0, 0], skillLevel: 1, name: '', napping: false })
    add('mew', 151); add('raikou', 243)
    expect(roster.setSlot(0, 'mew')).toBe(true)
    expect(roster.setSlot(1, 'raikou')).toBe(false)
    expect(roster.setSlot(1, 'mew')).toBe(false)
    expect(roster.slots).toEqual(['mew', null, null, null, null])
    expect(roster.setSlot(0, 'raikou')).toBe(true)
    expect(roster.error).toBe('')
  })
  it('allows the Latias/Latios exception and rejects custom duplicates without leaking customs', () => {
    const roster = useRosterStore()
    const latias = roster.addCustom(0, 380)!
    expect(roster.addCustom(1, 381)).not.toBeNull()
    expect(roster.addCustom(2, 151)).toBeNull()
    expect(roster.duplicateCustom(latias)).toBeNull()
    expect(roster.customs).toHaveLength(2)
    expect(roster.slots.filter(Boolean)).toHaveLength(2)
    expect(roster.addCustom(2, 25)).not.toBeNull()
  })
})
