import { ISLANDS, SLEEP_STYLES } from './data'
import { resolvedSleepdex, styleKey, type SleepdexSelection } from './sleep'

/** 图鉴使用同一个 key；跨岛去重，保留百变怪等同星不同睡姿的身份。 */
export function missingCompletionStyles(selection: SleepdexSelection) {
  const found = new Set(resolvedSleepdex(selection))
  const known = new Set<string>()
  const islands = new Set(ISLANDS.map(island => island.id))
  return SLEEP_STYLES.filter(style => {
    const key = styleKey(style.pokeId, style.stars, style.styleId)
    if (style.limited || !islands.has(style.island) || found.has(key) || known.has(key)) return false
    known.add(key)
    return true
  })
}
