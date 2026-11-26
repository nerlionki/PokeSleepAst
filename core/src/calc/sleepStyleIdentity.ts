import dprSource from '../data/sleep-dpr-source.resource'
import rewards from '../data/sleep-rewards.resource'

/** A string is a legacy saved key whose mapping may still be unresolved. */
export type SleepStyleRef = number | string
export interface SleepStyleIdentity {
  pokeId: number
  stars: number
  island?: string
  styleId?: number
  raeStyleId?: number
}

export function legacySleepStyleKey(pokeId: number, stars: number, styleId?: number) {
  return styleId == null ? `${pokeId}-${stars}` : `${pokeId}-${stars}-${styleId}`
}

const byLinkage = new Map(dprSource.entries.map(entry => [entry.key, entry.internalId]))
const byLegacyKey = new Map<string, Set<number>>()
function register(key: string, internalId: number) {
  const ids = byLegacyKey.get(key)
  if (ids) ids.add(internalId)
  else byLegacyKey.set(key, new Set([internalId]))
}
for (const { key, internalId } of dprSource.entries) {
  const [, pokemon, stars, variant] = key.split(':')
  register(legacySleepStyleKey(Number(pokemon), Number(stars), variant ? Number(variant) : undefined), internalId)
}
for (const { key, internalId } of dprSource.additionalStyleIds ?? []) register(key, internalId)
// Released snapshots also contain the RAE reward records, including event-only styles.
// A grouped legacy key, such as Ditto's unqualified four-star key, stays ambiguous.
for (const { id, pokeId, stars } of rewards) register(legacySleepStyleKey(pokeId, stars), id)

export function resolveSleepStyleRef(ref: SleepStyleRef | undefined): number | undefined {
  if (typeof ref === 'number') return Number.isSafeInteger(ref) && ref > 0 ? ref : undefined
  const ids = ref == null ? undefined : byLegacyKey.get(ref)
  return ids?.size === 1 ? ids.values().next().value : undefined
}

export function raeSleepStyleId(row: SleepStyleIdentity): number | undefined {
  const explicit = row.raeStyleId ?? row.styleId
  if (explicit != null) return resolveSleepStyleRef(explicit)
  return (row.island == null ? undefined : byLinkage.get(`${row.island}:${row.pokeId}:${row.stars}:`))
    ?? resolveSleepStyleRef(legacySleepStyleKey(row.pokeId, row.stars))
}

export function bindRaeSleepStyle<T extends SleepStyleIdentity & { id: number }>(row: T): (T & { raeStyleId: number }) | undefined {
  const id = raeSleepStyleId(row)
  return id == null ? undefined : { ...row, id, raeStyleId: id }
}

export function migrateSleepStyleRefs(refs: readonly SleepStyleRef[] | undefined): SleepStyleRef[] {
  if (!Array.isArray(refs)) return []
  return [...new Set(refs.flatMap(ref => typeof ref === 'string' || typeof ref === 'number' ? [resolveSleepStyleRef(ref) ?? ref] : []))]
}
