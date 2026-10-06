/** National dex numbers for records whose internal IDs identify forms. */
export const FORM_DEX: Record<number, number> = {
  7006: 37, 7007: 38, 7054: 194, 8001: 849,
  9001: 25, 9002: 25, 9007: 25, 9004: 133, 9005: 133, 9006: 363,
  71002: 710, 71003: 710, 71004: 710, 71102: 711, 71103: 711, 71104: 711,
}

export const nationalDex = (id: number) => FORM_DEX[id] ?? id

export function compareDex(a: { id: number }, b: { id: number }): number {
  return nationalDex(a.id) - nationalDex(b.id) || a.id - b.id
}
