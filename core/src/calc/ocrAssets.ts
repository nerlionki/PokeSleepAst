import { INGREDIENTS, POKEDEX } from './data'
import { ingredientImageUrl, pokemonPortraitUrl, pokemonShinyPortraitUrl } from './raeImage'
import type { ImportAssets } from './ocrWorker'
import { bundledImage } from '#platform/images'
export function importAssets(): ImportAssets {
  const preferred = (url: string) => bundledImage(url) || url
  return {
    ingredients: Object.fromEntries(INGREDIENTS.map(item => [item.id, preferred(ingredientImageUrl(item.id))])),
    portraits: Object.fromEntries(POKEDEX.map(poke => [poke.id, preferred(pokemonPortraitUrl(poke.id))])),
    shiny: Object.fromEntries(POKEDEX.map(poke => [poke.id, pokemonShinyPortraitUrl(poke.id)])),
  }
}
