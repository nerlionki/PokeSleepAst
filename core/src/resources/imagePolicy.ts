/** Game data images below have local fallbacks. Shiny art remains remote-only. */
export function isBundledImage(file: string): boolean {
  return /^(?:images\/)?(?:berry\/|ingredient\/|meal\/|mainSkill\/|subSkill\/|ribbon\/|pokemon\/(?:icons|portrait)\/)/.test(file)
    && !file.includes('/shiny/')
}
