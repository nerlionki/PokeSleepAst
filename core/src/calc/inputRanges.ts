import contracts from '../data/runtime-contracts.resource'
import runtime from '../data/runtime-parameters.resource'
import rules from '../data/rule-parameters.resource'
import tables from '../data/calc-tables.resource'
import defaults from '../data/client-defaults.resource'

interface Reference { file: string; path: string[]; id?: number; field?: string }
type Ranges<T> = { [C in keyof T]: { [F in keyof T[C]]: { [A in keyof T[C][F]]: number } } }
const sources: Record<string, unknown> = {
  'runtime-parameters.json': runtime, 'rule-parameters.json': rules,
  'calc-tables.json': tables, 'client-defaults.json': defaults,
}
const ranges = contracts.modules.inputRanges
export const INPUT_RANGES = Object.fromEntries(Object.entries(ranges).map(([component, fields]) => [component,
  Object.fromEntries(Object.entries(fields).map(([field, attributes]) => [field,
    Object.fromEntries(Object.entries(attributes).map(([attribute, setting]) => {
      const ref = setting as unknown as Reference
      let value = typeof setting === 'number' ? setting : ref.path.reduce<unknown>((value, key) => (value as Record<string, unknown>)[key], sources[ref.file])
      if (ref.id != null) value = (value as Record<string, unknown>[]).find(row => row.id === ref.id)?.[ref.field!]
      if (typeof value !== 'number' || !Number.isFinite(value)) throw new Error(`输入范围资料无效：${component}.${field}.${attribute}`)
      return [attribute, value]
    })),
  ])),
])) as Ranges<typeof ranges>
