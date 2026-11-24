import { EVENT_PARAMETERS } from './activities'

export type EventMix = 'off' | 'some' | 'all'
export const MIX_OPTIONS = EVENT_PARAMETERS.sleep.mixOptions as { value: EventMix, label: string }[]

/** Legacy flags represent the partial mixed-type event. */
export function normalizeEventMix(value: EventMix | boolean | undefined): EventMix {
  return value === true || value === 'some' ? 'some' : value === 'all' ? 'all' : 'off'
}

/** RAE Worker event-balanced table. */
const mixedSlots: Readonly<Record<number, number>> = { 3: 3, 4: 3, 5: 4, 6: 5, 7: 5, 8: 6 }
export function openSleepSlots(count: number, mode: EventMix | boolean | undefined): number {
  const mix = normalizeEventMix(mode)
  if (mix === 'off') return 0
  return mix === 'all' ? count : mixedSlots[count] ?? Math.ceil(0.7 * count)
}

export const UP_WEIGHTS = EVENT_PARAMETERS.sleep.upWeights
export const RAE_RESTRICTED_LEADER_CHANCE = EVENT_PARAMETERS.sleep.raeRestrictedLeaderChance
type EncounterModifier = 'blocked' | 'small' | 'mid' | 'large'
export type PokemonUps = Partial<Record<EncounterModifier, readonly number[]>>

/** RAE custom and preset rate changes are separate modes. */
export function sleepEncounterWeight(pokeId: number, activityWeight = UP_WEIGHTS.normal, ups?: PokemonUps): number {
  if (!ups) return activityWeight
  for (const tier of ['blocked', 'large', 'mid', 'small'] as const) {
    if (ups[tier]?.includes(pokeId)) return UP_WEIGHTS[tier]
  }
  return UP_WEIGHTS.normal
}

export function eventMixLabel(value: EventMix | boolean | undefined): string {
  const label = MIX_OPTIONS.find(option => option.value === normalizeEventMix(value))!.label
  return label === '关闭' ? '不混合' : label
}
