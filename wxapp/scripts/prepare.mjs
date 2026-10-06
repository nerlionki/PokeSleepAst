import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'
const root = path.resolve(import.meta.dirname, '../..')
const wxRoot = path.join(root, 'wxapp')
const core = path.join(root, 'core/src')
const generated = path.join(wxRoot, 'src/generated')
const require = createRequire(path.join(wxRoot, 'package.json'))
const write = (file, value) => { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, value) }
const walk = dir => fs.readdirSync(dir, { withFileTypes: true }).flatMap(f => f.isDirectory() ? walk(path.join(dir, f.name)) : [path.join(dir, f.name)])
function clean(dir) {
  const checked = path.resolve(dir)
  if (!checked.startsWith(path.join(wxRoot, 'src') + path.sep)) throw new Error('Unsafe generated path')
  fs.rmSync(checked, { recursive: true, force: true })
}
clean(generated)
for (const file of walk(core)) {
  const rel = path.relative(core, file).replaceAll('\\', '/')
  if (!/\.(vue|ts)$/.test(file) || rel.includes('assets/') || rel === 'components/layout/AppShell.vue' || rel.startsWith('components/update/')) continue
  const dest = path.join(generated, rel)
  if (file.endsWith('.ts')) {
    let source = path.relative(path.dirname(dest), file).replaceAll('\\', '/').replace(/\.ts$/, '')
    write(dest, `export * from '${source}'\n`)
    continue
  }
  let text = fs.readFileSync(file, 'utf8').replaceAll('\r\n', '\n')
  text = text.replace(/import UpdateSettings from[^\n]*\n/g, '').replace(/<UpdateSettings\s*\/>/g, '')
  text = text.replace('<article class="card"></article>', '')
  if (rel === 'components/plan/BabyEfficiencyPane.vue') text = text.replace(/watch\(busy,[\s\S]*?\n\}\)\n/, '')
  text = text.replace(/\s+v-back="[^"]*"/g, '')
  text = text.replace(/<Teleport\b[^>]*>/g, '').replace(/<\/Teleport>/g, '')
  const tags = [['input', 'WxInput'], ['select', 'WxSelect'], ['textarea', 'WxTextarea'], ['a', 'WxLink'], ['img', 'WxImage']]
  const imports = []
  for (const [tag, component] of tags) {
    if (!new RegExp(`<${tag}\\b`).test(text)) continue
    const source = path.relative(path.dirname(dest), path.join(wxRoot, `src/components/${component}.vue`)).replaceAll('\\', '/')
    imports.push(`import ${component} from '${source}'`)
    text = text.replace(new RegExp(`<${tag}\\b((?:[^"'>]|"[^"]*"|'[^']*')*)>`, 'g'), (_match, attrs) => `<${component}${attrs.replace(/\s*\/$/, '')}${['input', 'img'].includes(tag) ? ' />' : '>'}`)
    text = text.replace(new RegExp(`</${tag}>`, 'g'), `</${component}>`)
  }
  if (rel === 'views/ProfileView.vue') {
    imports.push("import OcrModels from '../../components/OcrModels.vue'", "import { importBackupText } from '#platform/backup'")
    text = text.replace('async function wipe()', `async function importFile() {\n  try { incoming.value = await importBackupText(); msg.value = '文件已读取，请选择合并或覆盖导入' }\n  catch (error) { msg.value = error instanceof Error ? error.message : '文件选择取消或失败' }\n}\n\nasync function wipe()`)
    text = text.replace('<div class="stack">', '<div class="stack"><OcrModels />').replace('<WxTextarea', '<button class="btn ghost" @click="importFile">选择备份 JSON 文件</button><WxTextarea')
  }
  if (rel === 'components/pokemon/BoxPane.vue') text = text.replace('从截图导入</button>', '从截图导入（体验版）</button>')
  if (imports.length) text = text.replace(/(<script setup[^>]*>)/, '$1\n' + imports.join('\n'))
  write(dest, text)
}
// Each asset subpackage stays below 2 MB and is loaded only when its images are used.
for (const dir of fs.readdirSync(path.join(wxRoot, 'src')).filter(n => /^asset-pack\d+$/.test(n))) clean(path.join(wxRoot, 'src', dir))
const map = {}
let pack = 0, size = 0
const assets = walk(path.join(core, 'assets/imgs')).sort()
for (const file of assets) {
  const bytes = fs.statSync(file).size
  if (size + bytes > 1_700_000) { pack++; size = 0 }
  size += bytes
  const rel = path.relative(path.join(core, 'assets/imgs'), file).replaceAll('\\', '/')
  const dest = path.join(wxRoot, 'src', `asset-pack${pack}`, rel)
  fs.mkdirSync(path.dirname(dest), { recursive: true }); fs.copyFileSync(file, dest)
  map[rel] = `/asset-pack${pack}/${rel}`
}
write(path.join(wxRoot, 'src/platform/image-map.json'), JSON.stringify(map))
const subPackages = Array.from({ length: pack + 1 }, (_, index) => ({ name: `asset-pack${index}`, root: `asset-pack${index}`, pages: ['index'] }))
for (const item of subPackages) {
  write(path.join(wxRoot, 'src', item.root, 'index.vue'), '<template><view /></template>\n')
  write(path.join(wxRoot, 'src', item.root, 'index.config.ts'), 'export default {}\n')
}
const pages = ['pokemon', 'plan', 'team', 'data', 'profile']
const labels = ['宝可梦', '规划', '配队', '资料', '我的']
write(path.join(wxRoot, 'src/app.config.ts'), `export default defineAppConfig(${JSON.stringify({ pages: pages.map(p => `pages/${p}/index`), window: { navigationBarTitleText: '宝睡助手', navigationBarBackgroundColor: '#081018', navigationBarTextStyle: 'white', backgroundColor: '#081018' }, tabBar: { color: '#93a4b5', selectedColor: '#7fcec0', backgroundColor: '#101a26', list: pages.map((p, i) => ({ pagePath: `pages/${p}/index`, text: labels[i] })) }, subPackages, workers: { path: 'workers', isSubpackage: true }, lazyCodeLoading: 'requiredComponents' }, null, 2)})\n`)
// Native Worker gets its own pure-core bundle; no Vue or platform code enters it.
const esbuild = require('esbuild')
fs.mkdirSync(path.join(wxRoot, 'src/workers'), { recursive: true })
await esbuild.build({ stdin: { contents: `import { searchBabyEfficiency } from './core/src/calc/babyEfficiency';\nworker.onMessage(({options}) => { try { const result = searchBabyEfficiency(options, progress => worker.postMessage({type:'progress',progress})); worker.postMessage({type:'result',result}); } catch(error) { worker.postMessage({type:'error',message:error.message || '计算失败'}); } });`, resolveDir: root }, outfile: path.join(wxRoot, 'src/workers/baby.js'), bundle: true, platform: 'neutral', format: 'iife', target: 'es2020', minify: true })
// Read ONNX protobuf metadata directly; preparing WeChat does not require Web inference.
function fields(data) {
  let offset = 0
  const result = []
  function number() { let value = 0, shift = 0, byte; do { byte = data[offset++]; value += (byte & 127) * 2 ** shift; shift += 7 } while (byte & 128); return value }
  while (offset < data.length) {
    const tag = number(), wire = tag & 7, field = tag >>> 3
    if (wire === 2) { const size = number(); result.push({ field, data: data.subarray(offset, offset + size) }); offset += size }
    else if (wire === 0) number()
    else if (wire === 1) offset += 8
    else if (wire === 5) offset += 4
    else throw new Error('Unsupported ONNX metadata wire format')
  }
  return result
}
const models = {}
for (const name of ['det', 'rec']) {
  const file = path.join(root, 'core/public/ocr', `${name}.onnx`)
  const data = fs.readFileSync(file)
  const graph = fields(fields(data).find(item => item.field === 7).data)
  const valueName = field => fields(graph.find(item => item.field === field).data).find(item => item.field === 1).data.toString('utf8')
  models[name] = { input: valueName(11), output: valueName(12), size: data.length }
}
write(path.join(wxRoot, 'src/platform/ocr-models.json'), JSON.stringify(models))
write(path.join(wxRoot, 'src/platform/ocr-dict.json'), JSON.stringify(fs.readFileSync(path.join(root, 'core/public/ocr/keys.txt'), 'utf8').replace(/^\uFEFF/, '').trimEnd().split(/\r?\n/)))
let css = fs.readFileSync(path.join(core, 'style.css'), 'utf8').replaceAll(':root', 'page').replace(/html, body, #app/g, 'page').replace(/\bbody\b/g, 'page').replaceAll('input[type="checkbox"]', 'switch')
write(path.join(wxRoot, 'src/app.css'), css + '\npage{padding:16px;box-sizing:border-box;font-size:14px} .wx-select{padding:8px;min-height:24px} image{display:inline-block} button{line-height:1.5} textarea{width:100%;min-height:100px} .source-link{color:#7fcec0;margin-right:12px} .wx-settings{margin-bottom:14px}\n')
console.log(`Prepared shared views and ${pack + 1} asset subpackages (${assets.length} images).`)
