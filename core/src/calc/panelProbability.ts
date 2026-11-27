import { NATURES, SUBSKILL_DRAW, SUBSKILLS, type PokeRow } from './data'
import { friendTiers, ingredientColumns } from './ingredients'
import { SUBSKILL_GATES, SUBSKILL_UPGRADES } from './member'
import { SPECIAL_POKEMON } from './sleep'

export interface PanelSkillGroup {
  skills: string[]
  fromSlot: number
  throughSlot: number
  mode: 'all' | 'minimum' | 'exclude'
  minimum: number
}

export interface PanelConditions {
  natures: string[] | null
  ingredients: string[]
  groups: PanelSkillGroup[]
  allowUpgrade: boolean
}

export interface PanelCatchPlan extends PanelConditions {
  friendship: number
  catches: number
  goldSlots: boolean[]
}

const rarityOdds = SUBSKILL_DRAW.rarityProbability
type Rarity = keyof typeof rarityOdds
const rarities = Object.keys(rarityOdds) as Rarity[]
const skillIndex = new Map(SUBSKILLS.map(({ id }, index) => [id, index]))
const rarityMasks = rarities.map(rarity =>
  SUBSKILLS.reduce((mask, skill, index) => skill.rarity === rarity ? mask | (1 << index) : mask, 0))
const goldRarity = rarities.indexOf('gold')
const fallbackRarities = SUBSKILL_DRAW.exhaustedRarityFallback as Partial<Record<Rarity, Rarity>>
const fallbackIndices = rarities.map(rarity => rarities.indexOf(fallbackRarities[rarity] ?? rarity))
const upgrades = SUBSKILLS.map(({ id }) => skillIndex.get(SUBSKILL_UPGRADES[id] ?? '') ?? -1)

function countBits(mask: number): number {
  let count = 0
  for (; mask; mask &= mask - 1) count++
  return count
}

export function panelIngredientSpreads(pokemon: PokeRow) {
  const [first = [], second = [], third = []] = ingredientColumns(pokemon.ingredients)
  // RAE ingredient research: Lv.30 uses ABB; Lv.60 uses ABC, or ABB with two ingredients.
  // https://hackmd.io/@raenonx-pokemon-sleep/rJj6yeIlWe
  return first.flatMap(a => second.flatMap(b => third.map(c => ({
    key: a.letter + b.letter + c.letter,
    slots: [a, b, c],
    probability: (b.index === 0 ? 1 : 2) * (third.length === 2 && c.index === 1 ? 2 : 1) / 9,
  }))))
}

function prepareSkillProbability(conditions: PanelConditions) {
  const groups = conditions.groups.filter(group => group.skills.length).map(group => {
    if (!Number.isInteger(group.fromSlot) || !Number.isInteger(group.throughSlot)
      || group.fromSlot < 0 || group.throughSlot < group.fromSlot || group.throughSlot >= SUBSKILL_GATES.length) {
      throw new RangeError('Invalid subskill slot range')
    }
    let targetMask = 0
    for (const id of group.skills) {
      const index = skillIndex.get(id)
      if (index !== undefined) targetMask |= 1 << index
    }
    return { ...group, targetMask,
      minimum: group.mode === 'all' ? new Set(group.skills).size : group.minimum }
  })
  if (!groups.length) return function* (_goldMask: number): Generator<number, number> { return 1 }
  if (groups.some(group => group.mode !== 'exclude' &&
    group.minimum > Math.min(countBits(group.targetMask), group.throughSlot - group.fromSlot + 1))) {
    return function* (_goldMask: number): Generator<number, number> { return 0 }
  }

  const activeSlots = Math.max(...groups.map(group => group.throughSlot)) + 1
  const relevantTargets = groups.reduce((mask, group) => group.mode === 'exclude' ? mask : mask | group.targetMask, 0)
  const hasRelevantUpgrade = upgrades.some(to => {
    for (let next = to; next >= 0; next = upgrades[next] ?? -1) {
      if (relevantTargets & (1 << next)) return true
    }
    return false
  })
  // An upgrade can be blocked by a skill in an unopened slot.
  const canUpgrade = conditions.allowUpgrade &&
    (hasRelevantUpgrade || groups.some(group => group.mode === 'exclude'))
  const slotsToDraw = canUpgrade ? SUBSKILL_GATES.length : activeSlots
  const panel = new Array<number>(slotsToDraw)

  function matches(): boolean {
    return groups.every(group => {
      let count = 0
      for (let slot = group.fromSlot; slot <= group.throughSlot; slot++) {
        if (group.targetMask & (1 << panel[slot]!)) count++
      }
      return group.mode === 'exclude' ? count === 0 : count >= group.minimum
    })
  }

  function matchesAfterUpgrade(used: number): boolean {
    if (matches()) return true
    if (!canUpgrade) return false
    for (let slot = 0; slot < activeSlots; slot++) {
      const from = panel[slot]!
      const to = upgrades[from] ?? -1
      if (to < 0 || used & (1 << to)) continue
      panel[slot] = to
      const matched = matchesAfterUpgrade((used & ~(1 << from)) | (1 << to))
      panel[slot] = from
      if (matched) return true
    }
    return false
  }

  const cache = new Map<number, number>()
  return function* (goldMask: number): Generator<number, number> {
    goldMask &= (1 << slotsToDraw) - 1
    const cached = cache.get(goldMask)
    if (cached !== undefined) return cached
    function walk(slot: number, used: number): number {
      if (slot === slotsToDraw) return Number(matchesAfterUpgrade(used))
      if (goldMask & (1 << slot)) return drawRarity(goldRarity)
      let probability = 0
      // The odds of a rarity stay constant as its candidates are removed.
      for (let rarity = 0; rarity < rarities.length; rarity++) {
        const available = (rarityMasks[rarity]! & ~used) !== 0
        probability += rarityOdds[rarities[rarity]!] * drawRarity(available ? rarity : fallbackIndices[rarity]!)
      }
      return probability

      function drawRarity(rarity: number): number {
        const available = rarityMasks[rarity]! & ~used
        if (!available) return 0
        let sum = 0
        for (let choices = available; choices; choices &= choices - 1) {
          const bit = choices & -choices
          panel[slot] = 31 - Math.clz32(bit)
          sum += walk(slot + 1, used | bit)
        }
        return sum / countBits(available)
      }
    }

    const rootLocked = (goldMask & 1) !== 0
    const rootRarities = rootLocked ? [goldRarity] : rarities.map((_, index) => index)
    let total = 0
    for (const [index, rarity] of rootRarities.entries()) {
      const effectiveRarity = !rootLocked && !rarityMasks[rarity] ? fallbackIndices[rarity]! : rarity
      const available = rarityMasks[effectiveRarity]!
      const choices = countBits(available)
      if (!choices) continue
      let sum = 0
      let completed = 0
      for (let remaining = available; remaining; remaining &= remaining - 1) {
        const bit = remaining & -remaining
        panel[0] = 31 - Math.clz32(bit)
        sum += walk(1, bit)
        yield (index + ++completed / choices) / rootRarities.length
      }
      total += (rootLocked ? 1 : rarityOdds[rarities[rarity]!]) * (sum / choices)
    }
    const probability = Math.min(1, total)
    cache.set(goldMask, probability)
    return probability
  }
}

export function panelFriendshipTier(tiers: readonly { level: number }[], friendship: number) {
  return tiers.filter(badge => friendship >= badge.level).length
}

export function panelGoldSlotsEditable(tier: number) {
  return tier >= SUBSKILL_DRAW.friendMedal.independentGoldSlotToggleFromTier
}

export function panelGoldMask(tier: number, enabled: readonly boolean[]) {
  return (SUBSKILL_DRAW.friendMedal.goldSlotsByTier[tier] ?? []).reduce((mask, slot) =>
    !panelGoldSlotsEditable(tier) || enabled[slot] !== false
      ? mask | (1 << slot) : mask, 0)
}

// The official Mewtwo announcement confirms that the first specimen of each
// Special Pokémon species has a fixed nature and subskills.
// https://www.pokemonsleep.net/en/news/343333373536323134383333313834373731/
export function firstRandomPanelFriendship(pokeId: number) {
  return SPECIAL_POKEMON.has(pokeId) ? 2 : 1
}

export function* panelProbabilitySteps(pokemon: PokeRow, plan: PanelCatchPlan) {
  if (!Number.isSafeInteger(plan.friendship) || plan.friendship < firstRandomPanelFriendship(pokemon.id)
    || !Number.isSafeInteger(plan.catches) || plan.catches < 1) throw new RangeError('Invalid panel catch plan')
  const spreads = panelIngredientSpreads(pokemon)
  const ingredientProbability = plan.ingredients.length
    ? spreads.filter(spread => plan.ingredients.includes(spread.key)).reduce((sum, spread) => sum + spread.probability, 0)
    : 1
  const natureProbability = plan.natures === null ? 1
    : NATURES.filter(nature => plan.natures?.includes(nature.name)).length / NATURES.length
  const skillProbability = prepareSkillProbability(plan)
  const tiers = friendTiers(pokemon.medalGroup)
  const starts = [plan.friendship, ...tiers.map(tier => tier.level).filter(level => level > plan.friendship)]
  const segments: { start: number; goldMask: number; skills: number; length: number; probability: number }[] = []
  for (const [index, start] of starts.entries()) {
    const tier = panelFriendshipTier(tiers, start)
    const goldMask = panelGoldMask(tier, plan.goldSlots)
    const task = skillProbability(goldMask)
    let step = task.next()
    while (!step.done) {
      yield (index + step.value) / starts.length
      step = task.next()
    }
    const skills = step.value
    segments.push({
      start, goldMask, skills,
      length: index + 1 < starts.length ? starts[index + 1]! - start : Infinity,
      probability: Math.min(1, skills * natureProbability * ingredientProbability),
    })
    yield (index + 1) / starts.length
  }

  function cumulative(catches: number): number {
    let logFailure = 0
    for (const segment of segments) {
      const count = Math.min(catches, segment.length)
      if (count <= 0) break
      logFailure += count * Math.log1p(-segment.probability)
      catches -= count
    }
    return logFailure === 0 ? 0 : -Math.expm1(logFailure)
  }

  function catchesFor(target: number): number {
    const logTarget = Math.log1p(-target)
    let logFailure = 0
    let passed = 0
    for (const { length, probability } of segments) {
      if (probability === 1) return passed + 1
      const logOne = Math.log1p(-probability)
      if (probability > 0) {
        const count = Math.max(1, Math.ceil((logTarget - logFailure) / logOne))
        if (count <= length) return passed + count
      }
      if (length === Infinity) return Infinity
      logFailure += length * logOne
      passed += length
    }
    return Infinity
  }

  function expectedCatches(): number {
    let mean = 0
    let logFailure = 0
    for (const { length, probability } of segments) {
      if (logFailure === -Infinity) break
      if (length === Infinity) return probability > 0 ? mean + Math.exp(logFailure) / probability : Infinity
      const change = length * Math.log1p(-probability)
      mean += Math.exp(logFailure) * (probability > 0 ? -Math.expm1(change) / probability : length)
      logFailure += change
    }
    return mean
  }

  return {
    segments, natureProbability, ingredientProbability,
    cumulativeProbability: cumulative(plan.catches),
    expectedCatches: expectedCatches(),
    milestones: [0.5, 0.9, 0.95].map(target => ({ target, catches: catchesFor(target) })),
  }
}

export function calculatePanelProbability(pokemon: PokeRow, plan: PanelCatchPlan) {
  const task = panelProbabilitySteps(pokemon, plan)
  let step = task.next()
  while (!step.done) step = task.next()
  return step.value
}
