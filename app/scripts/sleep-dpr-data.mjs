export const SPO_RATE = 38000
export const EX2_FALLBACK_FACTOR = 1.0351
export function sleepDprKey(row) {
  return `${row.island}:${row.pokeId}:${row.stars}:${row.styleId ?? ''}`
}
// References are at 1.0x; RAE displays that multiplier as 100, not 100x.
export function referenceDpr(computed, mapId, ex1Computed = computed) {
  const own = mapId >= 10000 ? computed?.ex?.[mapId] : computed?.regular
  if (Number.isFinite(own?.reference) && own.reference > 0) {
    return { dpr: Math.round(own.reference * SPO_RATE), spo: own.reference,
      settled: own.isSettled === true, estimated: false, sourceMapId: mapId }
  }
  const base = ex1Computed?.ex?.[10001]
  if (mapId === 10002 && Number.isFinite(base?.reference) && base.reference > 0) {
    return { dpr: Math.round(base.reference * SPO_RATE * EX2_FALLBACK_FACTOR),
      spo: base.reference, settled: false, estimated: true, sourceMapId: 10001 }
  }
  return undefined
}
export function applySleepDpr(rows, snapshot) {
  const entries = new Map(snapshot.entries.map(entry => [entry.key, entry]))
  return rows.map(row => {
    if (row.limited) return row
    const entry = entries.get(sleepDprKey(row))
    if (!entry) throw Error(`Missing DPR snapshot: ${sleepDprKey(row)}`)
    return { ...row, dpr: entry.dpr, dprSource: entry.source,
      dprSettled: entry.settled, dprEstimated: entry.estimated }
  })
}
