// Offline sync: node scripts/sync-sleep-dpr.mjs <directory with nine map HTML pages>
import fs from 'node:fs'
import path from 'node:path'
import { applySleepDpr, referenceDpr, sleepDprKey, SPO_RATE, EX2_FALLBACK_FACTOR } from './sleep-dpr-data.mjs'
const maps = { greengrass: 1, cyan: 2, taupe: 3, snowdrop: 4, lapis: 5,
  powerplant: 6, canyon: 7, greenex: 10001, cyanex: 10002 }
const dataDir = path.resolve(import.meta.dirname, '../../core/src/data')
const sourceDir = process.argv[2]
if (!sourceDir) throw Error('Provide a directory containing all nine <mapId>.html pages')
const read = name => JSON.parse(fs.readFileSync(path.join(dataDir, `${name}.json`), 'utf8'))
const write = (name, value) => fs.writeFileSync(path.join(dataDir, `${name}.json`), JSON.stringify(value, null, 2) + '\n')
function collection(text, key) {
  const marker = `"${key}":`, start = text.indexOf(marker) + marker.length
  if (start < marker.length) throw Error(`Missing ${key}`)
  const open = text[start], close = open === '{' ? '}' : ']'
  let depth = 0, quoted = false, escaped = false
  for (let i = start; i < text.length; i++) {
    const c = text[i]
    if (quoted) {
      if (escaped) escaped = false
      else if (c === '\\') escaped = true
      else if (c === '"') quoted = false
    } else if (c === '"') quoted = true
    else if (c === open) depth++
    else if (c === close && --depth === 0) return JSON.parse(text.slice(start, i + 1))
  }
  throw Error(`Incomplete ${key}`)
}
const sources = Object.fromEntries(Object.entries(maps).map(([island, mapId]) => {
  const html = fs.readFileSync(path.join(sourceDir, `${mapId}.html`), 'utf8')
  const text = [...html.matchAll(/self\.__next_f\.push\(\[1,("(?:\\.|[^"\\])*")\]\)/g)].map(m => JSON.parse(m[1])).join('')
  return [island, { faces: collection(text, 'sleepStyleBaseDataMap'), spo: collection(text, 'spoRemapDataMap') }]
}))
const rows = read('sleep-styles')
const entries = rows.filter(row => !row.limited).map(row => {
  const data = sources[row.island], mapId = maps[row.island]
  const matches = Object.values(data.faces).filter(face => face.pokedexId === row.pokeId && face.rarity === row.stars
    && (row.styleId == null || face.internalId === row.styleId))
  if (matches.length !== 1) throw Error(`Ambiguous/missing sleep face: ${sleepDprKey(row)}`)
  const face = matches[0], computed = data.spo[face.spoId]?.computed
  const result = referenceDpr(computed, mapId, computed?.ex?.[10001] ? computed : sources.greenex.spo[face.spoId]?.computed)
  if (!result) {
    const approved = new Set(['taupe:330:4:', 'canyon:330:4:', 'canyon:373:3:', 'canyon:373:4:', 'canyon:558:4:'])
    if (!approved.has(sleepDprKey(row))) throw Error(`Unapproved missing reference: ${sleepDprKey(row)}`)
    return { key: sleepDprKey(row), internalId: face.internalId, spoId: face.spoId,
      dpr: row.dpr, source: '旧公式估算，RAE 参考值缺失，未核验', settled: false, estimated: true }
  }
  return { key: sleepDprKey(row), internalId: face.internalId, spoId: face.spoId, ...result,
    source: result.estimated ? 'RAE EX1 参考值 ×1.0351（用户指定估算）' : `RAE map/${mapId} 参考值 2026-10-09` }
})
const snapshot = { verifiedAt: '2026-10-09', sources: Object.values(maps).map(id => `https://pks.raenonx.cc/zh/map/${id}`),
  spoRate: SPO_RATE, raeUiMultiplier: 100, normalizedMultiplier: 1,
  ex2FallbackFactor: EX2_FALLBACK_FACTOR, entries }
const updated = applySleepDpr(rows, snapshot)
write('sleep-dpr-source', snapshot)
write('sleep-styles', updated)
const meta = read('meta')
meta.version = '2026-10-09'
meta.sleepDprSource = 'RAE 各地图参考值；EX2 缺项按 EX1 ×1.0351 估算；5 条普通睡姿保留未核验旧估算'
write('meta', meta)
console.log(`Synced ${entries.length} ordinary styles: ${entries.filter(e => !e.estimated).length} references, ${entries.filter(e => e.estimated && e.sourceMapId).length} EX2 estimates, ${entries.filter(e => !e.sourceMapId).length} unverified legacy estimates`)
