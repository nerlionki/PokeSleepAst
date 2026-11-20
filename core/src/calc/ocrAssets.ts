import { INGREDIENTS, POKEDEX } from './data'
import { pokemonPortraitUrl, pokemonShinyPortraitUrl } from './raeImage'
import type { ImportAssets } from './ocrWorker'
import { bundledImage, localImage } from '#platform/images'

/** 使用当前快照的版本化食材图，网络失败由平台图片加载器回退；缺图不拿问号作模板。 */
export function ocrIngredientImageUrl(id: number): string {
  return localImage(`ingredient/${id}.webp`)
}
export function importAssets(): ImportAssets {
  const preferred = (url: string) => bundledImage(url) || url
  return {
    ingredients: Object.fromEntries(INGREDIENTS.map(item => [item.id, ocrIngredientImageUrl(item.id)])),
    portraits: Object.fromEntries(POKEDEX.map(poke => [poke.id, preferred(pokemonPortraitUrl(poke.id))])),
    shiny: Object.fromEntries(POKEDEX.map(poke => [poke.id, pokemonShinyPortraitUrl(poke.id)])),
  }
}
