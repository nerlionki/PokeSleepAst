export type IslandId =
  | 'greengrass'
  | 'cyan'
  | 'taupe'
  | 'snowdrop'
  | 'lapis'
  | 'powerplant'
  | 'canyon'
  | 'greenex'
  | 'cyanex'

export type SleepType = '淺淺入夢' | '安然入睡' | '深深入眠' | '没有特征'
export type MealCategory = 'curry' | 'salad' | 'dessert'
export type Period = 'day' | 'week'
export type Specialty = '树果型' | '食材型' | '技能型' | '全部'

export type NatureStat = 'help' | 'energy' | 'ingredient' | 'skill' | 'exp'

export interface Settings {
  island: IslandId
  berries: string[]
  areaBonus: number
  sleepStart: string
  sleepEnd: string
  sleepScore: number
  meals: boolean
  incense: boolean
  dailySkillHeal: number
  goodCamp: boolean
  helpingBonus: number
  mealCategory: MealCategory
  potSize: number
  period: Period
  eventMult: number
  recipeLevels: Record<string, number>
  whistleHelps: number
  shinyUp: boolean
  sundayPot: boolean
}

export type IngredientSlots = [number | null, number | null, number | null]
export type OcrMissingField = 'level' | 'nature' | 'skillLevel' | 'ingredient0' | 'ingredient1' | 'ingredient2'
  | 'subskill0' | 'subskill1' | 'subskill2' | 'subskill3' | 'subskill4'

export interface BoxPokemon {
  uid: string
  pokeId: number
  level: number
  nature: string
  subskills: string[]
  ingredientSlots: IngredientSlots
  skillLevel: number
  /** 空字符串表示用宝可梦中文名。 */
  name: string
  napping: boolean
  shiny?: boolean
  tune?: MemberTune
  /** OCR 未识别、尚待用户确认的字段；与占位默认值分开保存。 */
  ocrMissing?: OcrMissingField[]
}

export type CarryMode = 'preset' | 'normal' | 'full' | 'unlimited'

export interface MemberTune {
  evolutions: number
  goldSeeds: number
  silverSeeds: number
  sleepHours: number
  carryMode: CarryMode
  exp: number
  ribbonHours: number
}

export interface MemberTune {
  evolutions: number
  goldSeeds: number
  silverSeeds: number
  sleepHours: number
  carryMode: CarryMode
  exp: number
  ribbonHours: number
}

export interface ProduceInput {
  pokeId: number
  level: number
  nature: string
  subskills: string[]
  ingredientSlots: IngredientSlots
  skillLevel: number
  /** 预设跟随营地票，一般不用票，全时满包，持有无上限。 */
  carryMode?: CarryMode
  /** 覆盖起床活力。不填则用睡眠分数。 */
  wakeEnergy?: number
  /** 一起睡觉的累计小时，用来算睡饱饱勋章。 */
  ribbonHours?: number
  /** 时间记录里显示的个体名称。不填则用宝可梦名。 */
  displayName?: string
}

export interface EnergyPoint {
  minute: number
  energy: number
  multiplier: number
  asleep: boolean
}

export interface ProduceResult {
  helps: number
  berries: number
  berryEnergy: number
  ingredients: Record<string, number>
  skillProcs: number
  skillEnergy: number
  sneaky: number
  curve: EnergyPoint[]
}

export interface CookMeal {
  name: string
  mix: boolean
  potUsed: number
  energy: number
}

export interface TeamProduceResult {
  members: ProduceResult[]
  helpingBonus: number
  berryEnergy: number
  skillEnergy: number
  cookEnergy: number
  totalEnergy: number
  bag: Record<string, number>
  meals: CookMeal[]
  events: { minute: number, name: string, kind: string, actor: number, note: string }[]
}
