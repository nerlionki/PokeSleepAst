/** Ordinary Pokémon, berries, ingredients and recipes have local image fallbacks. Shiny art is always remote. */
export function isBundledImage(file: string): boolean {
  return /^(?:images\/)?(?:berry\/|ingredient\/|meal\/|pokemon\/(?:icons|portrait)\/)/.test(file)
    && !file.includes('/shiny/')
}
