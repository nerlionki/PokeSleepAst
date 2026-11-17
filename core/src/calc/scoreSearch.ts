import runtimeParameters from '../data/runtime-parameters.resource'
import ruleCatalogs from '../data/rule-catalogs.resource'
import { activityBerrySettings, activityValues, snapshotActivity, activityRecipeCategories } from './activities'
import { RECIPES, pokeById } from './data'
import { addIngredient } from './catalogIds'
import { produce } from './produce'
import { resolveMemberSkill } from './mew'
import { recipeLevelMult, recipeLevelOf } from './cook'
import { nextSpecialTeamState, type SpecialTeamState } from './teamRestrictions'
import { unlockedSubskills } from './member'
import { SCORE_ASSUMPTIONS, simulateScore } from './scoreSimulation'
import { scoreSkillRoles } from './scoreSkills'
import { resourceRevision } from '../resources/runtime'
import { SCORE_RULE_VERSION, hm, scoreBounds, scoreCandidates, seededRandom, validateScoreOptions,
  type ScoreCheckpoint, type ScorePolicy, type ScoreRequest, type ScoreResult, type ScoreSolution } from './scorePlan'
const scoreSearch_policyPool_runtimeParameters = runtimeParameters.modules.scoreSearch.policyPool.values
const scoreSearch_config_ruleCatalogs = ruleCatalogs.modules.scoreSearch
const scoreSearch_scoreSearchSteps_runtimeParameters = runtimeParameters.modules.scoreSearch.scoreSearchSteps.values
const policyKinds = ['berry', 'targeted', 'ingredients', 'mixed'] as const
const defaultLookaheadNodes = 1


export function scoreFingerprint(request: ScoreRequest, lookaheadNodes = defaultLookaheadNodes): string {
  return JSON.stringify({ version: SCORE_RULE_VERSION, resource: resourceRevision(), activityRuleVersion: 3, lookaheadNodes,
    settings: snapshotActivity(request.settings, 'week'), box: request.box, options: request.options, baseline: request.baseline })
}
/** Rank candidates using the actual planning interval, including midweek event phases. */
export function scoreCandidateProduction(request: ScoreRequest, pokemon: ScoreRequest['box'][number]) {
  const settings = snapshotActivity(request.settings, 'week')
  const poke = pokeById(pokemon.pokeId)!
  const { start, end } = scoreBounds(request.options)
  const total = { berryEnergy: 0, skillEnergy: 0, ingredients: {} as Record<string, number> }
  const cache = new Map<string, ReturnType<typeof produce>>()
  for (let minute = start; minute < end;) {
    const next = Math.min(end, (Math.floor((minute - 240) / 1440) + 1) * 1440 + 240)
    const activity = activityValues(settings.activity, settings.island, poke, minute)
    const environment = { ...activityBerrySettings(settings, settings.activity, minute), period: 'day' as const,
      meals: false, whistleHelps: 0, dailySkillHeal: 0,
      activity: { ...settings.activity, catalog: { schemaVersion: 1 as const, version: settings.activity.catalog.version, activities: [] }, overrides: activity } }
    // Freeze this day's resolved effects for a comparable 24-hour production estimate.
    const key = JSON.stringify([environment.berries, activity])
    let result = cache.get(key)
    if (!result) {
      result = produce(environment, { ...pokemon, ribbonHours: pokemon.tune?.ribbonHours ?? 0, wakeEnergy: (scoreSearch_policyPool_runtimeParameters.p001 as 100) }, 0)
      cache.set(key, result)
    }
    const weight = (next - minute) / (end - start)
    total.berryEnergy += result.berryEnergy * weight
    total.skillEnergy += result.skillEnergy * weight
    for (const [name, amount] of Object.entries(result.ingredients)) addIngredient(total.ingredients, name, amount * weight)
    minute = next
  }
  return total
}
function policyPool(request: ScoreRequest): ScorePolicy[] {
  const { settings, options: o } = request
  const { candidates } = scoreCandidates(request.box)
  if (!candidates.length) throw new Error('Box 中没有可参与规划的个体，请先添加并确认生产资料')
  const random = seededRandom(o.seed)
  const ranked = candidates.map(p => {
    const poke = pokeById(p.pokeId)!
    const result = scoreCandidateProduction(request, p)
    return { pokemon: p, poke, result, roles: scoreSkillRoles(resolveMemberSkill(poke, p).name, p.pokeId) }
  })
  const snapshot = snapshotActivity(settings, 'week')
  const bounds = scoreBounds(o)
  let allCategories = false
  for (let minute = bounds.start; minute < bounds.end; minute = Math.min(bounds.end, (Math.floor((minute - 240) / 1440) + 1) * 1440 + 240)) {
    if (activityRecipeCategories(activityValues(snapshot.activity, settings.island, undefined, minute), o.category).some(category => category !== o.category)) allCategories = true
  }
  const recipes = RECIPES.filter(r => (allCategories || r.category === o.category) && !r.mix)
    .sort((a, b) => b.baseEnergy * recipeLevelMult(recipeLevelOf(settings, b.id)) - a.baseEnergy * recipeLevelMult(recipeLevelOf(settings, a.id)))
  const estimatedIngredient: Record<number, number> = {}
  const coverage = (recipe: typeof RECIPES[number]) => Math.min(...recipe.ingredients.map(ingredient => {
    estimatedIngredient[ingredient.id] ??= ranked.map(candidate => candidate.result.ingredients[ingredient.id] ?? 0)
      .sort((a, b) => b - a).slice(0, scoreSearch_policyPool_runtimeParameters.p002).reduce((sum, count) => sum + count, 0)
    return ((o.bag[ingredient.id] ?? 0) + estimatedIngredient[ingredient.id]!) / ingredient.count
  }))
  const accessible = [...recipes].sort((a, b) => Math.min(3, coverage(b)) - Math.min(3, coverage(a)))
  const recipeChoices = [...new Set(recipes.flatMap((recipe, index) => [recipe, accessible[index]!]))]
  type Candidate = { uid: string, pokeId: number, score: number, roles: ReturnType<typeof scoreSkillRoles>, ingredients: Record<string, number> }
  const team = (scores: Candidate[], healer: 'include' | 'exclude' | 'any' = 'any', recipe?: typeof RECIPES[number],
    support: readonly ('pot' | 'crit')[] = []) => {
    let special: SpecialTeamState = 'none'
    const selected: string[] = []
    const remaining = scores.filter(s => healer !== 'exclude' || !s.roles.teamHeal)
    const selectedRoles = new Set<'pot' | 'crit'>()
    const available = { ...o.bag }
    while (remaining.length && selected.length < scoreSearch_policyPool_runtimeParameters.p002) {
      const value = (candidate: Candidate) => candidate.score + (recipe?.ingredients.reduce((sum, ingredient) => {
        const missing = Math.max(0, o.meals.length * ingredient.count - (available[ingredient.id] ?? 0))
        return sum + Math.min(missing, candidate.ingredients[ingredient.id] ?? 0) / ingredient.count
      }, 0) ?? 0) * scoreSearch_policyPool_runtimeParameters.p015
      const legal = remaining.filter(candidate => nextSpecialTeamState(special, candidate.pokeId) != null)
      const required = healer === 'include' && selected.length === 0 && legal.some(candidate => candidate.roles.teamHeal)
        ? 'teamHeal' : support.find(role => !selectedRoles.has(role) && legal.some(candidate => candidate.roles[role]))
      const candidate = legal.filter(candidate => !required || candidate.roles[required])
        .sort((a, b) => value(b) - value(a) || a.uid.localeCompare(b.uid))[0]
      if (!candidate) break
      special = nextSpecialTeamState(special, candidate.pokeId)!
      selected.push(candidate.uid)
      if (candidate.roles.pot) selectedRoles.add('pot')
      if (candidate.roles.crit) selectedRoles.add('crit')
      remaining.splice(remaining.indexOf(candidate), 1)
      for (const [name, amount] of Object.entries(candidate.ingredients)) addIngredient(available, name, amount)
    }
    return selected
  }
  const policies: ScorePolicy[] = []
  const count = o.precision === 'high' ? (scoreSearch_policyPool_runtimeParameters.p003 as 96) : (scoreSearch_policyPool_runtimeParameters.p004 as 48)
  for (let index = 0; index < count; index++) {
    const recipeIndex = Math.floor(index / 3) % Math.min(recipeChoices.length, o.precision === 'high' ? (scoreSearch_policyPool_runtimeParameters.p005 as 12) : (scoreSearch_policyPool_runtimeParameters.p006 as 6))
    const recipe = recipeChoices[recipeIndex]
    const noise = index < (scoreSearch_policyPool_runtimeParameters.p007 as 6) ? 0 : index < (scoreSearch_policyPool_runtimeParameters.p008 as 24) ? (scoreSearch_policyPool_runtimeParameters.p009 as 0.45) : (scoreSearch_policyPool_runtimeParameters.p010 as 1.2)
    const scores = (kind: 'berry' | 'food' | 'sleep' | 'settle') => ranked.map(r => {
      const berry = r.result.berryEnergy + r.result.skillEnergy
      const support = unlockedSubskills(r.pokemon.level, r.pokemon.subskills).includes('helpingBonus') ? (scoreSearch_policyPool_runtimeParameters.p012 as 6000) : 0
      const value = kind === 'settle' ? (unlockedSubskills(r.pokemon.level, r.pokemon.subskills).includes('sleepExp') ? (scoreSearch_policyPool_runtimeParameters.p013 as 30000) : 0) + berry * (scoreSearch_policyPool_runtimeParameters.p014 as 0.2)
        : kind === 'food' ? berry * (scoreSearch_policyPool_runtimeParameters.p016 as 0.25) + support
        : kind === 'sleep' ? berry + r.poke.carry * 100 + support * (scoreSearch_policyPool_runtimeParameters.p017 as 0.5) : berry + support
      return { uid: r.pokemon.uid, pokeId: r.pokemon.pokeId, roles: r.roles, ingredients: r.result.ingredients,
        score: value * (1 + (random() - (scoreSearch_policyPool_runtimeParameters.p018 as 0.5)) * noise) }
    })
    const supportVariants = [[], ['pot'], ['crit'], ['pot', 'crit']] as const
    const support = supportVariants[Math.floor(index / policyKinds.length) % supportVariants.length]!
    const berryTeam = team(scores('berry'), 'include'), foodTeam = team(scores('food'), 'include', recipe, support)
    const sleepScores = scores('sleep')
    const withHealer = team(sleepScores, 'include')
    const withoutHealer = team(sleepScores, 'exclude')
    const phase = index + Math.floor(index / policyKinds.length)
    const sleepTeam = (value: number) => value % 2 === 0 || !withoutHealer.length ? withHealer : withoutHealer
    const sleep = [sleepTeam(phase), sleepTeam(Math.floor(phase / 2))]
    const containsHealer = (team: string[]) => team.some(uid => sleepScores.find(candidate => candidate.uid === uid)?.roles.teamHeal)
    const canCompareNightRotation = withoutHealer.length === withHealer.length && withHealer.some(uid =>
      sleepScores.find(candidate => candidate.uid === uid)?.roles.teamHeal)
    const style = index % policyKinds.length
    const alternateRecipe = recipeChoices[recipeIndex + 1]
    const mealRecipeIds = style !== 0 && recipe ? o.meals.map((_, meal) =>
      style === 3 && alternateRecipe && meal === o.meals.length - 1 ? alternateRecipe.id : recipe.id) : undefined
    const foodTeamByMeal = style === 3 && alternateRecipe ? [
      foodTeam, foodTeam, team(scores('food'), 'include', alternateRecipe, support),
    ] : undefined
    const day = style === 0 ? [berryTeam] : style === 2 ? [foodTeam] : [berryTeam, foodTeam]
    const dayAlternates = [
      team(scores('berry'), 'exclude'), team(scores('food'), 'exclude', recipe),
    ]
    const selfHealing = team(scores('berry').filter(candidate => candidate.roles.selfHeal))
    if (index % 8 === 7 && selfHealing.length === scoreSearch_policyPool_runtimeParameters.p002) day[0] = selfHealing
    policies.push({ kind: policyKinds[style], day, foodTeamByMeal, dayAlternates, allowHealerRest: index % 3 !== 0,
      sleep, sleepWithHealer: sleep.map(containsHealer),
      sleepAfterCollect: o.device && index % 3 === 2 && canCompareNightRotation
        ? sleep.map(team => team === withHealer ? withoutHealer : withHealer) : undefined,
      collectMode: style === 0 ? 'none' : style === 1 ? 'targeted' : 'all',
      mealRecipeIds,
      settle: [team(scores('settle')), team(scores('settle'))], recipeId: style === 0 ? null : recipe?.id ?? null,
      reserveMeals: scoreSearch_config_ruleCatalogs.policyPoolList0.values[Math.floor(index / (scoreSearch_policyPool_runtimeParameters.p019 as 6)) % (scoreSearch_policyPool_runtimeParameters.p020 as 4)]!, rotateMinutes: scoreSearch_config_ruleCatalogs.policyPoolList1.values[index % (scoreSearch_policyPool_runtimeParameters.p021 as 4)]!, fill: index % 3 !== 0, juiceAt: scoreSearch_config_ruleCatalogs.policyPoolList2.values[index % (scoreSearch_policyPool_runtimeParameters.p022 as 4)]! })
  }
  return policies
}
function evaluate(request: ScoreRequest, policy: ScorePolicy, iterations: number, rollback = 1, record = false, compareDecay = false): ScoreSolution {
  const traces = Array.from({ length: iterations }, (_, i) => simulateScore(request, policy, request.options.seed + i * 7919, rollback, record && i === 0))
  const mean = traces.reduce((sum, t) => sum + t.total, 0) / iterations
  const average = (key: 'berry' | 'zone' | 'skill' | 'cooking') => traces.reduce((sum, t) => sum + t[key], 0) / iterations
  const mealDistribution: NonNullable<ScoreSolution['mealDistribution']> = {}
  if (record) {
    const planned = new Set((policy.mealRecipeIds ?? [policy.recipeId]).filter(id => id != null))
    const { start, end } = scoreBounds(request.options)
    const mealDays: number[] = []
    for (let day = Math.floor((start - 240) / 1440); day * 1440 + 240 < end; day++) {
      if (request.options.meals.some(meal => day * 1440 + hm(meal) >= start && day * 1440 + hm(meal) < end)) mealDays.push(day)
    }
    for (const id of planned) {
      const counts: Record<number, number> = {}
      for (const trace of traces) for (const day of mealDays) {
        const count = trace.cookedByDay?.[day]?.[id] ?? 0
        counts[count] = (counts[count] ?? 0) + 1
      }
      mealDistribution[id] = counts
    }
  }
  let withoutDecay: ScoreSolution['withoutDecay']
  if (compareDecay) {
    // With no reduced roll or forecast, removing the throttle leaves the walk identical.
    let additionalSimulations = 0
    const controls = traces.map((trace, index) => {
      if (!trace.decayApplied) return trace
      additionalSimulations++
      return simulateScore(request, policy, request.options.seed + index * 7919, rollback, false, 1)
    })
    withoutDecay = {
      mean: controls.reduce((sum, trace) => sum + trace.total, 0) / iterations,
      skillReleases: controls.reduce((sum, trace) => sum + (trace.skillReleases ?? 0), 0) / iterations,
      additionalSimulations,
    }
  }
  return { policy, mean, min: Math.min(...traces.map(t => t.total)), max: Math.max(...traces.map(t => t.total)),
    deviation: Math.sqrt(traces.reduce((sum, t) => sum + (t.total - mean) ** 2, 0) / iterations),
    berry: average('berry'), zone: average('zone'), skill: average('skill'), cooking: average('cooking'), simulations: iterations, trace: traces[0]!, sensitivity: [], mealDistribution,
    skillReleases: traces.reduce((sum, trace) => sum + (trace.skillReleases ?? 0), 0) / iterations, withoutDecay }
}
/** 每个检查点是完整方案评估边界；中断的评估以相同种子重做，不重复累加收益。 */
export function* scoreSearchSteps(request: ScoreRequest, measuredLookahead = defaultLookaheadNodes): Generator<ScoreCheckpoint, ScoreResult> {
  request = { ...request, settings: snapshotActivity(request.settings, 'week') }
  const invalid = validateScoreOptions(request.options, request.settings)
  if (invalid) throw new Error(invalid)
  const fingerprint = scoreFingerprint(request, measuredLookahead)
  const saved = request.checkpoint
  if (saved && (saved.version !== SCORE_RULE_VERSION || saved.fingerprint !== fingerprint)) throw new Error('规划参数或规则已变化，请重新规划')
  const state: ScoreCheckpoint = saved ? JSON.parse(JSON.stringify(saved)) : { version: SCORE_RULE_VERSION, fingerprint, phase: 'search', index: 0,
    policies: policyPool(request).map(policy => measuredLookahead > 1 ? { ...policy, lookaheadNodes: measuredLookahead } : policy),
    finalists: [], solutions: [], elapsedMs: 0, simulations: 0 }
  const high = request.options.precision === 'high'
  const budget = high ? (scoreSearch_scoreSearchSteps_runtimeParameters.p001 as 60000) : (scoreSearch_scoreSearchSteps_runtimeParameters.p002 as 30000)
  const reviewIterations = high ? (scoreSearch_scoreSearchSteps_runtimeParameters.p003 as 24) : (scoreSearch_scoreSearchSteps_runtimeParameters.p004 as 12)
  const replayVariants = 2 + scoreSearch_config_ruleCatalogs.scoreSearchStepsList0.values.length
  while (state.phase === 'search' && state.index < state.policies.length) {
    const began = Date.now()
    const result = evaluate(request, state.policies[state.index]!, 3)
    state.simulations += 3
    const ranked = [...state.finalists, result].sort((a, b) => b.mean - a.mean)
    const representatives = new Set(ranked.filter((candidate, index) =>
      ranked.findIndex(other => other.policy.kind === candidate.policy.kind) === index))
    const nightStyles = new Set([...representatives].map(candidate => candidate.policy.sleepWithHealer?.[0]))
    const contrastingNight = ranked.find(candidate => !nightStyles.has(candidate.policy.sleepWithHealer?.[0]))
    if (contrastingNight && representatives.size < scoreSearch_scoreSearchSteps_runtimeParameters.p005) representatives.add(contrastingNight)
    for (const candidate of ranked) {
      if (representatives.size >= scoreSearch_scoreSearchSteps_runtimeParameters.p005) break
      representatives.add(candidate)
    }
    state.finalists = [...representatives].sort((a, b) => b.mean - a.mean)
    state.index++; state.elapsedMs += Date.now() - began
    // Reserve enough time to replay each finalist with the same sample count.
    const plannedReplays = reviewIterations * (state.finalists.length * replayVariants + Number(Boolean(request.baseline)))
    const reviewEstimate = state.elapsedMs / state.simulations * plannedReplays
    const searchBudgetReached = state.elapsedMs + reviewEstimate >= budget ||
      state.elapsedMs >= budget * scoreSearch_scoreSearchSteps_runtimeParameters.p006
    if (state.index === state.policies.length || state.index >= policyKinds.length * 2 && searchBudgetReached) {
      state.policies = state.policies.slice(0, state.index)
      state.phase = 'review'
      state.index = 0
    }
    yield JSON.parse(JSON.stringify(state)) as ScoreCheckpoint
  }
  while (state.phase === 'review' && state.index < state.finalists.length) {
    const began = Date.now()
    const solution = evaluate(request, state.finalists[state.index]!.policy, reviewIterations, 1, true, true)
    for (const rollback of scoreSearch_config_ruleCatalogs.scoreSearchStepsList0.values) {
      const alternative = evaluate(request, solution.policy, reviewIterations, rollback)
      solution.sensitivity.push({ rollback, mean: alternative.mean })
    }
    state.simulations += reviewIterations * (replayVariants - 1) + (solution.withoutDecay?.additionalSimulations ?? 0)
    state.solutions.push(solution); state.index++
    state.elapsedMs += Date.now() - began
    yield JSON.parse(JSON.stringify(state)) as ScoreCheckpoint
  }
  state.solutions.sort((a, b) => b.mean - a.mean)
  const baselineStart = Date.now()
  const baselineMembers = request.baseline?.members.map(member => member.uid)
  const baseline = request.baseline ? {
    name: request.baseline.name,
    solution: evaluate({ ...request, box: request.baseline.members }, {
      day: [baselineMembers!], sleep: [baselineMembers!, baselineMembers!],
      settle: [baselineMembers!, baselineMembers!], recipeId: null, reserveMeals: 0,
      rotateMinutes: request.options.collectMinutes, fill: true, juiceAt: 80,
    }, reviewIterations, 1, true)
  } : undefined
  return { version: SCORE_RULE_VERSION, options: request.options, solutions: state.solutions, baseline, excluded: scoreCandidates(request.box).excluded,
    compared: state.policies.length, simulations: state.simulations + (baseline ? reviewIterations : 0), elapsedMs: state.elapsedMs + Date.now() - baselineStart,
    warnings: [...SCORE_ASSUMPTIONS, '技能衰退为模拟假设', ...new Set(state.solutions.flatMap(s => s.trace.warnings))] }
}
