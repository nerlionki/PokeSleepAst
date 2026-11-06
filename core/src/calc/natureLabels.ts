import extracted0 from '../data/calc-tables.resource'
import extracted1 from '../data/client-defaults.resource'
import { cloneData } from './dataClone'
import type { NatureStat } from '../types'
import { NEUTRAL_NATURE, natureByName } from './data'
const natureLabels_config_extracted0 = extracted0.modules.natureLabels
const natureLabels_config_extracted1 = extracted1.modules.natureLabels


const FACTOR: Record<NatureStat, [number, number]> = (cloneData(natureLabels_config_extracted0.FACTOR) as unknown as Record<NatureStat, [number, number]>)

/** 净白薄荷取消能力特色，但不改写原性格。官方：https://www.pokemonsleep.net/zh/news/323930363038373331333038313633303733/ */
export function effectiveNature(member: { nature: string, natureMinted?: boolean }): string {
  return member.natureMinted === true ? NEUTRAL_NATURE : member.nature
}

/** 仅在局部计算副本中归一化；持久化数据、昵称和进化条件仍保留原性格。 */
export function withEffectiveNature<T extends { nature: string, natureMinted?: boolean }>(member: T): T {
  return member.natureMinted === true ? { ...member, nature: effectiveNature(member) } : member
}

/** 性格对这项数值的乘数。帮忙间隔另算：加速 ×0.9，减速 ×1.075。 */
export function natureStatFactor(nature: string, stat: NatureStat): number {
  const row = natureByName(nature)
  const [up, down] = FACTOR[stat]
  if (row.up === stat) return up
  if (row.down === stat) return down
  return 1
}

/** RAE 性格页展示的修正幅度 https://pks.raenonx.cc/zh/stats/nature */
export const STAT_LABEL: Record<NatureStat, string> = (cloneData(natureLabels_config_extracted1.STAT_LABEL) as unknown as Record<NatureStat, string>)

export const STAT_UP: Record<NatureStat, string> = (cloneData(natureLabels_config_extracted1.STAT_UP) as unknown as Record<NatureStat, string>)

export const STAT_DOWN: Record<NatureStat, string> = (cloneData(natureLabels_config_extracted1.STAT_DOWN) as unknown as Record<NatureStat, string>)
