import { i18nPack } from './i18nRuntime'

export function gameLabel(name: string) {
  return i18nPack()?.gameLabel(name) ?? name.replaceAll('咖哩', '咖喱')
}
