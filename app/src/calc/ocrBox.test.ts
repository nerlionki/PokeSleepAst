import { describe, expect, it } from 'vitest'
import { produce } from './produce'
import { defaultSettings } from './defaults'
import { ocrFold } from './text'
import { exportSdrice, parseBoxImport } from './boxio'
import {
  avatarBox,
  chooseSimilar,
  fingerprint,
  ingredientQuantityMarks,
  matchIngredientSlot,
  parseCard,
  planImports,
  readMainSkill,
  splitCards,
  type OcrWord,
} from './ocrBox'
import type { BoxPokemon } from '../types'

function word(text: string, x: number, y: number, width = 80, height = 28): OcrWord {
  return { text, x, y, width, height }
}

describe('ocr fold', () => {
  it('folds traditional natures and 機率 onto the catalog spelling', () => {
    expect(ocrFold('溫順')).toBe(ocrFold('温顺'))
    expect(ocrFold('食材機率提升S')).toBe(ocrFold('食材概率提升S'))
    expect(ocrFold('幫忙速度M')).toBe(ocrFold('帮忙速度M'))
    expect(ocrFold('幫手獎勵')).toBe(ocrFold('帮手奖励'))
  })
})

describe('screenshot card', () => {
  const card: OcrWord[] = [
    word('幫忙能力', 10, 8, 120, 24),
    word('Lv. 50', 16, 48, 70, 32),
    word('古月鳥', 100, 48, 90, 32),
    word('Lv. 6', 280, 160, 48, 24),
    word('食材機率提升M', 16, 220, 140, 36),
    word('幫忙速度M', 200, 220, 120, 36),
    word('Lv. 80', 16, 270, 48, 18),
    word('技能機率提升M', 16, 300, 140, 36),
    word('性格', 16, 420, 48, 24),
    word('溫順', 90, 420, 60, 28),
    word('143小时44分', 160, 520, 120, 24),
  ]

  it('keeps header level, skill level, and subskill slots in place', () => {
    const pokemon = parseCard(card, { portraitId: 845, slotLines: [0, null] })
    expect(pokemon).toMatchObject({
      pokeId: 845,
      level: 50,
      nature: '温顺',
      name: '古月鳥',
      subskills: ['ingM', 'helpM', 'skillM', '', ''],
      skillLevel: 6,
      ingredientSlots: [0, 0, 2],
    })
    expect(pokemon?.tune?.ribbonHours).toBeCloseTo(143 + 44 / 60)
  })

  it('accepts a unique subskill prefix and rejects one shared by S and M', () => {
    const pokemon = parseCard([
      word('古月鳥', 80, 40),
      word('帮手', 16, 220, 80, 36),
      word('帮忙', 200, 220, 80, 36),
    ], { portraitId: 845, slotLines: [null, null] })
    expect(pokemon?.subskills[0]).toBe('helpingBonus')
    expect(pokemon?.subskills[1]).toBe('')
  })

  it('does not pull a later subskill forward when a slot is missed', () => {
    const pokemon = parseCard(card, { portraitId: 845, slotLines: [null, null] })
    expect(pokemon?.subskills[2]).toBe('skillM')
    expect(pokemon?.subskills[1]).toBe('helpM')
  })

  it('recovers recurring gold-pill OCR errors and dropped first characters', () => {
    const pokemon = parseCard([
      word('樹果', 230, 88, 100, 28),
      word('Lv.51金B3概', 235, 271, 200, 40),
      word('主技能/副技能', 100, 700, 180, 32),
      word('手厅', 250, 840, 120, 36),
      word('食材機率提升S', 730, 842, 160, 36),
      word('Lv.70', 638, 969, 70, 28),
      word('技能機率提升M', 192, 1026, 160, 36),
      word('技能機率提升S', 728, 1026, 160, 36),
      word('Lv.80', 103, 1153, 70, 28),
      word('忙速度S', 196, 1210, 160, 36),
    ], { portraitId: 922, slotLines: [null, null] })
    expect(pokemon?.subskills).toEqual(['helpingBonus', 'ingS', 'skillM', 'skillS', 'helpS'])
  })

  it('uses unlock badges to preserve empty earlier rows', () => {
    const pokemon = parseCard([
      word('Lv.50', 16, 48, 70, 32),
      word('Lv.75', 587, 300, 70, 28),
      word('技能機率提升M', 180, 350, 160, 36),
      word('技能機率提升S', 670, 350, 160, 36),
      word('Lv.100', 86, 500, 80, 28),
      word('持有上限提升L', 180, 550, 160, 36),
    ], { portraitId: 154, slotLines: [null, null] })
    expect(pokemon?.subskills).toEqual(['', '', 'skillM', 'skillS', 'invL'])
  })

  it('discards a card when the portrait misses, even if the corner text is a species name', () => {
    expect(parseCard([word('古月鳥', 40, 40), word('Lv. 50', 16, 40)], { portraitId: null, slotLines: [null, null] })).toBeNull()
  })

  it('keeps the corner text as the name and takes species only from the portrait', () => {
    const pokemon = parseCard([
      word('Lv. 50', 16, 48, 70, 32),
      word('古月鳥', 100, 48, 90, 32),
    ], { portraitId: 25, slotLines: [null, null] })
    expect(pokemon?.pokeId).toBe(25)
    expect(pokemon?.name).toBe('古月鳥')
  })

  it('uses the portrait when the name is not a species, and keeps a header level', () => {
    const pokemon = parseCard(
      [word('Lv. 51', 16, 40, 70, 36), word('溫順', 40, 300)],
      { portraitId: 25, slotLines: [null, null] },
    )
    expect(pokemon).toMatchObject({
      pokeId: 25,
      level: 51,
      nature: '温顺',
      ingredientSlots: [0, 1, 2],
      skillLevel: 1,
    })
  })

  it('writes Mew slot 1 as egg and leaves the other slots empty', () => {
    const pokemon = parseCard([word('夢幻', 100, 40, 80, 32), word('Lv. 30', 16, 40, 70, 32)], {
      portraitId: 151,
      slotLines: [null, null],
    })
    expect(pokemon?.pokeId).toBe(151)
    expect(pokemon?.name).toBe('夢幻')
    expect(pokemon?.ingredientSlots).toEqual([1, null, null])
  })

  it('places the avatar beside the nickname row, not the status clock', () => {
    const box = avatarBox([
      word('13:44', 91, 60, 80, 24),
      word('Lv.51金B3概', 235, 271, 200, 40),
      word('温顺', 285, 2119),
    ])
    expect(box).not.toBeNull()
    expect(box!.y).toBeGreaterThan(120)
    expect(box!.x + box!.size).toBeLessThanOrEqual(235 + 8)
  })

  it('reads a level glued to a nickname and ignores the unlock badge on the right', () => {
    const pokemon = parseCard([
      word('Lv.51金B3概', 235, 271, 200, 40),
      word('LV.60', 892, 232, 70, 28),
      word('LV.6', 970, 1017, 60, 28),
      word('温顺', 285, 2119),
      word('食材機率提升S', 730, 1331, 160, 36),
      word('技能機率提升M', 192, 1513, 160, 36),
      word('技能機率提升S', 727, 1516, 160, 36),
      word('持有上限提升L', 196, 1701, 160, 36),
    ], { portraitId: 25, slotLines: [null, null] })
    expect(pokemon).toMatchObject({
      pokeId: 25,
      name: '金B3概',
      level: 51,
      nature: '温顺',
      skillLevel: 6,
      subskills: ['', 'ingS', 'skillM', 'skillS', 'invL'],
    })
  })

  it('writes Darkrai slot 1 as bean sausage', () => {
    const pokemon = parseCard([word('達克萊伊', 100, 40, 90, 32), word('Lv. 30', 16, 40, 70, 32)], { portraitId: 491, slotLines: [null, null] })
    expect(pokemon?.pokeId).toBe(491)
    expect(pokemon?.name).toBe('達克萊伊')
    expect(pokemon?.ingredientSlots).toEqual([0, null, null])
    expect(pokemon?.level).toBe(30)
  })
})

describe('ingredient icon slot', () => {
  it('rejects a hit whose quantity does not match that slot', () => {
    expect(matchIngredientSlot(845, 1, 10, 5)).toBe(0)
    expect(matchIngredientSlot(845, 1, 10, 4)).toBeNull()
  })

  it('uses an unambiguous quantity when icon OCR misses', () => {
    expect(matchIngredientSlot(195, 1, null, 5)).toBe(0)
    expect(matchIngredientSlot(195, 2, null, 7)).toBe(0)
  })

  it('accepts bare ingredient quantities and locates the last two columns', () => {
    const marks = ingredientQuantityMarks([
      word('食材', 214, 407, 120, 36),
      word('×2', 575, 482, 40, 24),
      word('5', 757, 482, 20, 24),
      word('7', 935, 482, 20, 24),
      word('幫忙間隔', 182, 590, 160, 32),
      word('返回', 123, 2299, 80, 28),
    ])
    expect(marks.map((mark) => mark?.quantity ?? null)).toEqual([5, 7])
  })

  it('infers a missing middle quantity position from the first and third columns', () => {
    const marks = ingredientQuantityMarks([
      word('食材', 1779, 306, 100, 28),
      word('2', 2056, 363, 20, 24),
      word('×7', 2321, 361, 36, 24),
      word('幫忙間隔', 1755, 442, 160, 32),
    ])
    expect(marks[0]?.quantity).toBeNull()
    expect(marks[0]?.word.x).toBeGreaterThan(2150)
    expect(marks[1]?.quantity).toBe(7)
  })
})

describe('import batch', () => {
  const base = {
    pokeId: 845,
    level: 50,
    nature: '温顺',
    subskills: ['ingM', 'helpM', 'skillM', '', ''],
    ingredientSlots: [0, 0, 2] as [number, number, number],
    skillLevel: 6,
    name: '',
    napping: false,
  }

  it('treats a null ingredient slot as different from zero', () => {
    const filled = fingerprint({ ...base, ingredientSlots: [1, 0, null] })
    const zeroed = fingerprint({ ...base, ingredientSlots: [1, 0, 0] })
    expect(filled).not.toBe(zeroed)
  })

  it('treats normal and shiny Pokémon as different fingerprints', () => {
    expect(fingerprint({ ...base, shiny: true })).not.toBe(fingerprint(base))
    expect(fingerprint({ ...base, shiny: false })).toBe(fingerprint(base))
  })

  it('skips a later card with the same fingerprint and does not rewrite the box', () => {
    const existing: BoxPokemon = { ...base, uid: 'old', tune: { evolutions: 0, goldSeeds: 0, silverSeeds: 0, sleepHours: 0, carryMode: 'preset', exp: 0, ribbonHours: 10 } }
    const again = { ...base, name: '新', tune: { ...existing.tune!, ribbonHours: 99 } }
    const result = planImports([existing], [again, null])
    expect(result.accepted).toEqual([])
    expect(result.skipped).toBe(1)
    expect(result.discarded).toBe(1)
    expect(existing.tune?.ribbonHours).toBe(10)
  })

  it('splits a wide image on repeated headers from left to right', () => {
    const groups = splitCards([
      word('幫忙能力', 10, 8),
      word('古月鳥', 20, 40),
      word('幫忙能力', 400, 8),
      word('皮卡丘', 420, 40),
    ])
    expect(groups).toHaveLength(2)
    expect(groups[0]?.some((item) => item.text === '古月鳥')).toBe(true)
    expect(groups[1]?.some((item) => item.text === '皮卡丘')).toBe(true)
  })

  it('keeps the right subskill column with its card in a wide image', () => {
    const groups = splitCards([
      word('幫忙能力', 78, 8, 120, 24),
      word('幫忙速度M', 529, 1035, 150, 36),
      word('幫忙能力', 885, 8, 120, 24),
      word('食材機率提升M', 945, 1072, 160, 36),
      word('幫忙能力', 1695, 8, 120, 24),
    ])
    expect(groups[0]?.some((item) => item.text === '幫忙速度M')).toBe(true)
    expect(groups[1]?.some((item) => item.text === '食材機率提升M')).toBe(true)
  })
})

describe('similar portraits', () => {
  it('recovers the observed dropped character in Latios main skill', () => {
    expect(readMainSkill([word('流星群（樹果增）', 40, 80)])).toBe('流星群（樹果增）')
  })

  it('uses a unique main skill even when noisy ingredient icons disagree', () => {
    expect(chooseSimilar(
      [{ id: 132, score: 52.5 }, { id: 9006, score: 53.2 }, { id: 363, score: 56.2 }],
      { skill: '料理成功S', ingredients: [7, 3] },
    )).toBe(9006)
  })

  it('reads the main skill and keeps the species whose ingredients fit', () => {
    expect(readMainSkill([word('能量填充S', 40, 80)])).toBe('能量填充S')
    const picked = chooseSimilar(
      [{ id: 25, score: 30 }, { id: 57, score: 31 }],
      { skill: '能量填充S', ingredients: [2, null] },
    )
    expect(picked).toBe(57)
  })

  it('keeps the closer portrait when the skill and ingredients fit both', () => {
    expect(chooseSimilar(
      [{ id: 923, score: 40 }, { id: 922, score: 28 }],
      { skill: '活力全體療癒S', ingredients: [8, 3] },
    )).toBe(922)
  })

  it('discards the pair when nothing on the card can separate them', () => {
    expect(chooseSimilar(
      [{ id: 25, score: 30 }, { id: 57, score: 31 }],
      { skill: null, ingredients: [null, null] },
    )).toBeNull()
  })
})

describe('empty ingredient slots', () => {
  it('does not turn a null slot into the first ingredient line', () => {
    const settings = { ...defaultSettings(), meals: false }
    const input = {
      pokeId: 151,
      level: 60,
      nature: '勤奋',
      subskills: [] as string[],
      ingredientSlots: [1, null, null] as [number, null, null],
      skillLevel: 1,
      wakeEnergy: 100,
    }
    const skipped = produce(settings, input)
    const filled = produce(settings, { ...input, ingredientSlots: [1, 0, null] })
    expect(skipped.ingredients['特选蛋']).toBeGreaterThan(0)
    expect(skipped.ingredients['粗枝大葱']).toBeUndefined()
    expect(filled.ingredients['粗枝大葱']).toBeGreaterThan(0)
  })

  it('keeps nulls in native json and writes zero for sdrice', () => {
    const pokemon: BoxPokemon = {
      uid: 'm', pokeId: 151, level: 30, nature: '勤奋', subskills: ['', '', '', '', ''],
      ingredientSlots: [1, null, null], skillLevel: 1, name: '', napping: false,
    }
    const back = parseBoxImport({ schemaVersion: 1, pokemon: [pokemon] })
    expect(back.pokemon[0]?.ingredientSlots).toEqual([1, null, null])
    expect(exportSdrice([pokemon])[0]?.useFoods).toEqual([1, 0, 0])
  })
})
