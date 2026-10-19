import { build } from 'vite'
import { fileURLToPath } from 'node:url'

// 使用与双端面板相同的共享算法和默认配置；不读写用户的图鉴记录。
const bundle = await build({
  configFile: false, publicDir: false, logLevel: 'warn',
  plugins: [{ name: 'completion-cli',
    resolveId(id) { if (id === '#platform/images') return '\0' + id },
    load(id) {
      if (id === '\0#platform/images') return 'export const localImage = () => ""'
    },
  }],
  build: { write: false, minify: false, lib: { entry: fileURLToPath(new URL('./completionCalculation.ts', import.meta.url)), formats: ['es'] } },
})
const chunk = (Array.isArray(bundle) ? bundle[0] : bundle).output.find(item => item.type === 'chunk')
const { DEFAULT_COMPLETION_EFFICIENCY, searchBabyEfficiency, SLEEP_STYLES, styleKey } = await import(`data:text/javascript;base64,${Buffer.from(chunk.code).toString('base64')}`)
const [pokeId, stars, styleId] = process.argv.slice(2).map(Number)
const target = SLEEP_STYLES.find(style => !style.limited && style.pokeId === pokeId && style.stars === stars && (styleId == null || style.styleId === styleId))
if (!target) throw new Error('未找到普通研究睡姿，用法：node scripts/calculate-completion.mjs 宝可梦ID 星级 [睡姿ID]')
const matches = new Set(SLEEP_STYLES.filter(style => !style.limited && style.pokeId === pokeId && style.stars === stars).map(style => styleKey(style.pokeId, style.stars, style.styleId)))
if (matches.size > 1 && styleId == null) throw new Error('同星级存在多个睡姿，请指定睡姿ID')
const options = { ...DEFAULT_COMPLETION_EFFICIENCY, pokeId, completionTarget: styleKey(pokeId, stars, target.styleId) }
let last = 0
const result = searchBabyEfficiency(options, progress => {
  if (Date.now() - last < 10000) return
  last = Date.now()
  console.error(JSON.stringify(progress))
})
console.log(JSON.stringify({ target: { name: target.name, stars, styleName: target.styleName }, ...result }, null, 2))
