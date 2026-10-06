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
const models = new Zip()
for (const file of ['det.onnx', 'rec.onnx']) models.addLocalFile(path.join(root, 'core/public/ocr', file))
models.addFile('README.txt', Buffer.from('解压后把 det.onnx 与 rec.onnx 发到微信，在小程序“我的”页面导入两份文件。OCR 为体验版，请在真机自行验证。\n', 'utf8'))
models.writeZip(path.join(output, `PokeSleepAst-${version}-ocr-models.zip`))
for (const suffix of ['weapp', 'ocr-models']) {
  const file = path.join(output, `PokeSleepAst-${version}-${suffix}.zip`)
  for (const entry of new Zip(file).getEntries()) {
    if (!entry.isDirectory && entry.getData().length !== entry.header.size) throw new Error(`ZIP validation failed: ${entry.entryName}`)
  }
  console.log(`${file}: ${fs.statSync(file).size} bytes`)
}
