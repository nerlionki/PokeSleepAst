import { localImage, publicImage } from '#platform/images'
import { ITEM_CATALOG, pokemonCatalog, type GameItem, type PokemonItemId } from './itemCatalog'
export { ITEM_ROLES, itemById } from './itemCatalog'

export interface ItemEntry extends GameItem<number | PokemonItemId> {
  icon: string
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
  return JSON.stringify([item.category, item.name, item.sharedImageId ?? item.id])
}
export const DISPLAY_ITEMS = [...ITEMS.reduce((groups, item) => {
  const key = itemGroupKey(item)
  const previous = groups.get(key)
  groups.set(key, previous ? {
    ...previous,
    compatiblePokemonIds: [...new Set([...previous.compatiblePokemonIds ?? [], ...item.compatiblePokemonIds ?? []])],
  } : item)
  return groups
}, new Map<string, ItemEntry>()).values()]
