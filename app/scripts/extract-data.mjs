import fs from 'node:fs'
import path from 'node:path'

const root = path.resolve(import.meta.dirname, '../..')
const mdPath = path.join(root, 'Sleep游戏资料.md')
const outDir = path.resolve(import.meta.dirname, '../../core/src/data')
fs.mkdirSync(outDir, { recursive: true })

const md = fs.readFileSync(mdPath, 'utf8')

function section(title) {
  const start = md.indexOf(title)
  if (start < 0) throw new Error(`missing ${title}`)
  const next = md.indexOf('\n## ', start + title.length)
  return md.slice(start, next < 0 ? undefined : next)
}

function parseTable(block) {
  const lines = block.split('\n').filter((l) => l.startsWith('|'))
  const rows = []
  for (const line of lines) {
    if (/^\|\s*-/.test(line) || /^\|\s*#\s*\|/.test(line) || /^\|\s*ID\s*\|/.test(line)) continue
    if (/^\|\s*岛屿\s*\|/.test(line) || /^\|\s*食谱\s*\|/.test(line) || /^\|\s*树果\s*\|/.test(line)) continue
    if (/^\|\s*登录睡姿\s*\|/.test(line) || /^\|\s*Lv\s*\|/.test(line) || /^\|\s*类别\s*\|/.test(line)) continue
    if (/^\|\s*评级\s*\|/.test(line) || /^\|\s*性格\s*\|/.test(line) || /^\|\s*稀有\s*\|/.test(line)) continue
    const cells = line.split('|').slice(1, -1).map((c) => c.trim())
    if (cells.length) rows.push(cells)
  }
  return rows
}

function num(s) {
  return Number(String(s).replace(/[,+%]/g, '').replace(/–.*/, '').trim())
}

function parsePokeId(s) {
  const m = String(s).trim().match(/^(\d+)(?:-(\d+))?$/)
  if (!m) return 0
  return m[2] ? Number(m[1]) * 100 + Number(m[2]) : Number(m[1])
}

function normalizeName(s) {
  return s
    .replace(/\s+/g, '')
    .replace(/[()（）]/g, '')
    .replace(/的樣子/g, '')
    .replace(/的样子/g, '')
}

const TRAD_MAP = {
  綠: '绿', 種: '种', 龍: '龙', 傑: '杰', 龜: '龟', 達: '达', 蘋: '苹',
  選: '选', 窩: '窝', 鮮: '鲜', 製: '制', 鬆: '松', 薑: '姜', 純: '纯',
  專: '专', 夢: '梦', 貓: '猫', 鳥: '鸟', 鴨: '鸭', 獸: '兽', 蟲: '虫',
  齒: '齿', 蔥: '葱', 麗: '丽', 擊: '击', 亂: '乱', 風: '风', 熱: '热',
  濕: '湿', 撥: '拨', 凱: '凯', 貪: '贪', 蠻: '蛮', 邁: '迈', 醬: '酱',
  濃: '浓', 湯: '汤', 捲: '卷', 煉: '炼', 獄: '狱', 乾: '干', 迷: '迷',
  昏: '昏', 覺: '觉', 醒: '醒', 腦: '脑', 居: '居', 斬: '斩', 壽: '寿',
  燒: '烧', 扮: '扮', 演: '演', 茂: '茂', 盛: '盛', 焗: '焗', 烤: '烤',
  酪: '酪', 梨: '梨', 彈: '弹', 跳: '跳', 麵: '面', 櫻: '樱', 餘: '余',
  異: '异',
}

function simplify(s) {
  return [...s].map((ch) => TRAD_MAP[ch] ?? ch).join('')
}

const berries = parseTable(section('## 6. 树果')).map((c) => ({
  name: c[0],
  type: c[1],
  energyLv1: num(c[2]),
  energyHigh: num(c[3]),
}))

function berryName(name) {
  const folded = simplify(name)
  return berries.find((b) => simplify(b.name) === folded)?.name ?? name
}

const ingredients = parseTable(section('## 7. 食材')).map((c) => ({
  id: num(c[0]),
  name: c[1],
  energy: num(c[2]),
  shards: num(c[3]),
}))

const ingredientByName = new Map()
for (const ing of ingredients) {
  ingredientByName.set(ing.name, ing)
  ingredientByName.set(normalizeName(ing.name), ing)
  ingredientByName.set(simplify(normalizeName(ing.name)), ing)
}

function findIngredient(name) {
  const n = name.replace(/×.*/, '').replace(/x\d+.*/i, '').trim()
  const s = simplify(normalizeName(n))
  return (
    ingredientByName.get(n)
    || ingredientByName.get(normalizeName(n))
    || ingredientByName.get(s)
    || ingredients.find((i) => {
      const is = simplify(normalizeName(i.name))
      return s === is || s.includes(is) || is.includes(s)
    })
  )
}

function parseRecipeBlock(block, category) {
  return parseTable(block)
    .filter((c) => c[0] && !c[0].includes('食谱'))
    .map((c) => {
      const bonus = num(c[3]) / 100
      const ings = []
      if (!c[4].includes('任意')) {
        for (const part of c[4].split(/[，,]/)) {
          const m = part.trim().match(/^(.+?)[×xX](\d+)$/)
          if (!m) continue
          const ing = findIngredient(m[1].trim())
          if (ing) ings.push({ id: ing.id, name: ing.name, count: Number(m[2]) })
        }
      }
      return {
        name: c[0],
        category,
        pot: num(c[1]),
        baseEnergy: num(c[2]),
        bonus,
        mix: c[4].includes('拌拌') || num(c[1]) === 0,
        ingredients: ings,
      }
    })
}

const recipeSec = section('## 8. 食谱')
const recipes = [
  ...parseRecipeBlock(recipeSec.split('### 8.2')[0], 'curry'),
  ...parseRecipeBlock(recipeSec.split('### 8.2')[1].split('### 8.3')[0], 'salad'),
  ...parseRecipeBlock(recipeSec.split('### 8.3')[1], 'dessert'),
]

/** 全能型数量按 1 / 30 / 60 级写，少写的是低等级还没有：梦幻「美味尾巴 2」= [0, 0, 2]。 */
function parsePokeIngredients(raw, allRounder = false) {
  if (!raw) return []
  return raw.split('；').map((part) => {
    const [name, qty] = part.trim().split(/\s+/)
    const nums = (qty || '').split('/').map(Number)
    const ing = findIngredient(name)
    const amounts = allRounder
      ? [...Array(Math.max(0, 3 - nums.length)).fill(0), ...nums]
      : nums.length === 1 ? [nums[0], nums[0], nums[0]] : nums
    return {
      id: ing?.id ?? 0,
      name: ing?.name ?? name,
      amounts,
    }
  }).filter((x) => x.name)
}

const pokeRows = md
  .split('\n')
  .filter((l) => /^\| \d+/.test(l) && l.includes('|') && l.split('|').length >= 12)

const pokedex = pokeRows.map((line) => {
  const c = line.split('|').slice(1, -1).map((x) => x.trim())
  const berry = berryName(c[4].replace(/\(.*\)/, '').trim())
  const berryType = (c[4].match(/\((.+)\)/) || [])[1] || ''
  return {
    id: parsePokeId(c[0]),
    name: c[1],
    specialty: c[2],
    sleepType: c[3],
    berry,
    berryType,
    interval: num(c[5]),
    carry: num(c[6]),
    ingredientRate: num(c[7]) / 100,
    skillRate: num(c[8]) / 100,
    mainSkill: c[9],
    friendship: num(c[10]),
    ingredients: parsePokeIngredients(c[11], c[2] === '全部'),
    formKey: normalizeName(c[1]),
  }
})

const ISLAND_META = [
  { id: 'greengrass', name: '萌绿之岛', heading: '### 萌绿之岛\n', berries: [], pot: 15, ex: false, helpFavored: 1, helpUnfavored: 1, band: 'greengrass' },
  { id: 'cyan', name: '天青沙滩', heading: '### 天青沙滩\n', berries: ['橙橙果', '椰木果', '桃桃果'], pot: 18, ex: false, helpFavored: 1, helpUnfavored: 1, band: 'cyan' },
  { id: 'taupe', name: '灰褐洞窟', heading: '### 灰褐洞窟\n', berries: ['蘋野果', '勿花果', '文柚果'], pot: 21, ex: false, helpFavored: 1, helpUnfavored: 1, band: 'taupe' },
  { id: 'snowdrop', name: '白花雪原', heading: '### 白花雪原\n', berries: ['莓莓果', '柿仔果', '异奇果'], pot: 24, ex: false, helpFavored: 1, helpUnfavored: 1, band: 'snowdrop' },
  { id: 'lapis', name: '宝蓝湖畔', heading: '### 宝蓝湖畔\n', berries: ['金枕果', '樱子果', '芒芒果'], pot: 27, ex: false, helpFavored: 1, helpUnfavored: 1, band: 'lapis' },
  { id: 'powerplant', name: '黄金旧发电厂', heading: '### 黄金旧发电厂\n', berries: ['萄葡果', '墨莓果', '靛莓果'], pot: 30, ex: false, helpFavored: 1, helpUnfavored: 1, band: 'late' },
  { id: 'canyon', name: '琥褐溪谷', heading: '### 琥褐溪谷\n', berries: ['零余果', '木子果', '番荔果'], pot: 33, ex: false, helpFavored: 1, helpUnfavored: 1, band: 'late' },
  { id: 'greenex', name: '萌绿之岛 EX', heading: '### 萌绿之岛 EX\n', berries: [], pot: 36, ex: true, helpFavored: 0.9, helpUnfavored: 1.15, band: 'late' },
  { id: 'cyanex', name: '天青沙滩 EX', heading: '### 天青沙滩 EX\n', berries: ['桃桃果', '椰木果', '橙橙果'], pot: 36, ex: true, helpFavored: 0.8, helpUnfavored: 1.35, band: 'late' },
]

function speciesFromIslandBlock(heading) {
  const i = md.indexOf(heading)
  if (i < 0) return []
  const chunk = md.slice(i, md.indexOf('\n### ', i + heading.length) > 0 ? md.indexOf('\n### ', i + heading.length) : md.length)
  const m = chunk.match(/常驻\/表内种族[^：:]*[：:](.+)/)
  if (!m) return []
  return m[1].split('、').map((s) => s.trim()).filter(Boolean)
}

const nameIndex = new Map()
for (const p of pokedex) {
  nameIndex.set(p.name, p)
  nameIndex.set(normalizeName(p.name), p)
  nameIndex.set(simplify(p.name), p)
}

function resolveSpecies(name) {
  return nameIndex.get(name) || nameIndex.get(normalizeName(name)) || nameIndex.get(simplify(name))
}

const islands = ISLAND_META.map((meta) => {
  const speciesNames = speciesFromIslandBlock(meta.heading)
  const species = speciesNames.map((n) => resolveSpecies(n)?.id).filter((id) => id != null)
  return { ...meta, speciesNames, species: [...new Set(species)] }
})

const bandRows = parseTable(section('### 3.2'))
const BAND_KEYS = ['greengrass', 'cyan', 'taupe', 'snowdrop', 'lapis', 'late']
const encounterBands = {}
bandRows.forEach((c, idx) => {
  const key = BAND_KEYS[idx]
  if (!key) return
  encounterBands[key] = [3, 4, 5, 6, 7, 8].map((count, i) => {
    const cell = c[i + 1]
    const parts = cell.replace(/,/g, '').split(/[–-]/).map((x) => x.replace('+', '').trim())
    return { count, min: Number(parts[0]) || 0, max: parts[1] ? Number(parts[1]) : Number.POSITIVE_INFINITY }
  })
})

const fallbackRows = parseTable(section('### 3.4'))
const fallbacks = {}
for (const c of fallbackRows) {
  const island = islands.find((i) => c[0].includes(i.name.replace(' EX', '')) || i.name.includes(c[0]))
  if (!island) continue
  fallbacks[island.id] = {
    dozing: c[1],
    snoozing: c[2],
    slumbering: c[3],
    balanced: c[4],
  }
}
fallbacks.greenex = fallbacks.greengrass
fallbacks.cyanex = fallbacks.cyan
fallbacks.canyon = {
  dozing: '绿毛虫',
  snoozing: '皮卡丘',
  slumbering: '皮丘',
  balanced: '皮卡丘',
}

const expRows = md.split('\n').filter((l) => /^\| \d+ \|/.test(l) && l.includes('|') && section('### 4.3').includes(l))
const xpTable = []
for (const line of section('### 4.3').split('\n')) {
  if (!/^\| \d+/.test(line)) continue
  const c = line.split('|').slice(1, -1).map((x) => x.trim())
  if (c.length >= 3 && /^\d+$/.test(c[0])) {
    xpTable.push({ level: num(c[0]), exp: num(c[1]), shards: num(c[2]) })
    if (c[3] && /^\d+$/.test(c[3])) {
      xpTable.push({ level: num(c[3]), exp: num(c[4]), shards: num(c[5]) })
    }
  }
}
xpTable.sort((a, b) => a.level - b.level)

const candyDrops = [
  { key: 'unevolved', label: '未进化', stars: [4, 6, 9, 10] },
  { key: 'babyOnce', label: '幼年进化一次', stars: [5, 7, 10, 11] },
  { key: 'once', label: '非幼年进化一次', stars: [6, 8, 11, 12] },
  { key: 'none', label: '无进化', stars: [7, 9, 12, 13] },
  { key: 'eevee', label: '伊布进化型等', stars: [8, 10, 13, 14] },
  { key: 'twice', label: '进化二次', stars: [9, 11, 14, 15] },
  { key: 'legendary', label: '传说', stars: [11, 13, 16, 0] },
  { key: 'mythical', label: '幻之宝可梦', stars: [11, 16, 20, 0] },
]

const mealRecovery = [
  { min: 0, max: 19, recover: 19 },
  { min: 20, max: 39, recover: 16 },
  { min: 40, max: 59, recover: 13 },
  { min: 60, max: 79, recover: 10 },
  { min: 80, max: 99, recover: 7 },
  { min: 100, max: 119, recover: 5 },
  { min: 120, max: 149, recover: 3 },
  { min: 150, max: 150, recover: 0 },
]

const potTiers = parseTable(section('## 12. 营地、评级与锅子')).map((c) => ({
  sleepStyles: num(c[0]),
  pot: num(c[1]),
  shards: num(c[2]),
}))

const rankThresholds = [
  { rank: '普通1', strength: 0 },
  { rank: '普通2', strength: 3118 },
  { rank: '普通3', strength: 7171 },
  { rank: '普通4', strength: 11693 },
  { rank: '普通5', strength: 17149 },
  { rank: '超级1', strength: 23385 },
  { rank: '超级2', strength: 31492 },
  { rank: '超级3', strength: 41314 },
  { rank: '超级4', strength: 53006 },
  { rank: '超级5', strength: 65634 },
  { rank: '高级1', strength: 79197 },
  { rank: '高级2', strength: 93540 },
  { rank: '高级3', strength: 109130 },
  { rank: '高级4', strength: 125032 },
  { rank: '高级5', strength: 156121 },
  { rank: '大师1', strength: 187832 },
  { rank: '大师5', strength: 321146 },
  { rank: '大师10', strength: 532707 },
  { rank: '大师15', strength: 1199506 },
  { rank: '大师20', strength: 3245795 },
]

const sleepFaces = JSON.parse(fs.readFileSync(path.join(outDir, 'sleep-faces.json'), 'utf8'))
const sleepMap = JSON.parse(fs.readFileSync(path.join(outDir, 'sleep-map-mask.json'), 'utf8'))

function islandMask(islandId) {
  const map = new Map()
  for (const part of (sleepMap[islandId]?.bits ?? '').split(',')) {
    if (!part) continue
    const [id, mask] = part.split(':')
    map.set(Number(id), Number(mask))
  }
  return map
}

function sleepStyleName(pokeId, star) {
  return sleepFaces[`${pokeId}-${star}`] ?? ''
}

const sleepStyles = []
let styleId = 1
for (const island of islands) {
  const allowed = islandMask(island.id)
  for (const id of island.species) {
    const poke = pokedex.find((p) => p.id === id)
    if (!poke) continue
    const mask = allowed.get(poke.id) ?? 0
    for (let star = 1; star <= 4; star++) {
      if ((mask & (1 << (star - 1))) === 0) continue
      const dpr = Math.round(poke.friendship * 8000 * star * star)
      const faces = poke.id === 132 && star === 4 ? (sleepMap[island.id]?.ditto ?? []) : []
      if (faces.length) {
        for (const face of faces) {
          sleepStyles.push({
            id: styleId++,
            pokeId: poke.id,
            name: poke.name,
            island: island.id,
            sleepType: poke.sleepType,
            stars: star,
            styleId: face.styleId,
            styleName: face.name,
            dpr,
          })
        }
        continue
      }
      sleepStyles.push({
        id: styleId++,
        pokeId: poke.id,
        name: poke.name,
        island: island.id,
        sleepType: poke.sleepType,
        stars: star,
        styleName: sleepStyleName(poke.id, star),
        dpr,
      })
    }
  }
  for (const face of sleepMap.limited ?? []) {
    const poke = pokedex.find((p) => p.id === face.pokeId)
    if (!poke) continue
    const dpr = Math.round(poke.friendship * 8000 * face.stars * face.stars)
    sleepStyles.push({
      id: styleId++,
      pokeId: poke.id,
      name: poke.name,
      island: island.id,
      sleepType: poke.sleepType,
      stars: face.stars,
      styleId: face.styleId,
      styleName: face.styleName,
      dpr,
      limited: true,
    })
  }
}

const natures = [
  { name: '怕寂寞', up: 'help', down: 'energy' },
  { name: '固执', up: 'help', down: 'ingredient' },
  { name: '顽皮', up: 'help', down: 'skill' },
  { name: '勇敢', up: 'help', down: 'exp' },
  { name: '大胆', up: 'energy', down: 'help' },
  { name: '淘气', up: 'energy', down: 'ingredient' },
  { name: '乐天', up: 'energy', down: 'skill' },
  { name: '悠闲', up: 'energy', down: 'exp' },
  { name: '内敛', up: 'ingredient', down: 'help' },
  { name: '慢吞吞', up: 'ingredient', down: 'energy' },
  { name: '马虎', up: 'ingredient', down: 'skill' },
  { name: '冷静', up: 'ingredient', down: 'exp' },
  { name: '温和', up: 'skill', down: 'help' },
  { name: '温顺', up: 'skill', down: 'energy' },
  { name: '慎重', up: 'skill', down: 'ingredient' },
  { name: '自大', up: 'skill', down: 'exp' },
  { name: '胆小', up: 'exp', down: 'help' },
  { name: '急躁', up: 'exp', down: 'energy' },
  { name: '爽朗', up: 'exp', down: 'ingredient' },
  { name: '天真', up: 'exp', down: 'skill' },
  { name: '害羞', up: null, down: null },
  { name: '勤奋', up: null, down: null },
  { name: '坦率', up: null, down: null },
  { name: '浮躁', up: null, down: null },
  { name: '认真', up: null, down: null },
]

const subskills = [
  { id: 'berryS', name: '树果数量S', rarity: 'gold' },
  { id: 'sleepExp', name: '睡眠EXP奖励', rarity: 'gold' },
  { id: 'helpingBonus', name: '帮手奖励', rarity: 'gold' },
  { id: 'researchExp', name: '研究EXP奖励', rarity: 'gold' },
  { id: 'shardBonus', name: '梦之碎片奖励', rarity: 'gold' },
  { id: 'skillLevelM', name: '技能等级提升M', rarity: 'gold' },
  { id: 'energyRecover', name: '活力回复奖励', rarity: 'gold' },
  { id: 'helpM', name: '帮忙速度M', rarity: 'blue' },
  { id: 'ingM', name: '食材概率提升M', rarity: 'blue' },
  { id: 'invL', name: '持有上限提升L', rarity: 'blue' },
  { id: 'invM', name: '持有上限提升M', rarity: 'blue' },
  { id: 'skillM', name: '技能概率提升M', rarity: 'blue' },
  { id: 'skillLevelS', name: '技能等级提升S', rarity: 'blue' },
  { id: 'helpS', name: '帮忙速度S', rarity: 'white' },
  { id: 'ingS', name: '食材概率提升S', rarity: 'white' },
  { id: 'invS', name: '持有上限提升S', rarity: 'white' },
  { id: 'skillS', name: '技能概率提升S', rarity: 'white' },
]

const mainSkills = {
  charge: ['能量填充S', '能量填充S(X)', '能量填充S(X~Y)', '能量填充M', '蓄力', '梦魇', '波导弹', '精神击破'],
  heal: ['活力填充S', '活力疗愈S', '活力全体疗愈S', '月光', '新月祈祷', '树果汁', '治愈波动', '蹭蹭脸颊'],
}

const meta = {
  version: '2026-10-03',
  source: 'Sleep游戏资料.md',
  pokedex: pokedex.length,
  recipes: recipes.length,
  islands: islands.length,
  sleepStyles: sleepStyles.length,
}

function write(name, data) {
  fs.writeFileSync(path.join(outDir, name), `${JSON.stringify(data, null, 2)}\n`)
}

write('berries.json', berries)
write('ingredients.json', ingredients)
write('recipes.json', recipes)
write('pokedex.json', pokedex)
write('islands.json', islands.map(({ heading, ...rest }) => rest))
write('encounter-bands.json', encounterBands)
write('fallbacks.json', fallbacks)
write('xp.json', xpTable)
write('candy-drops.json', candyDrops)
write('meal-recovery.json', mealRecovery)
write('pot-tiers.json', potTiers)
write('ranks.json', rankThresholds)
write('sleep-styles.json', sleepStyles)
write('natures.json', natures)
write('subskills.json', subskills)
write('main-skills.json', mainSkills)
write('meta.json', meta)

console.log(meta)
