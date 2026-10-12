/** 用户确认的同队限制；与睡眠抽选中的特殊宝可梦限制分别维护。 */
export const SPECIAL_TEAM_POKEMON = new Set([150, 151, 243, 244, 245, 380, 381, 488, 491])
export const SPECIAL_TEAM_RULE = '每队最多 1 只特殊宝可梦；仅允许各 1 只拉帝亚斯和拉帝欧斯一起上场，同种不能重复。'

export type SpecialTeamState = 'none' | 'other' | 'latias' | 'latios' | 'pair'

export function nextSpecialTeamState(state: SpecialTeamState, pokeId: number): SpecialTeamState | null {
  if (!SPECIAL_TEAM_POKEMON.has(pokeId)) return state
  if (state === 'none') return pokeId === 380 ? 'latias' : pokeId === 381 ? 'latios' : 'other'
  if (state === 'latias' && pokeId === 381 || state === 'latios' && pokeId === 380) return 'pair'
  return null
}

export function teamRestrictionError(team: readonly { pokeId: number }[]): string {
  let state: SpecialTeamState = 'none'
  for (const member of team) {
    const next = nextSpecialTeamState(state, member.pokeId)
    if (next == null) return SPECIAL_TEAM_RULE
    state = next
  }
  return ''
}
