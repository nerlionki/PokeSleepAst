import source from '../data/sleep-last-roll-source.resource'
import { sleepStyleInternalId } from './sleepRewards'

const excluded = new Set<number>(source.excludedInternalIds)

/** RAE excludes these styles from the restricted leader pool. */
export function isLastRollExcluded(style: Parameters<typeof sleepStyleInternalId>[0]): boolean {
  return excluded.has(sleepStyleInternalId(style))
}

const fillers: Readonly<Record<string, Readonly<Record<string, boolean>>>> | undefined = source.raeFiller?.byIsland
export function requireRaeSleepLottery() {
  if (!fillers) throw new Error('RAE 睡姿抽选资料不完整')
}
export function isRaeFiller(island: string, internalId: number): boolean {
  return fillers?.[island]?.[internalId] === true
}

export const RAE_SPO_RATE = 38_000
/** Worker deployment 63315b1 supplies fractional spoLeft before Otsu compression. */
export const raeSpoBudget = (power: number) => Math.max(0, power) / RAE_SPO_RATE
export const raeSpoCost = (dpr: number) => Math.round(dpr / RAE_SPO_RATE)
