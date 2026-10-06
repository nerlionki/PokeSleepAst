import { describe, expect, it } from 'vitest'
import { parseBoxImport } from './boxio'
import { candyExpectation } from './sleepCandy'
import { compareDex } from './pokedexOrder'
import { sleepExpect, unlockedStyles, styleUnlockIndex } from './sleep'

describe('iqdooh Box import', () => {
  const entry = { id: 'b123', dex: '#001', name: '妙蛙种子', nickname: '小草', level: 50, levelReal: 32,
    selected: ['speedM', 'fruitS', 'helperBonus', 'lvS', null], incAttr: 'F', decAttr: 'E',
    ingChoice2: 'b', ingChoice3: 'c', shiny: true }
  it('converts actual export fields without treating calculation tiers as levels', () => {
    const result = parseBoxImport({ version: 1, entries: [entry] })
    expect(result.source).toBe('iqdooh')
    expect(result.pokemon[0]).toMatchObject({ uid: 'iqdooh-b123', pokeId: 1, name: '小草', level: 32,
      nature: '冷静', subskills: ['helpM', 'berryS', 'helpingBonus', 'skillLevelS', ''],
      ingredientSlots: [0, 1, 2], shiny: true })
    expect(result.pokemon[0]?.ocrMissing).toEqual(expect.arrayContaining(['skillLevel', 'subskill4']))
  })
  it('recognizes entry arrays and keeps IDs stable on repeated imports', () => {
    const a = parseBoxImport([entry])
    expect(a.source).toBe('iqdooh')
    expect(a.pokemon[0]?.uid).toBe(parseBoxImport([entry]).pokemon[0]?.uid)
  })
  it('converts known forms and skips unknown ones instead of importing a different Pokemon', () => {
    const result = parseBoxImport({ version: 1, entries: [{ ...entry, dex: '#037-1' }, { ...entry, dex: '#025-99' }] })
    expect(result.pokemon[0]?.pokeId).toBe(7006)
    expect(result.skipped).toBe(1)
  })
  it('marks missing ingredient choices and invalid attributes as unresolved', () => {
    const p = parseBoxImport([{ ...entry, incAttr: 'bad', ingChoice2: null }]).pokemon[0]!
    expect(p.ocrMissing).toEqual(expect.arrayContaining(['nature', 'ingredient1', 'skillLevel']))
  })
})

describe('sleep candy expectations', () => {
  it('combines evolution siblings and split sleep results, then divides by the number of plans', () => {
    const result = candyExpectation([{ pokeId: 1, candy: 4000 }, { pokeId: 2, candy: 8000 },
      { pokeId: 3, candy: 4000 }, { pokeId: 133, candy: 4000 }, { pokeId: 134, candy: 4000 }], 4000)
    expect(result).toEqual(expect.arrayContaining([
      expect.objectContaining({ pokeId: 1, average: 4 }), expect.objectContaining({ pokeId: 133, average: 2 }),
    ]))
    expect(result).toHaveLength(2)
  })
  it('combines costume Pikachu and Pichu into the same candy', () => {
    expect(candyExpectation([{ pokeId: 25, candy: 4000 }, { pokeId: 172, candy: 4000 },
      { pokeId: 9001, candy: 4000 }], 4000)).toHaveLength(1)
  })
})

describe('pokedex ordering', () => {
  it('orders forms beside their national dex number, not their internal IDs', () => {
    expect([{ id: 590 }, { id: 7006 }, { id: 38 }, { id: 37 }, { id: 1 }].sort(compareDex).map(p => p.id))
      .toEqual([1, 37, 7006, 38, 590])
  })
})

describe('RAE ordinary-island mushroom encounters', () => {
  it('uses verified drowsy power and minimum ranks on Greengrass', () => {
    const styles = unlockedStyles('greengrass', '淺淺入夢', 150_000_000, '大师20', 'normal')
      .filter(s => s.pokeId === 590 || s.pokeId === 591)
    expect(styles.map(s => [s.pokeId, s.stars, s.dpr])).toEqual([
      [590, 1, 2_090_000], [590, 2, 9_120_000], [590, 4, 49_894_000],
      [591, 1, 11_780_000], [591, 2, 33_478_000], [591, 4, 134_710_000],
    ])
    expect(styleUnlockIndex('greengrass', { pokeId: 590, stars: 1 })).toBe(5)
    expect(styleUnlockIndex('greengrass', { pokeId: 591, stars: 1 })).toBe(13)
    expect(unlockedStyles('greengrass', '淺淺入夢', 150_000_000, '普通5', 'normal').some(s => s.pokeId === 590)).toBe(false)
  })
  it('draws both mushrooms in a seeded 4000-plan batch and grants their real rewards', () => {
    const rows = sleepExpect('greengrass', '淺淺入夢', 150_000_000, 4000, 'normal', { rank: '大师20', seed: 7 })
    for (const id of [590, 591]) {
      const mushroom = rows.filter(r => r.pokeId === id)
      expect(mushroom.length).toBeGreaterThan(0)
      expect(mushroom.reduce((n, r) => n + r.candy, 0)).toBeGreaterThan(0)
    }
  })
})

