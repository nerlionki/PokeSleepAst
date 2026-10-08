import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'
import { createHash } from 'node:crypto'
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
  // Native text nodes cannot host image children. Preserve inline icon rows
  // using a view, including berry labels and member production summaries.
  const template = require('@vue/compiler-sfc').parse(text).descriptor.template
  if (template) {
    const edits = []
    const hasImage = node => /^(?:\w*Icon|PokeSprite|img)$/.test(node.tag ?? '') || (node.children ?? []).some(hasImage)
    const visit = node => {
      if (['span', 'em'].includes(node.tag) && hasImage(node)) {
        edits.push({ start: node.loc.start.offset + 1, length: node.tag.length, value: 'view' })
        const closing = template.content.lastIndexOf(`</${node.tag}`, node.loc.end.offset)
        edits.push({ start: closing + 2, length: node.tag.length, value: 'view' })
        const cls = node.props.find(prop => prop.type === 6 && prop.name === 'class')
        edits.push(cls?.value ? { start: cls.value.loc.start.offset + 1, length: 0, value: 'wx-inline ' } : { start: node.loc.start.offset + 1 + node.tag.length, length: 0, value: ' class="wx-inline"' })
      }
      for (const child of node.children ?? []) visit(child)
    }
    visit(require('@vue/compiler-dom').parse(template.content))
    let content = template.content
    for (const edit of edits.sort((a, b) => b.start - a.start)) content = content.slice(0, edit.start) + edit.value + content.slice(edit.start + edit.length)
    text = text.slice(0, template.loc.start.offset) + content + text.slice(template.loc.end.offset)
  }
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
    imports.push("import { importBackupText } from '#platform/backup'")
    text = text.replace('async function wipe()', `async function importFile() {\n  try { incoming.value = await importBackupText(); msg.value = '文件已读取，请选择合并或覆盖导入' }\n  catch (error) { msg.value = error instanceof Error ? error.message : '文件选择取消或失败' }\n}\n\nasync function wipe()`)
    text = text.replace('<WxTextarea', '<button class="btn ghost" @click="importFile">选择备份 JSON 文件</button><WxTextarea')
  }
  if (rel === 'components/shared/SubskillIcon.vue') {
    text = `<script setup lang="ts">
import { computed } from 'vue'
import { SUBSKILLS } from '../../calc/data'
import { subskillImageUrl } from '../../calc/raeImage'
import WxImage from '../../../components/WxImage.vue'
const props = defineProps<{ id: string; locked?: boolean }>()
const skill = computed(() => SUBSKILLS.find(item => item.id === props.id))
const src = computed(() => subskillImageUrl(props.id))
</script>
<template><WxImage v-if="skill" class="sub-ico wx-sub-ico" :class="{ locked }" :src="src" :alt="skill.name" /></template>
`
  }
  if (imports.length) text = text.replace(/(<script setup[^>]*>)/, '$1\n' + imports.join('\n'))
  write(dest, text)
}
// Native async modules cross package boundaries; image components cannot reference
// another package's raw files. PNG payloads are materialized in USER_DATA_PATH.
for (const dir of fs.readdirSync(path.join(wxRoot, 'src')).filter(n => /^asset-pack\d+$/.test(n))) clean(path.join(wxRoot, 'src', dir))
const map = {}
const manifest = {}
let pack = 0, size = 0
const sharp = require('sharp')
const skillImageNumbers = Object.fromEntries([...fs.readFileSync(path.join(core, 'calc/raeImage.ts'), 'utf8').split('const SUBSKILL_IMAGE')[1].split('}')[0].matchAll(/(\w+):\s*(\d+)/g)].map(match => [match[1], Number(match[2])]))
const skillColors = Object.fromEntries(JSON.parse(fs.readFileSync(path.join(core, 'data/subskills.json'))).map(skill => [skillImageNumbers[skill.id], { gold: '#e2a423', blue: '#3c86d6', white: '#f4f7fb' }[skill.rarity]]))
const assetRoots = [path.join(core, 'assets/imgs'), path.join(root, 'core/public')]
const assets = assetRoots.flatMap(dir => walk(dir).filter(file => /\.(webp|png|jpe?g)$/i.test(file)).map(file => ({ file, rel: path.relative(dir, file).replaceAll('\\', '/') }))).sort((a, b) => a.rel.localeCompare(b.rel, 'en'))
let payload = {}
const flush = () => write(path.join(wxRoot, 'src', `asset-pack${pack}`, 'images.js'), `module.exports=${JSON.stringify(payload)};\n`)
for (const { file, rel } of assets) {
  let image = sharp(file).resize({ width:128, height:128, fit:'inside', withoutEnlargement:true })
  const skillNumber = /^subSkill\/(\d+)\./.exec(rel)?.[1]
  if (skillNumber && skillColors[skillNumber]) {
    const { data: alpha, info } = await image.ensureAlpha().extractChannel(3).raw().toBuffer({ resolveWithObject: true })
    image = sharp({ create: { width: info.width, height: info.height, channels: 3, background: skillColors[skillNumber] } }).joinChannel(alpha, { raw: { width: info.width, height: info.height, channels: 1 } })
  }
  const data = await image.png({ palette:true, quality:100, compressionLevel:9 }).toBuffer()
  const key = rel.replace(/\.[^.]+$/, '.png')
  const base64 = data.toString('base64')
  const bytes = Buffer.byteLength(JSON.stringify(key)) + base64.length + 4
  if (size + bytes > 1_600_000) { flush(); pack++; size = 0; payload = {} }
  size += bytes
  payload[key] = base64
  const url = `/asset-pack${pack}/${key}`
  map[rel] = url
  manifest[url] = { pack:`asset-pack${pack}`, key, file:`${createHash('sha256').update(data).digest('hex')}.png`, size:data.length }
}
flush()
write(path.join(wxRoot, 'src/platform/image-map.json'), JSON.stringify(map))
write(path.join(wxRoot, 'src/platform/image-manifest.json'), JSON.stringify(manifest))
const subPackages = Array.from({ length: pack + 1 }, (_, index) => ({ name: `asset-pack${index}`, root: `asset-pack${index}`, pages: ['index'] }))
// Keep original model bytes in resource packages, below the single-package limit.
for (const dir of fs.readdirSync(path.join(wxRoot, 'src')).filter(n => /^ocr-pack\d+$/.test(n))) clean(path.join(wxRoot, 'src', dir))
const modelChunks = {}
let modelPack = 0
for (const name of ['det', 'rec']) {
  const data = fs.readFileSync(path.join(root, 'core/public/ocr', `${name}.onnx`))
  modelChunks[name] = []
  for (let offset = 0; offset < data.length; offset += 1_600_000) {
    const packageName = `ocr-pack${modelPack++}`
    const bytes = data.subarray(offset, offset + 1_600_000)
    write(path.join(wxRoot, 'src', packageName, 'model.bin'), bytes)
    write(path.join(wxRoot, 'src', packageName, 'images.js'), `module.exports={path:${JSON.stringify(`${packageName}/model.bin`)}};\n`)
    modelChunks[name].push({ pack: packageName, size: bytes.length })
    subPackages.push({ name: packageName, root: packageName, pages: ['index'] })
  }
}
const modelLoaders = subPackages.filter(item => item.name.startsWith('ocr-')).map(item => `${JSON.stringify(item.name)}:()=>require.async(${JSON.stringify(`./${item.name}/images.js`)})`).join(',')
write(path.join(wxRoot, 'src/native/image-loader.js'), require('./config/native-image-loader.cjs').imageLoaderSource(subPackages.filter(item => item.name.startsWith('asset-')).map(item => item.name)) + `\nexports.loadModelChunk=function(name){const loaders={${modelLoaders}};if(!loaders[name])return Promise.reject(new Error('Invalid model package'));return loaders[name]();};\n`)
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
  models[name] = { input: valueName(11), output: valueName(12), size: data.length, chunks: modelChunks[name], hash: createHash('sha256').update(data).digest('hex') }
}
write(path.join(wxRoot, 'src/platform/ocr-models.json'), JSON.stringify(models))
write(path.join(wxRoot, 'src/platform/ocr-dict.json'), JSON.stringify(fs.readFileSync(path.join(root, 'core/public/ocr/keys.txt'), 'utf8').replace(/^\uFEFF/, '').trimEnd().split(/\r?\n/)))
let css = fs.readFileSync(path.join(core, 'style.css'), 'utf8').replace(/\bbody\s*\{[\s\S]*?\n\}/, 'body { background: #081018; }').replaceAll(':root', 'page').replace(/html, body, #app/g, 'page').replace(/\bbody\b/g, 'page').replaceAll('input[type="checkbox"]', 'switch')
write(path.join(wxRoot, 'src/app.css'), css + '\npage{padding:16px;box-sizing:border-box;font-size:16px;min-height:100vh;background:#081018;background-image:none} view,text,button,input,picker,textarea{box-sizing:border-box} .page{padding-left:0;padding-right:0} .wx-control{display:block;width:100%;max-width:100%;min-width:0;box-sizing:border-box;font-size:16px;color:var(--text)} .wx-input{height:44px;line-height:24px;padding:10px 12px} .wx-select{padding:10px 12px;min-height:44px;background:var(--ink-2);border:1px solid var(--line);border-radius:12px;overflow-wrap:anywhere} .wx-inline{display:inline-flex;align-items:center;gap:4px;min-width:0} .wx-sub-ico{background:transparent;mask-image:none;-webkit-mask-image:none} .wx-textarea{padding:10px 12px} image{display:inline-block} button{line-height:1.5;margin:0} textarea{width:100%;min-height:100px} .source-link{color:#7fcec0;margin-right:12px} .wx-settings{margin-bottom:14px}\n')
console.log(`Prepared shared views and ${pack + 1} asset subpackages (${assets.length} images).`)
