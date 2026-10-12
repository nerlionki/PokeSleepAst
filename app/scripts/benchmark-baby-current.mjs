import { createRequire } from 'node:module'
import { tmpdir, cpus } from 'node:os'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { writeFileSync } from 'node:fs'
import { performance } from 'node:perf_hooks'
const root = resolve(import.meta.dirname, '../..')
const {build} = createRequire(join(root, 'wxapp/package.json'))('esbuild')
const outfile = join(tmpdir(), 'pokesleep-baby-after-20261012.mjs')
await build({entryPoints:[join(root,'core/src/calc/babyEfficiency.ts')],outfile,bundle:true,platform:'node',format:'esm',target:'node24'})
const before = await import(pathToFileURL(process.env.BENCHMARK_BASELINE_FILE ?? join(root,'docs/benchmarks/baby-before-20261012.mjs')).href)
const after = await import(pathToFileURL(outfile).href)
const iterations = Number(process.env.BENCHMARK_ITERATIONS ?? 100)
const rows=[]
for (const precision of (process.env.BENCHMARK_PRECISION ? [process.env.BENCHMARK_PRECISION] : ['medium','high'])) {
  for (const [label,engine] of (process.env.BENCHMARK_AFTER_ONLY === '1' ? [['after',after]] : [['before',before],['after',after]])) {
    engine.searchBabyEfficiency({...engine.DEFAULT_BABY_EFFICIENCY,pokeId:439,precision:'low',iterations:100})
    const start=performance.now()
    const result=engine.searchBabyEfficiency({...engine.DEFAULT_BABY_EFFICIENCY,pokeId:439,precision,iterations})
    const row={label,precision,iterations,ms:performance.now()-start,states:result.evaluatedStates,catch:result.catch.value,candy:result.candy.value}
    rows.push(row);console.log(JSON.stringify(row))
    writeFileSync(join(root,'app/benchmarks/baby-current-'+iterations+(process.env.BENCHMARK_AFTER_ONLY === '1' ? '-final' : '')+'.json'),JSON.stringify({node:process.version,cpu:cpus()[0].model,measuredAt:new Date().toISOString(),note:'After includes daily candy reduction, both split orders and a 5-billion power ceiling per sleep; every distinct draw state uses full iterations.',rows},null,2)+'\n')
  }
}
