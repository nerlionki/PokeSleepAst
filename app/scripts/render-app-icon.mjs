import { readFile, mkdir } from 'node:fs/promises'
import path from 'node:path'
import sharp from 'sharp'

const root = path.resolve(import.meta.dirname, '..')
const assets = path.join(root, 'assets')
const source = await readFile(path.join(assets, 'app-icon.svg'), 'utf8')
const backgroundTag = '<rect width="1024" height="1024" fill="url(#sky)"/>'

if (!source.includes(backgroundTag)) throw new Error('Icon background layer not found')

const foreground = source.replace(backgroundTag, '')
const background = `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024"><rect width="1024" height="1024" fill="#d7edeb"/></svg>`

await mkdir(assets, { recursive: true })
await Promise.all([
  sharp(Buffer.from(source)).resize(1024, 1024).png().toFile(path.join(assets, 'icon-only.png')),
  sharp(Buffer.from(foreground)).resize(1024, 1024).png().toFile(path.join(assets, 'icon-foreground.png')),
  sharp(Buffer.from(background)).png().toFile(path.join(assets, 'icon-background.png')),
])

console.log('Rendered app icon sources in assets/')
