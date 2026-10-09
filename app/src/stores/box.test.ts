import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useBoxStore } from './box'

const stored = vi.hoisted(() => ({ box: null as unknown }))
vi.mock('../storage', () => ({
  loadJson: async (_key: string, fallback: unknown) => stored.box ?? fallback,
  saveJson: async (_key: string, value: unknown) => { stored.box = value },
}))

function member(uid: string, level: number) {
  return {
    uid,
    pokeId: 25,
    level,
    nature: '勤奋',
    subskills: ['', '', '', '', ''],
    ingredientSlots: [0, 1, 2] as [number, number, number],
    skillLevel: 1,
    name: '',
    napping: false,
  }
}

describe('box update order', () => {
  beforeEach(() => setActivePinia(createPinia()))

  it('moves an edited member to the newest end of storage order', () => {
    const box = useBoxStore()
    box.create(member('first', 10))
    box.create(member('second', 20))

    box.update('first', { level: 30 })

    expect(box.pokemon.map((item) => item.uid)).toEqual(['second', 'first'])
    expect(box.pokemon[1]?.level).toBe(30)
  })

  it('moves merged members to the newest end', () => {
    const box = useBoxStore()
    box.create(member('first', 10))
    box.create(member('second', 20))

    box.merge([member('first', 40)])

    expect(box.pokemon.map((item) => item.uid)).toEqual(['second', 'first'])
    expect(box.pokemon[1]?.level).toBe(40)
  })
})

describe('box uid', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    stored.box = null
  })

  it('gives a blank uid a fresh one on create', () => {
    const box = useBoxStore()
    const a = box.create(member('', 10))
    const b = box.create(member('', 20))
    expect(a.uid).not.toBe('')
    expect(b.uid).not.toBe('')
    expect(a.uid).not.toBe(b.uid)
  })

  it('repairs stored members whose uid is blank', async () => {
    stored.box = { schemaVersion: 1, pokemon: [member('', 10), member('', 20), member('keep', 30)] }
    const box = useBoxStore()
    await box.hydrate()
    const uids = box.pokemon.map((item) => item.uid)
    expect(uids[2]).toBe('keep')
    expect(uids.every(Boolean)).toBe(true)
    expect(new Set(uids).size).toBe(3)
  })
})

describe('OCR pending persistence', () => {
  it('keeps pending fields after hydration and saves partial completion without losing the record', async () => {
    stored.box = null
    setActivePinia(createPinia())
    const box = useBoxStore()
    await box.hydrate()
    const pokemon = box.create({ ...member('pending', 30), ocrMissing: ['level', 'nature'] })
    expect(pokemon.ocrMissing).toEqual(['level', 'nature'])
    await vi.waitFor(() => expect((stored.box as { pokemon: typeof box.pokemon }).pokemon[0]?.ocrMissing).toEqual(['level', 'nature']))
    setActivePinia(createPinia())
    const restored = useBoxStore()
    await restored.hydrate()
    expect(restored.pokemon[0]?.ocrMissing).toEqual(['level', 'nature'])
    restored.update('pending', { level: 40, ocrMissing: ['nature'] })
    expect(restored.pokemon[0]?.level).toBe(40)
    expect(restored.pokemon[0]?.ocrMissing).toEqual(['nature'])
    restored.update('pending', { nature: '固执', ocrMissing: [] })
    expect(restored.pokemon).toHaveLength(1)
    expect(restored.pokemon[0]?.ocrMissing).toBeUndefined()
  })
})


describe('manual OCR save merging', () => {
  beforeEach(() => setActivePinia(createPinia()))
  it('explicitly removes old OCR markers while retaining edited values', () => {
    const box = useBoxStore()
    box.create({ ...member('incomplete', 10), ocrMissing: ['level', 'nature'] })
    box.update('incomplete', { level: 50, nature: '坦率', ocrMissing: [] })
    expect(box.pokemon[0]?.level).toBe(50)
    expect(box.pokemon[0]?.nature).toBe('坦率')
    expect(box.pokemon[0]?.ocrMissing).toBeUndefined()
  })
  it('preserves untouched markers on ordinary patches and supports partial confirmation', () => {
    const box = useBoxStore()
    box.create({ ...member('incomplete', 10), ocrMissing: ['level', 'nature'] })
    box.update('incomplete', { name: 'edited' })
    expect(box.pokemon[0]?.ocrMissing).toEqual(['level', 'nature'])
    box.update('incomplete', { level: 30, ocrMissing: ['nature'] })
    expect(box.pokemon[0]?.ocrMissing).toEqual(['nature'])
  })
})
