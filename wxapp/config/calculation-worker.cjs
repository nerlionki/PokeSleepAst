// Keep the scheduler as a named function declaration: some WeChat Worker
// runtimes fail while wrapping an assigned arrow callback's readonly toString.
const schedulerSource = `
function run(steps, checkpoint) {
 function tick() {
  try {
   const next = steps.next();
   if (next.done) worker.postMessage({type:'result',result:next.value});
   else { checkpoint(next.value); setTimeout(tick,0); }
  } catch(error) {
   worker.postMessage({type:'error',message:error && error.message ? String(error.message) : '计算失败'});
  }
 }
 tick();
}
`

function calculationWorkerEntry(handler) {
  if (!['runBaby', 'runSleep', 'runScore'].includes(handler)) throw Error('Unknown calculation worker')
  return `let run;
worker.onMessage(function receive(message) {
 try {
  if (!run) {
   globalThis.__sleepastResources = message.__sleepastResources;
   run = require('./calculation.js').${handler};
  }
  run(message);
 } catch(error) {
  worker.postMessage({type:'error',message:error && error.message ? String(error.message) : '后台计算启动失败'});
 }
});
`
}

module.exports = { schedulerSource, calculationWorkerEntry }
