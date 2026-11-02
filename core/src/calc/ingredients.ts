import ruleParameters from '../data/rule-parameters.resource'
import extracted0 from '../data/calc-tables.resource'
import extracted1 from '../data/client-defaults.resource'
import { cloneData } from './dataClone'
import { isAllRounderId } from './specialty'
import type { IngredientSlots } from '../types'
const ingredients_config_extracted0 = extracted0.modules.ingredients
const ingredients_config_extracted1 = extracted1.modules.ingredients


export interface IngredientLine {
  id: number
  name: string
  amounts: number[]
}

export interface IngredientCell {
  letter: string
  id: number
  name: string
  amount: number
  /** 在该宝可梦食材表里的下标，也就是食材槽存的值。 */
  index: number
}

function cell(letter: string, line: IngredientLine, amount: number, lines: IngredientLine[]): IngredientCell {
  return { letter, id: line.id, name: line.name, amount, index: lines.indexOf(line) }
}

/** 全能型的食材表按 1 / 30 / 60 级各一档数量，0 表示这一档还没有这种食材（RAE 产量计算）。 */
function tierAmount(line: IngredientLine, level: number): number {
  return line.amounts[Math.min(level, line.amounts.length - 1)] ?? 0
}

/** 食材格按解锁等级分列：1 级 A，30 级 A/B，60 级 A/B/C。全能型每档列出这一档能出的全部食材。 */
export function ingredientColumns(lines: IngredientLine[]): IngredientCell[][] {
  if (lines.length > 3) {
    return [0, 1, 2].map((level) => lines.flatMap((line) => {
      const amount = tierAmount(line, level)
      return amount > 0 ? [cell('', line, amount, lines)] : []
    }))
  }
  const cols: IngredientCell[][] = [[], [], []]
  const [a, b, c] = lines
  if (a) {
    cols[0].push(cell('A', a, a.amounts[0] ?? 0, lines))
    if (a.amounts.length > 1) cols[1].push(cell('A', a, a.amounts[1], lines))
    if (a.amounts.length > 2) cols[2].push(cell('A', a, a.amounts[2], lines))
  }
  if (b) {
    cols[1].push(cell('B', b, b.amounts[0] ?? 0, lines))
    cols[2].push(cell('B', b, b.amounts[1] ?? b.amounts[0] ?? 0, lines))
  }
  if (c) cols[2].push(cell('C', c, c.amounts.at(-1) ?? 0, lines))
  return cols
}

/** 这一槽这一次帮忙掉落的食材。10 级用第 1 槽数量，30 级用第 2 槽，60 级用第 3 槽。 */
export function slotDrop(lines: IngredientLine[], slot: number, lineIndex: number): IngredientCell | null {
  const line = lines[lineIndex] ?? lines[0]
  if (!line || slot < 0 || slot > 2) return null
  if (lines.length > 3) {
    const amount = tierAmount(line, slot)
    return amount > 0 ? cell(String(slot + 1), line, amount, lines) : null
  }
  if (lineIndex <= 0) {
    const amount = line.amounts[slot] ?? 0
    return amount > 0 ? cell('A', line, amount, lines) : null
  }
  if (lineIndex === 1 && slot >= 1) {
    const amount = line.amounts[slot - 1] ?? 0
    return amount > 0 ? cell('B', line, amount, lines) : null
  }
  if (lineIndex >= 2 && slot >= 2) {
    const amount = line.amounts.at(-1) ?? 0
    return amount > 0 ? cell('C', line, amount, lines) : null
  }
  return null
}

/** 按三个食材槽的选择，画出 1 / 30 / 60 级会拿到的食材。 */
export function spreadColumns(lines: IngredientLine[], slots: Array<number | null>): IngredientCell[][] {
  if (!lines.length) return [[], [], []]
  const chosen = slots.map((index) => index == null ? undefined : lines[index])
  if (lines.length > 3) {
    return [0, 1, 2].map((level) => chosen.flatMap((line, slot) => {
      if (!line) return []
      const amount = tierAmount(line, level)
      return amount > 0 ? [cell(String(slot + 1), line, amount, lines)] : []
    }))
  }
  const cols: IngredientCell[][] = [[], [], []]
  const [a, b, c] = chosen
  if (a) {
    cols[0].push(cell('A', a, a.amounts[0] ?? 0, lines))
    cols[1].push(cell('A', a, a.amounts[Math.min(1, a.amounts.length - 1)] ?? 0, lines))
    cols[2].push(cell('A', a, a.amounts[Math.min(2, a.amounts.length - 1)] ?? 0, lines))
  }
  if (b) {
    cols[1].push(cell('B', b, b.amounts[0] ?? 0, lines))
    cols[2].push(cell('B', b, b.amounts[Math.min(1, b.amounts.length - 1)] ?? 0, lines))
  }
  if (c) cols[2].push(cell('C', c, c.amounts.at(-1) ?? 0, lines))
  return cols
}

/** 点某一级的食材，就是选定这一槽的食材组合。第 1 槽固定，30 级改第 2 槽，60 级改第 3 槽。 */
export function setIngredientChoice(
  lineCount: number,
  slots: IngredientSlots,
  column: number,
  lineIndex: number,
): IngredientSlots | null {
  if (column < 0 || column > 2 || lineIndex < 0 || lineIndex >= lineCount) return null
  if (lineCount <= 3) {
    if (column === 0) return null
    if (lineIndex > column) return null
  }
  if (slots[column] === lineIndex) return null
  const next: IngredientSlots = [slots[0], slots[1], slots[2]]
  next[column] = lineIndex
  return next
}

/** 只有全能型可以把某一格清成空。 */
export function clearIngredientSlot(pokeId: number, slots: IngredientSlots, column: number): IngredientSlots | null {
  if (!isAllRounderId(pokeId)) return null
  if (column <= 0 || column > 2 || slots[column] == null) return null
  const next: IngredientSlots = [slots[0], slots[1], slots[2]]
  next[column] = null
  return next
}

/** 某一槽能换到的下一种食材。普通宝可梦第 1 槽固定 A，第 2 槽 A/B，第 3 槽 A/B/C。 */
export function nextIngredientSlot(lineCount: number, slot: number, current: number): number {
  const allowed = lineCount > 3
    ? Array.from({ length: lineCount }, (_, index) => index)
    : (slot === 0 ? [0] : slot === 1 ? [0, 1] : [0, 1, 2]).filter((index) => index < lineCount)
  if (!allowed.length) return 0
  const at = allowed.indexOf(current)
  return allowed[(at + 1) % allowed.length] ?? allowed[0]!
}

/** 一次帮忙的树果数：树果型和全能型 2 颗。 */
export function berryCount(specialty: string): number {
  return specialty === '树果型' || specialty === '全部' ? ruleParameters.modules.ingredients.berryCount.specialist : ruleParameters.modules.ingredients.berryCount.normal
}

/** 友情徽章组。等级到达后，捕捉到的个体锁定对应数量的金色副技能。 */
const MEDAL_LEVELS: Record<number, readonly [number, number, number]> = (cloneData(ingredients_config_extracted0.MEDAL_LEVELS) as unknown as Record<number, readonly [number, number, number]>)

const TONES = (cloneData(ingredients_config_extracted1.TONES) as unknown as readonly ["copper","silver","gold"])

export function friendTiers(group: number | null | undefined) {
  const levels = group ? MEDAL_LEVELS[group] : undefined
  if (!levels) return []
  return levels.map((level, index) => ({
    level,
    golds: index + 1,
    label: `锁 ${index + 1} 金`,
    tone: TONES[index],
  }))
}

export { topIngredientProducers, topIngredientProducerSteps, type ProducerRank } from './ingredientProduction'
