<script setup lang="ts">
import PlanCampTicket from './PlanCampTicket.vue'
import { usePlanCampTicket } from '../../composables/usePlanCampTicket'
import { gameText, sleepStyleText, t as translateUi } from '../../ui/i18n'


import { INPUT_RANGES } from '../../calc/inputRanges'
const INPUT_LIMITS = INPUT_RANGES.EncounterTargetPane

import { computed, onScopeDispose, useId, watch } from 'vue'
import { storeToRefs } from 'pinia'
import type { EncounterGoal } from '../../calc/encounterPlan'
import { availableBabyPokemonIds, babyEfficiencyIslands, EFFICIENCY_SLEEP_TYPES } from '../../calc/babyEfficiency'
import { completionTargets } from '../../calc/completionEfficiency'
import { EVENT_BONUSES, raeSleepStyleId, resolveSleepStyleRef } from '../../calc/sleep'
import { eventMixLabel, normalizeEventMix } from '../../calc/sleepRules'
import { useEncounterActivity } from '../../composables/useEncounterAvailability'
import { useActivities } from '../../composables/useActivities'
import { useBabyEfficiency } from '../../composables/useBabyEfficiency'
import { usePlanStore } from '../../stores/plans'
import { useSettingsStore } from '../../stores/settings'
import { ISLANDS, POKEDEX } from '../../calc/data'
import { familyOf } from '../../calc/candyPlan'
import PlanningTargetFields from './PlanningTargetFields.vue'
import ProgressDialog from '../shared/ProgressDialog.vue'
import BabyEfficiencyResult from './BabyEfficiencyResult.vue'

const props = defineProps<{ goal: EncounterGoal; adding?: boolean }>()
const emit = defineEmits<{ busy: [value: boolean]; valid: [value: boolean] }>()
const fieldPrefix = useId()
const options = computed(() => props.goal.options)
const isStyle = computed(() => props.goal.purpose === 'sleep')
const isCandy = computed(() => props.goal.purpose === 'candy')
const title = computed(() => isStyle.value ? '睡姿补齐效率' : isCandy.value ? '家族刷糖效率' : '宝宝捕捉效率')
const { plan } = storeToRefs(usePlanStore())
const { settings } = storeToRefs(useSettingsStore())
const { mode: campTicketMode, enabled: campTicket } = usePlanCampTicket('encounter')
const activity = useActivities(options, () => options.value.island ?? 'all', () => settings.value.activity)
const research = useEncounterActivity(activity.context)
const babyIds = computed(() => availableBabyPokemonIds(research.value, isCandy.value ? 'candy' : undefined))
const eventMult = activity.field('drowsyPowerMultiplier', () => options.value.eventMult)
const mixMode = activity.field('eventMix', () => normalizeEventMix(options.value.eventMix) !== 'off' ? settings.value.sleepEventMix : 'off')
const otherTypes = computed({ get: () => mixMode.value !== 'off', set: (value: boolean) => { mixMode.value = value ? settings.value.sleepEventMix : 'off' } })
const targets = computed(() => completionTargets(plan.value, props.goal.selectionMode, research.value))
const pokeIds = computed(() => isStyle.value ? [...new Set(targets.value.map(style => style.pokeId))] : babyIds.value)
watch(pokeIds, ids => {
  if (isStyle.value && ids.length && !options.value.pokeId) {
    options.value.pokeId = ids[0]!
    options.value.completionTarget = ''
  }
}, { immediate: true })
const faces = computed(() => targets.value.filter(style => style.pokeId === options.value.pokeId).sort((a, b) => a.stars - b.stars))
const faceKeys = computed(() => faces.value.map(raeSleepStyleId))
const validStyle = computed(() => {
  const id = resolveSleepStyleRef(options.value.completionTarget)
  return id != null && faceKeys.value.includes(id)
})
watch([isStyle, () => props.goal.selectionMode, faceKeys], ([sleep, mode, keys]) => {
  if (sleep && mode === 'sleepdex' && !options.value.completionTarget) options.value.completionTarget = keys[0] ?? ''
}, { immediate: true })
function selectPokemon(id: number) {
  if (isStyle.value && id !== options.value.pokeId) options.value.completionTarget = ''
  options.value.pokeId = id
}
const islands = computed(() => babyEfficiencyIslands(options.value.pokeId, isStyle.value ? options.value.completionTarget : undefined, research.value, isCandy.value ? 'candy' : undefined))
const simulationOptions = computed(() => ({ ...options.value, campTicket: campTicket.value, objective: isStyle.value ? undefined : props.goal.purpose === 'candy' ? 'candy' as const : 'catch' as const, activity: research.value, eventMult: eventMult.value, eventMix: mixMode.value }))
const { busy, error, notice, result, progress, dirty, calculate, cancel } = useBabyEfficiency(simulationOptions, props.goal.id)
watch(() => campTicket.value, () => { if (busy.value) cancel() })
watch(busy, value => emit('busy', value), { immediate: true })
onScopeDispose(() => emit('busy', false))
watch(islands, available => { if (available.length && !available.some(island => island.id === options.value.island)) options.value.island = 'all' }, { immediate: true })
watch(() => [options.value.pokeId, options.value.completionTarget, props.goal.selectionMode, validStyle.value], () => {
  if (busy.value) cancel()
  result.value = null
  error.value = ''
  notice.value = ''
}, { flush: 'sync' })
const resultName = computed(() => result.value ? POKEDEX.find(poke => poke.id === result.value!.options.pokeId)?.name : '')
const family = computed(() => [...new Set(POKEDEX.filter(poke => familyOf(poke.id) === familyOf(options.value.pokeId)).map(poke => poke.name))].join('、'))
const resultStyle = computed(() => {
  const id = resolveSleepStyleRef(result.value?.options.completionTarget)
  return id == null ? undefined : targets.value.find(style => raeSleepStyleId(style) === id)
})
const statistic = computed({ get: () => options.value.completionStatistic ?? 'first-hit', set: (value: 'first-hit' | 'expectation') => { options.value.completionStatistic = value } })
const probabilityResult = computed(() => isStyle.value && result.value?.options.completionStatistic !== 'expectation')
const canCalculate = computed(() => isStyle.value ? validStyle.value && islands.value.length > 0 : babyIds.value.includes(options.value.pokeId))
if (props.adding) watch(canCalculate, value => emit('valid', value), { immediate: true })
</script>

<template>
  <section class="stack" :class="{ card: !adding }" :aria-busy="busy">
    <h3 v-if="!adding">{{ translateUi(title) }}</h3>
    <p v-if="!adding" class="muted">{{ translateUi("每天合计 100 分，搜索所选岛屿、能量和睡眠类型；每次仅计算当前目标。") }}</p>
    <div class="target-fields stack">
      <PlanningTargetFields v-model:selection-mode="goal.selectionMode" v-model:style-id="options.completionTarget"
        :poke-id="options.pokeId" :style-target="isStyle" :allowed-ids="pokeIds" :faces="faces" :disabled="busy"
        :show-style="goal.selectionMode === 'free' || faces.length > 1 || !validStyle"
        :empty-style-option="goal.selectionMode === 'free' || !validStyle"
        @update:poke-id="selectPokemon" />
      <p v-if="isStyle && !validStyle" class="amber">{{ translateUi("请先选择范围内的宝可梦及具体睡姿。") }}</p>
      <p v-else-if="isStyle" class="muted">{{ translateUi("计算这个睡姿每天至少出现一次的概率。") }}</p>
      <p v-else-if="isCandy" class="muted">{{ translateUi("糖果统计") }} {{ family }} {{ translateUi("的睡眠研究奖励；第 11 只起按每只 1 颗结算。") }}</p>
      <p v-else class="muted">{{ translateUi("统计目标宝可梦全部星级的研究遇见只数。") }}</p>
      <template v-if="!adding">
      <div class="efficiency-fields">
        <div class="field"><label :for="fieldPrefix + '-island'">{{ translateUi("岛屿") }}</label><select :disabled="busy" :id="fieldPrefix + '-island'" v-model="options.island"><option value="all">{{ translateUi("全部 · 自动择优") }}</option><option v-for="island in islands" :key="island.id" :value="island.id">{{ gameText(island.name) }}</option></select></div>
        <div class="field"><label :for="fieldPrefix + '-sleep'">{{ translateUi("睡眠类型") }}</label><select :disabled="busy" :id="fieldPrefix + '-sleep'" v-model="options.sleepType"><option value="all">{{ translateUi("全部 · 自动择优") }}</option><option v-for="type in EFFICIENCY_SLEEP_TYPES" :key="type" :value="type">{{ gameText(type) }}</option></select></div>
      </div>
      <PlanCampTicket v-model="campTicketMode" :disabled="busy" />
      <label class="row"><input :disabled="busy" v-model="options.splitSleep" type="checkbox" role="switch"> {{ isStyle ? translateUi("比较拆分睡眠") : translateUi("拆分睡眠") }}</label>
      <p class="muted">{{ !options.splitSleep ? translateUi("只计算一觉 100 分。") : isStyle ? translateUi("同时比较整觉 100 分和两觉合计 100 分。") : translateUi("只搜索两觉合计 100 分的最佳比例。") }} {{ translateUi("拆觉使用相同卡比兽能量；指定睡眠类型时，两觉均使用该类型。") }}</p>
      <div class="field"><label :for="fieldPrefix + '-event'">{{ translateUi("活动睡意之力倍率") }}</label><select :disabled="busy" :id="fieldPrefix + '-event'" v-model.number="eventMult"><option v-if="!EVENT_BONUSES.some(bonus => bonus.mult === eventMult)" :value="eventMult">{{ eventMult }}{{ translateUi("倍（活动）") }}</option><option v-for="bonus in EVENT_BONUSES" :key="bonus.mult" :value="bonus.mult">{{ translateUi(bonus.label) }}</option></select></div>
      <label class="row"><input :disabled="busy" v-model="otherTypes" type="checkbox" role="switch"> {{ translateUi("活动期间遇到一些其他类型宝可梦") }}</label>
      <button class="btn ghost" type="button" :disabled="busy" @click="activity.reset()">{{ translateUi("恢复此目标自动活动设置") }}</button>
      <div class="efficiency-fields">
        <div v-if="isStyle" class="field"><label :for="fieldPrefix + '-statistic'">{{ translateUi("目标") }}</label><select :id="fieldPrefix + '-statistic'" v-model="statistic" :disabled="busy"><option value="first-hit">{{ translateUi("每日补齐概率最高") }}</option><option value="expectation">{{ translateUi("遇见只数最多") }}</option></select></div>
        <div v-if="options.precision === 'low'" class="field"><label :for="fieldPrefix + '-iterations'">{{ translateUi("计算次数") }}</label><input :disabled="busy" :id="fieldPrefix + '-iterations'" v-model.number="options.iterations" type="number" :min="INPUT_LIMITS.encounter_iterations.min" :max="INPUT_LIMITS.encounter_iterations.max" :step="INPUT_LIMITS.encounter_iterations.step" inputmode="numeric"></div>
        <div class="field"><label :for="fieldPrefix + '-precision'">{{ translateUi("计算精度") }}</label><select :disabled="busy" :id="fieldPrefix + '-precision'" v-model="options.precision"><option value="low">{{ translateUi("低 · 快速搜索") }}</option><option value="medium">{{ translateUi("中 · 细化搜索") }}</option><option value="high">{{ translateUi("高 · 密集搜索") }}</option></select></div>
      </div>
      <p v-if="options.precision === 'low'" class="muted">{{ translateUi("每觉最多搜索 50 亿睡意之力。计算次数用于每个候选抽取状态；精度控制能量和拆分比例的搜索细度。高精度耗时较长，可随时取消。") }}</p>
      </template>
    </div>
    <button v-if="!adding" class="btn sage" type="button" :disabled="busy || !canCalculate" @click="calculate">{{ translateUi("计算此目标效率") }}</button>
    <p v-if="error" class="amber" role="alert">{{ translateUi(error) }}</p>
    <p v-if="notice" class="muted" role="status">{{ translateUi(notice) }}</p>
    <p v-if="options.pokeId && (!isStyle || options.completionTarget) && !canCalculate" class="muted">{{ translateUi("此目标暂不可参与抽选") }}</p>
    <template v-if="result">
      <p v-if="dirty" class="amber">{{ translateUi("参数已修改，请重新计算更新结果。") }}</p>
      <p class="muted">{{ gameText(resultName) }}<template v-if="resultStyle"> · {{ resultStyle.stars }}★ {{ sleepStyleText(resultStyle) }}</template> · <template v-if="result.options.precision === 'low'">{{ result.options.iterations.toLocaleString('zh-CN') }} {{ translateUi("次模拟 · 睡意之力 ×") }}</template><template v-else>{{ translateUi("睡意之力") }} ×</template>{{ result.options.eventMult }} {{ translateUi("· 跨类型：") }}{{ translateUi(eventMixLabel(result.options.eventMix)) }} {{ translateUi("· 露营券：") }}{{ result.options.campTicket ? translateUi("开启") : translateUi("关闭") }} · {{ result.options.island === 'all' ? translateUi("全部岛屿") : gameText(ISLANDS.find(island => island.id === result?.options.island)?.name) }}{{ translateUi("。以下为本次搜索中该指标最高的方案。") }}</p>
      <BabyEfficiencyResult :key="JSON.stringify(result.options)" :title="probabilityResult ? translateUi('每日补齐概率最高') : isCandy ? translateUi('家族糖果最多') : translateUi('遇见只数最多')" :unit="isCandy ? '颗' : '只'" :optimum="isCandy ? result.candy : result.catch" :precision="result.options.precision" :probability="probabilityResult" :curves="result.curves" :curve-goal="isCandy ? 'candy' : 'catch'" />
    </template>
    <ProgressDialog :open="busy" :title="translateUi('正在计算{title}', { title: translateUi(title) })" :progress="Math.min(100, Math.floor(progress.percent))" :stage="progress.island || '准备候选方案'" :notice="notice" :detail="translateUi('已模拟 {count} 个抽取状态', { count: progress.evaluatedStates.toLocaleString('zh-CN') })" cancellable cancel-text="取消计算" @cancel="cancel" />
  </section>
</template>

<style scoped>
.target-fields { border: 0; padding: 0; margin: 0; min-width: 0; }
.efficiency-fields { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 14px; }
@media (max-width: 400px) { .efficiency-fields { grid-template-columns: 1fr; } }
</style>
