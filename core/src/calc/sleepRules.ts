import ruleCatalogs from '../data/rule-catalogs.json'
/** Wiki research model; UP multipliers are simulator assumptions, not confirmed game rates. */
export type EventMix = 'off' | 'some' | 'all'
import { EVENT_PARAMETERS } from './activities'
const sleepRules_config_ruleCatalogs = ruleCatalogs.modules.sleepRules

export const MIX_OPTIONS = EVENT_PARAMETERS.sleep.mixOptions as { value: EventMix, label: string }[]
/** Legacy booleans: true meant the partial cross-type event. */
export function normalizeEventMix(value: EventMix | boolean | undefined): EventMix {
  return value === true || value === 'some' ? 'some' : value === 'all' ? 'all' : 'off'
}
export function openSleepSlots(count: number, mode: EventMix | boolean | undefined): number {
  const mix = normalizeEventMix(mode)
  return mix === 'off' ? 0 : mix === 'all' ? count : count - Math.floor(count * EVENT_PARAMETERS.sleep.sameTypeShare)
}
export const UP_WEIGHTS = EVENT_PARAMETERS.sleep.upWeights
export type UpTier = keyof typeof UP_WEIGHTS
export type PokemonUps = Partial<Record<UpTier, readonly number[]>>
export const MOON_POKEMON = EVENT_PARAMETERS.sleep.moonPokemon
/** These multipliers correspond to the explicitly named Good Sleep Day options in the UI. */
export function moonUp(mult = 1): UpTier | undefined {
  return EVENT_PARAMETERS.sleep.moonTiers.find(row => row.multipliers.includes(mult))?.tier as UpTier | undefined
}
export function pokemonSleepWeight(pokeId: number, mult = 1, ups: PokemonUps = {}): number {
  let weight = 1
  for (const tier of (sleepRules_config_ruleCatalogs.pokemonSleepWeightList0.values as unknown as readonly ["small","mid","large"])) {
    if (ups[tier]?.includes(pokeId)) weight *= UP_WEIGHTS[tier]
  }
  const moon = moonUp(mult)
  // The automatic moon group is the same tier, not an additional copy of that tier.
  if (moon && ((MOON_POKEMON as unknown as readonly number[])).includes(pokeId) && !ups[moon]?.includes(pokeId)) weight *= UP_WEIGHTS[moon]
  return weight
}
export function moonUpLabel(mult: number): string {
  const tier = moonUp(mult)
  return tier ? `${EVENT_PARAMETERS.sleep.moonPokemonLabel}：` + (tier === 'mid' ? '中 UP' : '大 UP') + ` ×${UP_WEIGHTS[tier]}（模拟权重）` : '当前无好眠日宝可梦 UP'
}
export function eventMixLabel(value: EventMix | boolean | undefined): string {
  return MIX_OPTIONS.find(option => option.value === normalizeEventMix(value))!.label
}
