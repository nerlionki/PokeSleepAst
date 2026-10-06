import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'
import { createHash } from 'node:crypto'
import { runInNewContext } from 'node:vm'
const root = path.resolve(import.meta.dirname, '..')
const dist = path.join(root, 'dist')
const config = JSON.parse(fs.readFileSync(path.join(dist, 'app.json')))
const project = JSON.parse(fs.readFileSync(path.join(root, 'project.config.json')))
if (project.appid !== 'wxa305c12ee6676e08') throw Error('Incorrect AppID')
if (config.pages.length !== 5) throw Error('Missing feature pages')
const walk = d => fs.readdirSync(d, {withFileTypes:true}).flatMap(f => f.isDirectory() ? walk(path.join(d,f.name)) : [path.join(d,f.name)])
const files = walk(dist)
const require = createRequire(import.meta.url)
const images = JSON.parse(fs.readFileSync(path.join(root, 'src/platform/image-map.json'), 'utf8'))
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'src/platform/image-manifest.json'), 'utf8'))
for (const folder of [path.resolve(root, '../core/src/assets/imgs'), path.resolve(root, '../core/public')]) {
  for (const file of walk(folder).filter(file => /\.(webp|png|jpe?g)$/i.test(file))) {
    const key = path.relative(folder, file).replaceAll('\\', '/')
    if (!images[key]) throw Error(`Source image missing from WeChat: ${key}`)
  }
}
const modules = new Map()
for (const url of Object.values(images)) {
  const item = manifest[url]
  if (!item) throw Error(`Image manifest missing ${url}`)
  if (!modules.has(item.pack)) modules.set(item.pack, require(path.join(dist, item.pack, 'images.js')))
  const data = Buffer.from(modules.get(item.pack)[item.key] ?? '', 'base64')
  if (data.length !== item.size || data.subarray(0, 8).toString('hex') !== '89504e470d0a1a0a' || `${createHash('sha256').update(data).digest('hex')}.png` !== item.file) throw Error(`Invalid image payload: ${url}`)
}
for (const folder of ['berry/', 'ingredient/', 'mainSkill/', 'meal/', 'pokemon/icons/', 'pokemon/portrait/', 'subSkill/', 'items/', 'sprites/']) {
  if (!Object.keys(images).some(key => key.startsWith(folder))) throw Error(`Missing image category ${folder}`)
}
const bridge = fs.readFileSync(path.join(dist, 'image-loader.js'), 'utf8')
if (!bridge.includes('require.async(') || bridge.includes('wx.loadSubpackage')) throw Error('Invalid native async image bridge')
const literalImports = new Set([...bridge.matchAll(/require\.async\(\s*["']\.\/(asset-pack\d+)\/images\.js["']\s*\)/g)].map(match => match[1]))
for (const item of Object.values(manifest)) if (!literalImports.has(item.pack)) throw Error(`Native image package needs a literal async dependency: ${item.pack}`)
const wxss = fs.readFileSync(path.join(dist, 'app.wxss'), 'utf8')
const pageRules = [...wxss.matchAll(/(?:^|})\s*page\s*\{([^}]*)\}/g)].map(match => match[1])
if (pageRules.some(rule => rule.includes('gradient(')) || !pageRules.some(rule => /background-image\s*:\s*none/.test(rule))) throw Error('WeChat page background must be solid')
for (const file of walk(path.join(root, 'src/generated')).filter(file => file.endsWith('.vue'))) {
  if (/\b(?:crypto\.randomUUID|document\.|window\.|navigator\.)/.test(fs.readFileSync(file, 'utf8'))) throw Error(`Browser API in WeChat view: ${file}`)
}
const size = list => list.reduce((sum,file)=>sum+fs.statSync(file).size,0)
const sub = config.subPackages ?? config.subpackages ?? []
const main = files.filter(file => !sub.some(p => file.startsWith(path.join(dist,p.root)+path.sep)) && !(config.workers?.isSubpackage && file.startsWith(path.join(dist, config.workers.path) + path.sep)))
const importingChunks = main.filter(file => file.endsWith('.js') && /require\(["']\.\/image-loader\.js["']\)/.test(fs.readFileSync(file, 'utf8')))
if (!importingChunks.length) throw Error('Image loader must remain a native external require')
const nativeModules = new Map()
const asyncPaths = []
function nativeModule(file) {
  if (nativeModules.has(file)) return nativeModules.get(file).exports
  if (!fs.existsSync(file)) throw Error(`Native module missing: ${path.relative(dist, file)}`)
  const module = { exports:{} }
  nativeModules.set(file, module)
  const nativeRequire = Object.assign(arg => nativeModule(path.resolve(path.dirname(file), arg)), { async:async arg => {
    const target = path.resolve(path.dirname(file), arg)
    asyncPaths.push(target)
    return nativeModule(target)
  } })
  runInNewContext(fs.readFileSync(file, 'utf8'), { module, exports:module.exports, require:nativeRequire, Promise, Error }, { filename:file })
  return module.exports
}
const first = Object.values(manifest)[0]
for (const chunk of importingChunks) {
  const loader = nativeModule(path.join(path.dirname(chunk), 'image-loader.js'))
  const payload = await loader.loadImageModule(first.pack)
  if (payload[first.key] !== modules.get(first.pack)[first.key]) throw Error(`Native image loader returned wrong payload: ${chunk}`)
}
if (asyncPaths.some(file => file !== path.join(dist, first.pack, 'images.js'))) throw Error('Native async image paths must resolve from the root bridge')
console.log(`Main package: ${size(main)} bytes; total: ${size(files)} bytes`)
if (size(main) > 2 * 1024 * 1024) throw Error('Main package exceeds 2 MB')
for(const pack of sub) {
  const bytes = size(files.filter(f=>f.startsWith(path.join(dist,pack.root)+path.sep)))
  console.log(`${pack.root}: ${bytes} bytes`)
  if(bytes > 2 * 1024 * 1024) throw Error(`${pack.root} exceeds 2 MB`)
}
if(size(files) > 20 * 1024 * 1024) throw Error('Total package exceeds 20 MB')
if(config.workers?.isSubpackage && size(files.filter(file => file.startsWith(path.join(dist, config.workers.path) + path.sep))) > 2 * 1024 * 1024) throw Error('Worker subpackage exceeds 2 MB')
const profile = fs.readFileSync(path.join(root,'src/generated/views/ProfileView.vue'),'utf8')
if(profile.includes('UpdateSettings') || profile.includes('资料版本')) throw Error('WeChat must not contain update check or data version panel')
console.log('WeChat build verified: pages, AppID, package sizes and profile scope.')
console.log(`Verified ${Object.keys(images).length} PNG images and the native async loader.`)
console.log(`Verified native image require paths from ${importingChunks.length} importing chunks.`)
