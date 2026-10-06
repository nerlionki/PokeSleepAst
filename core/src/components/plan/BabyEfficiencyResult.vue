<script setup lang="ts">
import { computed, shallowRef } from 'vue'
import type { EfficiencyOptimum, EfficiencyPrecision } from '../../calc/babyEfficiency'

const props = defineProps<{ title: string, unit: string, optimum: EfficiencyOptimum, precision: EfficiencyPrecision }>()
const visibleCount = shallowRef(20)
const visible = computed(() => props.optimum.intervals.slice(0, visibleCount.value))
const format = (value: number) => value.toLocaleString('zh-CN', { maximumFractionDigits: 3 })
const range = (min: number, max: number | null) => max === null ? `≥ ${format(min)}` : min === max ? format(min) : `${format(min)} – ${format(max)}`
</script>

<template>
  <section class="card stack efficiency-result">
    <header class="row result-header">
      <h3>{{ title }}</h3>
      <strong v-if="optimum.intervals.length" class="result-value">{{ format(optimum.value) }} {{ unit }}/天</strong>
    </header>
    <p v-if="!optimum.intervals.length" class="muted">本次搜索没有遇到目标的方案。</p>
    <template v-else>
      <p class="muted">{{ precision === 'high' ? '已穷举全部拆分与能量临界区间' : '近似搜索结果，可用高精度核对' }} · {{ optimum.intervals.length }} 个并列最佳区间</p>
      <article v-for="(interval, index) in visible" :key="index" class="efficiency-interval stack">
        <div class="row result-header"><strong>{{ interval.island }}</strong><span class="chip">{{ interval.sleeps.length === 1 ? '整觉' : '拆成两觉' }}</span></div>
        <p class="energy-range"><span class="muted">卡比兽能量</span><strong>{{ range(interval.min, interval.max) }}</strong></p>
        <div v-for="(sleep, sleepIndex) in interval.sleeps" :key="sleepIndex" class="sleep-line">
          <span>{{ interval.sleeps.length === 1 ? '整觉' : `第 ${sleepIndex + 1} 觉` }}</span>
          <strong>{{ sleep.score }} 分</strong>
          <span class="sleep-types">{{ sleep.sleepTypes.join(' / ') }}<small v-if="sleep.sleepTypes.length > 1" class="muted">（任选）</small></span>
        </div>
      </article>
      <button v-if="visibleCount < optimum.intervals.length" class="btn ghost" type="button" @click="visibleCount += 20">显示更多区间（剩余 {{ optimum.intervals.length - visibleCount }}）</button>
    </template>
  </section>
</template>

<style scoped>
.result-header { justify-content: space-between; flex-wrap: wrap; }
.result-value { color: var(--sage); font-size: 20px; }
.efficiency-interval { border-top: 1px solid var(--line); padding-top: 14px; }
.energy-range { display: flex; flex-wrap: wrap; align-items: baseline; gap: 10px; }
.energy-range strong { color: var(--amber); font-size: 18px; font-variant-numeric: tabular-nums; }
.sleep-line { display: flex; flex-wrap: wrap; align-items: baseline; gap: 6px 10px; font-size: 14px; }
.sleep-types { flex-basis: 100%; }
</style>
