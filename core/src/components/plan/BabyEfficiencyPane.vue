<script setup lang="ts">
import { computed, nextTick, useTemplateRef, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { BABY_POKEMON_IDS } from '../../calc/babyEfficiency'
import { POKEDEX, pokeById } from '../../calc/data'
import { familyOf } from '../../calc/candyPlan'
import { EVENT_BONUSES } from '../../calc/sleep'
import { useBabyEfficiency } from '../../composables/useBabyEfficiency'
import { usePlanStore } from '../../stores/plans'
import PokePicker from '../shared/PokePicker.vue'
import BabyEfficiencyResult from './BabyEfficiencyResult.vue'

const { plan } = storeToRefs(usePlanStore())
const options = computed(() => plan.value.babyEfficiency)
const family = computed(() => POKEDEX.filter((poke) => familyOf(poke.id) === familyOf(options.value.pokeId)).map((poke) => poke.name).join('、'))
const targetName = computed(() => pokeById(options.value.pokeId)?.name ?? '')
const { busy, error, notice, result, progress, dirty, calculate, cancel } = useBabyEfficiency(options)
const resultName = computed(() => result.value ? pokeById(result.value.options.pokeId)?.name : '')
const percent = computed(() => Math.min(100, Math.floor(progress.value.percent)))
const cancelButton = useTemplateRef<HTMLButtonElement>('cancelButton')
const calculateButton = useTemplateRef<HTMLButtonElement>('calculateButton')
watch(busy, async (value, _previous, onCleanup) => {
  if (!value) {
    await nextTick()
    calculateButton.value?.focus({ preventScroll: true })
    return
  }
  const overflow = document.body.style.overflow
  document.body.style.overflow = 'hidden'
  onCleanup(() => { document.body.style.overflow = overflow })
  await nextTick()
  if (busy.value) cancelButton.value?.focus()
})
</script>

<template>
  <div class="stack" :aria-busy="busy">
    <p class="muted">每天按 100 分，自动比较所有岛屿、整觉和拆觉；两觉可分别选择睡眠类型，卡比兽能量按相同值计算。</p>
    <article class="card stack">
      <div class="field"><label>目标一阶段宝可梦</label><PokePicker v-model="options.pokeId" :allowed-ids="BABY_POKEMON_IDS" /></div>
      <p class="muted">捕捉统计 {{ targetName }} 的全部星级睡姿。糖果统计 {{ family }} 的睡眠研究奖励。</p>
      <div class="field"><label for="baby-event">活动睡意之力倍率</label>
        <select id="baby-event" v-model.number="options.eventMult"><option v-for="bonus in EVENT_BONUSES" :key="bonus.mult" :value="bonus.mult">{{ bonus.label }}</option></select>
      </div>
      <label class="row"><input v-model="options.eventMix" type="checkbox"> 活动期间跨睡眠类型出现</label>
      <div class="efficiency-fields">
        <div class="field"><label for="baby-iterations">计算次数</label><input id="baby-iterations" v-model.number="options.iterations" type="number" min="100" max="100000" step="100" inputmode="numeric"></div>
        <div class="field"><label for="baby-precision">计算精度</label><select id="baby-precision" v-model="options.precision"><option value="low">低 · 快速搜索</option><option value="medium">中 · 细化搜索</option><option value="high">高 · 穷举全部区间</option></select></div>
      </div>
      <p class="muted">计算次数用于每个候选抽取状态的模拟；精度控制能量区间和拆分比例的搜索细度。高精度耗时较长，可随时取消。</p>
      <button ref="calculateButton" class="btn sage" type="button" :disabled="busy" @click="calculate">计算宝宝效率</button>
    </article>
    <p v-if="error" class="amber" role="alert">{{ error }}</p>
    <p v-if="notice" class="muted" role="status">{{ notice }}</p>
    <template v-if="result">
      <p v-if="dirty" class="amber">参数已修改，请重新计算更新结果。</p>
      <p class="muted">{{ resultName }} · {{ result.options.iterations.toLocaleString('zh-CN') }} 次模拟 · 睡意之力 ×{{ result.options.eventMult }}{{ result.options.eventMix ? ' · 跨类型活动' : '' }}。预期收益只计普通睡眠研究；最高值相同的方案均列出。</p>
      <BabyEfficiencyResult :key="`${JSON.stringify(result.options)}-catch`" title="捕捉只数最多" unit="只" :optimum="result.catch" :precision="result.options.precision" />
      <BabyEfficiencyResult :key="`${JSON.stringify(result.options)}-candy`" title="家族糖果最多" unit="颗" :optimum="result.candy" :precision="result.options.precision" />
    </template>
    <Teleport to="body">
      <div v-if="busy" v-back="cancel" class="overlay efficiency-loading" role="dialog" aria-modal="true" aria-labelledby="baby-loading-title" @keydown.esc="cancel" @keydown.tab.prevent="cancelButton?.focus()">
        <section class="card stack loading-card" role="status" aria-live="polite">
          <div class="loading-spinner" aria-hidden="true" />
          <h3 id="baby-loading-title">正在计算宝宝效率</h3>
          <p>{{ progress.island || '准备候选方案' }} · {{ percent }}%</p>
          <progress class="loading-progress" :value="percent" max="100" aria-label="计算进度" />
          <p class="muted">已模拟 {{ progress.evaluatedStates.toLocaleString('zh-CN') }} 个抽取状态</p>
          <button ref="cancelButton" class="btn ghost" type="button" @click="cancel">取消计算</button>
        </section>
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
.efficiency-fields { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 14px; }
.efficiency-loading { z-index: 55; place-items: center; padding: 20px; backdrop-filter: blur(4px); }
.loading-card { width: min(100%, 380px); text-align: center; justify-items: center; box-shadow: var(--shadow); }
.loading-progress { width: 100%; height: 10px; accent-color: var(--sage); }
.loading-spinner { width: 38px; height: 38px; border: 3px solid var(--line); border-top-color: var(--sage); border-radius: 50%; animation: efficiency-spin 1s linear infinite; }
@keyframes efficiency-spin { to { transform: rotate(360deg); } }
@media (max-width: 400px) { .efficiency-fields { grid-template-columns: 1fr; } }
@media (prefers-reduced-motion: reduce) { .loading-spinner { animation: none; } }
</style>
