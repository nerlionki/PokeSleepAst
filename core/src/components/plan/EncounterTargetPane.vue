<script setup lang="ts">
import { computed, onScopeDispose, watch } from 'vue'
import { storeToRefs } from 'pinia'
import type { EncounterGoal } from '../../calc/encounterPlan'
import { BABY_POKEMON_IDS, BABY_POKEMON_NAMES, babyEfficiencyIslands, EFFICIENCY_SLEEP_TYPES } from '../../calc/babyEfficiency'
import { completionTargets } from '../../calc/completionEfficiency'
import { EVENT_BONUSES, styleKey } from '../../calc/sleep'
import { eventMixLabel, normalizeEventMix } from '../../calc/sleepRules'
import { useActivities } from '../../composables/useActivities'
import { useBabyEfficiency } from '../../composables/useBabyEfficiency'
import { usePlanStore } from '../../stores/plans'
import { useSettingsStore } from '../../stores/settings'
import { ISLANDS, POKEDEX } from '../../calc/data'
import { familyOf } from '../../calc/candyPlan'
import PokePicker from '../shared/PokePicker.vue'
import ProgressDialog from '../shared/ProgressDialog.vue'
import BabyEfficiencyResult from './BabyEfficiencyResult.vue'

const props = defineProps<{ goal: EncounterGoal }>()
const emit = defineEmits<{ busy: [value: boolean] }>()
const options = computed(() => props.goal.options)
const isStyle = computed(() => props.goal.purpose === 'sleep')
const isCandy = computed(() => props.goal.purpose === 'candy')
const title = computed(() => isStyle.value ? '睡姿补齐效率' : isCandy.value ? '家族刷糖效率' : '宝宝捕捉效率')
const { plan } = storeToRefs(usePlanStore())
const { settings } = storeToRefs(useSettingsStore())
const activity = useActivities(options, () => options.value.island ?? 'all', () => settings.value.activity)
const eventMult = activity.field('drowsyPowerMultiplier', () => options.value.eventMult)
const mixMode = activity.field('eventMix', () => normalizeEventMix(options.value.eventMix) !== 'off' ? settings.value.sleepEventMix : 'off')
const otherTypes = computed({ get: () => mixMode.value !== 'off', set: (value: boolean) => { mixMode.value = value ? settings.value.sleepEventMix : 'off' } })
const targets = computed(() => completionTargets(plan.value, props.goal.selectionMode, activity.context.value))
const pokeIds = computed(() => isStyle.value ? [...new Set(targets.value.map(style => style.pokeId))] : BABY_POKEMON_IDS)
watch(pokeIds, ids => {
  if (isStyle.value && ids.length && !ids.includes(options.value.pokeId)) {
    options.value.pokeId = ids[0]!
    options.value.completionTarget = ''
  }
}, { immediate: true })
const faces = computed(() => targets.value.filter(style => style.pokeId === options.value.pokeId))
const validStyle = computed(() => faces.value.some(style => styleKey(style.pokeId, style.stars, style.styleId) === options.value.completionTarget))
const islands = computed(() => babyEfficiencyIslands(options.value.pokeId, isStyle.value ? options.value.completionTarget : undefined, activity.context.value))
const simulationOptions = computed(() => ({ ...options.value, activity: activity.context.value, eventMult: eventMult.value, eventMix: mixMode.value }))
const { busy, error, notice, result, progress, dirty, calculate, cancel } = useBabyEfficiency(simulationOptions, props.goal.id)
watch(busy, value => emit('busy', value), { immediate: true })
onScopeDispose(() => emit('busy', false))
watch(islands, available => { if (!available.some(island => island.id === options.value.island)) options.value.island = 'all' }, { immediate: true })
watch(() => [options.value.pokeId, options.value.completionTarget, props.goal.selectionMode, validStyle.value], () => {
  if (busy.value) cancel()
  result.value = null
  error.value = ''
  notice.value = ''
}, { flush: 'sync' })
const resultName = computed(() => result.value ? POKEDEX.find(poke => poke.id === result.value!.options.pokeId)?.name : '')
const family = computed(() => [...new Set(POKEDEX.filter(poke => familyOf(poke.id) === familyOf(options.value.pokeId)).map(poke => poke.name))].join('、'))
const resultStyle = computed(() => result.value ? targets.value.find(style => styleKey(style.pokeId, style.stars, style.styleId) === result.value!.options.completionTarget) : undefined)
const canCalculate = computed(() => isStyle.value ? validStyle.value : BABY_POKEMON_IDS.includes(options.value.pokeId))
</script>

<template>
  <section class="card stack" :aria-busy="busy">
    <h3>{{ title }}</h3>
    <p class="muted">每天合计 100 分，搜索所选岛屿、能量和睡眠类型；每次仅计算当前目标。</p>
    <div class="target-fields stack">
      <template v-if="isStyle">
        <div class="field"><label for="encounter-selection">睡姿选择范围</label><select :disabled="busy" id="encounter-selection" v-model="goal.selectionMode"><option value="sleepdex">根据睡姿图鉴 · 仅未收集</option><option value="free">自由选择</option></select></div>
        <p v-if="!pokeIds.length" class="muted">暂无可选择的睡姿。可切换为自由选择，或在睡姿图鉴中取消勾选尚未收集的睡姿。</p>
      </template>
      <div v-if="pokeIds.length" class="field"><label>{{ isStyle ? '目标宝可梦' : '目标一阶段宝可梦' }}</label><PokePicker v-if="!busy" v-model="options.pokeId" :allowed-ids="pokeIds" :name-overrides="isStyle ? undefined : BABY_POKEMON_NAMES" /></div>
      <div v-if="isStyle" class="field"><label for="encounter-style">具体睡姿</label><select :disabled="busy" id="encounter-style" v-model="options.completionTarget"><option value="">请选择具体睡姿</option><option v-for="style in faces" :key="styleKey(style.pokeId, style.stars, style.styleId)" :value="styleKey(style.pokeId, style.stars, style.styleId)">{{ style.stars }}★ · {{ style.styleName }}</option></select></div>
      <p v-if="isStyle && !validStyle" class="amber">请先选择范围内的宝可梦及具体睡姿。</p>
      <p v-else-if="isStyle" class="muted">计算这个睡姿每天至少出现一次的概率。</p>
      <p v-else-if="isCandy" class="muted">糖果统计 {{ family }} 的睡眠研究奖励；第 11 只起按每只 1 颗结算。</p>
      <p v-else class="muted">统计目标宝可梦全部星级的研究遇见只数。</p>
      <div class="efficiency-fields">
        <div class="field"><label for="encounter-island">岛屿</label><select :disabled="busy" id="encounter-island" v-model="options.island"><option value="all">全部 · 自动择优</option><option v-for="island in islands" :key="island.id" :value="island.id">{{ island.name }}</option></select></div>
        <div class="field"><label for="encounter-sleep">睡眠类型</label><select :disabled="busy" id="encounter-sleep" v-model="options.sleepType"><option value="all">全部 · 自动择优</option><option v-for="type in EFFICIENCY_SLEEP_TYPES" :key="type" :value="type">{{ type }}</option></select></div>
      </div>
      <label class="row"><input :disabled="busy" v-model="options.campTicket" type="checkbox" role="switch"> 露营券 +1（只加第一觉）</label>
      <label class="row"><input :disabled="busy" v-model="options.splitSleep" type="checkbox" role="switch"> {{ isStyle ? '比较拆分睡眠' : '拆分睡眠' }}</label>
      <p class="muted">{{ !options.splitSleep ? '只计算一觉 100 分。' : isStyle ? '同时比较整觉 100 分和两觉合计 100 分。' : '只搜索两觉合计 100 分的最佳比例。' }} 拆觉使用相同卡比兽能量；指定睡眠类型时，两觉均使用该类型。</p>
      <div class="field"><label for="encounter-event">活动睡意之力倍率</label><select :disabled="busy" id="encounter-event" v-model.number="eventMult"><option v-if="!EVENT_BONUSES.some(bonus => bonus.mult === eventMult)" :value="eventMult">{{ eventMult }}倍（活动）</option><option v-for="bonus in EVENT_BONUSES" :key="bonus.mult" :value="bonus.mult">{{ bonus.label }}</option></select></div>
      <label class="row"><input :disabled="busy" v-model="otherTypes" type="checkbox" role="switch"> 活动期间遇到一些其他类型宝可梦</label>
      <button class="btn ghost" type="button" :disabled="busy" @click="activity.reset()">恢复此目标自动活动设置</button>
      <div class="efficiency-fields">
        <div class="field"><label for="encounter-iterations">计算次数</label><input :disabled="busy" id="encounter-iterations" v-model.number="options.iterations" type="number" min="100" max="100000" step="100" inputmode="numeric"></div>
        <div class="field"><label for="encounter-precision">计算精度</label><select :disabled="busy" id="encounter-precision" v-model="options.precision"><option value="low">低 · 快速搜索</option><option value="medium">中 · 细化搜索</option><option value="high">高 · 密集搜索</option></select></div>
      </div>
      <p class="muted">每觉最多搜索 50 亿睡意之力。计算次数用于每个候选抽取状态；精度控制能量和拆分比例的搜索细度。高精度耗时较长，可随时取消。</p>
    </div>
    <button class="btn sage" type="button" :disabled="busy || !canCalculate" @click="calculate">计算此目标效率</button>
    <p v-if="error" class="amber" role="alert">{{ error }}</p>
    <p v-if="notice" class="muted" role="status">{{ notice }}</p>
    <template v-if="result">
      <p v-if="dirty" class="amber">参数已修改，请重新计算更新结果。</p>
      <p class="muted">{{ resultName }}<template v-if="resultStyle"> · {{ resultStyle.stars }}★ {{ resultStyle.styleName }}</template> · {{ result.options.iterations.toLocaleString('zh-CN') }} 次模拟 · 睡意之力 ×{{ result.options.eventMult }} · 跨类型：{{ eventMixLabel(result.options.eventMix) }} · 露营券：{{ result.options.campTicket ? '开启' : '关闭' }} · {{ result.options.island === 'all' ? '全部岛屿' : ISLANDS.find(island => island.id === result?.options.island)?.name }}。以下为本次搜索中该指标最高的方案。</p>
      <BabyEfficiencyResult :key="JSON.stringify(result.options)" :title="isStyle ? '每日补齐概率最高' : isCandy ? '家族糖果最多' : '遇见只数最多'" :unit="isCandy ? '颗' : '只'" :optimum="isCandy ? result.candy : result.catch" :precision="result.options.precision" :probability="isStyle" />
    </template>
    <ProgressDialog :open="busy" :title="'正在计算' + title" :progress="Math.min(100, Math.floor(progress.percent))" :stage="progress.island || '准备候选方案'" :notice="notice" :detail="'已模拟 ' + progress.evaluatedStates.toLocaleString('zh-CN') + ' 个抽取状态'" cancellable cancel-text="取消计算" @cancel="cancel" />
  </section>
</template>

<style scoped>
.target-fields { border: 0; padding: 0; margin: 0; min-width: 0; }
.efficiency-fields { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 14px; }
@media (max-width: 400px) { .efficiency-fields { grid-template-columns: 1fr; } }
</style>
