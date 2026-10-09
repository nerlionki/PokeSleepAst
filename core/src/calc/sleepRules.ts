/** Wiki research model; UP multipliers are simulator assumptions, not confirmed game rates. */
export type EventMix = 'off' | 'some' | 'all'
export const MIX_OPTIONS = [
  { value: 'off', label: '关闭' }, { value: 'some', label: '少量' }, { value: 'all', label: '大量' },
] as const
/** Legacy booleans: true meant the partial cross-type event. */
export function normalizeEventMix(value: EventMix | boolean | undefined): EventMix {
  return value === true || value === 'some' ? 'some' : value === 'all' ? 'all' : 'off'
}
export function openSleepSlots(count: number, mode: EventMix | boolean | undefined): number {
  const mix = normalizeEventMix(mode)
  return mix === 'off' ? 0 : mix === 'all' ? count : count - Math.floor(count * 0.4)
}
export const UP_WEIGHTS = { small: 4, mid: 6, large: 9 } as const
export type UpTier = keyof typeof UP_WEIGHTS
export type PokemonUps = Partial<Record<UpTier, readonly number[]>>
export const MOON_POKEMON = [173, 35, 36] as const
/** These multipliers correspond to the explicitly named Good Sleep Day options in the UI. */
export function moonUp(mult = 1): UpTier | undefined {
  return mult === 1.5 ? 'mid' : [2, 2.5, 3, 4].includes(mult) ? 'large' : undefined
}
export function pokemonSleepWeight(pokeId: number, mult = 1, ups: PokemonUps = {}): number {
  let weight = 1
  for (const tier of ['small', 'mid', 'large'] as const) {
    if (ups[tier]?.includes(pokeId)) weight *= UP_WEIGHTS[tier]
  }
  const moon = moonUp(mult)
  // The automatic moon group is the same tier, not an additional copy of that tier.
  if (moon && (MOON_POKEMON as readonly number[]).includes(pokeId) && !ups[moon]?.includes(pokeId)) weight *= UP_WEIGHTS[moon]
  return weight
}
export function moonUpLabel(mult: number): string {
  const tier = moonUp(mult)
  return tier ? '皮宝宝、皮皮、皮可西：' + (tier === 'mid' ? '中 UP ×6' : '大 UP ×9') + '（模拟权重）' : '当前无好眠日宝可梦 UP'
}
export function eventMixLabel(value: EventMix | boolean | undefined): string {
  return MIX_OPTIONS.find(option => option.value === normalizeEventMix(value))!.label
}
