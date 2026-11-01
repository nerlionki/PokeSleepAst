/** Only these game images ship with either client. Shiny art is always remote. */
export function isBundledImage(file: string): boolean {
  return /^(?:images\/)?(?:berry\/|ingredient\/|pokemon\/(?:icons|portrait)\/)/.test(file)
    && !file.includes('/shiny/')
}
