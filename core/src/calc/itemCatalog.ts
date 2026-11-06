import tables from '../data/calc-tables.resource'

export interface GameItem {
  id: number
  name: string
  category: string
  imageFile: string
  acquisition?: string
  additionalAcquisition?: string
  maxHeld?: number
  legacyRewardKey?: 'berryJuice'
  useEffect?: { op: 'heal'; amount: number; energyCap: number; ignoreNegativeNature: boolean }
}
export const ITEM_CATALOG = tables.modules.items.catalog as unknown as GameItem[]
export const ITEM_ROLES = tables.modules.items.roles
export function itemById(id: number) { return ITEM_CATALOG.find(item => item.id === id) }
