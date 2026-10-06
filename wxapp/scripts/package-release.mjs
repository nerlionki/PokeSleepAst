import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'
const require = createRequire(import.meta.url)
const Zip = require('adm-zip')
const root = path.resolve(import.meta.dirname, '../..')
const version = JSON.parse(fs.readFileSync(path.join(root, 'wxapp/package.json'))).version
const output = path.join(root, 'app/release')
fs.mkdirSync(output, { recursive: true })
const app = new Zip()
app.addLocalFolder(path.join(root, 'wxapp/dist'))
app.addLocalFile(path.join(root, 'wxapp/README.md'), '', 'README.md')
app.writeZip(path.join(output, `PokeSleepAst-${version}-weapp.zip`))
const file = path.join(output, `PokeSleepAst-${version}-weapp.zip`)
for (const entry of new Zip(file).getEntries()) {
  if (!entry.isDirectory && entry.getData().length !== entry.header.size) throw new Error(`ZIP validation failed: ${entry.entryName}`)
}
console.log(`${file}: ${fs.statSync(file).size} bytes`)
