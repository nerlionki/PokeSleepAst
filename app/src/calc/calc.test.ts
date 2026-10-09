import { describe, expect, it } from 'vitest'
import { berryEnergyAt } from './berry'
import { instantInterval, levelInterval, natureHelpFactor } from './helpSpeed'
import { BERRIES, berryByName, ISLANDS, pokeById, POKEDEX, POT_TIERS, RECIPES, SLEEP_STYLES } from './data'
import { compareHelpingBonus, exclusiveSubskills } from './member'
import { ribbonBonus, stagesLeft } from './ribbon'
import { berryCount, friendTiers, ingredientColumns, nextIngredientSlot, setIngredientChoice, slotDrop, spreadColumns, topIngredientProducers } from './ingredients'
import { MAIN_SKILLS } from './mainSkills'
import { wakeFromHours } from './member'
import { englishName, pokeHit } from './pokeSearch'
import { evolutionStages } from './evolution'
import { homeText, islandPokemon, islandsOf } from './islandMeta'
import { defaultFirstSlot, isAllRounder, mythicalSeed, specialtyHit, specialtyLabel } from './specialty'
import { berryImageUrl, hasShiny, mainSkillImageUrl, mealImageUrl, pokemonIconUrl, pokemonShinyIconUrl } from './raeImage'
import { cookMeals } from './cook'
import { defaultSettings } from './defaults'
import { energyCurve, mealRecover } from './energy'
import { cookEnergy, recipeLevelMult } from './cook'
import { effectiveDrowsyRatio, energyForCount, energyLost, encounterCount, expectSpecies, maxEncounters, RANK_ORDER, rankFromStrength, rankIndex, rankStrength, rankToNext, resolvedSleepdex, shinyRateLabel, sleepClock, sleepdexState, sleepExpect, strengthToNext, styleKey, styleUnlockIndex, unlockedStyles, wallStyleKeys } from './sleep'
import { produce, splitHelps } from './produce'
import { natureStatFactor } from './natureLabels'
import { skillKind } from './skills'
import { teamProduce } from './team'
import { simulateTeam } from './timeline'
import { napDailyExp, napTotalExp, trainPlan } from './train'
import { expTo, xpCandy } from './xp'
import { recommendThree } from './catch'
import { calculateCandy, planCandy } from './candyPlan'

describe('pot and sleep headline', () => {
  it('follows the RAE pot table through 81', () => {
    expect(POT_TIERS[0]).toEqual({ pot: 21, shards: 0 })
    expect(POT_TIERS[1]).toMatchObject({ pot: 23, shards: 1200 })
    expect(POT_TIERS.at(-1)).toEqual({ pot: 81, shards: 1200000 })
  })

  it('matches a full night with no snorlax energy', () => {
    expect(energyLost(100)).toBe(51)
    expect(strengthToNext('greengrass', 100, 0, 1)).toEqual({ count: 4, need: 9653 })
  })
})

const settings = defaultSettings()

describe('rae images', () => {
  it('points berries, meals, and pokemon at local image files', () => {
    expect(berryImageUrl('柿仔果')).toContain('berry/1.webp')
    expect(berryImageUrl('異奇果')).toContain('berry/16.webp')
    expect(berryImageUrl('櫻子果')).toContain('berry/7.webp')
    expect(berryImageUrl('零餘果')).toContain('berry/8.webp')
    expect(berryImageUrl(pokeById(475)!.berry)).toContain('berry/7.webp')
    for (const poke of POKEDEX) expect(berryByName(poke.berry), poke.name).toBeDefined()
    expect(pokemonIconUrl(71002)).toContain('pokemon/icons/710-A2.webp')
    expect(mealImageUrl('特選蘋果咖哩')).toContain('meal/1001.webp')
    expect(mainSkillImageUrl(1)).toContain('mainSkill/1.webp')
    expect(mainSkillImageUrl(40)).toContain('mainSkill/40.webp')
    expect(mainSkillImageUrl(1)).not.toContain('raenonx')
    for (const recipe of RECIPES) {
      expect(mealImageUrl(recipe.name), recipe.name).toContain('meal/')
      expect(mealImageUrl(recipe.name), recipe.name).not.toContain('raenonx')
    }
  })
})

describe('pokedex homes', () => {
  it('lists evolved forms on the islands where RAE maps show them', () => {
    expect(islandsOf(3).map((island) => island.id)).toEqual(['greengrass', 'lapis', 'greenex'])
    expect(islandsOf(475).map((island) => island.id)).toEqual(['lapis', 'greenex'])
    expect(islandsOf(71102).map((island) => island.id)).toEqual(islandsOf(711).map((island) => island.id))
    expect(islandsOf(151)).toEqual([])
    expect(homeText(151)).toBe('仅限新月日活动，不限岛屿')
    expect(homeText(491)).toBe('仅限新月日活动，不限岛屿')
    expect(homeText(9001)).toBe('仅限活动')
    expect(POKEDEX.filter((poke) => !hasShiny(poke.id)).map((poke) => poke.id)).toEqual([151, 491, 9007])
    expect(pokemonShinyIconUrl(71102)).not.toBe(pokemonShinyIconUrl(711))
    const greengrass = islandPokemon('greengrass').map((poke) => poke.id)
    expect(greengrass).toEqual(expect.arrayContaining([1, 2, 3]))
    expect(greengrass.length).toBeGreaterThan(ISLANDS.find((island) => island.id === 'greengrass')!.species.length)
    expect(islandPokemon('lapis').some((poke) => poke.id === 475)).toBe(true)
  })

  it('treats all-rounders by specialty, not by id', () => {
    const allRounders = POKEDEX.filter((poke) => isAllRounder(poke)).map((poke) => poke.id)
    expect(allRounders).toEqual([151, 491])
    expect(POKEDEX.filter((poke) => specialtyHit(poke.specialty, '全能型')).map((poke) => poke.id)).toEqual(allRounders)
    expect(specialtyHit('全部', '树果型')).toBe(true)
    expect(specialtyHit('食材型', '全能型')).toBe(false)
    expect(specialtyLabel('全部')).toBe('全能型')
    for (const id of allRounders) expect(mythicalSeed(id)).toMatch(/^灵感种子（.+）$/)
    expect(mythicalSeed(25)).toBeNull()
    expect(pokeById(151)!.ingredients[defaultFirstSlot(151)]!.name).toBe('特选蛋')
    expect(pokeById(491)!.ingredients[defaultFirstSlot(491)]!.name).toBe('豆制肉')
  })
})

describe('evolution chain', () => {
  it('follows the RAE chain and conditions', () => {
    const bulbasaur = evolutionStages(2)
    expect(bulbasaur.map((stage) => stage.map((node) => node.id))).toEqual([[1], [2], [3]])
    expect(bulbasaur[1]![0]!.conditions).toEqual(['糖果 ×40', 'Lv.12'])
    expect(evolutionStages(172)[1]![0]!.conditions).toEqual(['糖果 ×20', '一起睡满 50 小时'])
    const eevee = evolutionStages(133)
    expect(eevee[1]!.map((node) => node.id)).toEqual([134, 135, 136, 197, 196, 470, 471, 700])
    expect(eevee[1]![0]!.conditions).toContain('水之石 ×1')
    expect(eevee[1]![3]!.conditions).toContain('夜晚 18:00–6:00')
    expect(evolutionStages(71002).map((stage) => stage.map((node) => node.id))).toEqual([[71002], [71102]])
    expect(evolutionStages(848)[1]![0]!.conditions.at(-1)).toMatch(/^性格：固执、顽皮/)
    expect(evolutionStages(9001)).toHaveLength(1)
  })
})

describe('ingredient board', () => {
  it('places bulbasaur A B C on the level that unlocks the slot', () => {
    const poke = POKEDEX.find((p) => p.id === 1)!
    const cols = ingredientColumns(poke.ingredients)
    expect(cols.map((col) => col.map((c) => `${c.letter}${c.amount}`))).toEqual([
      ['A2'],
      ['A5', 'B4'],
      ['A7', 'B7', 'C6'],
    ])
    expect(berryCount('树果型')).toBe(2)
    expect(berryCount(poke.specialty)).toBe(1)
  })

  it('matches the RAE production tab for all-rounders', () => {
    const table = (id: number) => ingredientColumns(pokeById(id)!.ingredients).map((col) => col.map((c) => `${c.name}${c.amount}`))
    expect(table(151)).toEqual([
      ['粗枝大葱2', '特选蛋2', '火辣香草2', '豆制肉2', '纯粹油2', '萌绿大豆2', '嫩亮酪梨2'],
      ['粗枝大葱3', '特选蛋4', '火辣香草4', '豆制肉4', '纯粹油4', '萌绿大豆5', '嫩亮酪梨3'],
      ['粗枝大葱4', '特选蛋6', '火辣香草5', '豆制肉7', '纯粹油6', '萌绿大豆7', '嫩亮酪梨4', '美味尾巴2'],
    ])
    expect(table(491).map((col) => col.map((c) => Number(c.match(/\d+$/)![0])))).toEqual([
      [2, 2, 2, 2, 2, 2, 2, 2],
      [4, 3, 5, 3, 4, 4, 4, 3],
      [6, 4, 7, 5, 6, 6, 6, 4],
    ])
    for (const id of [151, 491]) expect(berryCount(pokeById(id)!.specialty)).toBe(2)
    const mew = pokeById(151)!.ingredients
    const tail = mew.findIndex((line) => line.name === '美味尾巴')
    expect(slotDrop(mew, 0, tail)).toBeNull()
    expect(slotDrop(mew, 1, tail)).toBeNull()
    expect(slotDrop(mew, 2, tail)?.amount).toBe(2)
    expect(ingredientColumns(mew)[2]!.find((c) => c.name === '美味尾巴')?.index).toBe(tail)
  })

  it('uses the species medal group for gold subskill locks', () => {
    expect(friendTiers(1).map((tier) => tier.level)).toEqual([10, 40, 100])
    expect(friendTiers(2).map((tier) => [tier.level, tier.golds])).toEqual([[10, 1], [30, 2], [60, 3]])
    expect(friendTiers(4).map((tier) => tier.level)).toEqual([10, 20, 40])
    expect(friendTiers(null)).toEqual([])
    expect(POKEDEX.find((p) => p.id === 1)?.medalGroup).toBe(1)
    expect(POKEDEX.find((p) => p.id === 3)?.medalGroup).toBe(4)
    expect(POKEDEX.find((p) => p.id === 151)?.medalGroup).toBeNull()
  })

  it('ranks honey farmers and keeps the top three', () => {
    const top = topIngredientProducers(9)
    expect(top).toHaveLength(3)
    expect(top.map((p) => p.id)).toContain(3)
    expect(top.every((p) => POKEDEX.find((row) => row.id === p.id)?.ingredients.some((line) => line.id === 9))).toBe(true)
  })
})

describe('berry energy', () => {
  it('compounds 2.5% per level and matches the level-70 table', () => {
    expect(berryEnergyAt('柿仔果', 1)).toBe(28)
    expect(berryEnergyAt('柿仔果', 70)).toBe(154)
    expect(berryEnergyAt('萄葡果', 70)).toBe(137)
    expect(berryEnergyAt('櫻子果', 1)).toBe(berryByName('樱子果')!.energyLv1)
    for (const berry of BERRIES) {
      expect(berryEnergyAt(berry.name, 1)).toBe(berry.energyLv1)
      expect(berryEnergyAt(berry.name, 70)).toBe(berry.energyHigh)
    }
    expect(berryEnergyAt('柿仔果', 100)).toBeGreaterThan(berryEnergyAt('柿仔果', 70))
    expect(levelInterval(1000, 100, '勤奋', [], 0)).toBeLessThan(levelInterval(1000, 70, '勤奋', [], 0))
  })
})

describe('production comparison', () => {
  it('uses full energy, five helping bonus, and a 20% ingredient nature', () => {
    expect(natureStatFactor('固执', 'ingredient')).toBe(0.8)
    expect(natureHelpFactor('固执')).toBe(0.9)
    expect(natureHelpFactor('大胆')).toBe(1.075)
    expect(natureHelpFactor('勤奋')).toBe(1)
    const bare = {
      ...defaultSettings(),
      island: 'taupe' as const,
      berries: ['蘋野果', '勿花果', '文柚果'],
      goodCamp: false,
      areaBonus: 0,
      sleepScore: 100,
      period: 'day' as const,
    }
    const input = {
      pokeId: 25,
      level: 70,
      nature: '固执',
      subskills: ['helpS', 'ingM', 'helpingBonus', 'shardBonus', 'skillS'],
      ingredientSlots: [0, 1, 0] as [number, number, number],
      skillLevel: 1,
      carryMode: 'unlimited' as const,
      ribbonHours: 0,
      wakeEnergy: 100,
    }
    const calm = produce(bare, input, 5)
    const ingRate = 0.207 * 0.8 * 1.36
    const split = splitHelps(calm.helps, ingRate, 0.021, [
      { name: '特选苹果', amount: 1 },
      { name: '暖暖姜', amount: 2 },
      { name: '特选苹果', amount: 4 },
    ], false)
    expect(calm.ingredients['特选苹果']).toBe(split.ingredients['特选苹果'])
    expect(calm.ingredients['暖暖姜']).toBe(split.ingredients['暖暖姜'])
    expect(calm.berries).toBe(Math.floor(split.berryHelps * 2 * 10) / 10)
    expect(calm.berryEnergy).toBe(Math.floor(calm.berries * 137))
    expect(calm.skillProcs).toBe(split.skillProcs)
    expect(calm.skillEnergy).toBe(Math.floor(calm.skillProcs * 400))
    expect(slotDrop(POKEDEX.find((poke) => poke.id === 25)!.ingredients, 0, 0)?.amount).toBe(1)
    expect(slotDrop(POKEDEX.find((poke) => poke.id === 25)!.ingredients, 1, 1)?.amount).toBe(2)
    expect(slotDrop(POKEDEX.find((poke) => poke.id === 25)!.ingredients, 2, 0)?.amount).toBe(4)
    const slow = produce({ ...bare, goodCamp: false }, {
      pokeId: 1, level: 1, nature: '勤奋', subskills: [], ingredientSlots: [0, 0, 0], skillLevel: 1, wakeEnergy: 100,
    }, 0)
    expect(slow.helps * 0.019).toBeLessThan(1)
    expect(slow.skillProcs).toBe(1)
    expect(instantInterval(2700, 70, '固执', ['helpS', 'ingM', 'helpingBonus', 'shardBonus'], 5, 100, true, 'taupe', false, 0.05)).toBe(487)
  })
})

describe('energy', () => {
  it('awake ticks lose 1 energy per 10 minutes', () => {
    const curve = energyCurve({ ...settings, meals: false, sleepScore: 80, sleepStart: '23:00', sleepEnd: '07:00' }, {
      pokeId: 1, level: 30, nature: '勤奋', subskills: [], ingredientSlots: [0, 0, 0], skillLevel: 1,
    })
    const awake = curve.filter((p) => !p.asleep)
    expect(awake[0].energy).toBeGreaterThan(awake[10].energy)
  })

  it('meals restore by current energy band', () => {
    expect(mealRecover(10)).toBe(19)
    expect(mealRecover(80)).toBe(7)
    expect(mealRecover(150)).toBe(0)
  })

  it('recovery incense doubles restore, not +5%', () => {
    const input = { pokeId: 1, level: 30, nature: '勤奋', subskills: [] as string[], ingredientSlots: [0, 0, 0] as [number, number, number], skillLevel: 1 }
    const plain = energyCurve({ ...settings, meals: true, incense: false, sleepScore: 80, sleepStart: '23:00', sleepEnd: '07:00', dailySkillHeal: 0 }, input)
    const incense = energyCurve({ ...settings, meals: true, incense: true, sleepScore: 80, sleepStart: '23:00', sleepEnd: '07:00', dailySkillHeal: 0 }, input)
    const mealMin = 12 * 60
    const p = plain.find((x) => !x.asleep && x.minute % 1440 === mealMin)
    const i = incense.find((x) => !x.asleep && x.minute % 1440 === mealMin)
    expect(p && i).toBeTruthy()
    expect((i?.energy ?? 0) - (p?.energy ?? 0)).toBeGreaterThan(3)
  })
})

describe('xp', () => {
  it('reads cumulative table', () => {
    expect(expTo(1)).toBe(0)
    expect(expTo(25)).toBe(8668)
    expect(expTo(70)).toBe(82162)
  })

  it('boost doubles exp and multiplies shards', () => {
    const plain = xpCandy({ from: 1, to: 10, nature: '勤奋' })
    const boost = xpCandy({ from: 1, to: 10, nature: '勤奋', boost: true })
    expect(boost.candy).toBeLessThan(plain.candy)
    expect(boost.shards).toBe(plain.shards * 5)
  })
})

describe('nap island', () => {
  it('is 150 or 600 a day', () => {
    expect(napDailyExp(false)).toBe(150)
    expect(napDailyExp(true)).toBe(600)
  })

  it('halves when retrieved before 7 days', () => {
    expect(napTotalExp(7, false, false)).toBe(1050)
    expect(napTotalExp(6, false, true)).toBe(450)
    expect(napTotalExp(7, true, false)).toBe(4200)
  })

  it('train plan returns days', () => {
    const r = trainPlan({
      from: 1, to: 10, remaining: 0, nature: '勤奋', sleepOnTeam: true, napping: false,
      napDays: 0, earlyRetrieve: false, relaxTicket: false, sleepScore: 100, sleepExpBonus: 0,
      ownedCandy: 0, reserveCandy: 0, dailyCandy: 0, boost: 'none', boostCandy: 0, group: 'normal',
    })
    expect(r.needExp).toBeGreaterThan(0)
    expect(r.days).toBeGreaterThan(0)
  })

  it('stacks sleep EXP bonuses additively, up to a full team', () => {
    const base = {
      from: 1, to: 10, remaining: 0, nature: '勤奋', sleepOnTeam: true, napping: false,
      napDays: 0, earlyRetrieve: false, relaxTicket: false, sleepScore: 100,
      ownedCandy: 0, reserveCandy: 0, dailyCandy: 0, boost: 'none' as const, boostCandy: 0, group: 'normal' as const,
    }
    expect(trainPlan({ ...base, sleepExpBonus: 0 }).dailyExp).toBe(100)
    expect(trainPlan({ ...base, sleepExpBonus: 1 }).dailyExp).toBeCloseTo(114)
    expect(trainPlan({ ...base, sleepExpBonus: 2 }).dailyExp).toBeCloseTo(128)
    expect(trainPlan({ ...base, sleepExpBonus: 9 }).dailyExp).toBeCloseTo(170)
  })

  it('doubles the settled sleep EXP with the growth incense', () => {
    const base = {
      from: 1, to: 10, remaining: 0, nature: '勤奋', sleepOnTeam: true, napping: false,
      napDays: 0, earlyRetrieve: false, relaxTicket: false, sleepScore: 100,
      ownedCandy: 0, reserveCandy: 0, boost: 'none' as const, boostCandy: 0, group: 'normal' as const,
    }
    expect(trainPlan({ ...base, sleepExpBonus: 0, dailyCandy: 0, sleepIncense: true }).dailyExp).toBe(200)
    expect(trainPlan({ ...base, sleepExpBonus: 2, dailyCandy: 0, sleepIncense: true }).dailyExp).toBeCloseTo(256)
    expect(trainPlan({ ...base, sleepExpBonus: 0, dailyCandy: 2, sleepIncense: true }).dailyExp).toBe(250)
  })
})

describe('planners', () => {
  it('ranks non-greengrass islands ahead for a catch goal', () => {
    const [all] = recommendThree([{ id: 'a', pokeId: 1, purpose: 'catch', stars: [] }])
    expect(all.results[0].islandId).not.toBe('greengrass')
    expect(all.results[0].islandId).not.toBe('greenex')
    const grass = all.results.findIndex((pick) => pick.islandId === 'greengrass')
    expect(grass).toBeGreaterThan(0)
  })

  it('charges dream shards from the level before each boosted candy', () => {
    const row = {
      id: 'a', pokeId: 1, method: 'target' as const, start: 1, target: 2,
      use: 0, useAll: false, nature: 'flat' as const, remaining: null,
    }
    expect(calculateCandy(row, 'christmas')).toMatchObject({ candies: 1, shards: 70, level: 2 })
    const shared = planCandy([row, { ...row, id: 'b' }], { '6': 1 }, 'mini')
    expect(shared.results[0].missing).toBe(0)
    expect(shared.results[1].missing).toBe(1)
  })

  it('turns a full score into 8 hours 30 minutes', () => {
    expect(sleepClock(100)).toBe('8小时30分')
    expect(effectiveDrowsyRatio(9935, [10000, 4000])).toBeCloseTo(0.9935)
    expect(effectiveDrowsyRatio(20000, [10000])).toBe(1)
    expect(expectSpecies([
      { pokeId: 1, name: '妙蛙种子', count: 3 },
      { pokeId: 1, name: '妙蛙种子', count: 1 },
      { pokeId: 25, name: '皮卡丘', count: 1 },
    ])).toEqual([
      { pokeId: 1, name: '妙蛙种子', count: 4, percent: 80 },
      { pokeId: 25, name: '皮卡丘', count: 1, percent: 20 },
    ])
    expect(sleepClock(80)).toBe('6小时48分')
  })
})

describe('sleep encounters', () => {
  it('greengrass 0 strength 100 score is 3 and 4 needs ~9653', () => {
    expect(encounterCount('greengrass', 0)).toBe(3)
    expect(energyForCount('greengrass', 100, 1, 4)).toBe(9653)
  })

  it('split sleep can beat a single session at high DP', () => {
    const r = maxEncounters('greengrass', 100, 300000, 1)
    expect(r.best.total).toBeGreaterThanOrEqual(r.single)
  })

  it('only rolls species that actually spawn on taupe, evolved forms included', () => {
    const allowed = new Set(SLEEP_STYLES.filter((style) => style.island === 'taupe' && !style.limited).map((style) => style.pokeId))
    const styles = unlockedStyles('taupe', '没有特征', 1e12, '大师20', 'map')
    expect(new Set(styles.map((style) => style.pokeId))).toEqual(allowed)
    expect(allowed.has(6)).toBe(true)
    const got = sleepExpect('taupe', '没有特征', 1e8, 300, 'normal', { rare: true, seed: 1, rank: '大师20' })
    expect(got.length).toBeGreaterThan(0)
    expect(got.every((row) => allowed.has(row.pokeId))).toBe(true)
    expect(got.some((row) => row.pokeId === 25 || row.pokeId === 19)).toBe(false)
    expect(got.some((row) => row.pokeId === 5 || row.pokeId === 6)).toBe(true)
  })

  it('uses each island snorlax rank curve from RAE', () => {
    expect(rankFromStrength('greengrass', 23385)).toBe('超级1')
    expect(rankFromStrength('cyan', 23385)).toBe('普通4')
    expect(rankFromStrength('greenex', 23385)).toBe('普通1')
    expect(rankFromStrength('greengrass', 3245795)).toBe('大师20')
    expect(rankToNext('greengrass', 3000)).toEqual({ rank: '普通2', need: 118 })
    expect(rankToNext('greengrass', 3245795)).toBeNull()
    expect(rankStrength('greengrass', '超级1')).toBe(23385)
    expect(rankStrength('cyan', '普通2')).toBe(4822)
    for (const island of ['greengrass', 'greenex', 'cyanex'] as const) {
      for (const rank of RANK_ORDER) expect(rankFromStrength(island, rankStrength(island, rank))).toBe(rank)
    }
  })

  it('unlocks styles by the RAE minimum snorlax rank', () => {
    expect(styleUnlockIndex('greengrass', { pokeId: 1, stars: 1 })).toBe(rankIndex('普通2'))
    const low = unlockedStyles('greengrass', '没有特征', 1e12, '普通1', 'map')
    expect(low.some((style) => style.pokeId === 1)).toBe(false)
    expect(low.every((style) => styleUnlockIndex('greengrass', style) === 0)).toBe(true)
    const high = unlockedStyles('greengrass', '没有特征', 1e12, '大师20', 'map')
    expect(high.length).toBe(SLEEP_STYLES.filter((style) => style.island === 'greengrass' && !style.limited).length)
  })

  it('keeps entei on snoozing only unless the event mix is on', () => {
    const rank = '大师20'
    const dozing = sleepExpect('taupe', '淺淺入夢', 1e8, 400, 'normal', { rare: true, seed: 2, rank })
    const slumber = sleepExpect('taupe', '深深入眠', 1e8, 400, 'normal', { rare: true, seed: 3, rank })
    expect(dozing.some((row) => row.pokeId === 244)).toBe(false)
    expect(slumber.some((row) => row.pokeId === 244)).toBe(false)
    const snooze = sleepExpect('taupe', '安然入睡', 1e8, 800, 'normal', { rare: true, seed: 4, rank })
    expect(snooze.some((row) => row.pokeId === 244)).toBe(true)
    expect(sleepExpect('taupe', '安然入睡', 1e8, 800, 'normal', { rare: true, seed: 4, rank: '大师4' }).some((row) => row.pokeId === 244)).toBe(false)
    const mixed = sleepExpect('taupe', '淺淺入夢', 1e8, 400, 'normal', { rare: true, seed: 5, eventMix: true, rank })
    expect(mixed.some((row) => row.pokeId === 244)).toBe(true)
  })
})

describe('cook and team', () => {
  it('falls back to mix when bag is empty', () => {
    const r = cookMeals({}, { ...settings, potSize: 15 }, 1, false)
    expect(r.meals[0].mix).toBe(true)
  })

  it('cooks a matching recipe when ingredients exist', () => {
    const r = cookMeals({ 特选苹果: 7 }, { ...settings, potSize: 15, mealCategory: 'curry' }, 1, false)
    expect(r.meals[0].mix).toBe(false)
    expect(r.meals[0].name).toContain('蘋果咖哩')
  })

  it('team total equals parts plus cooking', () => {
    const roster = [
      { uid: 'a', pokeId: 1, level: 30, nature: '勤奋', subskills: [], ingredientSlots: [0, 0, 0] as [number, number, number], skillLevel: 1, name: '', napping: false },
      { uid: 'b', pokeId: 25, level: 30, nature: '勤奋', subskills: [], ingredientSlots: [0, 0, 0] as [number, number, number], skillLevel: 1, name: '', napping: false },
    ]
    const t = teamProduce({ ...settings, potSize: 21 }, roster)
    const part = t.members.reduce((s, m) => s + m.berryEnergy + m.skillEnergy, 0)
    expect(t.totalEnergy).toBe(part + t.cookEnergy)
    expect(t.members.length).toBe(2)
    expect(t.events).toBeDefined()
  })

  it('recipe level raises cook energy', () => {
    expect(recipeLevelMult(1)).toBe(1)
    expect(recipeLevelMult(11)).toBeCloseTo(1.2)
    const a = cookEnergy('特選蘋果咖哩', 0, false, 1)
    const b = cookEnergy('特選蘋果咖哩', 0, false, 11)
    expect(b).toBeGreaterThan(a)
  })

  it('uses per-recipe levels', () => {
    const bag = { 特选苹果: 7 }
    const low = cookMeals(bag, { ...settings, potSize: 15, mealCategory: 'curry', recipeLevels: { 特選蘋果咖哩: 1 } }, 1, false)
    const high = cookMeals(bag, { ...settings, potSize: 15, mealCategory: 'curry', recipeLevels: { 特選蘋果咖哩: 60 } }, 1, false)
    expect(high.meals[0].energy).toBeGreaterThan(low.meals[0].energy)
  })
})

describe('sleep draw realism', () => {
  it('labels shiny rates from Serebii', () => {
    expect(shinyRateLabel(false)).toContain('3/1000')
    expect(shinyRateLabel(true)).toContain('3/40')
  })

  it('draws Raikou on greenex only when the sleep type matches', () => {
    const power = Math.max(...SLEEP_STYLES.filter(s => s.island === 'greenex' && s.pokeId === 243).map(s => s.dpr))
    const dozing = sleepExpect('greenex', '淺淺入夢', power, 200, 'normal', { rare: true, seed: 8, undiscoveredBoost: false })
    expect(dozing.some((row) => row.pokeId === 243)).toBe(false)
    const snooze = sleepExpect('greenex', '安然入睡', power, 600, 'normal', { rare: true, seed: 9, undiscoveredBoost: false })
    expect(snooze.some((row) => row.rare && row.name === '雷公')).toBe(true)
  })
})

describe('skill timeline', () => {
  const healer = { uid: 'h', pokeId: 40, level: 30, nature: '勤奋', subskills: [], ingredientSlots: [0, 0, 0] as [number, number, number], skillLevel: 6, name: '', napping: false }
  const berry = { uid: 'b', pokeId: 1, level: 30, nature: '勤奋', subskills: [], ingredientSlots: [0, 0, 0] as [number, number, number], skillLevel: 1, name: '', napping: false }
  const support = { ...healer, uid: 's', pokeId: 59 }
  const accel = { ...healer, uid: 'a', pokeId: 243 }

  it('classifies healer and accel skills', () => {
    expect(skillKind('活力全體療癒S')).toBe('healAll')
    expect(skillKind('幫手支援S')).toBe('support')
    expect(skillKind('幫手加速（属性）')).toBe('typeAccel')
    expect(skillKind('幫手加速')).toBe('helpAccel')
  })

  it('heals the team at proc time', () => {
    const sim = simulateTeam({ ...settings, meals: false, dailySkillHeal: 0 }, [healer, berry], 0, { alwaysProc: true })
    expect(sim.events.some((e) => e.kind === 'healAll')).toBe(true)
  })

  it('helper support adds extra teammate helps', () => {
    const withSupport = simulateTeam({ ...settings, meals: false }, [support, berry], 0, { alwaysProc: true })
    const solo = simulateTeam({ ...settings, meals: false }, [berry], 0, { alwaysProc: true })
    expect(withSupport.members[1]!.helps).toBeGreaterThan(solo.members[0]!.helps)
    expect(withSupport.events.some((e) => e.kind === 'support')).toBe(true)
  })

  it('lists every RAE main skill and matches the pokedex names', () => {
    expect(new Set(MAIN_SKILLS.map((skill) => skill.id)).size).toBe(40)
    expect(MAIN_SKILLS.find((skill) => skill.id === 1)?.levels[0]).toEqual(['400'])
    expect(MAIN_SKILLS.find((skill) => skill.id === 1)?.levels[6]).toEqual(['3212'])
    const names = new Set(POKEDEX.map((poke) => poke.mainSkill))
    for (const name of names) {
      expect(MAIN_SKILLS.some((skill) => skill.aliases.includes(name)), name).toBe(true)
    }
  })

  it('uses the RAE map spawns and the good-night ribbon', () => {
    const grass = ISLANDS.find((island) => island.id === 'greengrass')!
    const cyan = ISLANDS.find((island) => island.id === 'cyan')!
    expect(grass.species).toContain(1)
    expect(grass.species).not.toContain(2)
    expect(cyan.species).toContain(7)
    expect(cyan.species).not.toContain(1)
    expect(stagesLeft(172)).toBe(2)
    expect(stagesLeft(26)).toBe(0)
    expect(ribbonBonus(500, 2)).toEqual({ carry: 3, speedCut: 0.11 })
    expect(ribbonBonus(2000, 1)).toEqual({ carry: 8, speedCut: 0.12 })
    expect(ribbonBonus(2000, 0)).toEqual({ carry: 8, speedCut: 0 })
    expect(compareHelpingBonus(30, ['helpingBonus', '', '', '', ''], 0)).toBe(5)
    expect(compareHelpingBonus(30, ['helpS', '', '', '', ''], 1)).toBe(1)
    expect(compareHelpingBonus(5, ['helpingBonus', '', '', '', ''], 0)).toBe(0)
    expect(exclusiveSubskills([{ id: 'helpS' }, { id: 'helpM' }], ['helpS', ''], 1).map((item) => item.id)).toEqual(['helpM'])
  })

  it('finds pokemon by simplified and english names', () => {
    const bulba = POKEDEX.find((poke) => poke.id === 1)!
    const squirtle = POKEDEX.find((poke) => poke.id === 7)!
    expect(pokeHit(bulba, '妙蛙种子')).toBe(true)
    expect(pokeHit(bulba, 'Bulbasaur')).toBe(true)
    expect(pokeHit(squirtle, '杰尼龟')).toBe(true)
    expect(pokeHit(bulba, 'Charizard')).toBe(false)
    expect(POKEDEX.every((poke) => englishName(poke.id).length > 0)).toBe(true)
    const darkrai = POKEDEX.find((poke) => poke.id === 491)!
    expect(pokeHit(darkrai, '达克莱伊')).toBe(true)
    expect(pokeHit(darkrai, '達克萊伊')).toBe(true)
    expect(pokeHit(darkrai, 'Darkrai')).toBe(true)
  })

  it('skips sleep styles already in the dex', () => {
    const stars = [...new Set(SLEEP_STYLES.filter((style) => style.pokeId === 1).map((style) => style.stars))].sort((a, b) => a - b)
    expect(stars.length).toBeGreaterThan(1)
    expect(SLEEP_STYLES.find((style) => style.pokeId === 25 && style.stars === 1)?.styleName).toBe('窩起來睡')
    expect(SLEEP_STYLES.find((style) => style.pokeId === 1 && style.stars === 1)?.styleName).toBe('光合作用睡')
    expect(SLEEP_STYLES.find((style) => style.pokeId === 1 && style.stars === 4)?.styleName).toBe('大肚上睡')
    expect(SLEEP_STYLES.find((style) => style.pokeId === 150 && style.stars === 1)?.styleName).toBe('立單膝睡')
    expect(SLEEP_STYLES.some((style) => style.pokeId === 150 && style.stars === 4)).toBe(false)
    const mewtwo = SLEEP_STYLES.filter((style) => style.pokeId === 150 && style.stars === 5 && style.island === 'taupe')
    expect(mewtwo.map((style) => style.styleName)).toEqual(['不耐煩睡', '心靈平靜睡'])
    expect(mewtwo.every((style) => style.limited)).toBe(true)
    expect(SLEEP_STYLES.some((style) => style.pokeId === 380 && style.stars === 5 && style.island === 'cyan' && style.styleName === '心繫夥伴睡')).toBe(true)
    expect(unlockedStyles('taupe', '没有特征', 1e12, '大师1', 'map').some((style) => style.limited)).toBe(false)
    const taupeDitto = SLEEP_STYLES.filter((style) => style.pokeId === 132 && style.stars === 4 && style.island === 'taupe')
    expect(taupeDitto.map((style) => style.styleName)).toEqual(['大肚上睡', '小火龍睡', '夢幻睡'])
    expect(taupeDitto.map((style) => style.styleId)).toEqual([371, 324, 858])
    expect(new Set(taupeDitto.map((style) => styleKey(style.pokeId, style.stars, style.styleId))).size).toBe(3)
    expect(SLEEP_STYLES.some((style) => style.pokeId === 132 && style.stars === 3 && style.island === 'taupe')).toBe(false)
    expect(SLEEP_STYLES.filter((style) => style.pokeId === 132 && style.stars === 4 && style.island === 'greengrass').map((style) => style.styleName)).toEqual(['大肚上睡', '妙蛙種子睡', '夢幻睡'])
    expect(SLEEP_STYLES.find((style) => style.pokeId === 244 && style.stars === 3)?.styleName).toBe('火山睡')
    const keys = stars.map((star) => styleKey(1, star))
    const goal = { id: 'a', pokeId: 1, purpose: 'sleep' as const, stars }
    expect(sleepdexState(1, keys).complete).toBe(true)
    const all = resolvedSleepdex({ sleepdexMode: 'all', sleepdex: [], sleepdexExcluded: [] })
    expect(all).toEqual(wallStyleKeys())
    expect(all).toContain(styleKey(244, 1))
    const dropped = resolvedSleepdex({ sleepdexMode: 'all', sleepdex: [], sleepdexExcluded: [styleKey(244, 1)] })
    expect(dropped).not.toContain(styleKey(244, 1))
    expect(resolvedSleepdex({ sleepdexMode: 'list', sleepdex: ['1-1'] })).toEqual(['1-1'])
    expect(recommendThree([goal], keys).find((col) => col.id === 'sleep')!.results).toHaveLength(0)
    const partial = recommendThree([goal], [keys[0]!]).find((col) => col.id === 'sleep')!
    const hit = partial.results.flatMap((pick) => pick.sleepGroups.flatMap((group) => group.matches.flatMap((match) => match.stars)))
    expect(hit).not.toContain(stars[0])
    expect(hit).toContain(stars[1])
  })

  it('draws the chosen ingredient spread at each level', () => {
    const poke = POKEDEX.find((item) => item.id === 1)!
    const cols = spreadColumns(poke.ingredients, [0, 1, 2])
    expect(cols.map((col) => col.map((cell) => cell.amount))).toEqual(ingredientColumns(poke.ingredients).map((col) => col.map((cell) => cell.amount)))
    expect(nextIngredientSlot(3, 0, 0)).toBe(0)
    expect(nextIngredientSlot(3, 1, 1)).toBe(0)
    expect(setIngredientChoice(3, [0, 1, 2], 1, 1)).toBeNull()
    expect(setIngredientChoice(3, [0, 1, 2], 1, 0)).toEqual([0, 0, 2])
    expect(setIngredientChoice(3, [0, 1, 2], 2, 0)).toEqual([0, 1, 0])
    expect(setIngredientChoice(3, [0, 1, 2], 0, 1)).toBeNull()
    expect(wakeFromHours(8.5)).toBe(100)
    expect(wakeFromHours(0)).toBeUndefined()
  })

  it('type accel only speeds same berry', () => {
    const same = simulateTeam({ ...settings, meals: false, berries: ['萄葡果'] }, [accel, { ...berry, pokeId: 25 }], 0, { alwaysProc: true })
    const other = simulateTeam({ ...settings, meals: false, berries: ['萄葡果'] }, [accel, berry], 0, { alwaysProc: true })
    expect(same.events.some((e) => e.kind === 'typeAccel')).toBe(true)
    expect(same.members[1]!.helps).toBeGreaterThanOrEqual(other.members[1]!.helps)
  })
})

