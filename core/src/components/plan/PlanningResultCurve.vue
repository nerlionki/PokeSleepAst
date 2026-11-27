<script setup lang="ts">
import { computed, shallowRef, watch } from 'vue'
import { planningCurvePeak, type PlanningCurvePoint } from '../../calc/planningCurve'
import { t } from '../../ui/i18n'

const props = defineProps<{
  series: { label: string, points: readonly PlanningCurvePoint[], unit: '%' | '只' | '颗' }[]
  axis: 'energy' | 'score'
  fixedEnergy?: number
}>()
const selection = shallowRef(0)
const active = computed(() => props.series[selection.value] ?? props.series[0])
const inspectedIndex = shallowRef<number>()
watch(active, () => { inspectedIndex.value = undefined })
const axisLabel = computed(() => t(props.axis === 'energy' ? '能量' : '第一觉分数'))
const metricLabel = computed(() => t(active.value?.unit === '%' ? '至少遇见一次的概率'
  : active.value?.unit === '颗' ? '家族糖果期望' : '期望次数'))
const position = (x: number) => props.axis === 'energy' ? x.toLocaleString() : `${x}/100`
function valueText(value: number) {
  if (active.value?.unit === '%') return `${(value * 100).toFixed(4)}%`
  return `${value.toFixed(6)} ${t(active.value?.unit)}`
}
const plot = computed(() => {
  const points = active.value?.points ?? []
  const peak = planningCurvePeak(points)
  if (!peak) return
  const minimum = points[0]!.x
  const maximum = points.at(-1)!.x
  const width = maximum - minimum
  const x = (value: number) => width ? (value - minimum) / width * 100 : 50
  const y = (value: number) => 95 - (peak.value > 0 ? value / peak.value * 90 : 0)
  const marks = points.map(point => ({ x: x(point.x), y: y(point.value) }))
  const targets = marks.map((mark, index) => {
    const left = index === 0 ? 0 : (marks[index - 1]!.x + mark.x) / 2
    const right = index === marks.length - 1 ? 100 : (mark.x + marks[index + 1]!.x) / 2
    return { left: `${left}%`, width: `${right - left}%` }
  })
  const steps = marks.slice(1).map((next, index) => {
    const previous = marks[index]!
    return {
      horizontal: { left: `${previous.x}%`, top: `${previous.y}%`, width: `${next.x - previous.x}%` },
      vertical: { left: `${next.x}%`, top: `${Math.min(previous.y, next.y)}%`, height: `${Math.abs(next.y - previous.y)}%` },
    }
  })
  return { peak, minimum, maximum, points, marks, steps, targets, peakStyle: { left: `${x(peak.x)}%`, top: `${y(peak.value)}%` } }
})
const inspected = computed(() => {
  const index = inspectedIndex.value
  if (index == null) return
  const point = plot.value?.points[index]
  const mark = plot.value?.marks[index]
  if (!point || !mark) return
  return { point, mark }
})
function moveInspection(offset: number) {
  const index = (inspectedIndex.value ?? 0) + offset
  if (plot.value?.points[index]) inspectedIndex.value = index
}
</script>

<template>
  <section v-if="plot" class="card stack">
    <h3>{{ t(axis === 'energy' ? '能量曲线' : '拆觉分数曲线') }}</h3>
    <p v-if="fixedEnergy != null" class="muted">{{ t('卡比兽能量') }} {{ fixedEnergy.toLocaleString() }}</p>
    <select v-if="series.length > 1" v-model.number="selection" :aria-label="t('已计算点走势')">
      <option v-for="(item, index) in series" :key="index" :value="index">{{ item.label }}</option>
    </select>
    <p v-else-if="active?.label" class="muted">{{ active.label }}</p>
    <div class="planning-curve" role="group" :aria-label="t('已计算点走势')">
      <div v-for="(step, index) in plot.steps" :key="index">
        <div class="planning-curve-horizontal" :style="step.horizontal" />
        <div class="planning-curve-vertical" :style="step.vertical" />
      </div>
      <div class="planning-curve-peak" :style="plot.peakStyle" />
      <template v-if="inspected">
        <div class="planning-curve-guide-x" :style="{ left: `${inspected.mark.x}%`, top: `${inspected.mark.y}%` }" />
        <div class="planning-curve-guide-y" :style="{ width: `${inspected.mark.x}%`, top: `${inspected.mark.y}%` }" />
        <div class="planning-curve-selected" :style="{ left: `${inspected.mark.x}%`, top: `${inspected.mark.y}%` }" />
      </template>
      <button
        v-for="(target, index) in plot.targets"
        :key="index" type="button" class="planning-curve-target" :style="target"
        :aria-label="`${axisLabel} ${position(plot.points[index]!.x)} · ${metricLabel} ${valueText(plot.points[index]!.value)}`"
        :aria-pressed="inspectedIndex === index"
        :tabindex="index === (inspectedIndex ?? 0) ? 0 : -1"
        @click="inspectedIndex = index"
      />
    </div>
    <div class="planning-curve-axis muted">
      <span>{{ position(plot.minimum) }}</span>
      <span>{{ axisLabel }}</span>
      <span>{{ position(plot.maximum) }}</span>
    </div>
    <div v-if="inspected" class="planning-curve-reading">
      <div class="planning-curve-values" aria-live="polite">
        <span>{{ axisLabel }} <strong>{{ position(inspected.point.x) }}</strong></span>
        <span>{{ metricLabel }} <strong>{{ valueText(inspected.point.value) }}</strong></span>
      </div>
      <div v-if="plot.points.length > 1" class="planning-curve-nav">
        <button type="button" class="btn ghost" :aria-label="t('上一个计算点')" :disabled="inspectedIndex === 0" @click="moveInspection(-1)">‹</button>
        <button type="button" class="btn ghost" :aria-label="t('下一个计算点')" :disabled="inspectedIndex === plot.points.length - 1" @click="moveInspection(1)">›</button>
      </div>
    </div>
    <p v-else class="muted">{{ t('点选曲线查看坐标') }}</p>
    <p class="muted">{{ t('已计算点中的最早峰值') }} · {{ axisLabel }} {{ position(plot.peak.x) }} · {{ valueText(plot.peak.value) }}</p>
  </section>
</template>

<style scoped>
.planning-curve {
  position: relative;
  height: 140px;
  margin: 0 5px;
  border-bottom: 1px solid var(--line);
  border-left: 1px solid var(--line);
}
.planning-curve-horizontal, .planning-curve-vertical, .planning-curve-peak {
  position: absolute;
  background: var(--sage);
}
.planning-curve-horizontal { height: 2px; }
.planning-curve-vertical { width: 2px; }
.planning-curve-peak {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  transform: translate(-50%, -50%);
}
.planning-curve-guide-x, .planning-curve-guide-y, .planning-curve-selected, .planning-curve-target {
  position: absolute;
}
.planning-curve-guide-x {
  bottom: 0;
  border-left: 1px dashed var(--amber);
}
.planning-curve-guide-y {
  left: 0;
  border-top: 1px dashed var(--amber);
}
.planning-curve-selected {
  width: 9px;
  height: 9px;
  border: 2px solid var(--amber);
  border-radius: 50%;
  transform: translate(-50%, -50%);
}
.planning-curve-target {
  top: 0;
  height: 100%;
  margin: 0;
  padding: 0;
  min-width: 0;
  max-width: none;
  border: 0;
  border-radius: 0;
  background: transparent;
  cursor: crosshair;
}
.planning-curve-target::after { border: 0; }
.planning-curve-target:focus-visible { outline: 1px solid var(--amber); outline-offset: -1px; }
.planning-curve-axis {
  display: flex;
  justify-content: space-between;
  gap: 8px;
}
.planning-curve-reading, .planning-curve-values, .planning-curve-nav {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px 12px;
}
.planning-curve-reading { justify-content: space-between; }
.planning-curve-reading strong { font-variant-numeric: tabular-nums; }
</style>
