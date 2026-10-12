import {createRequire} from 'node:module'
import {tmpdir} from 'node:os'
import {join,resolve} from 'node:path'
import {pathToFileURL} from 'node:url'
import {writeFileSync} from 'node:fs'
const root=resolve(import.meta.dirname,'../..');const {build}=createRequire(join(root,'wxapp/package.json'))('esbuild')
const outfile=join(tmpdir(),'pokesleep-bagon-current.mjs');await build({entryPoints:[join(root,'core/src/calc/babyEfficiency.ts')],outfile,bundle:true,platform:'node',format:'esm',target:'node24'})
const e=await import(pathToFileURL(outfile).href)
const options={...e.DEFAULT_BABY_EFFICIENCY,pokeId:371,precision:process.env.BAGON_PRECISION??'medium', ...(process.env.BAGON_ISLAND ? {island:process.env.BAGON_ISLAND} : {}), ...(process.env.BAGON_SLEEP_TYPE ? {sleepType:process.env.BAGON_SLEEP_TYPE} : {})}
const start=performance.now();let last=0
const result=e.searchBabyEfficiency(options,p=>{if(performance.now()-last>15000){last=performance.now();console.log(JSON.stringify(p))}})
const output={measuredAt:new Date().toISOString(),elapsedMs:performance.now()-start,...result};writeFileSync(join(root,'app/benchmarks/bagon-'+options.precision+'.json'),JSON.stringify(output,null,2)+'\n')
console.log(JSON.stringify({elapsedMs:output.elapsedMs,evaluatedStates:result.evaluatedStates,catch:result.catch.value,candy:result.candy.value,catchPlans:result.catch.intervals.slice(0,5),candyPlans:result.candy.intervals.slice(0,5),catchPlanCount:result.catch.intervals.length,candyPlanCount:result.candy.intervals.length}))
