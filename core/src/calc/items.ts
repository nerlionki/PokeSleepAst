import { publicImage } from '#platform/images'
import defaults from '../data/client-defaults.resource'
import { ITEM_CATALOG, type GameItem } from './itemCatalog'
export { ITEM_ROLES, itemById } from './itemCatalog'

export interface ItemEntry extends GameItem {
  icon: string
  sourceUrl: string
}
export const ITEM_CATEGORIES = [...new Set(ITEM_CATALOG.map(item => item.category))]
export const ITEMS: ItemEntry[] = ITEM_CATALOG.map(item => ({ ...item, icon: publicImage(item.imageFile), sourceUrl: defaults.modules.items.BASE + item.id }))
