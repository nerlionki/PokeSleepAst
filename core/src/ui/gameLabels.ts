import names from './gameLabels.json'
import { resourceGameLabel } from '../resources/gameLabelAliases'

// Simplified display labels also serve as translation keys for game resources.
const labels: Readonly<Record<string, string>> = names

export function gameLabel(name: string): string {
  return resourceGameLabel(name) ?? (Object.hasOwn(labels, name) ? labels[name]! : name.replaceAll('咖哩', '咖喱'))
}
