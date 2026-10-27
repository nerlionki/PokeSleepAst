import extracted0 from '../data/calc-tables.json'
import extracted1 from '../data/client-defaults.json'
import { cloneData } from './dataClone'
import type { NatureStat } from '../types'
import { natureByName } from './data'
const natureLabels_config_extracted0 = extracted0.modules.natureLabels
const natureLabels_config_extracted1 = extracted1.modules.natureLabels


const FACTOR: Record<NatureStat, [number, number]> = (cloneData(natureLabels_config_extracted0.FACTOR) as unknown as Record<NatureStat, [number, number]>)

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
