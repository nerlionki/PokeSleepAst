import { recipeById } from './catalogIds'
import { pokeById } from './data'
import { DAY_MINUTES, MEAL_PLAN_DAYS, MEAL_TARGET, type MealSupplyResult } from './mealSupply'
import { resolveMemberSkill } from './mew'
import { defaultScoreOptions, scoreCandidates, validateScoreOptions, type ScorePolicy, type ScoreRequest } from './scorePlan'
import { scoreCandidateProduction } from './scoreSearch'
import { simulateScore } from './scoreSimulation'
import { scoreSkillRoles } from './scoreSkills'
import { teamRestrictionError } from './teamRestrictions'
import type { BoxPokemon, Settings } from '../types'

const INDIVIDUAL_TRIALS = 24
const TEAM_TRIALS = 128
const STEPS_PER_UPDATE = 4

export interface MealPlanRequest {
  mode: 'meal'
  scope: 'individuals' | 'team'
  recipeId: number
  settings: Settings
  box: BoxPokemon[]
  team: string[]
  bag: Record<string, number>
  unresolvedBag?: Record<string, number>
  autoSpace: boolean
}

export interface MealCandidate {
  uid: string
  minutes: number | null
  coverage: Record<string, number>
  ingredientTimes: Record<string, number | null>
  dayChance: number
}

export interface MealTeamEstimate {
  milestones: (number | null)[]
  dayChance: number
  coverage: Record<string, number>
  missing: Record<string, number>
  contributions: Record<string, number>
  overflow: number
  sold: number
}

export type MealPlanResult = { scope: 'individuals'; candidates: MealCandidate[] } | { scope: 'team'; estimate: MealTeamEstimate }
export interface MealProgress { completed: number; total: number }
export type MealPlanMessage =
  | { type: 'progress'; completed: number; total: number }
  | { type: 'result'; result: MealPlanResult }
  | { type: 'error'; message: string }

function median(values: (number | undefined)[]): number | null {
  const sorted = values.filter((value): value is number => value != null).sort((a, b) => a - b)
  // A trial that never finishes counts after all finite times.
  return sorted[Math.ceil(values.length / 2) - 1] ?? null
}

const dayChance = (minutes: (number | undefined)[]) =>
  minutes.filter(value => value != null && value <= DAY_MINUTES).length / minutes.length

export function isMealHealer(pokemon: BoxPokemon): boolean {
  const poke = pokeById(pokemon.pokeId)
  return !!poke && scoreSkillRoles(resolveMemberSkill(poke, pokemon).name, poke.id).teamHeal
}

function fixedPolicy(team: BoxPokemon[]): ScorePolicy {
  const uids = team.map(pokemon => pokemon.uid)
  return { day: [uids], sleep: [uids, uids], settle: [uids, uids],
    recipeId: null, reserveMeals: 0, rotateMinutes: DAY_MINUTES, fill: false, juiceAt: 0 }
}

export function* mealPlanSteps(input: MealPlanRequest): Generator<MealProgress, MealPlanResult> {
  const recipe = recipeById(input.recipeId)
  if (!recipe || recipe.mix || !recipe.ingredients.length) throw new Error('请选择一道正式料理')
  const options = { ...defaultScoreOptions(input.settings), days: MEAL_PLAN_DAYS,
    bag: input.bag, unresolvedBag: input.unresolvedBag }
  const error = validateScoreOptions(options, input.settings, false)
  if (error) throw new Error(error)
  const list = scoreCandidates(input.box).candidates
  const byUid = new Map(list.map(pokemon => [pokemon.uid, pokemon]))
  const request: ScoreRequest = { settings: input.settings, options, box: [] }
  function runTrial(team: BoxPokemon[], policy: ScorePolicy, index: number, individualKeys?: string[]) {
    return simulateScore({ ...request, box: team }, policy, options.seed + index, 1, false, undefined,
      { ingredients: recipe!.ingredients, autoSpace: input.autoSpace, individualKeys }).mealSupply!
  }

  if (input.scope === 'individuals') {
    const candidates: MealCandidate[] = []
    const total = list.length * INDIVIDUAL_TRIALS
    let completed = 0
    for (const pokemon of list) {
      const estimated = scoreCandidateProduction(request, pokemon)
      const suitable = recipe.ingredients.filter(({ id }) => (estimated.ingredients[id] ?? 0) > 0)
      if (!suitable.length) {
        completed += INDIVIDUAL_TRIALS
        yield { completed, total }
        continue
      }
      const team = [pokemon]
      const policy = fixedPolicy(team)
      const keys = suitable.map(({ id }) => String(id))
      const trials: MealSupplyResult[] = []
      for (let i = 0; i < INDIVIDUAL_TRIALS; i++) {
        trials.push(runTrial(team, policy, i, keys))
        if (++completed % STEPS_PER_UPDATE === 0) yield { completed, total }
      }
      const times = trials.map(trial => trial.completion)
      candidates.push({ uid: pokemon.uid, minutes: median(times), dayChance: dayChance(times),
        ingredientTimes: Object.fromEntries(keys.map(key => [key, median(trials.map(trial => trial.ingredientTimes[key]))])),
        coverage: Object.fromEntries(suitable.map(({ id, count }) => [id, (estimated.naturalIngredients[id] ?? 0) / (count * MEAL_TARGET)])) })
    }
    const bestCoverage = (candidate: MealCandidate) => Math.max(...Object.values(candidate.coverage))
    candidates.sort((a, b) => bestCoverage(b) - bestCoverage(a)
      || (a.minutes ?? Infinity) - (b.minutes ?? Infinity) || a.uid.localeCompare(b.uid))
    return { scope: 'individuals', candidates }
  }

  const team = input.team.flatMap(uid => {
    const member = byUid.get(uid)
    return member ? [member] : []
  })
  if (!team.length || team.length > 5 || new Set(input.team).size !== team.length || team.length !== input.team.length) {
    throw new Error('请选择 1–5 只可上场且不重复的宝可梦')
  }
  const restricted = teamRestrictionError(team)
  if (restricted) throw new Error(restricted)
  const policy = fixedPolicy(team)
  const trials: MealSupplyResult[] = []
  for (let index = 0; index < TEAM_TRIALS; index++) {
    trials.push(runTrial(team, policy, index))
    if ((index + 1) % STEPS_PER_UPDATE === 0) yield { completed: index + 1, total: TEAM_TRIALS }
  }
  const successful = trials.filter(trial => trial.completion != null)
  const contributions: Record<string, number> = {}
  for (const member of team) {
    const minutes = successful.flatMap(trial => {
      const minute = trial.lastContribution[member.uid]
      return minute == null ? [] : [minute]
    })
    const estimate = median(minutes)
    if (estimate != null) contributions[member.uid] = estimate
  }
  return { scope: 'team', estimate: {
    milestones: Array.from({ length: MEAL_TARGET }, (_, i) => median(trials.map(trial => trial.meals[i]))),
    dayChance: dayChance(trials.map(trial => trial.completion)),
    coverage: Object.fromEntries(recipe.ingredients.map(({ id, count }) => [
      id, trials.reduce((sum, trial) => sum + (trial.firstDayNatural[id] ?? 0), 0) / (TEAM_TRIALS * count * MEAL_TARGET),
    ])),
    missing: Object.fromEntries(recipe.ingredients.map(({ id }) => [id, median(trials.map(trial => trial.missing[id])) ?? 0])),
    contributions,
    overflow: median(trials.map(trial => trial.overflow)) ?? 0,
    sold: median(trials.map(trial => Object.values(trial.sold).reduce((sum, amount) => sum + amount, 0))) ?? 0,
  } }
}
