export { pokemonIconUrl as remoteSpriteUrl, pokemonPortraitUrl } from './raeImage'

export function localSpriteUrl(id: number): string {
  return `/sprites/${id}.png`
}
