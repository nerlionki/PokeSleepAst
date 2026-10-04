import names from '../data/pokemon-en.json'
import { textHit } from './text'

const EN = names as Record<string, string>

export function englishName(id: number): string {
  return EN[String(id)] ?? ''
}

export function pokeHit(poke: { id: number, name: string, formKey?: string }, query: string, extra = ''): boolean {
  if (!query) return true
  return textHit(`${poke.name} ${englishName(poke.id)} ${poke.formKey ?? ''} ${poke.id} ${extra}`, query)
}
