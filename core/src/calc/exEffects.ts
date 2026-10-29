import ruleParameters from '../data/rule-parameters.resource'
import type { Settings } from '../types'
import { islandById } from './data'
const exEffects_exEffects_ruleParameters = ruleParameters.modules.exEffects.exEffects

export function isExIsland(id: string) { return exEffects_exEffects_ruleParameters.exIslandIds.includes(id) }
// Weekly ingredient specialty bonus uses the research expectation: +1, with 50% chance of another +1.
// https://wikiwiki.jp/poke_sleep/リサーチフィールド/EXモード
/** Only the main berry receives speed/+1 skill; secondary berries remain favored without main bonuses. */
export function exEffects(settings: Settings, berry: string, specialty = '') {
  const island = islandById(settings.island)
  const ex = isExIsland(settings.island)
  const main = ex && settings.berries[0] === berry
  const favored = settings.berries.includes(berry)
  const weekly = ex && favored ? settings.exWeeklyBonus : 'none'
  return {
    berryMultiplier: favored ? weekly === 'berries' ? exEffects_exEffects_ruleParameters.weeklyBerryMultiplier : exEffects_exEffects_ruleParameters.favoredBerryMultiplier : 1,
    ingredientExtra: weekly === 'ingredients' ? specialty === '食材型' ? exEffects_exEffects_ruleParameters.ingredientSpecialistExtra : exEffects_exEffects_ruleParameters.normalIngredientExtra : 0,
    skillMultiplier: weekly === 'skills' ? exEffects_exEffects_ruleParameters.weeklySkillMultiplier : 1,
    speed: main && settings.exBuff !== false ? island?.helpFavored ?? 1 : ex && !favored && settings.exDebuff !== false ? island?.helpUnfavored ?? 1 : 1,
    skillLevels: main && settings.exBuff !== false ? exEffects_exEffects_ruleParameters.mainSkillLevelBonus : 0,
    carryExtra: main && settings.island === exEffects_exEffects_ruleParameters.carryIslandId && settings.exBuff !== false ? exEffects_exEffects_ruleParameters.cyanExCarryExtra : 0,
  }
}
