import ruleCatalogs from '../data/rule-catalogs.json'
import ruleParameters from '../data/rule-parameters.json'
import clientFactoryDefaults from '../data/client-defaults.json'
import extracted0 from '../data/calc-tables.json'
import { cloneData } from './dataClone'
import type { IslandId, Settings } from '../types'
import berries from '../data/berries.json'
const defaults_config_extracted0 = extracted0.modules.defaults
const factory_defaults_config_clientFactoryDefaults = clientFactoryDefaults.modules.factory_defaults
const defaults_config_ruleCatalogs = ruleCatalogs.modules.defaults
const defaults_mergeSettings_ruleParameters = ruleParameters.modules.defaults.mergeSettings


export const BERRY_PREF_ISLANDS: IslandId[] = (cloneData(defaults_config_extracted0.BERRY_PREF_ISLANDS) as unknown as IslandId[])

export function canPickBerries(island: IslandId): boolean {
  return BERRY_PREF_ISLANDS.includes(island)
}

export const defaultSettings = (): Settings => ((cloneData(factory_defaults_config_clientFactoryDefaults["defaultSettings"]) as unknown as Settings))

export const idealSettings = (): Settings => ({
  ...defaultSettings(),
  sleepStart: (factory_defaults_config_clientFactoryDefaults["idealSettings_sleepStart"] as "21:30"),
  sleepEnd: (factory_defaults_config_clientFactoryDefaults["idealSettings_sleepEnd"] as "08:00"),
  sleepScore: (factory_defaults_config_clientFactoryDefaults["idealSettings_sleepScore"] as 100),
  meals: (factory_defaults_config_clientFactoryDefaults["idealSettings_meals"] as true),
  goodCamp: (factory_defaults_config_clientFactoryDefaults["idealSettings_goodCamp"] as true),
})

export const work18Settings = (): Settings => ({
  ...defaultSettings(),
  sleepStart: (factory_defaults_config_clientFactoryDefaults["work18Settings_sleepStart"] as "00:00"),
  sleepEnd: (factory_defaults_config_clientFactoryDefaults["work18Settings_sleepEnd"] as "06:00"),
  sleepScore: (factory_defaults_config_clientFactoryDefaults["work18Settings_sleepScore"] as 88),
  meals: (factory_defaults_config_clientFactoryDefaults["work18Settings_meals"] as true),
})

export const helpMaxSettings = (): Settings => ({
  ...defaultSettings(),
  helpingBonus: (factory_defaults_config_clientFactoryDefaults["helpMaxSettings_helpingBonus"] as 5),
})

export const EX_MAIN = cloneData(defaults_config_extracted0.EX_MAIN)

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
  merged.exWeeklyBonus = defaults_config_ruleCatalogs.mergeSettingsList0.values.includes(saved.exWeeklyBonus ?? '') ? saved.exWeeklyBonus : 'none'
  merged.islandBonuses = { ...saved.islandBonuses }
  if (merged.islandBonuses[merged.island] == null) merged.islandBonuses[merged.island] = Math.min(defaults_mergeSettings_ruleParameters.areaBonusCap, Math.max(0, merged.areaBonus || 0))
  merged.areaBonus = Math.min(defaults_mergeSettings_ruleParameters.areaBonusCap, Math.max(0, merged.islandBonuses[merged.island] ?? 0))
  if (merged.island === 'cyanex') merged.berries = normalizeEx2Berries(merged.berries)
  return merged
}
