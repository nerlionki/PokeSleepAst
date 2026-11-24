export const RAE_FILLER_ISLANDS = ['greengrass', 'cyan', 'taupe', 'snowdrop', 'lapis', 'powerplant', 'canyon', 'greenex', 'cyanex'] as const

export function validateSleepLottery(data: Record<string, unknown>) {
  const source = data['sleep-last-roll-source.json'] as {
    raeFiller?: { source?: string, baseStyleCount?: number, byIsland?: Record<string, Record<string, boolean>> }
    excludedInternalIds?: number[]
  }
  const filler = source?.raeFiller
  const sleep = (data['event-parameters.json'] as { sleep?: { upWeights?: Record<string, unknown>, raeRestrictedLeaderChance?: number } } | undefined)?.sleep
  const weights = sleep?.upWeights
  const weightKeys = ['normal', 'small', 'mid', 'large']
  const share = sleep?.raeRestrictedLeaderChance
  if (!weights || weightKeys.some(key => typeof weights[key] !== 'number' || !Number.isFinite(weights[key]) || Number(weights[key]) <= 0)
    || weights.blocked !== 0 || typeof share !== 'number' || !Number.isFinite(share) || share < 0 || share > 1) {
    throw new Error('资料包缺少 RAE 睡姿抽选权重')
  }
  if (typeof filler?.source !== 'string' || !filler.source || !Number.isSafeInteger(filler.baseStyleCount) || filler.baseStyleCount! <= 0 ||
    !filler.byIsland || !Array.isArray(source.excludedInternalIds) ||
    source.excludedInternalIds.some(id => !Number.isSafeInteger(id) || id < 1)) {
    throw new Error('资料包缺少 RAE 睡姿抽选资料')
  }
  for (const island of RAE_FILLER_ISLANDS) {
    const rows = filler.byIsland[island]
    if (!rows || Array.isArray(rows) || !Object.values(rows).includes(true) ||
      Object.entries(rows).some(([id, enabled]) => !/^[1-9]\d*$/.test(id) || typeof enabled !== 'boolean')) {
      throw new Error(`RAE 睡姿补位资料无效：${island}`)
    }
  }
}
