import { mkdirSync, readdirSync } from 'node:fs'
import path from 'node:path'
import sharp from 'sharp'

const portraitDir = path.resolve('../core/src/assets/imgs/pokemon/portrait')
const outDir = path.join(portraitDir, 'shiny')
mkdirSync(outDir, { recursive: true })

const skip = new Set(['151', '491'])
const files = readdirSync(portraitDir).filter((name) => name.endsWith('.webp') && !skip.has(name.replace(/\.webp$/, '')))

async function fetchOne(name) {
  const base = name.replace(/\.webp$/, '')
  const dest = path.join(outDir, `${base}.webp`)
  const url = 'https://cdn.raenonx.cc/api/content/pks?src=' + encodeURIComponent(`/images/pokemon/portrait/shiny/${base}.png`)
  const res = await fetch(url)
  if (!res.ok) return `${base} ${res.status}`
  const buf = Buffer.from(await res.arrayBuffer())
  if (buf[0] !== 0x89 || buf[1] !== 0x50 || buf[2] !== 0x4e || buf[3] !== 0x47) return `${base} not-png ${buf.subarray(0, 12).toString('hex')}`
  await sharp(buf).resize(256, 256, { fit: 'inside', withoutEnlargement: true }).webp({ quality: 82 }).toFile(dest)
  return null
}

const queue = [...files]
let ok = 0
let fail = 0
const failed = []
async function worker() {
  while (queue.length) {
    const name = queue.shift()
    try {
      const error = await fetchOne(name)
      if (error) {
        fail += 1
        failed.push(error)
      }
      else ok += 1
    }
    catch (error) {
      fail += 1
      failed.push(`${name} ${error.message}`)
    }
  }
}

await Promise.all(Array.from({ length: 8 }, () => worker()))
console.log({ ok, fail, skipped: [...skip] })
if (failed.length) console.log(failed.join('\n'))
