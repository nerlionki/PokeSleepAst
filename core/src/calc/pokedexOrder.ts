import extracted0 from '../data/compatibility-maps.json'
import { cloneData } from './dataClone'
const pokedexOrder_config_extracted0 = extracted0.modules.pokedexOrder

/** National dex numbers for records whose internal IDs identify forms. */
export const FORM_DEX: Record<number, number> = (cloneData(pokedexOrder_config_extracted0.FORM_DEX) as unknown as Record<number, number>)

export const nationalDex = (id: number) => FORM_DEX[id] ?? id

export function compareDex(a: { id: number }, b: { id: number }): number {
  return nationalDex(a.id) - nationalDex(b.id) || a.id - b.id
}
