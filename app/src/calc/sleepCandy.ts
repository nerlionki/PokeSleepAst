import evolution from '../data/evolution.json'
import growth from '../data/growth-meta.json'
import { POKEDEX, pokeById } from './data'
import { nationalDex } from './pokedexOrder'

const EVO = evolution as Record<string, { prev: number }>
const FAMILY = growth.family as Record<string, string>

function candyRoot(id: number): number {
  let current = nationalDex(id)
  const visited = new Set<number>()
  while (!visited.has(current)) {
    visited.add(current)
    const previous = EVO[String(current)]?.prev
    if (!previous || !pokeById(previous)) break
    current = nationalDex(previous)
  }
  return current
}

const familyRoots = new Map<string, number>()
for (const poke of POKEDEX) {
  const family = FAMILY[String(nationalDex(poke.id))]
  if (family && !familyRoots.has(family)) familyRoots.set(family, candyRoot(poke.id))
}

export function candyExpectation(rows: readonly { pokeId: number, candy: number }[], iterations: number) {
  if (iterations <= 0) return []
  const totals = new Map<number, number>()
  for (const row of rows) {
    const family = FAMILY[String(nationalDex(row.pokeId))]
    const root = (family && familyRoots.get(family)) || candyRoot(row.pokeId)
    totals.set(root, (totals.get(root) ?? 0) + row.candy)
  }
  return [...totals].sort(([a], [b]) => a - b).map(([pokeId, count]) => ({
    pokeId, name: `${pokeById(pokeId)?.name ?? pokeId}糖果`, average: count / iterations,
  }))
}
