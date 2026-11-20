import { ingredientEnergyValue } from './activityIngredients'

export const MEAL_TARGET = 3
export const DAY_MINUTES = 1440
export const MEAL_PLAN_DAYS = 7

export interface MealSupplyOptions {
  ingredients: readonly { id: number; count: number }[]
  individualKeys?: readonly string[]
  autoSpace: boolean
}

interface Lot { amount: number; uid?: string; minute: number }

export function createMealSupply(bag: Record<string, number>, capacity: number, options: MealSupplyOptions) {
  const quantities = new Map<string, number>()
  for (const { id, count } of options.ingredients) {
    const key = String(id)
    quantities.set(key, (quantities.get(key) ?? 0) + count)
  }
  const required = [...quantities]
  const relevant = options.individualKeys ? required.filter(([key]) => options.individualKeys!.includes(key)) : required
  const lots = new Map(required.map(([key]) => [key, [{ amount: bag[key] ?? 0, minute: 0 }] as Lot[]]))
  const meals: number[] = []
  const ingredientTimes: Record<string, number> = {}
  const lastContribution: Record<string, number> = {}
  const received: Record<string, number> = {}
  const sold: Record<string, number> = {}
  let stocked = Object.values(bag).reduce((sum, amount) => sum + amount, 0)
  let overflow = 0
  let completion: number | undefined
  let firstDay: Record<string, number> | undefined
  const remainingNeed = (key: string) => (quantities.get(key) ?? 0) * (MEAL_TARGET - meals.length)

  function removeLot(key: string, amount: number, fromNewest: boolean) {
    const entries = lots.get(key)
    if (!entries) return
    while (amount > 0 && entries.length) {
      const index = fromNewest ? entries.length - 1 : 0
      const lot = entries[index]!
      const taken = Math.min(amount, lot.amount)
      if (!fromNewest && lot.uid && taken > 0) lastContribution[lot.uid] = Math.max(lastContribution[lot.uid] ?? 0, lot.minute)
      lot.amount -= taken
      amount -= taken
      if (lot.amount === 0) entries.splice(index, 1)
    }
  }

  function prepare(minute: number) {
    while (meals.length < MEAL_TARGET && required.every(([key, count]) => (bag[key] ?? 0) >= count)) {
      for (const [key, count] of required) {
        bag[key]! -= count
        stocked -= count
        removeLot(key, count, false)
      }
      meals.push(minute)
    }
    if (options.individualKeys) {
      for (const [key] of relevant) {
        if (ingredientTimes[key] == null && (bag[key] ?? 0) >= remainingNeed(key)) ingredientTimes[key] = minute
      }
    }
    if (completion == null && (meals.length === MEAL_TARGET || options.individualKeys && relevant.length > 0 &&
      relevant.every(([key]) => ingredientTimes[key] != null))) completion = minute
  }

  function credit(key: string, amount: number, uid: string, minute: number) {
    if (completion != null) return
    if (options.autoSpace && stocked + amount > capacity) {
      // Sell excess only to make room for food that can still contribute to a meal.
      const needed = Math.max(0, remainingNeed(key) - (bag[key] ?? 0))
      let shortage = Math.max(0, stocked + Math.min(amount, needed) - capacity)
      if (shortage) {
        const expendable = Object.keys(bag).sort((a, b) => Number(quantities.has(a)) - Number(quantities.has(b))
          || (ingredientEnergyValue(a) ?? 0) - (ingredientEnergyValue(b) ?? 0))
        for (const name of expendable) {
          const sale = Math.min(shortage, Math.max(0, (bag[name] ?? 0) - remainingNeed(name)))
          if (!sale) continue
          bag[name]! -= sale
          stocked -= sale
          shortage -= sale
          sold[name] = (sold[name] ?? 0) + sale
          removeLot(name, sale, true)
          if (!shortage) break
        }
      }
    }
    const accepted = Math.min(capacity - stocked, amount)
    overflow += amount - accepted
    if (!accepted) return
    bag[key] = (bag[key] ?? 0) + accepted
    received[key] = (received[key] ?? 0) + accepted
    stocked += accepted
    const entries = lots.get(key)
    if (entries) entries.push({ uid, minute, amount: accepted })
    prepare(minute)
  }

  function captureFirstDay() {
    firstDay ??= Object.fromEntries(required.map(([key, count]) => [key, meals.length * count + (bag[key] ?? 0)]))
  }

  return {
    credit, prepare, captureFirstDay,
    get complete() { return completion != null },
    result() {
      captureFirstDay()
      return { meals, completion, ingredientTimes, received, sold, overflow, lastContribution, firstDay: firstDay!,
        missing: Object.fromEntries(required.map(([key]) => [key, Math.max(0, remainingNeed(key) - (bag[key] ?? 0))])) }
    },
  }
}

export type MealSupplyResult = ReturnType<ReturnType<typeof createMealSupply>['result']>
