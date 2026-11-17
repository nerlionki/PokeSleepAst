import { i18nPack } from './i18nRuntime'
import { resourceGameLabel } from '../../../core/src/resources/gameLabelAliases'

export function gameLabel(name: string) {
  return resourceGameLabel(name) ?? i18nPack()?.gameLabel(name) ?? name.replaceAll('咖哩', '咖喱')
}
