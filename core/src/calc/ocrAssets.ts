import { INGREDIENTS, POKEDEX } from './data'
import { ingredientImageUrl, pokemonPortraitUrl, pokemonShinyPortraitUrl } from './raeImage'
import type { ImportAssets } from './ocrWorker'
export function importAssets(): ImportAssets {
  return {
    ingredients: Object.fromEntries(INGREDIENTS.map(item => [item.id, ingredientImageUrl(item.id)])),
    portraits: Object.fromEntries(POKEDEX.map(poke => [poke.id, pokemonPortraitUrl(poke.id)])),
    shiny: Object.fromEntries(POKEDEX.map(poke => [poke.id, pokemonShinyPortraitUrl(poke.id)])),
  }
}
