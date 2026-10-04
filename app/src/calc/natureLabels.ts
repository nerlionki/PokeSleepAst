import type { NatureStat } from '../types'
import { natureByName } from './data'

const FACTOR: Record<NatureStat, [number, number]> = {
  help: [1.1, 0.9],
  energy: [1.2, 0.8],
  ingredient: [1.2, 0.8],
  skill: [1.2, 0.8],
  exp: [1.18, 0.82],
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
export const STAT_LABEL: Record<NatureStat, string> = {
  help: '帮忙速度',
  energy: '活力回复量',
  ingredient: '食材发现率',
  skill: '主技能发动率',
  exp: 'EXP获得量',
}

export const STAT_UP: Record<NatureStat, string> = {
  help: '+10%',
  energy: '+20%',
  ingredient: '+20%',
  skill: '+20%',
  exp: '+18%',
}

export const STAT_DOWN: Record<NatureStat, string> = {
  help: '-7.5%',
  energy: '-20%',
  ingredient: '-20%',
  skill: '-20%',
  exp: '-18%',
}
