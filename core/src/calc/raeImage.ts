import { BERRIES, berryByName } from './data'

import { localImage } from '#platform/images'

export function berryImageUrl(name: string): string {
  const berry = berryByName(name)
  const index = berry ? BERRIES.indexOf(berry) : -1
  return index >= 0 ? localImage(`berry/${index + 1}.webp`) : ''
}

export function ingredientImageUrl(id: number): string {
  return localImage(`ingredient/${id}.webp`)
}

/** RAE 副技能图编号，见 https://pks.raenonx.cc/zh/stats/subskill */
const SUBSKILL_IMAGE: Record<string, number> = {
  sleepExp: 1,
  helpingBonus: 2,
  energyRecover: 3,
  shardBonus: 4,
  researchExp: 5,
  helpS: 6,
  helpM: 7,
  berryS: 8,
  invS: 9,
  invM: 10,
  skillLevelS: 11,
  ingS: 12,
  ingM: 13,
  skillS: 14,
  skillM: 15,
  skillLevelM: 18,
  invL: 19,
}

export function subskillImageUrl(id: string): string {
  const image = SUBSKILL_IMAGE[id]
  return image ? localImage(`subSkill/${image}.webp`) : ''
}

/** RAE 主技能图编号，见 https://pks.raenonx.cc/zh/mainskill/info */
export function mainSkillImageUrl(id: number): string {
  return id > 0 ? localImage(`mainSkill/${id}.webp`) : ''
}

/** 南瓜精 / 南瓜怪人的体型档，对应 RAE 文件名 710-A2。 */
const POKEMON_FILE: Record<number, string> = {
  71002: '710-A2',
  71003: '710-A3',
  71004: '710-A4',
  71102: '711-A2',
  71103: '711-A3',
  71104: '711-A4',
}

export function pokemonFile(id: number): string {
  return POKEMON_FILE[id] ?? String(id)
}

export function pokemonIconUrl(id: number): string {
  return localImage(`pokemon/icons/${pokemonFile(id)}.webp`)
}

/** 异色图标，没有异色的宝可梦会是空字符串。 */
export function pokemonShinyIconUrl(id: number): string {
  return localImage(`pokemon/icons/shiny/${pokemonFile(id)}.webp`)
}

export function hasShiny(id: number): boolean {
  return Boolean(pokemonShinyIconUrl(id))
}

export function pokemonPortraitUrl(id: number): string {
  return localImage(`pokemon/portrait/${pokemonFile(id)}.webp`)
}

/** 异色全身图，没有异色的宝可梦会是空字符串。 */
export function pokemonShinyPortraitUrl(id: number): string {
  return localImage(`pokemon/portrait/shiny/${pokemonFile(id)}.webp`)
}

const MEAL_ID: Record<string, number> = {
  拌拌咖哩: 1000,
  特選蘋果咖哩: 1001,
  炙燒尾肉咖哩: 1002,
  太陽之力番茄咖哩: 1003,
  絕對睡眠奶油咖哩: 1004,
  辣味蔥勁十足咖哩: 1005,
  蘑菇孢子咖哩: 1006,
  親子愛咖哩: 1007,
  吃飽飽起司肉排咖哩: 1008,
  窩心白醬濃湯: 1009,
  單純白醬濃湯: 1010,
  豆製肉排咖哩: 1011,
  寶寶甜蜜咖哩: 1012,
  忍者咖哩: 1013,
  日照炸肉排咖哩: 1014,
  入口即化蛋捲咖哩: 1015,
  健美豆子咖哩: 1016,
  柔軟玉米濃湯: 1017,
  煉獄玉米乾咖哩: 1018,
  迷昏拳辣味咖哩: 1019,
  覺醒力量濃湯: 1020,
  居合斬壽喜燒咖哩: 1021,
  扮演南瓜精濃湯: 1022,
  茂盛焗烤酪梨: 1023,
  萌綠咖哩麵包: 1024,
  彈跳咖哩烏龍麵: 1025,
  拌拌沙拉: 2000,
  呆呆獸尾巴的胡椒沙拉: 2001,
  蘑菇孢子沙拉: 2002,
  撥雪凱撒沙拉: 2003,
  貪吃鬼洋芋沙拉: 2004,
  濕潤豆腐沙拉: 2005,
  蠻力豪邁沙拉: 2006,
  豆製火腿沙拉: 2007,
  好眠番茄沙拉: 2008,
  哞哞起司番茄沙拉: 2009,
  心情不定肉沙拉淋巧克力醬: 2010,
  過熱沙拉: 2011,
  特選蘋果沙拉: 2012,
  免疫蔥花沙拉: 2013,
  迷人蘋果起司沙拉: 2014,
  忍者沙拉: 2015,
  熱風豆腐沙拉: 2016,
  萌綠沙拉: 2017,
  冥想香甜沙拉: 2018,
  亂擊玉米沙拉: 2019,
  十字切碎丁沙拉: 2020,
  不服輸咖啡沙拉: 2021,
  落英繽紛含羞草蛋沙拉: 2022,
  蘋果酸優格沙拉: 2023,
  碎裂酪梨沙拉: 2024,
  重踏酪梨醬脆片: 2025,
  大塊滿滿熱水沙拉: 2026,
  拌拌果汁: 3000,
  熟成甜薯燒: 3001,
  不屈薑餅: 3002,
  特選蘋果汁: 3003,
  手製勁爽汽水: 3004,
  火花薑茶: 3005,
  胖丁百匯布丁: 3006,
  惡魔之吻水果牛奶: 3007,
  祈願蘋果派: 3008,
  橙夢的排毒茶: 3009,
  甜甜香氣巧克力蛋糕: 3010,
  哞哞熱鮮奶: 3011,
  輕裝豆香蛋糕: 3012,
  活力蛋白飲: 3013,
  我行我素蔬菜汁: 3014,
  大馬拉薩達: 3015,
  大力士豆香甜甜圈: 3016,
  大爆炸爆米花: 3017,
  茶會玉米司康: 3018,
  花瓣舞巧克力塔: 3019,
  花之禮馬卡龍: 3020,
  早起咖啡凍: 3021,
  電光香料可樂: 3022,
  破格玉米香提拉米蘇: 3023,
  土王閃電泡芙: 3024,
  心跳加速鬼面鬆餅: 3025,
  青草攪拌器冰沙: 3026,
  採蜜巧克力格子鬆餅: 3027,
}

export function mealId(name: string): number | undefined {
  return MEAL_ID[name]
}

export function mealImageUrl(name: string): string {
  const id = MEAL_ID[name]
  if (!id) return ''
  return localImage(`meal/${id}.webp`)
}
