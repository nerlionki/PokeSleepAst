import extracted0 from '../data/compatibility-maps.resource'
import { cloneData } from './dataClone'
const text_config_extracted0 = extracted0.modules.text

const PAIR: [string, string][] = (cloneData(text_config_extracted0.PAIR) as unknown as [string, string][])

export function foldText(s: string): string {
  let out = String(s ?? '').normalize('NFKC').toLowerCase()
  for (const [a, b] of PAIR) out = out.replaceAll(a, b)
  return out.replace(/[\s_\-']/g, '')
}

/** 截图文字：先把游戏里的「機率」收成资料用的「概率」，再繁简折叠。 */
export function ocrFold(s: string): string {
  return foldText(String(s ?? '').replaceAll('機率', '概率').replaceAll('机率', '概率'))
}

export function textHit(hay: string, needle: string): boolean {
  if (!needle) return true
  return foldText(hay).includes(foldText(needle))
}
