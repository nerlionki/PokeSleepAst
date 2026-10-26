<script setup lang="ts">
import { computed, ref } from 'vue'
import type { SplitOptimum, SplitResult } from '../../calc/splitSleep'
import { sleepClock } from '../../calc/sleep'

const props = defineProps<{ title: string, optimum: SplitOptimum, result: SplitResult, metricIndex?: number }>()
const visible = ref(5)
const expanded = ref<Record<string, number>>({})
const format = (value: number) => value.toLocaleString('zh-CN', { maximumFractionDigits: 3 })
const groups = computed(() => {
  const rows = new Map<string, number[]>()
  for (const index of props.optimum.indices) {
    const key = JSON.stringify(props.result.candidates[index]!.values)
    const list = rows.get(key) ?? []; list.push(index); rows.set(key, list)
  }
  return [...rows].map(([key, indices]) => ({ key, indices, first: props.result.candidates[indices[0]!]! }))
})
const mainValue = computed(() => {
  const metric = props.metricIndex == null ? null : props.result.metrics[props.metricIndex]
  return metric ? `${format(props.optimum.value * (metric.kind === 'probability' ? 100 : 1))} ${metric.kind === 'probability' ? '% / 天' : metric.kind === 'count' ? '只 / 天' : '颗 / 天'}` : `${format(props.optimum.value * 100)}% 综合达成率`
})
</script>

<template>
  <section class="card stack split-result">
    <div class="row result-heading"><h3>{{ title }}</h3><strong v-if="optimum.indices.length" class="sage">{{ mainValue }}</strong></div>
    <p v-if="!optimum.indices.length" class="muted">本次搜索未找到有正收益的方案，请检查目标解锁条件，或增加模拟次数后重试。</p>
    <template v-else>
      <p class="muted">{{ optimum.indices.length }} 个模拟并列方案 · 按相同收益合并展示</p>
      <article v-for="group in groups.slice(0, visible)" :key="group.key" class="outcome stack">
        <div v-for="index in group.indices.slice(0, expanded[group.key] ?? 1)" :key="index" class="schedule stack">
          <strong>{{ result.candidates[index]!.sleeps.length === 1 ? '整觉 100 分' : '两觉合计 100 分' }}</strong>
          <div v-for="(sleep, sleepIndex) in result.candidates[index]!.sleeps" :key="sleepIndex" class="sleep-row">
            <span>{{ result.candidates[index]!.sleeps.length === 1 ? '整觉' : `第 ${sleepIndex + 1} 觉` }}</span>
            <strong>{{ sleep.score }} 分 · {{ sleepClock(sleep.score) }}</strong>
            <span>{{ sleep.sleepType }}</span>
            <small class="muted">睡意之力 {{ format(sleep.power) }} · {{ sleep.encounters }} 只普通研究</small>
          </div>
        </div>
        <button v-if="group.indices.length > (expanded[group.key] ?? 1)" class="btn ghost" type="button" @click="expanded[group.key] = (expanded[group.key] ?? 1) + 20">展开其余并列分配（剩余 {{ group.indices.length - (expanded[group.key] ?? 1) }}）</button>
        <div class="benefits">
          <div v-for="(metric, index) in result.metrics" :key="index" class="benefit">
            <span>{{ metric.label }}</span>
            <strong>{{ format(group.first.values[index]! * (metric.kind === 'probability' ? 100 : 1)) }} {{ metric.kind === 'probability' ? '%' : metric.kind === 'count' ? '只' : '颗' }}</strong>
            <small class="muted">{{ result.maxima[index]! > 0 ? `达成率 ${format(group.first.values[index]! / result.maxima[index]! * 100)}%` : '未解锁或本次模拟收益为 0' }} · 权重 {{ metric.weight }}</small>
          </div>
        </div>
      </article>
      <button v-if="groups.length > visible" class="btn ghost" type="button" @click="visible += 5">显示更多收益组合（剩余 {{ groups.length - visible }}）</button>
    </template>
  </section>
</template>

<style scoped>
.result-heading { justify-content: space-between; flex-wrap: wrap; gap: 8px; }
.outcome { border-top: 1px solid var(--line); padding-top: 16px; }
.schedule { gap: 8px; }
.sleep-row { display: flex; flex-wrap: wrap; gap: 6px 12px; align-items: baseline; }
.sleep-row small { flex-basis: 100%; }
.benefits { display: grid; grid-template-columns: repeat(auto-fit, minmax(210px, 1fr)); gap: 12px; }
.benefit { display: flex; flex-direction: column; gap: 4px; min-width: 0; overflow-wrap: anywhere; }
.benefit strong { font-variant-numeric: tabular-nums; }
@media (max-width: 400px) { .benefits { grid-template-columns: 1fr; } }
</style>
