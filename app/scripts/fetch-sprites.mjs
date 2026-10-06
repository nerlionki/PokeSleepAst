import fs from 'node:fs'
import path from 'node:path'
import pokedex from '../../core/src/data/pokedex.json' with { type: 'json' }

const ART = {
  7006: 10037,
  7007: 10038,
  7054: 10253,
  8001: 10126,
  71002: 710,
  71003: 710,
  71004: 710,
  71102: 711,
  71103: 711,
  71104: 711,
  9001: 25,
  9002: 25,
  9003: 25,
  9004: 133,
  9005: 133,
  9006: 363,
  9007: 25,
}

function artId(id) {
  if (ART[id]) return ART[id]
  if (id > 10000) return Math.floor(id / 100)
  if (id > 8000 && id < 9000) return 849
  return id
}

const outDir = path.resolve(import.meta.dirname, '../../core/public/sprites')
fs.mkdirSync(outDir, { recursive: true })
const ids = [...new Set(pokedex.map((p) => p.id))]

async function fetchOne(id) {
  const dest = path.join(outDir, `${id}.png`)
  if (fs.existsSync(dest) && fs.statSync(dest).size > 800) return 'skip'
  const url = `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${artId(id)}.png`
  const res = await fetch(url)
  if (!res.ok) return 'fail'
  fs.writeFileSync(dest, Buffer.from(await res.arrayBuffer()))
  return 'ok'
}

const queue = [...ids]
let ok = 0
let fail = 0
async function worker() {
  while (queue.length) {
    const id = queue.shift()
    try {
      const r = await fetchOne(id)
      if (r === 'ok' || r === 'skip') ok += 1
      else fail += 1
    }
    catch {
      fail += 1
    }
  }
}

await Promise.all(Array.from({ length: 8 }, () => worker()))
console.log({ total: ids.length, ok, fail, dir: outDir })
