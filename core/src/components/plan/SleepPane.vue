<script setup lang="ts">
import clientDefaults from '../../data/client-defaults.json'

import { useActivities } from '../../composables/useActivities'
import ProgressDialog from '../shared/ProgressDialog.vue'
import { computed, shallowRef, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { ISLANDS } from '../../calc/data'
import { drowsyPower, energyLost, EVENT_BONUSES, expectSpecies, maxEncounters, RANK_ORDER, rankFromStrength, rankStrength, rankToNext, resolvedSleepdex, sleepClock, strengthToNext } from '../../calc/sleep'
import PokeSprite from '../shared/PokeSprite.vue'
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
const eventMult = activity.field('drowsyPowerMultiplier', () => settings.value.eventMult)
const shinyUp = activity.field('shinyUp', () => plan.value.shinyUp || settings.value.shinyUp)
const rank = computed(() => rankFromStrength(island.value, plan.value.snorlaxStrength))
const nextRank = computed(() => rankToNext(island.value, plan.value.snorlaxStrength))
const pickedRank = computed({
  get: () => rank.value,
  set: (value) => { plan.value.snorlaxStrength = rankStrength(island.value, value) },
})
const dp = computed(() => drowsyPower(plan.value.sleepScore, plan.value.snorlaxStrength, eventMult.value))

const result = computed(() => maxEncounters(
  island.value,
  plan.value.sleepScore,
  plan.value.snorlaxStrength,
  eventMult.value,
))
const splitHelps = computed(() => result.value.best.total > result.value.single)
/** null 表示跟随推荐：拆分能多抓时拆分。改岛屿、分数、能量或加成后回到推荐。 */
const manualWhole = shallowRef<boolean | null>((components_plan_SleepPane_config_clientDefaults["manualWholeInitial"] as unknown as boolean | null))
const whole = computed(() => manualWhole.value ?? !splitHelps.value)
const caught = computed(() => whole.value ? result.value.single : result.value.best.total)
const shown = computed(() => caught.value + (plan.value.campTicket ? 1 : 0))
const nextCatch = computed(() => strengthToNext(
  island.value,
  plan.value.sleepScore,
  plan.value.snorlaxStrength,
  eventMult.value,
))
const sameMult = (mult: number) => Math.abs(eventMult.value - mult) < 0.001

const BATCH = (components_plan_SleepPane_config_clientDefaults["BATCH"] as 4000)
const mixMode = activity.field('eventMix', () => 'off')
const otherTypes = computed({ get: () => mixMode.value !== 'off', set: (value: boolean) => { mixMode.value = value ? settings.value.sleepEventMix : 'off' } })
const researchedBefore = shallowRef(components_plan_SleepPane_config_clientDefaults["researchedBeforeInitial"])
const specialEncountered = shallowRef(components_plan_SleepPane_config_clientDefaults["specialEncounteredInitial"])
const firstResearchExtras = shallowRef(components_plan_SleepPane_config_clientDefaults["firstResearchExtrasInitial"])
const eventMix = mixMode
const resultTab = shallowRef<'encounters' | 'candies'>((components_plan_SleepPane_config_clientDefaults["resultTabInitial"] as unknown as 'encounters' | 'candies'))
const { busy, error: simulationError, notice, progress, result: seen, calculate: startSimulation, cancel, reset } = useSleepSimulation()
watch(() => [researchBonuses.value, focusIncense.value, luckIncense.value, incenseSession.value], () => reset(), { deep: true, flush: 'sync' })
const percent = computed(() => progress.value.total ? Math.floor(progress.value.completed / progress.value.total * 100) : 0)
let drawSeed = components_plan_SleepPane_config_clientDefaults["drawSeed"]

watch(() => [island.value, plan.value.sleepScore, plan.value.snorlaxStrength, eventMult.value], () => {
  manualWhole.value = null
})
watch(() => [island.value, plan.value.sleepScore, plan.value.snorlaxStrength, eventMult.value, whole.value, plan.value.sleepType, plan.value.undiscoveredBoost, plan.value.rare, plan.value.shinyUp, shinyUp.value, activity.context.value, eventMix.value, plan.value.sleepdexMode, plan.value.sleepdex, plan.value.sleepdexExcluded, researchedBefore.value, specialEncountered.value, firstResearchExtras.value, plan.value.campTicket], () => {
  reset()
}, { deep: true, flush: 'sync' })

function calculate() {
  if (busy.value) return
  drawSeed += 1
  const opts = {
    ...researchBonuses.value,
    focusIncense: focusIncense.value,
    luckIncense: luckIncense.value,
    incenseSession: whole.value ? 0 as const : incenseSession.value,
    researchedBefore: Math.max(0, Math.floor(researchedBefore.value)),
    researchLimit: specialEncountered.value ? 11 as const : 10 as const,
    firstResearchExtras: Math.max(0, Math.floor(firstResearchExtras.value)) + Number(plan.value.campTicket) + Number(specialEncountered.value),
    rank: rank.value,
    discovered: resolvedSleepdex(plan.value),
    undiscoveredBoost: plan.value.undiscoveredBoost,
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

const board = computed(() => expectSpecies(seen.value))
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
    <p class="muted">特殊加成</p>
    <div class="lv-row">
      <button
        v-for="bonus in EVENT_BONUSES"
        :key="bonus.mult"
        type="button"
        :disabled="busy"
        :class="{ on: sameMult(bonus.mult) }"
        @click="eventMult = bonus.mult"
      >{{ bonus.label }}</button>
    </div>
    <article class="card stack">
      <p class="sleep-brief">
        <button type="button" :disabled="busy" :class="{ on: whole }" @click="manualWhole = !whole">{{ whole ? '不拆分' : '拆分' }}</button>
        <span>
          满睡眠{{ sleepClock(plan.sleepScore) }}，可捕捉{{ shown }}只，
          {{ plan.sleepScore }}分，获得{{ Math.round(dp).toLocaleString('zh-CN') }}睡意之力，掉{{ energyLost(plan.sleepScore) }}点活力
        </span>
      </p>
      <p v-if="!whole && splitHelps" class="muted">
        第一觉 {{ sleepClock(result.best.a) }}（{{ result.best.a }} 分）{{ result.best.first }} 只，
        第二觉 {{ sleepClock(result.best.b) }}（{{ result.best.b }} 分）{{ result.best.second }} 只
      </p>
      <p v-else-if="!whole" class="muted">这个岛屿和分数下拆分不会多抓，按一觉睡满计算。</p>
      <p v-else-if="splitHelps" class="muted">拆成两觉可以多抓 {{ result.best.total - result.single }} 只，点「不拆分」切换为拆分查看拆法。</p>
      <p v-if="nextCatch">距离抓{{ nextCatch.count }}只还需 {{ nextCatch.need.toLocaleString('zh-CN') }} 能量</p>
      <p v-else class="muted">这个睡意之力已经到 8 只。</p>
    </article>
    <div class="field">
      <label>岛屿</label>
      <select :disabled="busy" v-model="island">
        <option v-for="i in ISLANDS" :key="i.id" :value="i.id">{{ i.name }}</option>
      </select>
    </div>
    <div class="field">
      <label>睡眠分数 {{ plan.sleepScore }} · {{ sleepClock(plan.sleepScore) }}</label>
      <input :disabled="busy" v-model.number="plan.sleepScore" type="range" min="1" max="100">
    </div>
    <div class="field">
      <label>评级（选择后填入该岛这一档的最低能量）</label>
      <select :disabled="busy" v-model="pickedRank">
        <option v-for="r in RANK_ORDER" :key="r" :value="r">{{ r }} · {{ rankStrength(island, r).toLocaleString('zh-CN') }}</option>
      </select>
    </div>
    <div class="field">
      <label>入睡卡比兽能量</label>
      <input :disabled="busy" v-model.number="plan.snorlaxStrength" type="number" min="0">
    </div>
    <div class="field"><label>本日此前已研究只数</label><input :disabled="busy" v-model.number="researchedBefore" type="number" min="0" max="20"></div>
    <label class="row"><input :disabled="busy" v-model="specialEncountered" type="checkbox">本日实际遇到特殊UP宝可梦</label>
    <div v-if="!whole" class="field"><label>第一觉熏香额外遭遇只数（不含露营券、特殊UP）</label><input :disabled="busy" v-model.number="firstResearchExtras" type="number" min="0" max="2"></div>
    <p class="muted">每日第11只起糖果为1，研究EXP与梦之碎片减半；实际遇到特殊UP时从第12只起减额。按抽选顺序结算，不减少捕捉数量。额外遭遇只计入累计只数，不模拟其奖励。</p>
    <div class="field">
      <label>睡眠类型</label>
      <select :disabled="busy" v-model="plan.sleepType">
        <option>淺淺入夢</option>
        <option>安然入睡</option>
        <option>深深入眠</option>
        <option>没有特征</option>
      </select>
    </div>
    <label class="row"><input :disabled="busy" v-model="plan.campTicket" type="checkbox"> 露营券 +1（只加第一觉）</label>
    <label class="row"><input :disabled="busy" v-model="focusIncense" type="checkbox"> 专注薰香（研究 EXP ×2）</label>
    <label class="row"><input :disabled="busy" v-model="luckIncense" type="checkbox"> 幸运薰香（研究梦碎 ×2）</label>
    <label v-if="!whole && (focusIncense || luckIncense)" class="field">
      <span>薰香使用时段</span>
      <select v-model.number="incenseSession" :disabled="busy"><option :value="0">第一觉</option><option :value="1">第二觉</option></select>
    </label>
    <label class="row"><input :disabled="busy" v-model="otherTypes" type="checkbox"> 活动期间遇到一些其他类型宝可梦</label>
    <label class="row"><input :disabled="busy" v-model="plan.undiscoveredBoost" type="checkbox"> 优先遇到未发现睡姿</label>
    <p class="muted">
      {{ ISLANDS.find((i) => i.id === island)?.name }}评级 {{ rank }}<template v-if="nextRank">，再 {{ nextRank.need.toLocaleString('zh-CN') }} 能量升到 {{ nextRank.rank }}</template>。
      露营券加 1 只。分数按满睡眠 8 小时 30 分 = 100 分换算。
    </p>
    <article class="expect-board">
      <div class="row">
        <button class="btn sage" type="button" :disabled="busy" @click="calculate">{{ busy ? '正在模拟…' : '计算 4000 次' }}</button>
      </div>
      <p v-if="simulationError" class="amber" role="alert">{{ simulationError }}</p>
      <p v-if="notice" class="muted" role="status">{{ notice }}</p>
      <p v-if="seenTotal" class="muted">本次模拟 {{ BATCH.toLocaleString('zh-CN') }} 次{{ whole ? '整觉' : '拆分方案' }}，共遇到 {{ seenTotal.toLocaleString('zh-CN') }} 只。预期只数 = 这只遇到的数量 / 全部遇到的数量。再点一次会重新算，不会累加。</p>
      <p v-else-if="!busy" class="muted">点一次单独模拟 4000 次当前方案。再点会换一批结果，不会和上一次加在一起。</p>
      <div v-if="seenTotal" class="sleep-reward-summary">
        <p><span>每次方案平均研究 EXP</span><strong>{{ average(perSleep.researchExp) }}</strong></p>
        <p><span>每次方案平均梦之碎片</span><strong>{{ average(perSleep.shards) }}</strong></p>
      </div>
      <div v-if="seenTotal" class="seg" role="tablist" aria-label="模拟结果">
        <button type="button" role="tab" :aria-selected="resultTab === 'encounters'" :class="{ on: resultTab === 'encounters' }" @click="resultTab = 'encounters'">遭遇</button>
        <button type="button" role="tab" :aria-selected="resultTab === 'candies'" :class="{ on: resultTab === 'candies' }" @click="resultTab = 'candies'">糖果</button>
      </div>
      <div v-if="resultTab === 'candies' && candies.length" class="sleep-candy-summary">
        <p class="muted">每次方案平均糖果（同一进化链合并）</p>
        <div v-for="candy in candies" :key="candy.pokeId" class="sleep-candy-line">
          <PokeSprite :id="candy.pokeId" :name="candy.name" />
          <span>{{ candy.name }}</span><strong>{{ average(candy.average) }}</strong>
        </div>
      </div>
      <p v-if="seenTotal && plan.campTicket" class="muted">奖励基于基础睡姿抽取；露营券增加的遭遇未计入。</p>
      <div v-if="resultTab === 'encounters' && board.length" class="expect-list">
        <div v-for="item in board" :key="item.pokeId" class="expect-line">
          <PokeSprite :id="item.pokeId" :name="item.name" />
          <strong>{{ item.name }}</strong>
          <span class="muted">遇到 {{ item.count.toLocaleString('zh-CN') }}</span>
          <b>{{ item.percent.toFixed(2) }}%</b>
        </div>
      </div>
    </article>
    <ProgressDialog :open="busy" title="正在模拟睡姿" :progress="percent" :notice="notice" hint="模拟期间参数已锁定"
      :detail="'已模拟 ' + progress.completed.toLocaleString('zh-CN') + ' / ' + progress.total.toLocaleString('zh-CN') + ' 次'" cancellable cancel-text="取消模拟" @cancel="cancel" />
  </div>
</template>
