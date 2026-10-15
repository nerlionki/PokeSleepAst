import source from '../data/sleep-last-roll-source.json'
import { sleepStyleInternalId } from './sleepRewards'

const excluded = new Set<number>(source.excludedInternalIds)

/** RAE Sleepdex “Show Last Roll Excl.”, verified and approved 2026-10-14.
 * Only the terminal guarantee excludes these styles; ordinary draws retain them.
 * Use game internal IDs, never the generated per-island row ID.
 */
export function isLastRollExcluded(style: { pokeId: number, stars: number, styleId?: number }): boolean {
  return excluded.has(sleepStyleInternalId(style))
}
