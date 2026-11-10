<script setup lang="ts">
import { gameText, t as translateUi } from '../../ui/i18n'


import { INPUT_RANGES } from '../../calc/inputRanges'
const INPUT_LIMITS = INPUT_RANGES.SleepPane

import clientDefaults from '../../data/client-defaults.resource'

import { useActivities } from '../../composables/useActivities'
import { activityHasPokemonUp } from '../../calc/activities'
import ProgressDialog from '../shared/ProgressDialog.vue'
import { computed, shallowRef, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { ISLANDS } from '../../calc/data'
import { drowsyPower, energyLost, EVENT_BONUSES, expectSpecies, maxEncounters, RANK_ORDER, rankFromStrength, rankStrength, rankToNext, resolvedSleepdex, prefersUndiscovered, sleepShinyRate, sleepClock, strengthToNext } from '../../calc/sleep'
import PokeSprite from '../shared/PokeSprite.vue'
import ShinyMark from '../shared/ShinyMark.vue'
import { usePlanStore } from '../../stores/plans'
import { useSettingsStore } from '../../stores/settings'
import type { SleepType } from '../../types'
import { useSleepSimulation } from '../../composables/useSleepSimulation'
import { candyExpectation } from '../../calc/sleepCandy'
import { teamResearchBonuses } from '../../calc/sleepRewards'
import { useRosterStore } from '../../stores/roster'
import { useBoxStore } from '../../stores/box'
const components_plan_SleepPane_config_clientDefaults = clientDefaults.modules.components_plan_SleepPane


const settingsStore = useSettingsStore()
const planStore = usePlanStore()
const roster = useRosterStore()
const box = useBoxStore()
const researchBonuses = computed(() => teamResearchBonuses(roster.slots.flatMap(uid => {
  const member = roster.customs.find(item => item.uid === uid) ?? box.pokemon.find(item => item.uid === uid)
  return member ? [member] : []
})))
const focusIncense = shallowRef(components_plan_SleepPane_config_clientDefaults["focusIncenseInitial"])
const luckIncense = shallowRef(components_plan_SleepPane_config_clientDefaults["luckIncenseInitial"])
const incenseSession = shallowRef<0 | 1>((components_plan_SleepPane_config_clientDefaults["incenseSessionInitial"] as unknown as 0 | 1))
const { settings } = storeToRefs(settingsStore)
const { plan } = storeToRefs(planStore)

const island = computed({
  get: () => settings.value.island,
  set: (value) => settingsStore.applyIsland(value),
})

const activity = useActivities(settings, () => island.value)
const researchSession = shallowRef<0 | 1>(0)
const eventMult = activity.field('drowsyPowerMultiplier', () => settings.value.eventMult)
const shinyUp = computed(() => plan.value.shinyUp || settings.value.shinyUp)
const shinyRate = computed(() => sleepShinyRate(activity.context.value, shinyUp.value, island.value, undefined, researchSession.value))
const undiscoveredBoost = computed({
  get: () => prefersUndiscovered(activity.context.value, plan.value.undiscoveredPreference),
  set: (value: boolean) => { plan.value.undiscoveredPreference = value },
})
const rank = computed(() => rankFromStrength(island.value, plan.value.snorlaxStrength))
const nextRank = computed(() => rankToNext(island.value, plan.value.snorlaxStrength))
const pickedRank = computed({
  get: () => rank.value,
  set: (value) => { plan.value.snorlaxStrength = rankStrength(island.value, value) },
})
// The overview recommends a full day's 100 points; simulation keeps the selected score.
const overviewScore = 100
const dp = computed(() => drowsyPower(overviewScore, plan.value.snorlaxStrength, eventMult.value))
const overview = computed(() => maxEncounters(island.value, overviewScore, plan.value.snorlaxStrength, eventMult.value))
const overviewSplitHelps = computed(() => overview.value.best.total > overview.value.single)

const result = computed(() => maxEncounters(
  island.value,
  plan.value.sleepScore,
  plan.value.snorlaxStrength,
  eventMult.value,
))
const splitHelps = computed(() => result.value.best.total > result.value.single)
/** null 表示跟随推荐：拆分能多抓时拆分。改岛屿、能量或加成后回到推荐。 */
const manualWhole = shallowRef<boolean | null>((components_plan_SleepPane_config_clientDefaults["manualWholeInitial"] as unknown as boolean | null))
const whole = computed(() => researchSession.value === 1 || (manualWhole.value ?? !splitHelps.value))
const overviewWhole = computed(() => researchSession.value === 1 || (manualWhole.value ?? !overviewSplitHelps.value))
const caught = computed(() => overviewWhole.value ? overview.value.single : overview.value.best.total)
const shown = computed(() => caught.value + (plan.value.campTicket && researchSession.value === 0 ? 1 : 0))
const nextCatch = computed(() => strengthToNext(
  island.value,
  overviewScore,
  plan.value.snorlaxStrength,
  eventMult.value,
))
const sameMult = (mult: number) => Math.abs(eventMult.value - mult) < 0.001

const BATCH = (components_plan_SleepPane_config_clientDefaults["BATCH"] as 4000)
const mixMode = activity.field('eventMix', () => 'off')
const otherTypes = computed({ get: () => mixMode.value !== 'off', set: (value: boolean) => { mixMode.value = value ? settings.value.sleepEventMix : 'off' } })
const researchedBefore = shallowRef(components_plan_SleepPane_config_clientDefaults["researchedBeforeInitial"])
const specialEncountered = shallowRef(components_plan_SleepPane_config_clientDefaults["specialEncounteredInitial"])
const specialEncounterDefault = computed(() => activityHasPokemonUp(activity.context.value, island.value))
// A stable key preserves manual changes across clock ticks within the same day.
watch(() => `${activity.context.value.startDate}|${island.value}|${specialEncounterDefault.value}`, () => {
  specialEncountered.value = specialEncounterDefault.value
}, { immediate: true, flush: 'sync' })
const firstResearchExtras = shallowRef(components_plan_SleepPane_config_clientDefaults["firstResearchExtrasInitial"])
const eventMix = mixMode
const resultTab = shallowRef<'encounters' | 'candies'>((components_plan_SleepPane_config_clientDefaults["resultTabInitial"] as unknown as 'encounters' | 'candies'))
const { busy, error: simulationError, notice, progress, result: seen, calculate: startSimulation, cancel, reset } = useSleepSimulation()
watch(() => [researchBonuses.value, focusIncense.value, luckIncense.value, incenseSession.value], () => reset(), { deep: true, flush: 'sync' })
const percent = computed(() => progress.value.total ? Math.floor(progress.value.completed / progress.value.total * 100) : 0)
let drawSeed = components_plan_SleepPane_config_clientDefaults["drawSeed"]

watch(() => [island.value, plan.value.snorlaxStrength, eventMult.value], () => {
  manualWhole.value = null
})
watch(() => [island.value, plan.value.sleepScore, plan.value.snorlaxStrength, eventMult.value, whole.value, plan.value.sleepType, undiscoveredBoost.value, plan.value.rare, plan.value.shinyUp, shinyUp.value, activity.context.value, eventMix.value, plan.value.sleepdexMode, plan.value.sleepdex, plan.value.sleepdexExcluded, researchedBefore.value, researchSession.value, specialEncountered.value, firstResearchExtras.value, plan.value.campTicket], () => {
  reset()
}, { deep: true, flush: 'sync' })

function calculate() {
  if (busy.value) return
  drawSeed += 1
  const opts = {
    campTicket: plan.value.campTicket,
    ...researchBonuses.value,
    focusIncense: focusIncense.value,
    luckIncense: luckIncense.value,
    incenseSession: whole.value ? 0 as const : incenseSession.value,
    researchedBefore: Math.max(0, Math.floor(researchedBefore.value)),
    researchSession: researchSession.value,
    researchLimit: specialEncountered.value ? 11 as const : 10 as const,
    firstResearchExtras: Math.max(0, Math.floor(firstResearchExtras.value)) + Number(plan.value.campTicket) + Number(specialEncountered.value),
    rank: rank.value,
    discovered: resolvedSleepdex(plan.value),
    undiscoveredBoost: undiscoveredBoost.value,
    rare: plan.value.rare,
    shinyUp: shinyUp.value,
    activity: activity.context.value,
    eventMix: eventMix.value,
    eventMult: eventMult.value,
  }
  const scores = whole.value ? [plan.value.sleepScore] : [result.value.best.a, result.value.best.b]
  resultTab.value = 'encounters'
  void startSimulation({ island: island.value, sleepType: plan.value.sleepType as SleepType,
    powers: scores.map((score) => drowsyPower(score, plan.value.snorlaxStrength, eventMult.value)),
    iterations: BATCH, seed: drawSeed, options: opts })
}

const seenShiny = computed(() => seen.value.reduce((sum, row) => sum + row.shiny, 0))
const board = computed(() => {
  const total = seen.value.reduce((sum, row) => sum + row.count, 0)
  const rows = [false, true].flatMap(shiny => expectSpecies(seen.value.map(row => ({
    ...row, count: shiny ? row.shiny : row.count - row.shiny,
  }))).filter(row => row.count > 0).map(row => ({ ...row, shiny, percent: row.count / total * 100 })))
  return rows.sort((a, b) => b.count - a.count || a.pokeId - b.pokeId)
})
const candies = computed(() => candyExpectation(seen.value, BATCH))
const seenTotal = computed(() => seen.value.reduce((sum, row) => sum + row.count, 0))
const rewards = computed(() => seen.value.reduce((sum, row) => ({
  researchExp: sum.researchExp + row.researchExp,
  shards: sum.shards + row.shards,
}), { researchExp: 0, shards: 0 }))
const perSleep = computed(() => ({
  researchExp: rewards.value.researchExp / BATCH,
  shards: rewards.value.shards / BATCH,
}))
const average = (n: number) => n.toLocaleString('zh-CN', { maximumFractionDigits: 1 })
</script>

<template>
  <div class="stack" :aria-busy="busy">
    <p class="muted">{{ translateUi("特殊加成") }}</p>
    <div class="lv-row">
      <button
        v-for="bonus in EVENT_BONUSES"
        :key="bonus.mult"
        type="button"
        :disabled="busy"
        :class="{ on: sameMult(bonus.mult) }"
        @click="eventMult = bonus.mult"
      >{{ translateUi(bonus.label) }}</button>
    </div>
    <article class="card stack">
      <p class="sleep-brief">
        <button type="button" :disabled="busy" :class="{ on: overviewWhole }" @click="manualWhole = !overviewWhole">{{ overviewWhole ? translateUi("不拆分") : translateUi("拆分") }}</button>
        <span>
          {{ translateUi("每日满睡眠") }}{{ sleepClock(overviewScore) }}{{ translateUi("，可捕捉") }}{{ shown }}{{ translateUi("只，") }}
          {{ overviewScore }}{{ translateUi("分，获得") }}{{ Math.round(dp).toLocaleString('zh-CN') }}{{ translateUi("睡意之力，掉") }}{{ energyLost(overviewScore) }}{{ translateUi("点活力") }}
        </span>
      </p>
      <p v-if="!overviewWhole && overviewSplitHelps" class="muted">
        {{ translateUi("第一觉") }} {{ sleepClock(overview.best.a) }}（{{ overview.best.a }} {{ translateUi("分）") }}{{ overview.best.first }} {{ translateUi("只， 第二觉") }} {{ sleepClock(overview.best.b) }}（{{ overview.best.b }} {{ translateUi("分）") }}{{ overview.best.second }} {{ translateUi("只") }}
      </p>
      <p v-else-if="!overviewWhole" class="muted">{{ translateUi("这个岛屿每日 100 分下拆分不会多抓，按一觉睡满计算。") }}</p>
      <p v-else-if="overviewSplitHelps" class="muted">{{ translateUi("拆成两觉可以多抓") }} {{ overview.best.total - overview.single }} {{ translateUi("只，点「不拆分」切换为拆分查看拆法。") }}</p>
      <p class="muted">{{ translateUi("顶部按每日 100 分推荐；下方模拟使用所选睡眠分数。") }}</p>
      <p v-if="nextCatch">{{ translateUi("距离抓") }}{{ nextCatch.count }}{{ translateUi("只还需") }} {{ nextCatch.need.toLocaleString('zh-CN') }} {{ translateUi("能量") }}</p>
      <p v-else class="muted">{{ translateUi("这个睡意之力已经到 8 只。") }}</p>
    </article>
    <div class="field">
      <label>{{ translateUi("岛屿") }}</label>
      <select :disabled="busy" v-model="island">
        <option v-for="i in ISLANDS" :key="i.id" :value="i.id">{{ gameText(i.name) }}</option>
      </select>
    </div>
    <div class="field" data-swipe-ignore @touchstart.stop @touchend.stop @touchcancel.stop>
      <label>{{ translateUi("睡眠分数") }} {{ plan.sleepScore }} · {{ sleepClock(plan.sleepScore) }}</label>
      <input :disabled="busy" v-model.number="plan.sleepScore" type="range" :min="INPUT_LIMITS.plan_sleepScore.min" :max="INPUT_LIMITS.plan_sleepScore.max">
    </div>
    <div class="field">
      <label>{{ translateUi("评级（选择后填入该岛这一档的最低能量）") }}</label>
      <select :disabled="busy" v-model="pickedRank">
        <option v-for="r in RANK_ORDER" :key="r" :value="r">{{ r }} · {{ rankStrength(island, r).toLocaleString('zh-CN') }}</option>
      </select>
    </div>
    <div class="field">
      <label>{{ translateUi("入睡卡比兽能量") }}</label>
      <input :disabled="busy" v-model.number="plan.snorlaxStrength" type="number" :min="INPUT_LIMITS.plan_snorlaxStrength.min">
    </div>
    <div class="field"><label>{{ translateUi("本日研究次数") }}</label><select :disabled="busy" v-model.number="researchSession"><option :value="0">{{ translateUi("第一次（拆觉时包括第二次）") }}</option><option :value="1">{{ translateUi("仅第二次") }}</option></select></div>
    <div class="field"><label>{{ translateUi("本日此前已研究只数") }}</label><input :disabled="busy" v-model.number="researchedBefore" type="number" :min="INPUT_LIMITS.researchedBefore.min" :max="INPUT_LIMITS.researchedBefore.max"></div>
    <label class="row"><input :disabled="busy" v-model="specialEncountered" type="checkbox">{{ translateUi("本日实际遇到特殊UP宝可梦") }}</label>
    <div v-if="!whole" class="field"><label>{{ translateUi("第一觉薰香额外遭遇只数（不含露营券、特殊UP）") }}</label><input :disabled="busy" v-model.number="firstResearchExtras" type="number" :min="INPUT_LIMITS.firstResearchExtras.min" :max="INPUT_LIMITS.firstResearchExtras.max"></div>
    <p class="muted">{{ translateUi("每日第11只起糖果为1，研究EXP与梦之碎片减半；实际遇到特殊UP时从第12只起减额。按抽选顺序结算，不减少捕捉数量。额外遭遇只计入累计只数，不模拟其奖励。") }}</p>
    <div class="field">
      <label>{{ translateUi("睡眠类型") }}</label>
      <select :disabled="busy" v-model="plan.sleepType">
        <option value="淺淺入夢">{{ translateUi("浅浅入梦") }}</option>
        <option value="安然入睡">{{ translateUi("安然入睡") }}</option>
        <option value="深深入眠">{{ translateUi("深深入眠") }}</option>
        <option value="没有特征">{{ translateUi("没有特征") }}</option>
      </select>
    </div>
    <label class="row"><input :disabled="busy" v-model="plan.campTicket" type="checkbox"> {{ translateUi("露营券 +1（只加第一觉）") }}</label>
    <label class="row"><input :disabled="busy" v-model="focusIncense" type="checkbox"> {{ translateUi("专注薰香（研究 EXP ×2）") }}</label>
    <label class="row"><input :disabled="busy" v-model="luckIncense" type="checkbox"> {{ translateUi("幸运薰香（研究梦碎 ×2）") }}</label>
    <label v-if="!whole && (focusIncense || luckIncense)" class="field">
      <span>{{ translateUi("薰香使用时段") }}</span>
      <select v-model.number="incenseSession" :disabled="busy"><option :value="0">{{ translateUi("第一觉") }}</option><option :value="1">{{ translateUi("第二觉") }}</option></select>
    </label>
    <label class="row"><input :disabled="busy" v-model="otherTypes" type="checkbox"> {{ translateUi("活动期间遇到一些其他类型宝可梦") }}</label>
    <label class="row"><input :disabled="busy" v-model="undiscoveredBoost" type="checkbox"> {{ translateUi("优先遇到未发现睡姿") }}</label>
    <p class="muted">
      {{ ISLANDS.find((i) => i.id === island)?.name }}{{ translateUi("评级") }} {{ rank }}<template v-if="nextRank">{{ translateUi("，再") }} {{ nextRank.need.toLocaleString('zh-CN') }} {{ translateUi("能量升到") }} {{ nextRank.rank }}</template>{{ translateUi("。 露营券加 1 只。分数按满睡眠 8 小时 30 分 = 100 分换算。") }}
    </p>
    <button v-if="plan.undiscoveredPreference !== undefined" class="btn ghost" type="button" :disabled="busy" @click="plan.undiscoveredPreference = undefined">{{ translateUi('未发现睡姿优先跟随活动') }}</button>
    <article class="expect-board">
      <div class="row">
        <button class="btn sage" type="button" :disabled="busy" @click="calculate">{{ busy ? translateUi("正在模拟…") : translateUi("计算 4000 次") }}</button>
      </div>
      <p class="muted">{{ translateUi('每只独立抽选闪光 · 全体适用模拟概率') }} {{ (shinyRate * 100).toFixed(2) }}%<template v-if="seenTotal"> · {{ translateUi('抽到闪光') }} {{ seenShiny.toLocaleString('zh-CN') }} {{ translateUi('只') }}</template></p>
      <p v-if="simulationError" class="amber" role="alert">{{ simulationError }}</p>
      <p v-if="notice" class="muted" role="status">{{ translateUi(notice) }}</p>
      <p v-if="seenTotal" class="muted">{{ translateUi("本次模拟") }} {{ BATCH.toLocaleString('zh-CN') }} {{ translateUi("次") }}{{ whole ? translateUi("整觉") : translateUi("拆分方案") }}{{ translateUi("，共遇到") }} {{ seenTotal.toLocaleString('zh-CN') }} {{ translateUi("只。预期只数 = 这只遇到的数量 / 全部遇到的数量。再点一次会重新算，不会累加。") }}</p>
      <p v-else-if="!busy" class="muted">{{ translateUi("点一次单独模拟 4000 次当前方案。再点会换一批结果，不会和上一次加在一起。") }}</p>
      <div v-if="seenTotal" class="sleep-reward-summary">
        <p><span>{{ translateUi("每次方案平均研究 EXP") }}</span><strong>{{ average(perSleep.researchExp) }}</strong></p>
        <p><span>{{ translateUi("每次方案平均梦之碎片") }}</span><strong>{{ average(perSleep.shards) }}</strong></p>
      </div>
      <div v-if="seenTotal" class="seg" role="tablist" :aria-label="translateUi('模拟结果')">
        <button type="button" role="tab" :aria-selected="resultTab === 'encounters'" :class="{ on: resultTab === 'encounters' }" @click="resultTab = 'encounters'">{{ translateUi("遭遇") }}</button>
        <button type="button" role="tab" :aria-selected="resultTab === 'candies'" :class="{ on: resultTab === 'candies' }" @click="resultTab = 'candies'">{{ translateUi("糖果") }}</button>
      </div>
      <div v-if="resultTab === 'candies' && candies.length" class="sleep-candy-summary">
        <p class="muted">{{ translateUi("每次方案平均糖果（同一进化链合并）") }}</p>
        <div v-for="candy in candies" :key="candy.pokeId" class="sleep-candy-line">
          <PokeSprite :id="candy.pokeId" :name="candy.name" />
          <span>{{ gameText(candy.name) }}</span><strong>{{ average(candy.average) }}</strong>
        </div>
      </div>
      <p v-if="seenTotal && plan.campTicket && researchSession === 0" class="muted">{{ translateUi("已计入露营券额外抽选及奖励。") }}</p>
      <div v-if="resultTab === 'encounters' && board.length" class="expect-list">
        <div v-for="item in board" :key="`${item.pokeId}-${item.shiny}`" class="expect-line">
          <PokeSprite :id="item.pokeId" :name="item.name" :shiny="item.shiny" />
          <strong>{{ gameText(item.name) }}<ShinyMark v-if="item.shiny" /></strong>
          <span class="muted">{{ translateUi("遇到") }} {{ item.count.toLocaleString('zh-CN') }}</span>
          <b>{{ item.percent.toFixed(2) }}%</b>
        </div>
      </div>
    </article>
    <ProgressDialog :open="busy" :title="translateUi('正在模拟睡姿')" :progress="percent" :notice="notice" hint="模拟期间参数已锁定"
      :detail="translateUi('已模拟 {done} / {total} 次', { done: progress.completed.toLocaleString('zh-CN'), total: progress.total.toLocaleString('zh-CN') })" cancellable cancel-text="取消模拟" @cancel="cancel" />
  </div>
</template>
