import { localImage, publicImage } from '#platform/images'
import { ITEM_CATALOG, pokemonCatalog, type GameItem, type PokemonItemId } from './itemCatalog'
export { ITEM_ROLES, itemById } from './itemCatalog'

export interface ItemEntry extends GameItem<number | PokemonItemId> {
  icon: string
}
export interface DisplayItem extends ItemEntry {
  researchEvents: NonNullable<GameItem['researchEvent']>[]
}
export const ITEM_CATEGORIES = [...new Set(ITEM_CATALOG.map(item => item.category))]
export function itemImage(item: Pick<GameItem, 'imageFile' | 'sharedImageId'>) {
  return publicImage(item.sharedImageId === undefined ? item.imageFile : `items/${item.sharedImageId}.webp`)
}
const pokemonIncenses = pokemonCatalog.filter(item => item.pokemonItem?.kind === 'incense')
export const ITEMS: ItemEntry[] = [...ITEM_CATALOG, ...pokemonIncenses].map(item => ({
  ...item,
  category: item.pokemonItem?.kind === 'incense' ? '功能型薰香' : item.category,
  icon: itemImage(item) || (item.pokemonItem?.kind === 'incense'
    ? localImage(`incense/pokemon/${item.pokemonItem.typeId}.webp`)
    : ''),
}))

export function itemGroupKey(item: ItemEntry) {
  const key = [item.category, item.name]
  return JSON.stringify(item.category === '活动研究物品' ? key : [...key, item.sharedImageId ?? item.id])
}
export const DISPLAY_ITEMS = [...ITEMS.reduce((groups, item) => {
  const key = itemGroupKey(item)
  const previous = groups.get(key)
  const researchEvents = previous?.researchEvents ?? []
  const event = item.researchEvent
  groups.set(key, {
    ...(previous ?? item),
    icon: previous?.icon || item.icon,
    ...(previous && {
      compatiblePokemonIds: [...new Set([...previous.compatiblePokemonIds ?? [], ...item.compatiblePokemonIds ?? []])],
    }),
    researchEvents: event && !researchEvents.some(entry => entry.id === event.id)
      ? [...researchEvents, event] : researchEvents,
  })
  return groups
}, new Map<string, DisplayItem>()).values()]
