<script setup lang="ts">
import clientDefaults from '../../data/client-defaults.resource'

import { useActivities } from '../../composables/useActivities'
import { activitySleepStyles } from '../../calc/activities'
import { computed, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { usePlanStore } from '../../stores/plans'
import { useSettingsStore } from '../../stores/settings'
import { BABY_POKEMON_IDS, BABY_POKEMON_NAMES, babyEfficiencyIslands, EFFICIENCY_SLEEP_TYPES } from '../../calc/babyEfficiency'
import { ISLANDS, SLEEP_STYLES } from '../../calc/data'
import { EVENT_BONUSES, styleKey } from '../../calc/sleep'
import { eventMixLabel, normalizeEventMix } from '../../calc/sleepRules'
import { newSplitTarget, splitTargetKey, splitTargetStatus, type SplitOptions, type SplitTarget } from '../../calc/splitSleep'
import { useSplitSleep } from '../../composables/useSplitSleep'
import PokePicker from '../shared/PokePicker.vue'
import ProgressDialog from '../shared/ProgressDialog.vue'
import SplitRecommendation from './SplitRecommendation.vue'
const components_plan_SplitSleepPane_config_clientDefaults = clientDefaults.modules.components_plan_SplitSleepPane


const { plan } = storeToRefs(usePlanStore())
const settingsStore = useSettingsStore()
const { settings } = storeToRefs(settingsStore)
const config = computed(() => plan.value.splitSleep)
const island = computed({ get: () => settings.value.island, set: value => settingsStore.applyIsland(value) })
const activity = useActivities(config, () => island.value, () => settings.value.activity)
const eventMult = activity.field('drowsyPowerMultiplier', () => config.value.eventMult)
const mixMode = activity.field('eventMix', () => normalizeEventMix(config.value.eventMix) !== 'off' ? settings.value.sleepEventMix : 'off')
const otherTypes = computed({ get: () => mixMode.value !== 'off', set: value => { mixMode.value = value ? settings.value.sleepEventMix : 'off' } })
const options = computed<SplitOptions>(() => ({ ...config.value, island: island.value, strength: plan.value.snorlaxStrength, activity: activity.context.value, eventMult: eventMult.value, eventMix: mixMode.value }))
const statuses = computed(() => options.value.targets.map(target => splitTargetStatus(target, island.value, options.value.strength, activity.context.value)))
const kind = ref<SplitTarget['kind']>((components_plan_SplitSleepPane_config_clientDefaults["kindInitial"] as unknown as SplitTarget['kind'])), pokeId = ref(components_plan_SplitSleepPane_config_clientDefaults["pokeIdInitial"]), face = ref(components_plan_SplitSleepPane_config_clientDefaults["faceInitial"]), advanced = ref(components_plan_SplitSleepPane_config_clientDefaults["advancedInitial"]), formError = ref(components_plan_SplitSleepPane_config_clientDefaults["formErrorInitial"])
const currentStyles = computed(() => activitySleepStyles(SLEEP_STYLES, activity.context.value))
const allowedIds = computed(() => kind.value === 'baby' ? BABY_POKEMON_IDS.filter(id => babyEfficiencyIslands(id, undefined, activity.context.value).some(row => row.id === island.value)) : [...new Set(currentStyles.value.filter(row => row.island === island.value).map(row => row.pokeId))])
const faces = computed(() => currentStyles.value.filter(row => row.island === island.value && row.pokeId === pokeId.value))
watch(allowedIds, ids => { if (!ids.includes(pokeId.value)) pokeId.value = ids[0] ?? 0 }, { immediate: true })
watch(faces, rows => { if (!rows.some(row => styleKey(row.pokeId, row.stars, row.styleId) === face.value)) { const first = rows[0]; face.value = first ? styleKey(first.pokeId, first.stars, first.styleId) : '' } }, { immediate: true })
const { busy, error, notice, progress, result, dirty, calculate, cancel } = useSplitSleep(options)
const percent = computed(() => progress.value.total ? Math.min(100, Math.floor(progress.value.completed / progress.value.total * 100)) : 0)
function addTarget() {
  const target = newSplitTarget(kind.value, pokeId.value, kind.value === 'style' ? face.value : '')
  if (!pokeId.value || (kind.value === 'style' && !face.value)) { formError.value = '请选择可参与普通研究的目标'; return }
  if (config.value.targets.some(row => splitTargetKey(row) === splitTargetKey(target))) { formError.value = '该目标已添加'; return }
  config.value.targets.push(target); formError.value = ''
}
function run() { formError.value = ''; void calculate() }
const resultGroups = computed(() => (['count', 'candy', 'probability'] as const).map(metricKind => ({
  kind: metricKind,
  title: metricKind === 'count' ? '宝宝遇到只数最大' : metricKind === 'candy' ? '糖果最多' : '睡姿概率最大',
  metrics: result.value?.metrics.flatMap((metric, index) => metric.kind === metricKind ? [{ ...metric, index }] : []) ?? [],
})).filter(group => group.metrics.length))
const resultNotices = computed(() => result.value?.options.targets.map(target => splitTargetStatus(target, result.value!.options.island, result.value!.options.strength)).filter(status => status.reason) ?? [])
const zeroMetrics = computed(() => result.value?.metrics.filter((_, index) => result.value!.maxima[index] === 0) ?? [])
const resultIsland = computed(() => ISLANDS.find(row => row.id === result.value?.options.island)?.name ?? '')
</script>

<template>
  <div class="stack" :aria-busy="busy">
    <button class="btn ghost" type="button" :disabled="busy" @click="activity.reset()">恢复本面板自动活动设置</button>
    <p class="muted">固定岛屿与能量，比较两觉合计 100 分和整觉 100 分，寻找多目标的综合方案与各目标最优方案。</p>
    <article class="card stack">
      <div class="split-fields">
        <div class="field"><label for="split-island">岛屿</label><select id="split-island" v-model="island" :disabled="busy"><option v-for="row in ISLANDS" :key="row.id" :value="row.id">{{ row.name }}</option></select></div>
        <div class="field"><label for="split-strength">卡比兽能量</label><input id="split-strength" v-model.number="plan.snorlaxStrength" type="number" min="0" step="1" inputmode="numeric" :disabled="busy"></div>
      </div>
      <label class="row"><input v-model="config.campTicket" :disabled="busy" type="checkbox" role="switch"> 露营券 +1（只加第一觉）</label>
      <h3>目标</h3>
      <p v-if="!config.targets.length" class="muted">添加宝宝或指定睡姿，支持混选多个目标。</p>
      <div v-for="(target, index) in config.targets" :key="splitTargetKey(target)" class="target-row">
        <div class="target-info"><strong>{{ statuses[index]?.label }}</strong><span class="muted">{{ target.kind === 'baby' ? '宝宝 · 全部星级 · 同家族糖果' : '指定睡姿 · 每日至少一次概率' }}</span><span v-if="statuses[index]?.reason" class="amber">{{ statuses[index]?.reason }}</span></div>
        <button class="btn ghost" type="button" :disabled="busy" :aria-label="`移除目标 ${statuses[index]?.label}`" @click="config.targets.splice(index, 1)">移除</button>
      </div>
      <div v-if="!busy" class="stack add-target">
        <div class="field"><label for="split-target-kind">添加目标类型</label><select id="split-target-kind" v-model="kind"><option value="baby">宝宝</option><option value="style">指定睡姿</option></select></div>
        <div v-if="allowedIds.length" class="field"><label>选择宝可梦</label><PokePicker v-model="pokeId" :allowed-ids="allowedIds" :name-overrides="kind === 'baby' ? BABY_POKEMON_NAMES : undefined" /></div>
        <div v-if="kind === 'style'" class="field"><label for="split-face">指定睡姿</label><select id="split-face" v-model="face"><option v-for="row in faces" :key="styleKey(row.pokeId, row.stars, row.styleId)" :value="styleKey(row.pokeId, row.stars, row.styleId)">{{ row.stars }}★ · {{ row.styleName }}</option></select></div>
        <button class="btn ghost" type="button" :disabled="!allowedIds.length" @click="addTarget">添加目标</button>
      </div>
      <button class="btn ghost" type="button" :aria-expanded="advanced" @click="advanced = !advanced">{{ advanced ? '收起高级设置' : '高级设置 · 类型、活动与权重' }}</button>
      <div v-if="advanced" class="stack advanced">
        <div class="split-fields">
          <div class="field"><label for="split-type">睡眠类型</label><select id="split-type" v-model="config.sleepType" :disabled="busy"><option value="all">每觉自动择优</option><option v-for="type in EFFICIENCY_SLEEP_TYPES" :key="type" :value="type">{{ type }}</option></select></div>
          <div class="field"><label for="split-event">活动睡意之力倍率</label><select id="split-event" v-model.number="eventMult" :disabled="busy"><option v-if="!EVENT_BONUSES.some(b => b.mult === eventMult)" :value="eventMult">{{ eventMult }}倍（活动）</option><option v-for="bonus in EVENT_BONUSES" :key="bonus.mult" :value="bonus.mult">{{ bonus.label }}</option></select></div>
        </div>
        <label class="row"><input v-model="otherTypes" type="checkbox" role="switch" :disabled="busy">活动期间遇到其他睡眠类型宝可梦</label>
        <div class="field"><label for="split-iterations">每个研究状态的模拟次数</label><input id="split-iterations" v-model.number="config.iterations" type="number" min="100" max="100000" step="100" :disabled="busy"></div>
        <p class="muted">按各指标相对单独最优值的达成率加权，默认权重都为 1。权重 0 只退出综合评分，仍计算单目标最优。宝宝糖果统计同家族普通研究收益。</p>
        <div v-for="(target, index) in config.targets" :key="splitTargetKey(target)" class="stack weight-row">
          <strong>{{ statuses[index]?.label }}</strong>
          <div v-if="target.kind === 'baby'" class="split-fields">
            <div class="field"><label :for="`split-count-${index}`">只数权重</label><input :id="`split-count-${index}`" v-model.number="target.countWeight" type="number" min="0" step="0.1" :disabled="busy"></div>
            <div class="field"><label :for="`split-candy-${index}`">糖果权重</label><input :id="`split-candy-${index}`" v-model.number="target.candyWeight" type="number" min="0" step="0.1" :disabled="busy"></div>
          </div>
          <template v-else>
            <div class="field"><label :for="`split-probability-${index}`">睡姿概率权重</label><input :id="`split-probability-${index}`" v-model.number="target.probabilityWeight" type="number" min="0" step="0.1" :disabled="busy"></div>
            <p v-if="!statuses[index]?.unlocked" class="amber">{{ statuses[index]?.reason }}。设置值保留，解锁后恢复生效。</p>
          </template>
        </div>
      </div>
      <p v-if="formError" class="amber" role="alert">{{ formError }}</p>
      <button class="btn sage" type="button" :disabled="busy || !config.targets.length" @click="run">计算最佳方案</button>
    </article>
    <p v-if="error" class="amber" role="alert">{{ error }}</p>
    <p v-if="notice" class="muted" role="status">{{ notice }}</p>
    <template v-if="result">
      <p v-if="dirty" class="amber">参数已修改，以下为上次计算结果，请重新计算。</p>
      <p class="muted">{{ resultIsland }} · 能量 {{ result.options.strength.toLocaleString('zh-CN') }} · {{ result.options.iterations.toLocaleString('zh-CN') }} 次模拟／状态 · 倍率 ×{{ result.options.eventMult }} · 露营券：{{ result.options.campTicket ? '开启' : '关闭' }} · 跨类型：{{ eventMixLabel(result.options.eventMix) }}。结果为本次候选搜索的模拟估计。</p>
      <p v-for="status in resultNotices" :key="status.label" class="amber">{{ status.label }}：{{ status.reason }}</p>
      <p v-for="metric in zeroMetrics" :key="`zero-${metric.targetIndex}-${metric.kind}`" class="muted">{{ metric.label }}：未解锁或本次模拟收益为 0，不参与综合评分。</p>
      <SplitRecommendation :key="`${JSON.stringify(result.options)}-combined`" title="综合推荐" :result="result" :optimum="result.combined" />
      <SplitRecommendation :key="`${JSON.stringify(result.options)}-whole`" title="整觉对照 · 综合最优" :result="result" :optimum="result.whole" />
      <section v-for="group in resultGroups" :key="group.kind" class="stack">
        <h3>{{ group.title }}</h3>
        <template v-for="metric in group.metrics" :key="`${JSON.stringify(result.options)}-${metric.index}`">
          <SplitRecommendation v-if="metric.kind !== 'probability' || splitTargetStatus(result.options.targets[metric.targetIndex]!, result.options.island, result.options.strength).unlocked" :title="metric.label" :result="result" :metric-index="metric.index" :optimum="result.individual[metric.index]!" />
        </template>
      </section>
    </template>
    <ProgressDialog :open="busy" title="正在计算目标拆觉" :progress="percent" stage="比较分数、睡眠类型与目标收益" :detail="`已完成 ${progress.completed} / ${progress.total} 个研究状态`" :notice="notice" cancellable cancel-text="取消计算" @cancel="cancel" />
  </div>
</template>

<style scoped>
.split-fields { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 14px; }
.target-row { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 12px 0; border-bottom: 1px solid var(--line); }
.target-info { display: flex; flex-direction: column; gap: 4px; min-width: 0; overflow-wrap: anywhere; }
.target-info span { font-size: var(--font-13); }
.add-target, .advanced, .weight-row { border-top: 1px solid var(--line); padding-top: 14px; }
@media (max-width: 400px) { .split-fields { grid-template-columns: 1fr; } }
</style>
