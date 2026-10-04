import type { IslandId, Settings } from '../types'

export const BERRY_PREF_ISLANDS: IslandId[] = ['greengrass', 'greenex', 'cyanex']

export function canPickBerries(island: IslandId): boolean {
  return BERRY_PREF_ISLANDS.includes(island)
}

export const defaultSettings = (): Settings => ({
  island: 'greengrass',
  berries: ['金枕果', '柿仔果', '萄葡果'],
  areaBonus: 0,
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

export function mergeSettings(saved: (Partial<Settings> & { recipeLevel?: number, goodNightRibbon?: boolean }) | null | undefined): Settings {
  const base = defaultSettings()
  if (!saved) return base
  const { recipeLevel: _legacy, goodNightRibbon: _ribbon, ...rest } = saved
  return {
    ...base,
    ...rest,
    berries: saved.berries?.length ? saved.berries : base.berries,
    recipeLevels: { ...(saved.recipeLevels ?? {}) },
  }
}
