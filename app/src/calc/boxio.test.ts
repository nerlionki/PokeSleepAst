import { describe, expect, it } from 'vitest'
import { exportSdrice, parseBoxImport, parseBoxText } from './boxio'

describe('box import', () => {
  it('reads native schema', () => {
    const r = parseBoxImport({
      schemaVersion: 1,
      pokemon: [{
        uid: 'a', pokeId: 25, level: 30, nature: '勤奋', subskills: ['helpS', '', '', '', ''],
        ingredientSlots: [0, 0, 0], skillLevel: 2, note: '闪电', napping: false,
      }],
    })
    expect(r.source).toBe('native')
    expect(r.pokemon[0]?.pokeId).toBe(25)
    expect(r.pokemon[0]?.subskills[0]).toBe('helpS')
    expect(r.pokemon[0]?.name).toBe('闪电')
  })

  it('reads sdrice box array', () => {
    const r = parseBoxImport([{
      dataId: 'x_25',
      pokemonId: 25,
      level: 42,
      skilllevel: 3,
      skill: ['hs', 'fm', 'hg1'],
      character: '固执',
      useFoods: [0, 1, 0],
    }])
    expect(r.source).toBe('sdrice')
    expect(r.pokemon[0]?.pokeId).toBe(25)
    expect(r.pokemon[0]?.level).toBe(42)
    expect(r.pokemon[0]?.subskills.slice(0, 3)).toEqual(['helpS', 'ingM', 'helpingBonus'])
    expect(r.pokemon[0]?.nature).toBe('固执')
  })

  it('reads RAE pokebox', () => {
    const r = parseBoxImport({
      version: 4,
      pokebox: [{
        uuid: 'rae-1',
        pokemon: 'PIKACHU',
        level: 50,
        nature: 'ADAMANT',
        subSkill: ['helpingSpeedS', 'ingredientFinderM', 'helpingBonus'],
        ingredients: ['fancyApple', 'fancyApple', 'fancyApple'],
        skillLevel: 4,
      }],
    })
    expect(r.source).toBe('rae')
    expect(r.pokemon[0]?.pokeId).toBe(25)
    expect(r.pokemon[0]?.nature).toBe('固执')
    expect(r.pokemon[0]?.subskills[0]).toBe('helpS')
    expect(r.pokemon[0]?.skillLevel).toBe(4)
  })

  it('exports sdrice array that round-trips', () => {
    const out = exportSdrice([{
      uid: 'u1', pokeId: 1, level: 20, nature: '勤奋', subskills: ['helpS', '', '', '', ''],
      ingredientSlots: [0, 0, 0], skillLevel: 1, name: '', napping: false,
    }])
    const back = parseBoxText(JSON.stringify(out))
    expect(back.source).toBe('sdrice')
    expect(back.pokemon[0]?.pokeId).toBe(1)
  })
})
