import tables from '../data/calc-tables.resource'

export type PokemonItemId = `Candy-${number}` | `Incense-${number}`

export interface GameItem<Id extends number | PokemonItemId = number> {
  id: Id
  name: string
  category: string
  imageFile: string
  pokemonItem?: { kind: 'incense'; pokemonId: number; typeId: number } | { kind: 'candy'; pokemonId: number }
  /** 常驻商店按单件折算的钻石售价；缺省表示无单买价资料。 */
  diamondPrice?: number
  diamondPurchaseQuantity?: number
  aliases?: string[]
  acquisition?: string
  additionalAcquisition?: string
  maxHeld?: number
  legacyRewardKey?: 'berryJuice'
  useEffect?: { op: 'heal'; amount: number; energyCap: number; ignoreNegativeNature: boolean }
}
export const ITEM_CATALOG = tables.modules.items.catalog as unknown as GameItem[]
const { pokemonCatalog = [] } = tables.modules.items as unknown as { pokemonCatalog?: GameItem<PokemonItemId>[] }
export const ITEM_ROLES = tables.modules.items.roles
export function itemById(id: number | PokemonItemId) {
  return typeof id === 'number' ? ITEM_CATALOG.find(item => item.id === id) : pokemonCatalog.find(item => item.id === id)
}
