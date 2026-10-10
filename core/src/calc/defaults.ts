import type { IslandId, Settings } from '../types'
import berries from '../data/berries.json'

export const BERRY_PREF_ISLANDS: IslandId[] = ['greengrass', 'greenex', 'cyanex']

export function canPickBerries(island: IslandId): boolean {
  return BERRY_PREF_ISLANDS.includes(island)
}

export const defaultSettings = (): Settings => ({
  island: 'greengrass',
  berries: ['金枕果', '柿仔果', '萄葡果'],
  areaBonus: 0,
  islandBonuses: {},
  exBuff: true,
  exDebuff: true,
  exWeeklyBonus: 'none',
  sleepStart: '23:00',
  sleepEnd: '07:30',
  sleepScore: 100,
  meals: true,
  incense: false,
  dailySkillHeal: 0,
  goodCamp: false,
  helpingBonus: 0,
  mealCategory: 'curry',
  potSize: 15,
  period: 'day',
  eventMult: 1,
  sleepEventMix: 'some',
  recipeLevels: {},
  whistleHelps: 0,
  shinyUp: false,
  sundayPot: false,
})

export const idealSettings = (): Settings => ({
  ...defaultSettings(),
  sleepStart: '21:30',
  sleepEnd: '08:00',
  sleepScore: 100,
  meals: true,
  goodCamp: true,
})

export const work18Settings = (): Settings => ({
  ...defaultSettings(),
  sleepStart: '00:00',
  sleepEnd: '06:00',
  sleepScore: 88,
  meals: true,
})

export const helpMaxSettings = (): Settings => ({
  ...defaultSettings(),
  helpingBonus: 5,
})

export const EX_MAIN = ['桃桃果', '椰木果', '橙橙果']

/** EX2: the first entry is its main berry; the other entries are distinct secondary berries. */
export function normalizeEx2Berries(selected: readonly string[]): string[] {
  const main = selected.find(name => EX_MAIN.includes(name)) ?? EX_MAIN[0]!
  const secondary = [...new Set(selected)].filter(name => name !== main && berries.some(berry => berry.name === name)).slice(0, 2)
  return [main, ...secondary]
}

export function mergeSettings(saved: (Partial<Settings> & { recipeLevel?: number, goodNightRibbon?: boolean }) | null | undefined): Settings {
  const base = defaultSettings()
  if (!saved) return base
  const { recipeLevel: _legacy, goodNightRibbon: _ribbon, ...rest } = saved
  const merged: Settings = {
    ...base,
    ...rest,
    sleepEventMix: saved.sleepEventMix === 'all' ? 'all' : 'some',
    berries: saved.berries?.length ? saved.berries : base.berries,
    recipeLevels: { ...(saved.recipeLevels ?? {}) },
  }
  merged.exWeeklyBonus = ['berries', 'ingredients', 'skills'].includes(saved.exWeeklyBonus ?? '') ? saved.exWeeklyBonus : 'none'
  merged.islandBonuses = { ...saved.islandBonuses }
  if (merged.islandBonuses[merged.island] == null) merged.islandBonuses[merged.island] = Math.min(0.85, Math.max(0, merged.areaBonus || 0))
  merged.areaBonus = Math.min(0.85, Math.max(0, merged.islandBonuses[merged.island] ?? 0))
  if (merged.island === 'cyanex') merged.berries = normalizeEx2Berries(merged.berries)
  return merged
}
