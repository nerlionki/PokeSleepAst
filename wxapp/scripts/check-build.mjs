import fs from 'node:fs'
import path from 'node:path'
const root = path.resolve(import.meta.dirname, '..')
const dist = path.join(root, 'dist')
const config = JSON.parse(fs.readFileSync(path.join(dist, 'app.json')))
const project = JSON.parse(fs.readFileSync(path.join(root, 'project.config.json')))
if (project.appid !== 'wxa305c12ee6676e08') throw Error('Incorrect AppID')
if (config.pages.length !== 5) throw Error('Missing feature pages')
const walk = d => fs.readdirSync(d, {withFileTypes:true}).flatMap(f => f.isDirectory() ? walk(path.join(d,f.name)) : [path.join(d,f.name)])
const files = walk(dist)
for (const file of walk(path.join(root, 'src/generated')).filter(file => file.endsWith('.vue'))) {
  if (/\b(?:crypto\.randomUUID|document\.|window\.|navigator\.)/.test(fs.readFileSync(file, 'utf8'))) throw Error(`Browser API in WeChat view: ${file}`)
}
const size = list => list.reduce((sum,file)=>sum+fs.statSync(file).size,0)
const sub = config.subPackages ?? config.subpackages ?? []
const main = files.filter(file => !sub.some(p => file.startsWith(path.join(dist,p.root)+path.sep)) && !(config.workers?.isSubpackage && file.startsWith(path.join(dist, config.workers.path) + path.sep)))
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
