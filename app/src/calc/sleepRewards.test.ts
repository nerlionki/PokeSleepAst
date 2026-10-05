import { describe, expect, it } from 'vitest'
import { POKEDEX, SLEEP_STYLES } from './data'
import { sleepExpect, styleUnlockIndex, unlockedStyles } from './sleep'
import { sleepReward } from './sleepRewards'

describe('RAE sleep research rewards', () => {
  it('covers every locally listed sleep style, including special Ditto faces', () => {
    expect(SLEEP_STYLES.every((style) => sleepReward(style))).toBe(true)
    expect(sleepReward({ pokeId: 132, stars: 4, styleId: 371 })?.researchExp).toBe(2363)
    expect(sleepReward({ pokeId: 132, stars: 4, styleId: 623 })?.researchExp).toBe(7091)
  })

  it('accumulates each drawn style reward for a per-sleep average', () => {
    const n = 100
    const rows = sleepExpect('greengrass', '淺淺入夢', 10_000_000, n, 'normal', { rank: '大师10', seed: 7 })
    const totals = rows.reduce((sum, row) => ({
      count: sum.count + row.count,
      researchExp: sum.researchExp + row.researchExp,
      shards: sum.shards + row.shards,
      candy: sum.candy + row.candy,
    }), { count: 0, researchExp: 0, shards: 0, candy: 0 })
    expect(totals.count).toBeGreaterThan(n)
    expect(totals.researchExp / n).toBeGreaterThan(0)
    expect(totals.shards / n).toBeGreaterThan(0)
    expect(totals.candy / n).toBeGreaterThan(0)
  })

  it('integrates both mushroom species across their RAE maps and reward pools', () => {
    expect(POKEDEX.find((poke) => poke.id === 590)?.ingredients[0]?.amounts).toEqual([2, 5, 7])
    expect(POKEDEX.find((poke) => poke.id === 591)?.carry).toBe(19)
    const mushroomStyles = SLEEP_STYLES.filter((style) => style.pokeId === 590 || style.pokeId === 591)
    expect(mushroomStyles).toHaveLength(38)
    expect(mushroomStyles.every((style) => sleepReward(style))).toBe(true)
    expect(styleUnlockIndex('lapis', { pokeId: 591, stars: 3 })).toBe(17)
    expect(unlockedStyles('lapis', '淺淺入夢', 93_290_000, '大师3', 'normal')
      .some((style) => style.pokeId === 591 && style.stars === 3)).toBe(true)
    expect(unlockedStyles('lapis', '淺淺入夢', 93_289_999, '大师3', 'normal')
      .some((style) => style.pokeId === 591 && style.stars === 3)).toBe(false)
    expect(sleepReward({ pokeId: 590, stars: 3 })).toMatchObject({ researchExp: 2641, shards: 2414, candy: 9 })
  })
})
