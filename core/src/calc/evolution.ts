import runtimeParameters from '../data/runtime-parameters.json'
import extracted0 from '../data/compatibility-maps.json'
import { cloneData } from './dataClone'
import evolution from '../data/evolution.json'
import { NATURES, pokeById } from './data'
const evolution_config_extracted0 = extracted0.modules.evolution
const evolution_conditionText_runtimeParameters = runtimeParameters.modules.evolution.conditionText.values
const evolution_evolutionStages_runtimeParameters = runtimeParameters.modules.evolution.evolutionStages.values


/** RAE 进化条件，见 https://pks.raenonx.cc/zh/pokedex */
export type EvoCondition =
  | ['candy', number]
  | ['level', number]
  | ['sleep', number]
  | ['item', number, number]
  | ['time', number, number]
  | ['gender', string]
  | ['nature', ...number[]]

interface EvoEntry {
  prev: number
  next: [number, EvoCondition[]][]
}

export interface EvoNode {
  id: number
  name: string
  conditions: string[]
}

const EVOLUTION = evolution as unknown as Record<string, EvoEntry>

/** RAE 道具编号对应的名称。 */
const ITEM_NAME: Record<number, string> = (cloneData(evolution_config_extracted0.ITEM_NAME) as unknown as Record<number, string>)

function hour(n: number) {
  return `${n}:00`
}

export function conditionText(condition: EvoCondition): string {
  switch (condition[0]) {
    case 'candy': return `糖果 ×${condition[1]}`
    case 'level': return `Lv.${condition[1]}`
    case 'sleep': return `一起睡满 ${condition[1]} 小时`
    case 'item': return `${ITEM_NAME[condition[1]] ?? `道具 ${condition[1]}`} ×${condition[2]}`
    case 'time': {
      const [, start, end] = condition
      return `${start >= (evolution_conditionText_runtimeParameters.p001 as 18) || start < (evolution_conditionText_runtimeParameters.p002 as 6) ? '夜晚' : '白天'} ${hour(start)}–${hour(end)}`
    }
    case 'gender': return condition[1] === 'female' ? '雌性' : '雄性'
    case 'nature': {
      const names = condition.slice(1).map((id) => NATURES[(id as number) - 1]?.name).filter(Boolean)
      return `性格：${names.join('、')}`
    }
  }
}

function entry(id: number): EvoEntry | undefined {
  return EVOLUTION[String(id)]
}

function rootOf(id: number): number {
  let current = id
  const seen = new Set<number>()
  while (!seen.has(current)) {
    seen.add(current)
    const prev = entry(current)?.prev
    if (!prev || !pokeById(prev)) break
    current = prev
  }
  return current
}

/** 按阶段排好的进化链，每个节点带上「从上一阶进化过来」的条件。 */
export function evolutionStages(id: number): EvoNode[][] {
  const root = rootOf(id)
  const first = pokeById(root)
  if (!first) return []
  const stages: EvoNode[][] = [[{ id: root, name: first.name, conditions: [] }]]
  for (let guard = 0; guard < (evolution_evolutionStages_runtimeParameters.p001 as 5); guard++) {
    const last = stages[stages.length - 1]!
    const next: EvoNode[] = []
    for (const node of last) {
      for (const [to, conditions] of entry(node.id)?.next ?? []) {
        const poke = pokeById(to)
        if (poke) next.push({ id: to, name: poke.name, conditions: conditions.map(conditionText) })
      }
    }
    if (!next.length) break
    stages.push(next)
  }
  return stages
}

/** 当前种类最多可能经历的进化次数；直接捕获的个体可以少于此值。 */
export function evolutionDepth(id: number): number {
  return Math.max(0, evolutionStages(id).findIndex(stage => stage.some(node => node.id === id)))
}
