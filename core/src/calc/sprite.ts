export { pokemonIconUrl as remoteSpriteUrl, pokemonPortraitUrl } from './raeImage'
import { publicImage } from '#platform/images'

export function localSpriteUrl(id: number): string {
  return publicImage(`sprites/${id}.png`)
}
