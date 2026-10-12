import { execFileSync } from 'node:child_process'
import { writeFileSync, readFileSync, rmSync, mkdtempSync, mkdirSync } from 'node:fs'
import { createRequire } from 'node:module'
import { tmpdir, cpus } from 'node:os'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { performance } from 'node:perf_hooks'
const root = path.resolve(import.meta.dirname, '../..')
const baselineRef = process.env.BENCHMARK_BASELINE ?? '4a88a3979163a5fdad8b344e71441cbbfbd8ae23'
const iterations = Number(process.env.BENCHMARK_ITERATIONS ?? 1000)
const precision = process.env.BENCHMARK_PRECISION ?? 'medium'
const repeats = Number(process.env.BENCHMARK_REPEATS ?? 3)
const baselineFile = path.join(root, `core/src/calc/babyEfficiency.baseline-${process.pid}.ts`)
const temp = mkdtempSync(path.join(tmpdir(), 'baby-efficiency-benchmark-'))
const { build } = createRequire(path.join(root, 'wxapp/package.json'))('esbuild')
try {
  const baselineCommit = execFileSync('git', ['rev-parse', baselineRef], { cwd: root, encoding: 'utf8' }).trim()
  writeFileSync(baselineFile, execFileSync('git', ['show', `${baselineRef}:core/src/calc/babyEfficiency.ts`], { cwd: root }))
  const outfile = path.join(temp, 'search.mjs')
  await build({ stdin: { contents: `export * as before from ${JSON.stringify(baselineFile)}; export * as after from './core/src/calc/babyEfficiency';`, resolveDir: root }, outfile, bundle: true, platform: 'node', format: 'esm', target: 'node24' })
  const { before, after } = await import(pathToFileURL(outfile).href)
  const pokedex = JSON.parse(readFileSync(path.join(root, 'core/src/data/pokedex.json'), 'utf8'))
  const ids = (process.env.BENCHMARK_POKEMON ?? '1,133,439').split(',').map(Number)
  const rows = []
  for (const pokeId of ids) {
    const options = { ...after.DEFAULT_BABY_EFFICIENCY, pokeId, iterations, precision, eventMix: 'off' }
    const island = after.babyEfficiencyIslands(pokeId)[0]?.id
    let variants = [ ['修改前', before, options], ['修改后默认', after, options], ['指定岛屿和自身类型', after, { ...options, island, sleepType: pokedex.find((poke) => poke.id === pokeId).sleepType }], ['关闭拆分', after, { ...options, splitSleep: false }] ]
    if (process.env.BENCHMARK_DEFAULT_ONLY === '1') variants = variants.slice(0, 2)
    // Warm both engines before timed runs; alternate order to reduce JIT/order bias.
    for (const engine of [before, after]) engine.searchBabyEfficiency({ ...options, precision: 'low', iterations: 100 })
    const samples = variants.map(() => []), states = variants.map(() => 0), outcomes = variants.map(() => null)
    for (let repeat = 0; repeat < repeats; repeat++) {
      const order = repeat % 2 ? [...variants.keys()].reverse() : [...variants.keys()]
      for (const index of order) {
        const [label, engine, selected] = variants[index]
        const start = performance.now(); const result = engine.searchBabyEfficiency(selected)
        const ms = performance.now() - start; samples[index].push(ms); states[index] = result.evaluatedStates
        outcomes[index] = { catch: result.catch.value, candy: result.candy.value }
        console.log(`${pokeId} ${label} ${repeat + 1}/${repeats}: ${(ms / 1000).toFixed(3)} s, ${result.evaluatedStates} states`)
      }
    }
    const median = (values) => [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)]
    rows.push({ pokeId, name: pokedex.find((poke) => poke.id === pokeId).name, firstAvailableIsland: island, variants: variants.map(([label], index) => ({ label, medianMs: median(samples[index]), samplesMs: samples[index], states: states[index], result: outcomes[index] })) })
    // Save after each target so a long benchmark always leaves reviewable measurements.
    mkdirSync(path.join(root, 'app/benchmarks'), { recursive: true })
    writeFileSync(path.join(root, `app/benchmarks/baby-efficiency-${precision}-${iterations}${process.env.BENCHMARK_DEFAULT_ONLY === '1' ? '-defaults' : ''}.json`), JSON.stringify({ measuredAt: new Date().toISOString(), baselineCommit, node: process.version, cpu: cpus()[0]?.model, iterations, precision, repeats, eventMix: 'off', island: 'all', sleepType: 'all', splitSleep: true, comparison: 'Old default searches all sleep types and whole/split sleep; new default applies the requested own-type/featureless and split-only restrictions.', rows }, null, 2) + '\n')
  }
} finally {
  rmSync(baselineFile, { force: true }); rmSync(temp, { recursive: true, force: true })
}
