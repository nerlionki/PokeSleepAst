<script setup lang="ts">
import { useActivities } from '../../composables/useActivities'
import { activitySleepStyles, createActivityContext } from '../../calc/activities'
import { computed, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { useRouter } from 'vue-router'
import { babyEfficiencyIslands, EFFICIENCY_SLEEP_TYPES } from '../../calc/babyEfficiency'
import { completionTargets } from '../../calc/completionEfficiency'
import { EVENT_BONUSES, styleKey } from '../../calc/sleep'
import { ISLANDS, SLEEP_STYLES } from '../../calc/data'
import { eventMixLabel, normalizeEventMix } from '../../calc/sleepRules'
import { useBabyEfficiency } from '../../composables/useBabyEfficiency'
import { usePlanStore } from '../../stores/plans'
import { useSettingsStore } from '../../stores/settings'
import PokePicker from '../shared/PokePicker.vue'
import ProgressDialog from '../shared/ProgressDialog.vue'
import BabyEfficiencyResult from './BabyEfficiencyResult.vue'

const router = useRouter()
const { plan } = storeToRefs(usePlanStore())
const { settings } = storeToRefs(useSettingsStore())
const options = computed(() => plan.value.completionEfficiency)
const targets = computed(() => completionTargets(plan.value, options.value.selectionMode, activity.context.value))
const pokeIds = computed(() => [...new Set(targets.value.map(style => style.pokeId))])
const faces = computed(() => targets.value.filter(style => style.pokeId === options.value.pokeId))
const islands = computed(() => babyEfficiencyIslands(options.value.pokeId, options.value.completionTarget, activity.context.value))
const activity = useActivities(options, () => options.value.island ?? 'all', () => settings.value.activity)
const eventMult = activity.field('drowsyPowerMultiplier', () => options.value.eventMult)
const mixMode = activity.field('eventMix', () => normalizeEventMix(options.value.eventMix) !== 'off' ? settings.value.sleepEventMix : 'off')
const otherTypes = computed({
  get: () => mixMode.value !== 'off',
  set: (value: boolean) => { mixMode.value = value ? settings.value.sleepEventMix : 'off' },
})
const simulationOptions = computed(() => ({ ...options.value, activity: activity.context.value, eventMult: eventMult.value, eventMix: mixMode.value }))
watch(pokeIds, ids => {
  if (!ids.includes(options.value.pokeId)) options.value.pokeId = ids[0] ?? 0
}, { immediate: true })
watch(faces, styles => {
  if (!styles.some(style => styleKey(style.pokeId, style.stars, style.styleId) === options.value.completionTarget)) {
    const first = styles[0]
    options.value.completionTarget = first ? styleKey(first.pokeId, first.stars, first.styleId) : ''
  }
}, { immediate: true })
watch(islands, available => {
  if (!available.some(island => island.id === options.value.island)) options.value.island = 'all'
}, { immediate: true })
const { busy, error, notice, result, progress, dirty, calculate, cancel } = useBabyEfficiency(simulationOptions)
const resultTarget = computed(() => result.value && targets.value.find(style => styleKey(style.pokeId, style.stars, style.styleId) === result.value?.options.completionTarget))
const resultStyle = computed(() => result.value && activitySleepStyles(SLEEP_STYLES, createActivityContext('research', result.value.options.activity)).find(style => styleKey(style.pokeId, style.stars, style.styleId) === result.value?.options.completionTarget))
// In dex mode a newly collected face leaves the target list; free mode keeps it.
watch(() => [options.value.pokeId, options.value.completionTarget], () => { if (busy.value) cancel() })
watch(() => options.value.selectionMode, () => {
  if (busy.value) cancel()
  result.value = null
  error.value = ''
  notice.value = ''
}, { flush: 'sync' })
</script>

<template>
  <div class="stack" :aria-busy="busy">
    <button class="btn ghost" type="button" :disabled="busy" @click="activity.reset()">恢复本面板自动活动设置</button>
    <div class="field"><label for="completion-selection">目标选择方式</label><select id="completion-selection" v-model="options.selectionMode" :disabled="busy"><option value="sleepdex">根据睡姿图鉴</option><option value="free">自由选择</option></select></div>
    <p class="muted">每天合计 100 分，寻找指定{{ options.selectionMode === 'free' ? '' : '未收集' }}睡姿至少出现一次的最佳方案。拆觉时，两觉使用相同卡比兽能量。</p>
    <article v-if="!targets.length" class="card stack">
      <h3>{{ options.selectionMode === 'free' ? '当前暂无可选择的睡姿' : '暂无可补齐的普通睡姿' }}</h3>
      <p class="muted">{{ options.selectionMode === 'free' ? '当前资料中没有可参与研究的睡姿。' : '请先在睡姿图鉴中取消勾选尚未收集的睡姿，或切换为自由选择。' }}</p>
      <button v-if="options.selectionMode !== 'free'" class="btn ghost" type="button" @click="router.push({ path: '/pokemon', query: { tab: 'wall' } })">前往睡姿图鉴</button>
    </article>
    <article v-else class="card stack">
      <div class="field"><label>目标宝可梦 · {{ options.selectionMode === 'free' ? '全部可研究睡姿' : '仅未收集' }}</label><PokePicker v-model="options.pokeId" :allowed-ids="pokeIds" /></div>
      <div class="field"><label for="completion-target">目标睡姿</label><select id="completion-target" v-model="options.completionTarget" :disabled="busy"><option v-for="style in faces" :key="styleKey(style.pokeId, style.stars, style.styleId)" :value="styleKey(style.pokeId, style.stars, style.styleId)">{{ style.stars }}★ · {{ style.styleName }}</option></select></div>
      <div class="efficiency-fields">
        <div class="field"><label for="completion-island">岛屿</label><select id="completion-island" v-model="options.island" :disabled="busy"><option value="all">全部 · 自动择优</option><option v-for="island in islands" :key="island.id" :value="island.id">{{ island.name }}</option></select></div>
        <div class="field"><label for="completion-sleep-type">睡眠类型</label><select id="completion-sleep-type" v-model="options.sleepType" :disabled="busy"><option value="all">全部 · 自动择优</option><option v-for="type in EFFICIENCY_SLEEP_TYPES" :key="type" :value="type">{{ type }}</option></select></div>
      </div>
      <label class="row"><input v-model="options.campTicket" :disabled="busy" type="checkbox" role="switch"> 露营券 +1（只加第一觉）</label>
      <label class="row"><input v-model="options.splitSleep" :disabled="busy" type="checkbox" role="switch"> 比较拆分睡眠</label>
      <p class="muted">{{ options.splitSleep ? '同时比较整觉 100 分和两觉合计 100 分；指定睡眠类型时，两觉均使用该类型。' : '只计算一觉 100 分。' }}</p>
      <div class="field"><label for="completion-event">活动睡意之力倍率</label><select id="completion-event" v-model.number="eventMult" :disabled="busy"><option v-if="!EVENT_BONUSES.some(b => b.mult === eventMult)" :value="eventMult">{{ eventMult }}倍（活动）</option><option v-for="bonus in EVENT_BONUSES" :key="bonus.mult" :value="bonus.mult">{{ bonus.label }}</option></select></div>
      <label class="row"><input v-model="otherTypes" :disabled="busy" type="checkbox" role="switch"> 活动期间遇到一些其他类型宝可梦</label>
      <div class="efficiency-fields">
        <div class="field"><label for="completion-iterations">计算次数</label><input id="completion-iterations" v-model.number="options.iterations" :disabled="busy" type="number" min="100" max="100000" step="100" inputmode="numeric"></div>
        <div class="field"><label for="completion-precision">计算精度</label><select id="completion-precision" v-model="options.precision" :disabled="busy"><option value="low">低 · 快速搜索</option><option value="medium">中 · 细化搜索</option><option value="high">高 · 密集搜索</option></select></div>
      </div>
      <p class="muted">每觉最多搜索 50 亿睡意之力。计算次数用于每个候选抽取状态；精度控制能量候选点与拆分比例的搜索细度。</p>
      <button class="btn sage" type="button" :disabled="busy || !options.completionTarget" @click="calculate">计算补齐效率</button>
    </article>
    <p v-if="error" class="amber" role="alert">{{ error }}</p>
    <p v-if="notice" class="muted" role="status">{{ notice }}</p>
    <template v-if="result && resultTarget">
      <p v-if="dirty" class="amber">参数已修改，请重新计算更新结果。</p>
      <p class="muted">{{ resultStyle?.name }} · {{ resultStyle?.stars }}★ {{ resultStyle?.styleName }} · {{ result.options.iterations.toLocaleString('zh-CN') }} 次模拟 · 睡意之力 ×{{ result.options.eventMult }} · 露营券：{{ result.options.campTicket ? '开启' : '关闭' }} · 跨类型：{{ eventMixLabel(result.options.eventMix) }} · {{ result.options.island === 'all' ? '全部岛屿' : ISLANDS.find(island => island.id === result?.options.island)?.name }}。列出本次搜索中每日补齐概率最高的方案。</p>
      <BabyEfficiencyResult :key="JSON.stringify(result.options)" title="每日补齐概率最高" unit="%" :optimum="result.catch" :precision="result.options.precision" probability />
    </template>
    <ProgressDialog :open="busy" title="正在计算补齐效率" :progress="Math.min(100, Math.floor(progress.percent))" :stage="progress.island || '准备候选方案'" :notice="notice" :detail="'已模拟 ' + progress.evaluatedStates.toLocaleString('zh-CN') + ' 个抽取状态'" cancellable cancel-text="取消计算" @cancel="cancel" />
  </div>
</template>

<style scoped>
.efficiency-fields { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 14px; }
@media (max-width: 400px) { .efficiency-fields { grid-template-columns: 1fr; } }
</style>
