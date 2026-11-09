<script setup lang="ts">
import { t as translateUi } from '../../ui/i18n'
import { gameLabel } from '../../ui/gameLabels'
import clientDefaults from '../../data/client-defaults.resource'

import { computed, shallowRef } from 'vue'
import type { EfficiencyOptimum, EfficiencyPrecision } from '../../calc/babyEfficiency'
const components_plan_BabyEfficiencyResult_config_clientDefaults = clientDefaults.modules.components_plan_BabyEfficiencyResult


const props = defineProps<{ title: string, unit: string, optimum: EfficiencyOptimum, precision: EfficiencyPrecision, probability?: boolean }>()
const visibleCount = shallowRef(components_plan_BabyEfficiencyResult_config_clientDefaults["visibleCountInitial"])
const visible = computed(() => props.optimum.intervals.slice(0, visibleCount.value))
const format = (value: number) => value.toLocaleString('zh-CN', { maximumFractionDigits: 3 })
const range = (min: number, max: number | null) => max === null ? `≥ ${format(min)}` : min === max ? format(min) : `${format(min)} – ${format(max)}`
</script>

<template>
  <section class="card stack efficiency-result">
    <header class="row result-header">
      <h3>{{ translateUi(title) }}</h3>
      <strong v-if="optimum.intervals.length" class="result-value">{{ format(probability ? optimum.value * 100 : optimum.value) }} {{ probability ? translateUi("% / 天") : translateUi("{arg1}/天", { arg1: String(unit) }) }}</strong>
    </header>
    <p v-if="!optimum.intervals.length" class="muted">{{ translateUi("本次搜索没有遇到目标的方案。") }}</p>
    <template v-else>
      <p class="muted">{{ probability ? translateUi("本次模拟搜索结果") : precision === 'high' ? translateUi("已比较全部拆分比例与能量候选点") : translateUi("近似搜索结果，可用高精度核对") }} · {{ optimum.intervals.length }} {{ translateUi("个推荐方案") }}</p>
      <article v-for="(interval, index) in visible" :key="index" class="efficiency-interval stack">
        <div class="row result-header"><strong>{{ interval.island }}</strong><span class="chip">{{ interval.sleeps.length === 1 ? translateUi("整觉") : translateUi("拆成两觉") }}</span></div>
        <p class="energy-range"><span class="muted">{{ translateUi("卡比兽能量") }}</span><strong>{{ range(interval.min, interval.max) }}</strong></p>
        <div v-for="(sleep, sleepIndex) in interval.sleeps" :key="sleepIndex" class="sleep-line">
          <span>{{ interval.sleeps.length === 1 ? translateUi("整觉") : translateUi("第 {arg1} 觉", { arg1: String(sleepIndex + 1) }) }}</span>
          <strong>{{ sleep.score }} {{ translateUi("分") }}</strong>
          <span class="sleep-types">{{ sleep.sleepTypes.map(gameLabel).join(' / ') }}<small v-if="sleep.sleepTypes.length > 1" class="muted">{{ translateUi("（任选）") }}</small></span>
        </div>
      </article>
      <button v-if="visibleCount < optimum.intervals.length" class="btn ghost" type="button" @click="visibleCount += 20">{{ translateUi("显示更多方案（剩余") }} {{ optimum.intervals.length - visibleCount }}）</button>
    </template>
  </section>
</template>

<style scoped>
.result-header { justify-content: space-between; flex-wrap: wrap; }
.result-value { color: var(--sage); font-size: var(--font-20); }
.efficiency-interval { border-top: 1px solid var(--line); padding-top: 14px; }
.energy-range { display: flex; flex-wrap: wrap; align-items: baseline; gap: 10px; }
.energy-range strong { color: var(--amber); font-size: var(--font-18); font-variant-numeric: tabular-nums; }
.sleep-line { display: flex; flex-wrap: wrap; align-items: baseline; gap: 6px 10px; font-size: var(--font-14); }
.sleep-types { flex-basis: 100%; }
</style>
