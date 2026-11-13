import { ANNOUNCED } from './announcedContent'
import { ISLANDS, POKEDEX, SLEEP_STYLES, type SleepStyleRow } from './data'

const releaseTimes = new Map<number, number>()
for (const entry of ANNOUNCED.pokemon) {
  const id = entry.runtimeId ?? entry.imageId
  if (id == null || !POKEDEX.some(poke => poke.id === id && (entry.runtimeId != null || poke.name === entry.name))) continue
  if (entry.timeBasis !== 'game-local' || !entry.availableFrom) continue
  const time = Date.parse(entry.availableFrom)
  if (Number.isFinite(time)) releaseTimes.set(id, time)
}

export function hasResearchDpr(style: SleepStyleRow) {
  return Number.isFinite(style.dpr) && style.dpr >= 0
}

export function pendingResearchPokemon(now = Date.now()): number[] {
  return [...releaseTimes].filter(([, time]) => now < time).map(([id]) => id)
}

const islands = new Set(ISLANDS.map(island => island.id))
const speciesWithDpr = new Set(SLEEP_STYLES.filter(style =>
  !style.limited && islands.has(style.island) && hasResearchDpr(style)
).map(style => style.pokeId))

export function hasBaseResearchDpr(id: number) {
  return speciesWithDpr.has(id)
}

export function upcomingResearchReleases(now = Date.now()): number[] {
  return [...releaseTimes].filter(([id, time]) => speciesWithDpr.has(id) && now < time).map(([, time]) => time)
}
