import runtimeParameters from '../data/runtime-parameters.json'
import ruleCatalogs from '../data/rule-catalogs.json'
import { snapshotActivity } from './activities'
import { RECIPES, pokeById } from './data'
import { produce } from './produce'
import { resolveMemberSkill } from './mew'
import { recipeLevelMult, recipeLevelOf } from './cook'
import { nextSpecialTeamState, type SpecialTeamState } from './teamRestrictions'
import { unlockedSubskills } from './member'
import { SCORE_ASSUMPTIONS, simulateScore } from './scoreSimulation'
import { SCORE_RULE_VERSION, scoreCandidates, seededRandom, validateScoreOptions,
  type ScoreCheckpoint, type ScorePolicy, type ScoreRequest, type ScoreResult, type ScoreSolution } from './scorePlan'
const scoreSearch_policyPool_runtimeParameters = runtimeParameters.modules.scoreSearch.policyPool.values
const scoreSearch_config_ruleCatalogs = ruleCatalogs.modules.scoreSearch
const scoreSearch_scoreSearchSteps_runtimeParameters = runtimeParameters.modules.scoreSearch.scoreSearchSteps.values


export function scoreFingerprint(request: ScoreRequest): string {
  return JSON.stringify({ version: SCORE_RULE_VERSION, settings: snapshotActivity(request.settings, 'week'), box: request.box, options: request.options })
}
function policyPool(request: ScoreRequest): ScorePolicy[] {
  const { settings, options: o } = request
  const { candidates } = scoreCandidates(request.box)
  if (!candidates.length) throw new Error('Box 中没有可参与规划的个体，请先添加并确认生产资料')
  const random = seededRandom(o.seed)
  const environment = { ...settings, period: 'day' as const, meals: false, whistleHelps: 0, dailySkillHeal: 0 }
  const ranked = candidates.map(p => {
    const poke = pokeById(p.pokeId)!
    const result = produce(environment, { ...p, ribbonHours: p.tune?.ribbonHours ?? 0, wakeEnergy: (scoreSearch_policyPool_runtimeParameters.p001 as 100) }, 0)
    return { pokemon: p, poke, result, skill: resolveMemberSkill(poke, p).name }
  })
  const recipes = RECIPES.filter(r => r.category === o.category && !r.mix)
    .sort((a, b) => b.baseEnergy * recipeLevelMult(recipeLevelOf(settings, b.name)) - a.baseEnergy * recipeLevelMult(recipeLevelOf(settings, a.name)))
  const team = (scores: { uid: string, pokeId: number, score: number }[]) => {
    let special: SpecialTeamState = 'none'
    const selected: string[] = []
    for (const s of scores.sort((a, b) => b.score - a.score || a.uid.localeCompare(b.uid))) {
      const next = nextSpecialTeamState(special, s.pokeId)
      if (next == null) continue
      special = next; selected.push(s.uid)
      if (selected.length === (scoreSearch_policyPool_runtimeParameters.p002 as 5)) break
    }
    return selected
  }
  const policies: ScorePolicy[] = []
  const count = o.precision === 'high' ? (scoreSearch_policyPool_runtimeParameters.p003 as 96) : (scoreSearch_policyPool_runtimeParameters.p004 as 48)
  for (let index = 0; index < count; index++) {
    const recipe = recipes[index % Math.min(recipes.length, o.precision === 'high' ? (scoreSearch_policyPool_runtimeParameters.p005 as 12) : (scoreSearch_policyPool_runtimeParameters.p006 as 6))]!
    const noise = index < (scoreSearch_policyPool_runtimeParameters.p007 as 6) ? 0 : index < (scoreSearch_policyPool_runtimeParameters.p008 as 24) ? (scoreSearch_policyPool_runtimeParameters.p009 as 0.45) : (scoreSearch_policyPool_runtimeParameters.p010 as 1.2)
    const scores = (kind: 'berry' | 'food' | 'sleep' | 'settle') => ranked.map(r => {
      const heal = /活力|治愈|治癒|树果汁|樹果汁/.test(r.skill)
      const needed = recipe?.ingredients.reduce((sum, ing) => sum + Math.min(3, (r.result.ingredients[ing.name] ?? 0) / ing.count), 0) ?? 0
      const berry = r.result.berryEnergy + r.result.skillEnergy
      const support = (heal ? (scoreSearch_policyPool_runtimeParameters.p011 as 14000) : 0) + (unlockedSubskills(r.pokemon.level, r.pokemon.subskills).includes('helpingBonus') ? (scoreSearch_policyPool_runtimeParameters.p012 as 6000) : 0)
      const value = kind === 'settle' ? (unlockedSubskills(r.pokemon.level, r.pokemon.subskills).includes('sleepExp') ? (scoreSearch_policyPool_runtimeParameters.p013 as 30000) : 0) + berry * (scoreSearch_policyPool_runtimeParameters.p014 as 0.2)
        : kind === 'food' ? needed * (scoreSearch_policyPool_runtimeParameters.p015 as 14000) + berry * (scoreSearch_policyPool_runtimeParameters.p016 as 0.25) + support
        : kind === 'sleep' ? berry + r.poke.carry * 100 + support * (scoreSearch_policyPool_runtimeParameters.p017 as 0.5) : berry + support
      return { uid: r.pokemon.uid, pokeId: r.pokemon.pokeId, score: value * (1 + (random() - (scoreSearch_policyPool_runtimeParameters.p018 as 0.5)) * noise) }
    })
    const berryTeam = team(scores('berry')), foodTeam = team(scores('food'))
    policies.push({ day: [berryTeam, foodTeam], sleep: [team(scores('sleep')), team(scores('sleep'))],
      settle: [team(scores('settle')), team(scores('settle'))], recipe: recipe?.name ?? '',
      reserveMeals: scoreSearch_config_ruleCatalogs.policyPoolList0.values[Math.floor(index / (scoreSearch_policyPool_runtimeParameters.p019 as 6)) % (scoreSearch_policyPool_runtimeParameters.p020 as 4)]!, rotateMinutes: scoreSearch_config_ruleCatalogs.policyPoolList1.values[index % (scoreSearch_policyPool_runtimeParameters.p021 as 4)]!, fill: index % 3 !== 0, juiceAt: scoreSearch_config_ruleCatalogs.policyPoolList2.values[index % (scoreSearch_policyPool_runtimeParameters.p022 as 4)]! })
  }
  return policies
}
function evaluate(request: ScoreRequest, policy: ScorePolicy, iterations: number, rollback = 1, record = false): ScoreSolution {
  const traces = Array.from({ length: iterations }, (_, i) => simulateScore(request, policy, request.options.seed + i * 7919, rollback, record && i === 0))
  const mean = traces.reduce((sum, t) => sum + t.total, 0) / iterations
  const average = (key: 'berry' | 'zone' | 'skill' | 'cooking') => traces.reduce((sum, t) => sum + t[key], 0) / iterations
  return { policy, mean, min: Math.min(...traces.map(t => t.total)), max: Math.max(...traces.map(t => t.total)),
    deviation: Math.sqrt(traces.reduce((sum, t) => sum + (t.total - mean) ** 2, 0) / iterations),
    berry: average('berry'), zone: average('zone'), skill: average('skill'), cooking: average('cooking'), simulations: iterations, trace: traces[0]!, sensitivity: [] }
}
/** 每个检查点是完整方案评估边界；中断的评估以相同种子重做，不重复累加收益。 */
export function* scoreSearchSteps(request: ScoreRequest): Generator<ScoreCheckpoint, ScoreResult> {
  request = { ...request, settings: snapshotActivity(request.settings, 'week') }
  const invalid = validateScoreOptions(request.options, request.settings)
  if (invalid) throw new Error(invalid)
  const fingerprint = scoreFingerprint(request)
  const saved = request.checkpoint
  if (saved && (saved.version !== SCORE_RULE_VERSION || saved.fingerprint !== fingerprint)) throw new Error('规划参数或规则已变化，请重新规划')
  const state: ScoreCheckpoint = saved ? JSON.parse(JSON.stringify(saved)) : { version: SCORE_RULE_VERSION, fingerprint, phase: 'search', index: 0,
    policies: policyPool(request), finalists: [], solutions: [], elapsedMs: 0, simulations: 0 }
  const high = request.options.precision === 'high'
  const budget = high ? (scoreSearch_scoreSearchSteps_runtimeParameters.p001 as 60000) : (scoreSearch_scoreSearchSteps_runtimeParameters.p002 as 30000)
  const reviewIterations = high ? (scoreSearch_scoreSearchSteps_runtimeParameters.p003 as 24) : (scoreSearch_scoreSearchSteps_runtimeParameters.p004 as 12)
  while (state.phase === 'search' && state.index < state.policies.length) {
    const began = Date.now()
    const result = evaluate(request, state.policies[state.index]!, 3)
    state.simulations += 3
    state.finalists.push(result); state.finalists.sort((a, b) => b.mean - a.mean); state.finalists = state.finalists.slice(0, (scoreSearch_scoreSearchSteps_runtimeParameters.p005 as 5))
    state.index++; state.elapsedMs += Date.now() - began
    if (state.index === state.policies.length || state.elapsedMs >= budget * (scoreSearch_scoreSearchSteps_runtimeParameters.p006 as 0.65)) { state.policies = state.policies.slice(0, state.index); state.phase = 'review'; state.index = 0 }
    yield JSON.parse(JSON.stringify(state)) as ScoreCheckpoint
  }
  while (state.phase === 'review' && state.index < state.finalists.length) {
    const began = Date.now()
    const solution = evaluate(request, state.finalists[state.index]!.policy, reviewIterations, 1, true)
    for (const rollback of scoreSearch_config_ruleCatalogs.scoreSearchStepsList0.values) {
      const alternative = evaluate(request, solution.policy, reviewIterations, rollback)
      solution.sensitivity.push({ rollback, mean: alternative.mean })
    }
    state.simulations += reviewIterations * 3; state.solutions.push(solution); state.index++
    state.elapsedMs += Date.now() - began
    yield JSON.parse(JSON.stringify(state)) as ScoreCheckpoint
  }
  state.solutions.sort((a, b) => b.mean - a.mean)
  return { version: SCORE_RULE_VERSION, options: request.options, solutions: state.solutions, excluded: scoreCandidates(request.box).excluded,
    compared: state.policies.length, simulations: state.simulations, elapsedMs: state.elapsedMs,
    warnings: [...SCORE_ASSUMPTIONS, ...new Set(state.solutions.flatMap(s => s.trace.warnings))] }
}
