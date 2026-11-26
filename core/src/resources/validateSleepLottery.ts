export const RAE_FILLER_ISLANDS = ['greengrass', 'cyan', 'taupe', 'snowdrop', 'lapis', 'powerplant', 'canyon', 'greenex', 'cyanex'] as const

function validateSleepStyleIds(data: Record<string, unknown>) {
  const styles = data['sleep-styles.json'] as { island: string, pokeId: number, stars: number, styleId?: number, raeStyleId?: number }[] | undefined
  if (!Array.isArray(styles) || !styles.some(style => style?.raeStyleId !== undefined)) return
  const source = data['sleep-dpr-source.json'] as { entries?: { key: string, internalId: number }[] } | undefined
  const ids = new Map((source?.entries ?? []).map(({ key, internalId }) => [key, internalId]))
  const seen = new Set<string>()
  for (const row of styles) {
    const internalId = row?.raeStyleId
    if (internalId == null || !Number.isSafeInteger(internalId) || internalId <= 0) throw new Error('资料包缺少 RAE 睡姿抽选资料')
    const expected = ids.get(`${row.island}:${row.pokeId}:${row.stars}:${row.styleId ?? ''}`) ?? row.styleId
    const link = `${row.island}:${internalId}`
    if (internalId !== expected || seen.has(link)) throw new Error('资料包缺少 RAE 睡姿抽选资料')
    seen.add(link)
  }
}

export function validateSleepLottery(data: Record<string, unknown>) {
  validateSleepStyleIds(data)
  const source = data['sleep-last-roll-source.json'] as {
    raeFiller?: { source?: string, baseStyleCount?: number, byIsland?: Record<string, Record<string, boolean>> }
    excludedInternalIds?: number[]
  }
  const filler = source?.raeFiller
  const sleep = (data['event-parameters.json'] as { sleep?: { upWeights?: Record<string, unknown>, raeRestrictedLeaderChance?: number } } | undefined)?.sleep
  const weights = sleep?.upWeights
  const weightKeys = ['small', 'mid', 'large']
  const share = sleep?.raeRestrictedLeaderChance
  const positiveWeight = (value: unknown) => typeof value === 'number' && Number.isFinite(value) && value > 0
  if (!weights || weightKeys.some(key => !positiveWeight(weights[key]))) {
    throw new Error('资料包缺少 RAE 睡姿抽选权重')
  }
  // Published v2 snapshots predating the RAE lottery extension have none of its fields.
  if (filler === undefined && share === undefined && weights.normal === undefined && weights.blocked === undefined) return
  if (!positiveWeight(weights.normal) || weights.blocked !== 0 || typeof share !== 'number' || !Number.isFinite(share) || share < 0 || share > 1) {
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
