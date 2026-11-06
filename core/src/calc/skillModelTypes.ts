export type SkillProfile = 'expected' | 'sampled'
export type SkillClassification = 'charge' | 'healAll' | 'healOne' | 'healSelf' | 'support' | 'typeAccel' | 'helpAccel' | 'other'
export type SkillCondition =
  | { teamPokemon: number[]; excludeSelf?: boolean }
  | { teamSkillTags: string[]; excludeSelf?: boolean }
  | { firstIngredient: true }
  | { targetTypeNot: string }
  | { all: SkillCondition[] }
export type SkillAmount = number
  | { column: string; percent?: boolean }
  | { range: [string, string] }
  | { table: string }
  | { add: SkillAmount[] }
  | { multiply: SkillAmount[] }
  | { divide: [SkillAmount, number] }
  | { maximum: SkillAmount[] }
  | { level: true }
  | { skill: number; value: SkillAmount }
  | { when: SkillCondition; then: SkillAmount; otherwise: SkillAmount }
  | { expected: SkillAmount; sampled: SkillAmount }
  | { randomMultiplier: { chance: number; hit: number; miss: number } }
export interface SkillTarget {
  kind: 'self' | 'team' | 'random'
  count?: number
  expected?: { firstWeight?: number; otherWeight?: number; rankWeights?: number[]; fullTeamSize?: number; shareTies?: boolean; supportSize?: boolean }
  sampled?: { lowestChance: number; randomLowestTies: boolean }
}
export interface SkillEffect {
  op: 'charge' | 'currency' | 'giveItem' | 'heal' | 'help' | 'skillOnlyHelp' | 'ingredients' | 'firstIngredient'
    | 'pot' | 'crit' | 'zone' | 'berries' | 'drainEnergy' | 'sequence' | 'accumulateRelease' | 'onceBonus'
  amount?: SkillAmount
  target?: SkillTarget
  condition?: SkillCondition
  profiles?: SkillProfile[]
  chance?: { probability: number; test?: 'lt' | 'gte'; expectedProbability?: number }
  currency?: 'dreamShards' | 'candies'
  itemId?: number
  pool?: number[]
  draws?: number
  roundingBonus?: SkillAmount
  selfAmount?: SkillAmount
  otherAmount?: SkillAmount
  effects?: SkillEffect[]
  maxStacks?: number
  releaseChance?: number
  extraTable?: number
  bonus?: number
}
export interface SkillSelection {
  kind: 'random' | 'copy' | 'choose'
  pool?: number[]
  fallbackSkillId?: number
  blockedPokemon?: number[]
  owners?: number[]
}
export interface MainSkillModel {
  classification: SkillClassification
  tags: string[]
  effects: SkillEffect[]
  selection?: SkillSelection
  copyable: boolean
  chargeValue?: SkillAmount
  displayValue?: SkillAmount
  comparisonFastPath: boolean
  berryRanking?: 'support' | 'unlimited'
}
