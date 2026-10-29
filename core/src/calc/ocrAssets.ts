import { INGREDIENTS, POKEDEX } from './data'
import { ingredientImageUrl, pokemonPortraitUrl, pokemonShinyPortraitUrl } from './raeImage'
import type { ImportAssets } from './ocrWorker'
import { bundledImage } from '#platform/images'
export function importAssets(): ImportAssets {
  return {
    ingredients: Object.fromEntries(INGREDIENTS.map(item => [item.id, bundledImage(ingredientImageUrl(item.id))])),
    portraits: Object.fromEntries(POKEDEX.map(poke => [poke.id, bundledImage(pokemonPortraitUrl(poke.id))])),
    shiny: Object.fromEntries(POKEDEX.map(poke => [poke.id, bundledImage(pokemonShinyPortraitUrl(poke.id))])),
  }
}
