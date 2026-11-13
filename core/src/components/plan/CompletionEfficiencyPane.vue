<script setup lang="ts">
import { gameText, sleepStyleText, t as translateUi } from '../../ui/i18n'


import { INPUT_RANGES } from '../../calc/inputRanges'
const INPUT_LIMITS = INPUT_RANGES.CompletionEfficiencyPane

import { useEncounterActivity } from '../../composables/useEncounterAvailability'
import { useActivities } from '../../composables/useActivities'
import { activitySleepStyles, createActivityContext } from '../../calc/activities'
import { computed, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { useRouter } from 'vue-router'
import { babyEfficiencyIslands, EFFICIENCY_SLEEP_TYPES } from '../../calc/babyEfficiency'
import { completionTargets } from '../../calc/completionEfficiency'
import { EVENT_BONUSES, sleepDiscoveryOptions, styleKey } from '../../calc/sleep'
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
const targets = computed(() => completionTargets(plan.value, options.value.selectionMode, research.value))
const pokeIds = computed(() => [...new Set(targets.value.map(style => style.pokeId))])
const faces = computed(() => targets.value.filter(style => style.pokeId === options.value.pokeId))
const targetAvailable = computed(() => faces.value.some(style => styleKey(style.pokeId, style.stars, style.styleId) === options.value.completionTarget))
const islands = computed(() => babyEfficiencyIslands(options.value.pokeId, options.value.completionTarget, research.value))
const activity = useActivities(options, () => options.value.island ?? 'all', () => settings.value.activity)
const research = useEncounterActivity(activity.context)
const eventMult = activity.field('drowsyPowerMultiplier', () => options.value.eventMult)
const mixMode = activity.field('eventMix', () => normalizeEventMix(options.value.eventMix) !== 'off' ? settings.value.sleepEventMix : 'off')
const otherTypes = computed({
  get: () => mixMode.value !== 'off',
  set: (value: boolean) => { mixMode.value = value ? settings.value.sleepEventMix : 'off' },
})
const simulationOptions = computed(() => ({ ...options.value, ...sleepDiscoveryOptions(plan.value, activity.context.value, plan.value.undiscoveredPreference), activity: research.value, eventMult: eventMult.value, eventMix: mixMode.value }))
watch(pokeIds, ids => {
  if (!options.value.pokeId) options.value.pokeId = ids[0] ?? 0
}, { immediate: true })
watch(faces, styles => {
  if (!options.value.completionTarget) {
    const first = styles[0]
    options.value.completionTarget = first ? styleKey(first.pokeId, first.stars, first.styleId) : ''
  }
}, { immediate: true })
function selectPokemon(id: number) {
  options.value.pokeId = id
  options.value.completionTarget = ''
}
watch(islands, available => {
  if (available.length && !available.some(island => island.id === options.value.island)) options.value.island = 'all'
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
    <button class="btn ghost" type="button" :disabled="busy" @click="activity.reset()">{{ translateUi("恢复本面板自动活动设置") }}</button>
    <div class="field"><label for="completion-selection">{{ translateUi("目标选择方式") }}</label><select id="completion-selection" v-model="options.selectionMode" :disabled="busy"><option value="sleepdex">{{ translateUi("根据睡姿图鉴") }}</option><option value="free">{{ translateUi("自由选择") }}</option></select></div>
    <p class="muted">{{ translateUi("每天合计 100 分，寻找指定") }}{{ options.selectionMode === 'free' ? '' : translateUi("未收集") }}{{ translateUi("睡姿至少出现一次的最佳方案。拆觉时，两觉使用相同卡比兽能量。") }}</p>
    <article v-if="!targets.length" class="card stack">
      <h3>{{ options.selectionMode === 'free' ? translateUi("当前暂无可选择的睡姿") : translateUi("暂无可补齐的普通睡姿") }}</h3>
      <p class="muted">{{ options.selectionMode === 'free' ? translateUi("当前资料中没有可参与研究的睡姿。") : translateUi("请先在睡姿图鉴中取消勾选尚未收集的睡姿，或切换为自由选择。") }}</p>
      <button v-if="options.selectionMode !== 'free'" class="btn ghost" type="button" @click="router.push({ path: '/pokemon', query: { tab: 'wall' } })">{{ translateUi("前往睡姿图鉴") }}</button>
    </article>
    <article v-else class="card stack">
      <div class="field"><label>{{ translateUi("目标宝可梦 ·") }} {{ options.selectionMode === 'free' ? translateUi("全部可研究睡姿") : translateUi("仅未收集") }}</label><PokePicker :model-value="options.pokeId" :allowed-ids="pokeIds" @update:model-value="selectPokemon" /></div>
      <div class="field"><label for="completion-target">{{ translateUi("目标睡姿") }}</label><select id="completion-target" v-model="options.completionTarget" :disabled="busy"><option v-for="style in faces" :key="styleKey(style.pokeId, style.stars, style.styleId)" :value="styleKey(style.pokeId, style.stars, style.styleId)">{{ style.stars }}★ · {{ sleepStyleText(style) }}</option></select></div>
      <div class="efficiency-fields">
        <div class="field"><label for="completion-island">{{ translateUi("岛屿") }}</label><select id="completion-island" v-model="options.island" :disabled="busy"><option value="all">{{ translateUi("全部 · 自动择优") }}</option><option v-for="island in islands" :key="island.id" :value="island.id">{{ gameText(island.name) }}</option></select></div>
        <div class="field"><label for="completion-sleep-type">{{ translateUi("睡眠类型") }}</label><select id="completion-sleep-type" v-model="options.sleepType" :disabled="busy"><option value="all">{{ translateUi("全部 · 自动择优") }}</option><option v-for="type in EFFICIENCY_SLEEP_TYPES" :key="type" :value="type">{{ gameText(type) }}</option></select></div>
      </div>
      <label class="row"><input v-model="options.campTicket" :disabled="busy" type="checkbox" role="switch"> {{ translateUi("露营券 +1（只加第一觉）") }}</label>
      <label class="row"><input v-model="options.splitSleep" :disabled="busy" type="checkbox" role="switch"> {{ translateUi("比较拆分睡眠") }}</label>
      <p class="muted">{{ options.splitSleep ? translateUi("同时比较整觉 100 分和两觉合计 100 分；指定睡眠类型时，两觉均使用该类型。") : translateUi("只计算一觉 100 分。") }}</p>
      <div class="field"><label for="completion-event">{{ translateUi("活动睡意之力倍率") }}</label><select id="completion-event" v-model.number="eventMult" :disabled="busy"><option v-if="!EVENT_BONUSES.some(b => b.mult === eventMult)" :value="eventMult">{{ eventMult }}{{ translateUi("倍（活动）") }}</option><option v-for="bonus in EVENT_BONUSES" :key="bonus.mult" :value="bonus.mult">{{ translateUi(bonus.label) }}</option></select></div>
      <label class="row"><input v-model="otherTypes" :disabled="busy" type="checkbox" role="switch"> {{ translateUi("活动期间遇到一些其他类型宝可梦") }}</label>
      <div class="efficiency-fields">
        <div class="field"><label for="completion-iterations">{{ translateUi("计算次数") }}</label><input id="completion-iterations" v-model.number="options.iterations" :disabled="busy" type="number" :min="INPUT_LIMITS.completion_iterations.min" :max="INPUT_LIMITS.completion_iterations.max" :step="INPUT_LIMITS.completion_iterations.step" inputmode="numeric"></div>
        <div class="field"><label for="completion-precision">{{ translateUi("计算精度") }}</label><select id="completion-precision" v-model="options.precision" :disabled="busy"><option value="low">{{ translateUi("低 · 快速搜索") }}</option><option value="medium">{{ translateUi("中 · 细化搜索") }}</option><option value="high">{{ translateUi("高 · 密集搜索") }}</option></select></div>
      </div>
      <p class="muted">{{ translateUi("每觉最多搜索 50 亿睡意之力。计算次数用于每个候选抽取状态；精度控制能量候选点与拆分比例的搜索细度。") }}</p>
      <button class="btn sage" type="button" :disabled="busy || !targetAvailable" @click="calculate">{{ translateUi("计算补齐效率") }}</button>
    </article>
    <p v-if="error" class="amber" role="alert">{{ translateUi(error) }}</p>
    <p v-if="notice" class="muted" role="status">{{ translateUi(notice) }}</p>
    <p v-if="options.pokeId && options.completionTarget && !targetAvailable" class="muted">{{ translateUi("此目标暂不可参与抽选") }}</p>
    <template v-if="result && resultTarget">
      <p v-if="dirty" class="amber">{{ translateUi("参数已修改，请重新计算更新结果。") }}</p>
      <p class="muted">{{ gameText(resultStyle?.name) }} · {{ resultStyle?.stars }}★ {{ resultStyle ? sleepStyleText(resultStyle) : "" }} · {{ result.options.iterations.toLocaleString('zh-CN') }} {{ translateUi("次模拟 · 睡意之力 ×") }}{{ result.options.eventMult }} {{ translateUi("· 露营券：") }}{{ result.options.campTicket ? translateUi("开启") : translateUi("关闭") }} {{ translateUi("· 跨类型：") }}{{ translateUi(eventMixLabel(result.options.eventMix)) }} · {{ result.options.island === 'all' ? translateUi("全部岛屿") : gameText(ISLANDS.find(island => island.id === result?.options.island)?.name) }}{{ translateUi("。列出本次搜索中每日补齐概率最高的方案。") }}</p>
      <BabyEfficiencyResult :key="JSON.stringify(result.options)" :title="translateUi('每日补齐概率最高')" unit="%" :optimum="result.catch" :precision="result.options.precision" probability />
    </template>
    <ProgressDialog :open="busy" :title="translateUi('正在计算补齐效率')" :progress="Math.min(100, Math.floor(progress.percent))" :stage="progress.island || '准备候选方案'" :notice="notice" :detail="translateUi('已模拟 {count} 个抽取状态', { count: progress.evaluatedStates.toLocaleString('zh-CN') })" cancellable cancel-text="取消计算" @cancel="cancel" />
  </div>
</template>

<style scoped>
.efficiency-fields { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 14px; }
@media (max-width: 400px) { .efficiency-fields { grid-template-columns: 1fr; } }
</style>
