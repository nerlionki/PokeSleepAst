/** Optional editor sections. Omitting ignore retains the complete editor. */
export type MemberEditorField =
  | 'profile' | 'evolutionChain' | 'mewSkill' | 'level' | 'exp'
  | 'ingredients' | 'evolutions' | 'seeds' | 'skill' | 'subskills'
  | 'nature' | 'ribbon' | 'ribbonCarry' | 'carryMode' | 'actions'

/** SP uses the intrinsic skill and does not model inventory or training costs. */
export const SP_EDITOR_IGNORE: readonly MemberEditorField[] = [
  'exp', 'evolutions', 'seeds', 'mewSkill', 'ribbonCarry', 'carryMode', 'actions',
]
