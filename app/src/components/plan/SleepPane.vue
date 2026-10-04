<script setup lang="ts">
import { computed, ref, shallowRef, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { ISLANDS } from '../../calc/data'
import { drowsyPower, energyLost, EVENT_BONUSES, EVENT_OTHER_SHARE, expectSpecies, maxEncounters, RANK_ORDER, rankFromStrength, rankStrength, rankToNext, resolvedSleepdex, sleepClock, sleepExpect, strengthToNext } from '../../calc/sleep'
import PokeSprite from '../shared/PokeSprite.vue'
import { usePlanStore } from '../../stores/plans'
import { useSettingsStore } from '../../stores/settings'
import type { SleepType } from '../../types'

const settingsStore = useSettingsStore()
const planStore = usePlanStore()
const { settings } = storeToRefs(settingsStore)
const { plan } = storeToRefs(planStore)

const island = computed({
  get: () => settings.value.island,
  set: (value) => settingsStore.applyIsland(value),
})

const rank = computed(() => rankFromStrength(island.value, plan.value.snorlaxStrength))
const nextRank = computed(() => rankToNext(island.value, plan.value.snorlaxStrength))
const pickedRank = computed({
  get: () => rank.value,
  set: (value) => { plan.value.snorlaxStrength = rankStrength(island.value, value) },
})
const dp = computed(() => drowsyPower(plan.value.sleepScore, plan.value.snorlaxStrength, settings.value.eventMult))

const result = computed(() => maxEncounters(
  island.value,
  plan.value.sleepScore,
  plan.value.snorlaxStrength,
  settings.value.eventMult,
))
const splitHelps = computed(() => result.value.best.total > result.value.single)
/** null 表示跟随推荐：拆分能多抓时拆分。改岛屿、分数、能量或加成后回到推荐。 */
const manualWhole = shallowRef<boolean | null>(null)
const whole = computed(() => manualWhole.value ?? !splitHelps.value)
const caught = computed(() => whole.value ? result.value.single : result.value.best.total)
const shown = computed(() => caught.value + (plan.value.campTicket ? 1 : 0) + (plan.value.incense ? 1 : 0))
const nextCatch = computed(() => strengthToNext(
  island.value,
  plan.value.sleepScore,
  plan.value.snorlaxStrength,
  settings.value.eventMult,
))
const sameMult = (mult: number) => Math.abs(settings.value.eventMult - mult) < 0.001

const BATCH = 4000
const eventMix = shallowRef(false)
const otherShare = Math.round((1 - EVENT_OTHER_SHARE) * 100)
const seen = ref<{ pokeId: number, name: string, count: number }[]>([])
let drawSeed = 1

watch(() => [island.value, plan.value.sleepScore, plan.value.snorlaxStrength, settings.value.eventMult], () => {
  manualWhole.value = null
  seen.value = []
})

function calculate() {
  drawSeed += 1
  seen.value = sleepExpect(island.value, plan.value.sleepType as SleepType, dp.value, BATCH, 'normal', {
    rank: rank.value,
    discovered: resolvedSleepdex(plan.value),
    undiscoveredBoost: plan.value.undiscoveredBoost,
    rare: plan.value.rare,
    shinyUp: plan.value.shinyUp || settings.value.shinyUp,
    eventMix: eventMix.value,
    seed: drawSeed,
  }).map((row) => ({ pokeId: row.pokeId, name: row.name, count: row.count }))
}

const board = computed(() => expectSpecies(seen.value))
const seenTotal = computed(() => seen.value.reduce((sum, row) => sum + row.count, 0))
</script>

<template>
  <div class="stack">
    <p class="muted">特殊加成</p>
    <div class="lv-row">
      <button
        v-for="bonus in EVENT_BONUSES"
        :key="bonus.mult"
        type="button"
        :class="{ on: sameMult(bonus.mult) }"
        @click="settings.eventMult = bonus.mult"
      >{{ bonus.label }}</button>
    </div>
    <article class="card stack">
      <p class="sleep-brief">
        <button type="button" :class="{ on: whole }" @click="manualWhole = !whole">{{ whole ? '不拆分' : '拆分' }}</button>
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
      <select v-model="island">
        <option v-for="i in ISLANDS" :key="i.id" :value="i.id">{{ i.name }}</option>
      </select>
    </div>
    <div class="field">
      <label>睡眠分数 {{ plan.sleepScore }} · {{ sleepClock(plan.sleepScore) }}</label>
      <input v-model.number="plan.sleepScore" type="range" min="1" max="100">
    </div>
    <div class="field">
      <label>评级（选择后填入该岛这一档的最低能量）</label>
      <select v-model="pickedRank">
        <option v-for="r in RANK_ORDER" :key="r" :value="r">{{ r }} · {{ rankStrength(island, r).toLocaleString('zh-CN') }}</option>
      </select>
    </div>
    <div class="field">
      <label>入睡卡比兽能量</label>
      <input v-model.number="plan.snorlaxStrength" type="number" min="0">
    </div>
    <div class="field">
      <label>睡眠类型</label>
      <select v-model="plan.sleepType">
        <option>淺淺入夢</option>
        <option>安然入睡</option>
        <option>深深入眠</option>
        <option>没有特征</option>
      </select>
    </div>
    <label class="row"><input v-model="plan.campTicket" type="checkbox"> 露营券 +1（只加第一觉）</label>
    <label class="row"><input v-model="plan.incense" type="checkbox"> 薰香 +1</label>
    <label class="row"><input v-model="eventMix" type="checkbox"> 活动期间遇到一些其他类型宝可梦（{{ otherShare }}%）</label>
    <p class="muted">
      {{ ISLANDS.find((i) => i.id === island)?.name }}评级 {{ rank }}<template v-if="nextRank">，再 {{ nextRank.need.toLocaleString('zh-CN') }} 能量升到 {{ nextRank.rank }}</template>。
      露营券和薰香各加 1 只。分数按满睡眠 8 小时 30 分 = 100 分换算。
    </p>
    <article class="expect-board">
      <div class="row">
        <button class="btn sage" type="button" @click="calculate">计算 4000 次</button>
      </div>
      <p v-if="seenTotal" class="muted">本次 {{ BATCH.toLocaleString('zh-CN') }} 次睡眠，共遇到 {{ seenTotal.toLocaleString('zh-CN') }} 只。预期只数 = 这只遇到的数量 / 全部遇到的数量。再点一次会重新算，不会累加。</p>
      <p v-else class="muted">点一次单独算 4000 次。再点会换一批结果，不会和上一次加在一起。</p>
      <div v-if="board.length" class="expect-list">
        <div v-for="item in board" :key="item.pokeId" class="expect-line">
          <PokeSprite :id="item.pokeId" :name="item.name" />
          <strong>{{ item.name }}</strong>
          <span class="muted">遇到 {{ item.count.toLocaleString('zh-CN') }}</span>
          <b>{{ item.percent.toFixed(2) }}%</b>
        </div>
      </div>
    </article>
  </div>
</template>
