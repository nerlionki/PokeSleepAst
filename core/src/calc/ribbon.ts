import extracted0 from '../data/calc-tables.json'
import { cloneData } from './dataClone'
import left from '../data/evolution-left.json'
const ribbon_config_extracted0 = extracted0.modules.ribbon


const STAGES = (cloneData(ribbon_config_extracted0.STAGES) as unknown as readonly [{readonly "hours":2000;readonly "carry":8;readonly "speed":readonly [0,0.12,0.25]},{readonly "hours":1000;readonly "carry":6;readonly "speed":readonly [0,0.05,0.11]},{readonly "hours":500;readonly "carry":3;readonly "speed":readonly [0,0.05,0.11]},{readonly "hours":200;readonly "carry":1;readonly "speed":readonly [0,0,0]}])

const LEFT = left as Record<string, number>

export const RIBBON_HOURS = (cloneData(ribbon_config_extracted0.RIBBON_HOURS) as unknown as readonly [0,200,500,1000,2000])

/** 还能再进化几次。最终形态是 0，不会因为勋章缩短帮忙间隔。 */
export function stagesLeft(pokeId: number): number {
  return LEFT[String(pokeId)] ?? 0
}

/** 睡饱饱勋章。持有是累计值，间隔缩短只看还能进化的次数。 */
export function ribbonBonus(hours: number, remainingEvolutions: number): { carry: number, speedCut: number } {
  const stage = STAGES.find((item) => hours >= item.hours)
  if (!stage) return { carry: 0, speedCut: 0 }
  const index = Math.min(2, Math.max(0, remainingEvolutions))
  return { carry: stage.carry, speedCut: stage.speed[index] ?? 0 }
}
