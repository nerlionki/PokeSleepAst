import type { BoxPokemon, IngredientSlots, OcrMissingField } from '../types'
import { NATURES, SUBSKILLS, pokeById } from './data'
import { slotDrop } from './ingredients'
import { MAIN_SKILLS, skillMaxFor } from './mainSkills'
import { defaultTune } from './member'
import { defaultFirstSlot, isAllRounder } from './specialty'
import { ocrFold } from './text'

export interface OcrWord {
  text: string
  x: number
  y: number
  width: number
  height: number
}

export interface ParseOptions {
  portraitId: number | null
  shiny?: boolean
  /** 第 2、第 3 食材格对上的食材行。没对上是 null。 */
  slotLines: [number | null, number | null]
}

function center(word: OcrWord) {
  return { x: word.x + word.width / 2, y: word.y + word.height / 2 }
}

function levelIn(text: string): number | null {
  const matched = ocrFold(text).match(/lv\.?(\d+)/)
  if (!matched) return null
  const level = Number(matched[1])
  if (!Number.isInteger(level) || level < 1 || level > 100) return null
  return level
}

function stripLevelPrefix(text: string): string {
  return text.replace(/^[Ll][Vv]\.?\s*\d+\s*/, '').trim()
}

function noiseLabel(text: string): boolean {
  const key = ocrFold(text)
  if (!key) return true
  const compact = key.replace(/[\/／\s]/g, '')
  if (compact === '帮忙能力' || compact === '性格' || compact === '主技能副技能' || compact === '食材' || compact === '树果' || compact === '返回') return true
  if (/^lv\.?\d+$/.test(key) || /sp\d/.test(key) || /^[\d:.]+$/.test(key)) return true
  if (natureName(text) || subskillId(text)) return true
  return false
}

function spWord(words: OcrWord[]): OcrWord | null {
  return [...words].filter((word) => /sp\d/.test(ocrFold(word.text))).sort((a, b) => a.y - b.y)[0] ?? null
}

function nameWord(words: OcrWord[]): OcrWord | null {
  if (!words.length) return null
  const sp = spWord(words)
  if (sp) {
    const near = words.filter((word) => {
      if (word === sp) return false
      const dy = center(word).y - center(sp).y
      const dx = Math.abs(center(word).x - center(sp).x)
      return dy > -word.height && dy < sp.height * 4 && dx < Math.max(sp.width, word.width) * 1.6
    })
    const level = [...near].filter((word) => levelIn(word.text) != null).sort((a, b) => a.x - b.x)[0]
    if (level) {
      const rest = stripLevelPrefix(level.text)
      if (rest && ocrFold(rest) !== ocrFold(level.text) && !noiseLabel(rest)) return level
      const beside = near
        .filter((word) => word !== level && center(word).x > level.x && Math.abs(center(word).y - center(level).y) < level.height * 1.4 && !noiseLabel(word.text))
        .sort((a, b) => a.x - b.x)[0]
      if (beside) return beside
    }
  }
  const top = Math.min(...words.map((word) => word.y))
  const bottom = Math.max(...words.map((word) => word.y + word.height))
  const upper = words.filter((word) => word.y < top + (bottom - top) * 0.45)
  const glued = upper
    .map((word) => ({ word, rest: stripLevelPrefix(word.text) }))
    .filter((item) => item.rest && ocrFold(item.rest) !== ocrFold(item.word.text) && !noiseLabel(item.rest))
    .sort((a, b) => b.word.height - a.word.height || a.word.y - b.word.y)[0]
  if (glued) return glued.word
  const levelWord = [...upper.filter((word) => levelIn(word.text) != null)].sort((a, b) => b.height - a.height)[0]
  if (levelWord) {
    const beside = upper
      .filter((word) => word !== levelWord && center(word).x > levelWord.x && Math.abs(center(word).y - center(levelWord).y) < levelWord.height && !noiseLabel(word.text))
      .sort((a, b) => a.x - b.x)[0]
    if (beside) return beside
  }
  return [...upper].sort((a, b) => a.x - b.x).find((word) => !noiseLabel(word.text)) ?? null
}

function subskillId(text: string): string {
  let key = ocrFold(text)
  if (/^忙速度[sm]$/.test(key)) key = `帮${key}`
  const recurring: Record<string, string> = {
    手: 'helpingBonus',
    手厅: 'helpingBonus',
    帮手厅: 'helpingBonus',
    常手爽厅: 'helpingBonus',
    活力回复厅: 'energyRecover',
  }
  if (recurring[key]) return recurring[key]
  if (key.length < 2) return ''
  const exact = SUBSKILLS.find((item) => ocrFold(item.name) === key)
  if (exact) return exact.id
  const prefixed = SUBSKILLS.filter((item) => ocrFold(item.name).startsWith(key))
  return prefixed.length === 1 ? prefixed[0]!.id : ''
}

function natureName(text: string): string {
  const key = ocrFold(text)
  return NATURES.find((nature) => ocrFold(nature.name) === key)?.name ?? ''
}

function cardMidX(words: OcrWord[]): number {
  const left = Math.min(...words.map((word) => word.x))
  const right = Math.max(...words.map((word) => word.x + word.width))
  return (left + right) / 2
}

function placeSubskills(words: OcrWord[]): string[] {
  const slots = ['', '', '', '', '']
  const section = [...words]
    .filter((word) => ocrFold(word.text).replace(/[\/／]/g, '').includes('副技能'))
    .sort((a, b) => a.y - b.y)[0]
  const nature = [...words]
    .filter((word) => ocrFold(word.text) === '性格' && (!section || word.y > section.y))
    .sort((a, b) => a.y - b.y)[0]
  const pool = words.filter((word) => (!section || word.y > section.y + section.height) && (!nature || word.y < nature.y))
  const hits = pool.flatMap((word) => {
    const id = subskillId(word.text)
    if (!id) return []
    const at = center(word)
    return [{ ...word, id, cx: at.x, cy: at.y }]
  })
  if (!hits.length) return slots
  const mid = cardMidX(words)
  const textHeight = [...hits].sort((a, b) => a.height - b.height)[Math.floor(hits.length / 2)]?.height ?? 28
  const step = textHeight * 4.7
  const minY = Math.min(...hits.map((hit) => hit.cy))
  const maxY = Math.max(...hits.map((hit) => hit.cy))
  const gateRow = (level: number): number | null => {
    if (level === 10 || level === 25) return 0
    if (level === 50 || level === 70 || level === 75) return 1
    if (level === 80 || level === 100) return 2
    return null
  }
  const anchors = words.flatMap((word) => {
    const level = levelIn(word.text)
    const row = level == null ? null : gateRow(level)
    if (row == null) return []
    const cy = word.y + word.height + textHeight * 1.3
    if (cy < minY - step * 1.2 || cy > maxY + step * 1.2) return []
    return [{ row, cy }]
  })
  const rows: typeof hits[] = []
  for (const hit of [...hits].sort((a, b) => a.cy - b.cy)) {
    const row = rows.find((group) => Math.abs(group[0]!.cy - hit.cy) < Math.max(hit.height, group[0]!.height) * 0.7)
    if (row) row.push(hit)
    else rows.push([hit])
  }
  const firstY = rows[0]?.reduce((sum, hit) => sum + hit.cy, 0) / rows[0]!.length
  const firstAnchor = firstY == null
    ? null
    : [...anchors].sort((a, b) => Math.abs(a.cy - firstY) - Math.abs(b.cy - firstY))[0]
  const rowOffset = firstAnchor && Math.abs(firstAnchor.cy - firstY) < textHeight * 1.8
    ? firstAnchor.row
    : 0
  rows.forEach((row, rowIndex) => {
    const visualRow = rowIndex + rowOffset
    if (visualRow > 2) return
    for (const hit of row) {
      const index = visualRow * 2 + (hit.cx >= mid ? 1 : 0)
      if (index < 5 && !slots[index]) slots[index] = hit.id
    }
  })
  return slots
}

function headerLevel(words: OcrWord[], name: OcrWord | null): { word: OcrWord, level: number } | null {
  const levels = words.flatMap((word) => {
    const level = levelIn(word.text)
    return level == null ? [] : [{ word, level, ...center(word) }]
  })
  if (!levels.length) return null
  if (name) {
    const at = center(name)
    const limit = name.width * 3 + 80
    const nearest = [...levels].sort((a, b) => Math.hypot(a.x - at.x, a.y - at.y) - Math.hypot(b.x - at.x, b.y - at.y))[0]
    if (!nearest) return null
    if (Math.hypot(nearest.x - at.x, nearest.y - at.y) > limit) return null
    return { word: nearest.word, level: nearest.level }
  }
  const top = Math.min(...words.map((word) => word.y))
  const bottom = Math.max(...words.map((word) => word.y + word.height))
  const band = levels.filter((item) => item.y < top + (bottom - top) * 0.45)
  const left = band.filter((item) => item.x < cardMidX(words))
  const pool = left.length ? left : band
  const glued = pool.filter((item) => ocrFold(item.word.text).replace(/lv\.?\d+/, '').length > 0)
  const pickFrom = glued.length ? glued : pool
  const biggest = [...pickFrom].sort((a, b) => b.word.height - a.word.height)[0]
  return biggest ? { word: biggest.word, level: biggest.level } : null
}

function skillLevelOf(words: OcrWord[], pokeId: number, header: OcrWord | null): number | null {
  const max = skillMaxFor(pokeById(pokeId)?.mainSkill ?? '')
  const hits = words.flatMap((word) => {
    if (word === header) return []
    const level = levelIn(word.text)
    if (level == null || level > max) return []
    return [{ word, level, x: center(word).x }]
  })
  const right = [...hits].sort((a, b) => b.x - a.x)[0]
  return right?.level ?? null
}

function ribbonHours(words: OcrWord[]): number {
  const texts = [words.map((word) => word.text).join(''), ...words.map((word) => word.text)]
  for (const text of texts) {
    const matched = text.match(/(\d+)\s*小时\s*(\d+)\s*分/)
    if (matched) return Number(matched[1]) + Number(matched[2]) / 60
  }
  return 0
}

function ingredientSlotsFor(pokeId: number, slotLines: [number | null, number | null]): IngredientSlots {
  const poke = pokeById(pokeId)
  const count = poke?.ingredients.length ?? 0
  const allRounder = isAllRounder(poke)
  if (!allRounder && count <= 3) return [0, slotLines[0] ?? 1, slotLines[1] ?? 2]
  return [allRounder ? defaultFirstSlot(pokeId) : 0, slotLines[0], slotLines[1]]
}

function headerCluster(words: OcrWord[]): OcrWord[] {
  const name = nameWord(words)
  const level = headerLevel(words, name)
  const anchors = [name, level?.word].filter((word): word is OcrWord => word != null)
  if (!anchors.length) return []
  const top = Math.min(...anchors.map((word) => word.y))
  const bottom = Math.max(...anchors.map((word) => word.y + word.height))
  const left = Math.min(...anchors.map((word) => word.x))
  const right = Math.max(...anchors.map((word) => word.x + word.width))
  const sp = words.filter((word) => {
    if (!/sp\d/.test(ocrFold(word.text))) return false
    const overlap = Math.min(word.x + word.width, right) - Math.max(word.x, left)
    if (overlap <= 0) return false
    return word.y + word.height >= top - word.height * 3 && word.y <= bottom + word.height
  })
  return [...new Set([...anchors, ...sp])]
}

/** 头像在等级和 SP 的左侧，盖住整颗圆头，不裁到名字文字上。 */
export function avatarBox(words: OcrWord[]): { x: number, y: number, size: number } | null {
  const cluster = headerCluster(words)
  const anchor = cluster.length ? cluster : (nameWord(words) ? [nameWord(words)!] : [])
  if (!anchor.length) return null
  const left = Math.min(...anchor.map((word) => word.x))
  const top = Math.min(...anchor.map((word) => word.y))
  const bottom = Math.max(...anchor.map((word) => word.y + word.height))
  const textH = Math.max(...anchor.map((word) => word.height))
  const size = Math.max(bottom - top, textH * 6.2)
  return {
    x: left - size * 1.02,
    y: (top + bottom) / 2 - size / 2,
    size,
  }
}

export function splitCards(words: OcrWord[]): OcrWord[][] {
  if (!words.length) return []
  const headers = words
    .filter((word) => ocrFold(word.text).includes('忙能力'))
    .sort((a, b) => center(a).x - center(b).x)
  if (headers.length < 2) return [words]
  const edges = [-Infinity, ...headers.slice(1).map((word) => word.x), Infinity]
  const groups = headers.map(() => [] as OcrWord[])
  for (const word of words) {
    const x = center(word).x
    const index = edges.findIndex((edge, i) => x >= edge && x < edges[i + 1]!)
    if (index >= 0) groups[index]?.push(word)
  }
  return groups.filter((group) => group.length)
}

export interface IngredientQuantityMark {
  word: OcrWord
  quantity: number | null
}

/** 食材图标下方的数量。PP-OCR 有时会漏掉乘号，所以也接受食材行里的纯数字。 */
export function ingredientQuantityMarks(words: OcrWord[]): [IngredientQuantityMark | null, IngredientQuantityMark | null] {
  const food = [...words].filter((word) => ocrFold(word.text) === '食材').sort((a, b) => a.y - b.y)[0]
  // 宝可梦信息浮层会遮住“食材”标题，但 30/60 级锁定标签和数量仍可见。
  // 必须同时找到两档标签，避免把技能等级或其它数字当成食材行。
  const locked = [30, 60].map((level) => words.find((word) => new RegExp(`^lv[.．·]?\\s*${level}$`, 'i').test(word.text.trim())))
  const anchor = food ?? (locked[0] && locked[1] ? locked[0] : null)
  if (!anchor) return [null, null]
  const end = [...words]
    .filter((word) => word.y > anchor.y && /[間间]隔/.test(word.text))
    .sort((a, b) => a.y - b.y)[0]
  const bottom = end?.y ?? anchor.y + anchor.height * 8
  const left = Math.min(...words.map((word) => word.x))
  const right = Math.max(...words.map((word) => word.x + word.width))
  const width = Math.max(1, right - left)
  const columns: [IngredientQuantityMark | null, IngredientQuantityMark | null, IngredientQuantityMark | null] = [null, null, null]
  const targets = [0.56, 0.75, 0.93]
  for (const word of words) {
    if (word.y <= anchor.y + anchor.height || word.y >= bottom) continue
    const matched = word.text.trim().match(/^(?:[×xX✕＊*]\s*)?(\d{1,3})$/)
    if (!matched) continue
    const ratio = (center(word).x - left) / width
    const slot: 0 | 1 | 2 | null = ratio >= 0.84 ? 2 : ratio >= 0.64 ? 1 : ratio >= 0.42 ? 0 : null
    if (slot == null) continue
    const candidate = { word, quantity: Number(matched[1]) }
    const current = columns[slot]
    if (!current || Math.abs(ratio - targets[slot]!) < Math.abs((center(current.word).x - left) / width - targets[slot]!)) {
      columns[slot] = candidate
    }
  }
  if (!columns[1] && columns[0] && columns[2]) {
    const first = columns[0].word
    const third = columns[2].word
    columns[1] = {
      quantity: null,
      word: {
        text: '',
        x: (first.x + third.x) / 2,
        y: (first.y + third.y) / 2,
        width: (first.width + third.width) / 2,
        height: (first.height + third.height) / 2,
      },
    }
  }
  if (!columns[2] && columns[0] && columns[1]) {
    const first = columns[0].word
    const second = columns[1].word
    columns[2] = {
      quantity: null,
      word: {
        text: '',
        x: second.x + second.x - first.x,
        y: second.y + second.y - first.y,
        width: second.width,
        height: second.height,
      },
    }
  }
  return [columns[1], columns[2]]
}

/** 第 2 格 slot=1，第 3 格 slot=2。数量对不上这一格的产量时视为没对上。 */
export function matchIngredientSlot(pokeId: number, slot: 1 | 2, ingredientId: number | null, quantity: number | null): number | null {
  const poke = pokeById(pokeId)
  if (!poke) return null
  const allowed = poke.ingredients.length > 3
    ? poke.ingredients.map((_, index) => index)
    : (slot === 1 ? [0, 1] : [0, 1, 2]).filter((index) => index < poke.ingredients.length)
  if (ingredientId == null) {
    if (quantity == null) return null
    const byQuantity = allowed.filter((index) => slotDrop(poke.ingredients, slot, index)?.amount === quantity)
    return byQuantity.length === 1 ? byQuantity[0]! : null
  }
  const hits = allowed.filter((index) => poke.ingredients[index]?.id === ingredientId)
  const matched = hits.filter((index) => {
    if (quantity == null) return true
    return slotDrop(poke.ingredients, slot, index)?.amount === quantity
  })
  return matched.length === 1 ? matched[0]! : (quantity == null && hits.length === 1 ? hits[0]! : null)
}

function skillBase(name: string): string {
  return ocrFold(name).replace(/[（(].*$/, '')
}

/** 画面上的主技能名。括号里的区间不参与比较，能量填充 S 和能量填充 M 仍然分开。 */
export function readMainSkill(words: OcrWord[]): string | null {
  const names = MAIN_SKILLS.flatMap((skill) => [skill.name, ...skill.aliases])
    .map((name) => ({ name, folded: ocrFold(name) }))
    .filter((item) => item.folded.length >= 4)
    .sort((a, b) => b.folded.length - a.folded.length)
  let found: string | null = null
  for (const word of words) {
    const folded = ocrFold(word.text)
    const hit = names.find((item) => folded.includes(item.folded))
    if (hit && (!found || ocrFold(hit.name).length > ocrFold(found).length)) found = hit.name
  }
  return found
}

function slotAllows(pokeId: number, slot: 1 | 2, ingredientId: number): boolean {
  const poke = pokeById(pokeId)
  if (!poke) return false
  const allowed = poke.ingredients.length > 3
    ? poke.ingredients.map((_, index) => index)
    : (slot === 1 ? [0, 1] : [0, 1, 2]).filter((index) => index < poke.ingredients.length)
  return allowed.some((index) => poke.ingredients[index]?.id === ingredientId)
}

export interface SpeciesEvidence {
  skill: string | null
  /** 第 2、第 3 格认到的食材 id。没认到是 null。 */
  ingredients: [number | null, number | null]
}

/** 立绘分数接近时，留下主技能和食材组合都说得通的那一只。都说得通则留立绘更好的。 */
export function chooseSimilar(candidates: { id: number, score: number }[], evidence: SpeciesEvidence): number | null {
  if (!evidence.skill && evidence.ingredients.every((id) => id == null)) return null
  let fitting = [...candidates].sort((a, b) => a.score - b.score)
  if (evidence.skill) {
    const skillFitting = fitting.filter((row) => {
      const poke = pokeById(row.id)
      return poke && skillBase(poke.mainSkill) === skillBase(evidence.skill!)
    })
    if (skillFitting.length === 1) return skillFitting[0]!.id
    if (!skillFitting.length) return null
    fitting = skillFitting
  }
  fitting = fitting.filter((row) => {
    const poke = pokeById(row.id)
    if (!poke) return false
    if (evidence.ingredients[0] != null && !slotAllows(row.id, 1, evidence.ingredients[0])) return false
    if (evidence.ingredients[1] != null && !slotAllows(row.id, 2, evidence.ingredients[1])) return false
    return true
  })
  return fitting[0]?.id ?? null
}

export function parseCard(words: OcrWord[], options: ParseOptions): Omit<BoxPokemon, 'uid'> | null {
  const pokeId = options.portraitId != null && pokeById(options.portraitId) ? options.portraitId : null
  if (pokeId == null) return null
  const labeled = nameWord(words)
  const header = headerLevel(words, labeled)
  const nature = words.map((word) => natureName(word.text)).find(Boolean)
  const subskills = placeSubskills(words)
  const skillLevel = skillLevelOf(words, pokeId, header?.word ?? null)
  const ocrMissing: OcrMissingField[] = []
  if (!header) ocrMissing.push('level')
  if (!nature) ocrMissing.push('nature')
  if (skillLevel == null) ocrMissing.push('skillLevel')
  if (isAllRounder(pokeById(pokeId))) ocrMissing.push('ingredient0')
  options.slotLines.forEach((line, index) => { if (line == null) ocrMissing.push(`ingredient${index + 1}` as OcrMissingField) })
  subskills.forEach((skill, index) => { if (!skill) ocrMissing.push(`subskill${index}` as OcrMissingField) })
  return {
    pokeId,
    level: header?.level ?? 30,
    nature: nature ?? '勤奋',
    subskills,
    ingredientSlots: ingredientSlotsFor(pokeId, options.slotLines),
    skillLevel: skillLevel ?? 1,
    name: labeled ? stripLevelPrefix(labeled.text) : '',
    napping: false,
    ...(options.shiny ? { shiny: true } : {}),
    tune: { ...defaultTune(), ribbonHours: ribbonHours(words) },
    ...(ocrMissing.length ? { ocrMissing } : {}),
  }
}

export function fingerprint(pokemon: Pick<BoxPokemon, 'pokeId' | 'level' | 'nature' | 'subskills' | 'ingredientSlots' | 'skillLevel' | 'shiny' | 'ocrMissing'>): string {
  const subs = [0, 1, 2, 3, 4].map((index) => pokemon.subskills[index] ?? '')
  const slots = [0, 1, 2].map((index) => pokemon.ingredientSlots[index] == null ? 'null' : String(pokemon.ingredientSlots[index]))
  const key = [pokemon.pokeId, pokemon.level, pokemon.nature, subs.join(','), slots.join(','), pokemon.skillLevel, pokemon.shiny ? 'shiny' : 'normal'].join('|')
  return pokemon.ocrMissing?.length ? `${key}|missing:${[...pokemon.ocrMissing].sort().join(',')}` : key
}

export function planImports(existing: BoxPokemon[], cards: Array<Omit<BoxPokemon, 'uid'> | null>) {
  const seen = new Set(existing.map((pokemon) => fingerprint(pokemon)))
  const accepted: Array<Omit<BoxPokemon, 'uid'>> = []
  let skipped = 0
  let discarded = 0
  for (const card of cards) {
    if (!card) {
      discarded += 1
      continue
    }
    const key = fingerprint(card)
    if (seen.has(key)) {
      skipped += 1
      continue
    }
    seen.add(key)
    accepted.push(card)
  }
  return { accepted, skipped, discarded }
}
