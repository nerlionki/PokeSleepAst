import bundled from './client-defaults.json'
import { resourceData } from '../resources/runtime'

export function readClientDefaults() {
  return resourceData('client-defaults.json', bundled)
}
