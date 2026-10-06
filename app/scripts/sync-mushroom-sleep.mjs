// Offline, reproducible extraction from downloaded RAE pokedex pages.
// node scripts/sync-mushroom-sleep.mjs release/rae-hotfix-590.html release/rae-hotfix-591.html
import fs from 'node:fs'
import path from 'node:path'

function collection(source, key) {
  const marker = `"${key}":`
  const start = source.indexOf(marker) + marker.length
  if (start < marker.length) throw new Error(`Missing ${key}`)
  const open = source[start], close = open === '{' ? '}' : ']'
  let depth = 0, quoted = false, escaped = false
  for (let i = start; i < source.length; i++) {
    const c = source[i]
    if (quoted) {
      if (escaped) escaped = false
      else if (c === '\\') escaped = true
      else if (c === '"') quoted = false
    } else if (c === '"') quoted = true
    else if (c === open) depth++
    else if (c === close && --depth === 0) return JSON.parse(source.slice(start, i + 1))
  }
  throw new Error(`Unclosed ${key}`)
}

const dataDir = path.resolve(import.meta.dirname, '../../core/src/data')
const read = name => JSON.parse(fs.readFileSync(path.join(dataDir, `${name}.json`), 'utf8'))
const write = (name, value, compact = false) => fs.writeFileSync(path.join(dataDir, `${name}.json`), `${JSON.stringify(value, null, compact ? undefined : 2)}\n`)
const styles = read('sleep-styles'), ranks = read('snorlax-ranks')
const snapshot = { verifiedAt: '2026-10-06', conversion: 'RAE getDprInfo: computed.regular.reference × 38000', pokemon: [] }
const maps = { 1: 'greengrass', 5: 'lapis', 7: 'canyon' }
for (const [index, file] of process.argv.slice(2).entries()) {
  const id = [590, 591][index]
  if (!id) throw new Error('Exactly two pokedex pages are supported')
  const html = fs.readFileSync(file, 'utf8')
  const source = [...html.matchAll(/self\.__next_f\.push\(\[1,("(?:\\.|[^"\\])*")\]\)/g)].map(m => JSON.parse(m[1])).join('')
  const faces = collection(source, 'sleepStyleBaseDataMap'), remap = collection(source, 'spoRemapDataMap')
  const links = collection(source, 'sleepStyleLinkages').filter(link => maps[link.mapId] && link.type === 'regular' && link.pokedexId === id)
  const entries = links.map(link => {
    const face = faces[link.sleepStyleInternalId], computed = remap[face.spoId]?.computed.regular
    if (!computed || !Number.isFinite(computed.reference)) throw new Error(`Missing ordinary SPO for ${id}`)
    const island = maps[link.mapId], dpr = computed.reference * 38000
    const row = styles.find(style => style.pokeId === id && style.island === island && style.stars === face.rarity)
    if (!row) throw new Error(`Missing sleep style: ${id}/${island}/${face.rarity}`)
    row.dpr = dpr
    row.dprSource = 'RAE 2026-10-06'
    row.dprSettled = computed.isSettled
    const rank = (link.minSnorlaxRank.title - 1) * 5 + link.minSnorlaxRank.number - 1
    ranks[island].unlock[`${id}-${face.rarity}`] = rank
    return { island, stars: face.rarity, raeId: face.internalId, dpr, rankIndex: rank, settled: computed.isSettled }
  })
  snapshot.pokemon.push({ id, url: `https://pks.raenonx.cc/zh/pokedex/${id}`, entries })
}
if (snapshot.pokemon.length !== 2) throw new Error('Provide both 590 and 591 HTML pages')
write('sleep-styles', styles)
write('snorlax-ranks', ranks, true)
write('mushroom-sleep-source', snapshot)
const meta = read('meta')
meta.version = '2026-10-06'
meta.sleepStyles = styles.length
meta.mushroomSleepSource = 'RAE 普通岛睡姿，2026-10-06 核验'
write('meta', meta)
console.log(`Verified ${snapshot.pokemon.reduce((n, p) => n + p.entries.length, 0)} ordinary-island mushroom sleep styles`)
