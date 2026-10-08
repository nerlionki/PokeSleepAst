import { ISLANDS, POKEDEX, SLEEP_STYLES, pokeById } from './data'
import { familyOf } from './candyPlan'
import { styleKey } from './sleep'
import type { IslandId } from '../types'

export type CatchPurpose = 'catch' | 'sleep' | 'candy'

export interface CatchGoal {
  id: string
  pokeId: number
  purpose: CatchPurpose
  stars: number[]
}

export interface CatchMatch {
  pokeId: number
  name: string
  purpose: CatchPurpose
  weight: number
  stars: number[]
}

export interface CatchSleepGroup {
  sleepType: string
  matches: CatchMatch[]
}

export interface CatchIslandPick {
  islandId: IslandId
  island: string
  score: number
  count: number
  sleepGroups: CatchSleepGroup[]
}

const STAR_FACTOR = [0, 0.8, 0.85, 0.88, 0.9]
const SLEEP_ORDER = ['淺淺入夢', '安然入睡', '深深入眠']
const DEFER = new Set<IslandId>(['greengrass', 'greenex'])

const speciesByIsland = new Map(ISLANDS.map((island) => [island.id, new Set(island.species)]))
const starsOnIsland = new Map<string, Map<number, number[]>>()
for (const style of SLEEP_STYLES) {
  if (style.stars < 1 || (style.stars > 4 && !style.limited)) continue
  if (!style.limited && !speciesByIsland.get(style.island)?.has(style.pokeId)) continue
  let island = starsOnIsland.get(style.island)
  if (!island) {
    island = new Map()
    starsOnIsland.set(style.island, island)
  }
  const have = island.get(style.pokeId) ?? []
  if (!have.includes(style.stars)) have.push(style.stars)
  island.set(style.pokeId, have)
}

export const CATCH_MODES = [
  { id: 'all', name: '捕捉＋睡姿＋刷糖', purposes: ['catch', 'sleep', 'candy'] as CatchPurpose[], weights: { catch: 1.2, candy: 1 } },
  { id: 'catch-candy', name: '捕捉＋刷糖', purposes: ['catch', 'candy'] as CatchPurpose[], weights: {} },
  { id: 'sleep', name: '仅睡姿', purposes: ['sleep'] as CatchPurpose[], weights: {} },
]

function mergeGoals(goals: CatchGoal[]) {
  const valid: { pokeId: number, purpose: CatchPurpose, stars: number[] }[] = []
  const sleepTargets = new Map<number, { pokeId: number, purpose: 'sleep', stars: number[] }>()
  for (const goal of goals) {
    if (!pokeById(goal.pokeId)) continue
    if (goal.purpose !== 'sleep') {
      valid.push({ pokeId: goal.pokeId, purpose: goal.purpose, stars: [] })
      continue
    }
    const stars = [...new Set(goal.stars.filter((n) => n >= 1 && n <= 5))]
    if (!stars.length) continue
    let target = sleepTargets.get(goal.pokeId)
    if (!target) {
      target = { pokeId: goal.pokeId, purpose: 'sleep', stars: [] }
      sleepTargets.set(goal.pokeId, target)
      valid.push(target)
    }
    target.stars = [...new Set([...target.stars, ...stars])].sort((a, b) => a - b)
  }
  return valid.map((goal, index) => ({ ...goal, baseWeight: valid.length - index }))
}

export function recommendIslands(
  goals: CatchGoal[],
  weights: { catch?: number, candy?: number } = {},
  discovered: readonly string[] = [],
): CatchIslandPick[] {
  const found = new Set(discovered)
  const targets = mergeGoals(goals)
  const picks: CatchIslandPick[] = []

  for (const island of ISLANDS) {
    const species = new Set(island.species)
    const styleMap = starsOnIsland.get(island.id)
    const sleepGroups: CatchSleepGroup[] = []

    for (const sleepType of SLEEP_ORDER) {
      const matches: CatchMatch[] = []
      for (const target of targets) {
        const poke = pokeById(target.pokeId)
        if (!poke) continue
        const islandStars = styleMap?.get(target.pokeId) ?? []
        const stars = target.purpose === 'sleep'
          ? islandStars.filter((star) => target.stars.includes(star) && SLEEP_STYLES.some((style) => style.island === island.id && style.pokeId === target.pokeId && style.stars === star && !found.has(styleKey(style.pokeId, style.stars, style.styleId))))
          : []
        const factor = target.purpose === 'sleep'
          ? (STAR_FACTOR[Math.min(stars.length, 4)] ?? 0)
          : (weights[target.purpose] ?? 1)
        if (factor <= 0) continue
        const members = target.purpose === 'candy'
          ? POKEDEX.filter((p) => familyOf(p.id) === familyOf(target.pokeId) && species.has(p.id) && p.sleepType === sleepType)
          : ((species.has(target.pokeId) || stars.some((star) => star >= 5)) && poke.sleepType === sleepType ? [poke] : [])
        if (!members.length) continue
        matches.push({
          pokeId: target.pokeId,
          name: poke.name,
          purpose: target.purpose,
          weight: Math.round(target.baseWeight * factor * 100) / 100,
          stars,
        })
      }
      if (matches.length) sleepGroups.push({ sleepType, matches })
    }

    if (!sleepGroups.length) continue
    const unique = new Map<string, CatchMatch>()
    for (const group of sleepGroups) {
      for (const match of group.matches) unique.set(`${match.name}|${match.purpose}|${match.weight}`, match)
    }
    picks.push({
      islandId: island.id as IslandId,
      island: island.name,
      score: [...unique.values()].reduce((sum, match) => sum + match.weight, 0),
      count: unique.size,
      sleepGroups,
    })
  }

  return picks.sort((a, b) => {
    const deferred = Number(DEFER.has(a.islandId)) - Number(DEFER.has(b.islandId))
    return deferred || b.score - a.score || b.count - a.count || a.island.localeCompare(b.island, 'zh')
  })
}

export function recommendThree(goals: CatchGoal[], discovered: readonly string[] = [], modes: readonly string[] = CATCH_MODES.map((mode) => mode.id)) {
  return CATCH_MODES.filter((mode) => modes.includes(mode.id)).map((mode) => ({
    id: mode.id,
    name: mode.name,
    results: recommendIslands(goals.filter((goal) => mode.purposes.includes(goal.purpose)), mode.weights, discovered),
  }))
}
