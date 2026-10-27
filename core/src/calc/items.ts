import runtimeParameters from '../data/runtime-parameters.json'
import ruleCatalogs from '../data/rule-catalogs.json'
import extracted0 from '../data/client-defaults.json'
import extracted1 from '../data/calc-tables.json'
import { cloneData } from './dataClone'
const items_config_extracted0 = extracted0.modules.items
const items_config_extracted1 = extracted1.modules.items
const items_config_ruleCatalogs = ruleCatalogs.modules.items
const items_module_runtimeParameters = runtimeParameters.modules.items.module.values

export interface ItemEntry {
  id: number
  name: string
  category: string
  icon: string
  sourceUrl: string
  acquisition?: string
  additionalAcquisition?: string
}

const BASE = (items_config_extracted0.BASE as "https://pks.raenonx.cc/zh/item/source/")
const groups: [string, [number, string][]][] = (cloneData(items_config_extracted1.groups) as unknown as [string, [number, string][]][])

const types = cloneData(items_config_extracted1.types)
const candyGroup = groups.find(([category]) => category === '糖果')![1]
for (const [index, size] of items_config_ruleCatalogs.moduleList0.values.entries()) {
  types.forEach((type, offset) => candyGroup.push([(items_module_runtimeParameters.p001 as 38) + index * (items_module_runtimeParameters.p002 as 18) + offset, `${type}屬性的糖果${size}`]))
}

/** RAE 物品来源页的永久成就；往期活动礼包需在对应活动期间取得。 */
const evolutionAchievements: Record<number, string> = (cloneData(items_config_extracted1.evolutionAchievements) as unknown as Record<number, string>)

export const ITEM_CATEGORIES = groups.map(([category]) => category)
export const ITEMS: ItemEntry[] = groups.flatMap(([category, rows]) => rows.map(([id, name]) => ({
  id,
  name,
  category,
  icon: `/items/${items_config_ruleCatalogs.moduleList1.values.includes(id) ? (items_module_runtimeParameters.p003 as 115) : id}.webp`,
  sourceUrl: `${BASE}${id}`,
  ...(category === '进化道具' ? {
    acquisition: '一般兑换处：1,400 睡眠点数（每月限购 5 个）。',
    additionalAcquisition: evolutionAchievements[id],
  } : {}),
})))
