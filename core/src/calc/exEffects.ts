import type { Settings } from '../types'
import { islandById } from './data'
export function isExIsland(id: string) { return id === 'greenex' || id === 'cyanex' }
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
    berryMultiplier: favored ? weekly === 'berries' ? 2.4 : 2 : 1,
    ingredientExtra: weekly === 'ingredients' ? specialty === '食材型' ? 1.5 : 1 : 0,
    skillMultiplier: weekly === 'skills' ? 1.25 : 1,
    speed: main && settings.exBuff !== false ? island?.helpFavored ?? 1 : ex && !favored && settings.exDebuff !== false ? island?.helpUnfavored ?? 1 : 1,
    skillLevels: main && settings.exBuff !== false ? 1 : 0,
  }
}
