<script setup lang="ts">
import { gameText, t as translateUi } from '../../ui/i18n'


import { INPUT_RANGES } from '../../calc/inputRanges'
const INPUT_LIMITS = INPUT_RANGES.BabyEfficiencyPane

import { useActivities } from '../../composables/useActivities'
import ProgressDialog from '../shared/ProgressDialog.vue'
import { eventMixLabel, normalizeEventMix } from '../../calc/sleepRules'
import { useSettingsStore } from '../../stores/settings'
import { computed, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { BABY_POKEMON_IDS, BABY_POKEMON_NAMES, babyEfficiencyPokemonName, babyEfficiencyIslands, EFFICIENCY_SLEEP_TYPES } from '../../calc/babyEfficiency'
import { ISLANDS, POKEDEX } from '../../calc/data'
import { familyOf } from '../../calc/candyPlan'
import { EVENT_BONUSES, sleepDiscoveryOptions } from '../../calc/sleep'
import { useBabyEfficiency } from '../../composables/useBabyEfficiency'
import { usePlanStore } from '../../stores/plans'
import PokePicker from '../shared/PokePicker.vue'
import BabyEfficiencyResult from './BabyEfficiencyResult.vue'

const { plan } = storeToRefs(usePlanStore())
const options = computed(() => plan.value.babyEfficiency)
const { settings } = storeToRefs(useSettingsStore())
const activity = useActivities(options, () => options.value.island ?? 'all', () => settings.value.activity)
const eventMult = activity.field('drowsyPowerMultiplier', () => options.value.eventMult)
const mixMode = activity.field('eventMix', () => normalizeEventMix(options.value.eventMix) !== 'off' ? settings.value.sleepEventMix : 'off')
const otherTypes = computed({
  get: () => mixMode.value !== 'off',
  set: (value: boolean) => { mixMode.value = value ? settings.value.sleepEventMix : 'off' },
})
const simulationOptions = computed(() => ({ ...options.value, ...sleepDiscoveryOptions(plan.value, activity.context.value, plan.value.undiscoveredPreference), activity: activity.context.value, eventMult: eventMult.value, eventMix: mixMode.value }))
const islands = computed(() => babyEfficiencyIslands(options.value.pokeId, undefined, activity.context.value))
const sleepTypes = EFFICIENCY_SLEEP_TYPES
watch(islands, () => {
  if (islands.value.length <= 1 || !islands.value.some((island) => island.id === options.value.island)) options.value.island = 'all'
}, { immediate: true })
const family = computed(() => [...new Set(POKEDEX.filter((poke) => familyOf(poke.id) === familyOf(options.value.pokeId)).map((poke) => options.value.pokeId === 710 ? poke.name.replace(/\(.*\)/, '') : poke.name))].join('、'))
const targetName = computed(() => babyEfficiencyPokemonName(options.value.pokeId))
const { busy, error, notice, result, progress, dirty, calculate, cancel } = useBabyEfficiency(simulationOptions)
const resultName = computed(() => result.value ? babyEfficiencyPokemonName(result.value.options.pokeId) : '')
const percent = computed(() => Math.min(100, Math.floor(progress.value.percent)))
</script>

<template>
  <div class="stack" :aria-busy="busy">
    <button class="btn ghost" type="button" :disabled="busy" @click="activity.reset()">{{ translateUi("恢复本面板自动活动设置") }}</button>
    <p class="muted">{{ translateUi("每天按 100 分，在所选岛屿和睡眠类型范围内寻找最佳方案。开启拆分睡眠后，两觉合计 100 分，卡比兽能量按相同值计算。") }}</p>
    <article class="card stack">
      <div class="field"><label>{{ translateUi("目标一阶段宝可梦") }}</label><PokePicker v-model="options.pokeId" :allowed-ids="BABY_POKEMON_IDS" :name-overrides="BABY_POKEMON_NAMES" /></div>
      <div class="efficiency-fields">
        <div class="field"><label for="baby-island">{{ translateUi("岛屿") }}</label><select id="baby-island" v-model="options.island" :disabled="busy"><option value="all">{{ translateUi("全部") }}</option><template v-if="islands.length > 1"><option v-for="island in islands" :key="island.id" :value="island.id">{{ gameText(island.name) }}</option></template></select></div>
        <div class="field"><label for="baby-sleep-type">{{ translateUi("睡眠类型") }}</label><select id="baby-sleep-type" v-model="options.sleepType" :disabled="busy"><option value="all">{{ translateUi("全部 · 自动择优") }}</option><option v-for="type in sleepTypes" :key="type" :value="type">{{ gameText(type) }}</option></select></div>
      </div>
      <label class="row"><input v-model="options.campTicket" :disabled="busy" type="checkbox" role="switch"> {{ translateUi("露营券 +1（只加第一觉）") }}</label>
      <label class="row"><input v-model="options.splitSleep" :disabled="busy" type="checkbox" role="switch"> {{ translateUi("拆分睡眠") }}</label>
      <p class="muted">{{ options.splitSleep ? translateUi("计算两觉的最佳分数比例；选择具体睡眠类型时，两觉都使用该类型。") : translateUi("只计算一觉 100 分。") }}</p>
      <p class="muted">{{ translateUi("捕捉统计") }} {{ targetName }} {{ translateUi("的全部星级睡姿。糖果统计") }} {{ family }} {{ translateUi("的睡眠研究奖励。") }}</p>
      <div class="field"><label for="baby-event">{{ translateUi("活动睡意之力倍率") }}</label>
        <select id="baby-event" v-model.number="eventMult"><option v-if="!EVENT_BONUSES.some(b => b.mult === eventMult)" :value="eventMult">{{ eventMult }}{{ translateUi("倍（活动）") }}</option><option v-for="bonus in EVENT_BONUSES" :key="bonus.mult" :value="bonus.mult">{{ translateUi(bonus.label) }}</option></select>
      </div>
      <label class="row"><input :disabled="busy" v-model="otherTypes" type="checkbox" role="switch"> {{ translateUi("活动期间遇到一些其他类型宝可梦") }}</label>
      <p v-if="!otherTypes && options.sleepType === 'all'" class="muted">{{ translateUi("活动关闭时，只比较目标宝可梦自身的睡眠类型和没有特征；其他睡眠类型不参与方案搜索。") }}</p>
      <div class="efficiency-fields">
        <div class="field"><label for="baby-iterations">{{ translateUi("计算次数") }}</label><input id="baby-iterations" v-model.number="options.iterations" type="number" :min="INPUT_LIMITS.baby_iterations.min" :max="INPUT_LIMITS.baby_iterations.max" :step="INPUT_LIMITS.baby_iterations.step" inputmode="numeric"></div>
        <div class="field"><label for="baby-precision">{{ translateUi("计算精度") }}</label><select id="baby-precision" v-model="options.precision"><option value="low">{{ translateUi("低 · 快速搜索") }}</option><option value="medium">{{ translateUi("中 · 细化搜索") }}</option><option value="high">{{ translateUi("高 · 密集搜索") }}</option></select></div>
      </div>
      <p class="muted">{{ translateUi("计算次数用于每个候选抽取状态的模拟；精度控制能量候选点和拆分比例的搜索细度。每一觉最多搜索50亿睡意之力。高精度耗时较长，可随时取消。") }}</p>
      <button class="btn sage" type="button" :disabled="busy" @click="calculate">{{ translateUi("计算宝宝效率") }}</button>
    </article>
    <p v-if="error" class="amber" role="alert">{{ translateUi(error) }}</p>
    <p v-if="notice" class="muted" role="status">{{ translateUi(notice) }}</p>
    <template v-if="result">
      <p v-if="dirty" class="amber">{{ translateUi("参数已修改，请重新计算更新结果。") }}</p>
      <p class="muted">{{ gameText(resultName) }} · {{ result.options.iterations.toLocaleString('zh-CN') }} {{ translateUi("次模拟 · 睡意之力 ×") }}{{ result.options.eventMult }} {{ translateUi("· 露营券：") }}{{ result.options.campTicket ? translateUi("开启") : translateUi("关闭") }} {{ translateUi("· 跨类型：") }}{{ translateUi(eventMixLabel(result.options.eventMix)) }} · {{ result.options.island === 'all' ? translateUi("全部岛屿") : gameText(ISLANDS.find((island) => island.id === result?.options.island)?.name) }} · {{ result.options.splitSleep ? translateUi("拆觉") : translateUi("整觉") }} · {{ result.options.sleepType === 'all' ? translateUi("睡眠类型自动择优") : gameText(result.options.sleepType) }}{{ translateUi("。预期收益计入已开启的露营券额外研究；第11只起家族糖果按每只1颗结算，捕捉数量不减少；列出本次搜索中收益最高的方案。") }}</p>
      <BabyEfficiencyResult :key="`${JSON.stringify(result.options)}-catch`" :title="translateUi('捕捉只数最多')" unit="只" :optimum="result.catch" :precision="result.options.precision" />
      <BabyEfficiencyResult :key="`${JSON.stringify(result.options)}-candy`" :title="translateUi('家族糖果最多')" unit="颗" :optimum="result.candy" :precision="result.options.precision" />
    </template>
    <ProgressDialog :open="busy" :title="translateUi('正在计算宝宝效率')" :progress="percent" :stage="progress.island || '准备候选方案'" :notice="notice"
      :detail="translateUi('已模拟 {count} 个抽取状态', { count: progress.evaluatedStates.toLocaleString('zh-CN') })" cancellable cancel-text="取消计算" @cancel="cancel" />
  </div>
</template>

<style scoped>
.efficiency-fields { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 14px; }
@media (max-width: 400px) { .efficiency-fields { grid-template-columns: 1fr; } }
</style>

