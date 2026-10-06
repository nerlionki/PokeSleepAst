import type { BoxPokemon, Settings, TeamProduceResult } from '../types'
import { teamTimeline } from './timeline'

export function teamProduce(settings: Settings, roster: BoxPokemon[]): TeamProduceResult {
  return teamTimeline(settings, roster)
}
