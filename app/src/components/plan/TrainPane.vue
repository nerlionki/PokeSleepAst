<script setup lang="ts">
import { computed, shallowRef, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { NATURES, POKEDEX } from '../../calc/data'
import { napDailyExp, SLEEP_EXP_BONUS, SLEEP_EXP_BONUS_MAX, trainPlan } from '../../calc/train'
import { useBoxStore } from '../../stores/box'
import { useSettingsStore } from '../../stores/settings'

const box = useBoxStore()
const uid = shallowRef('')
const from = shallowRef(1)
const to = shallowRef(30)
const remaining = shallowRef(0)
const nature = shallowRef('勤奋')
const sleepOnTeam = shallowRef(true)
const napping = shallowRef(false)
const napDays = shallowRef(7)
const early = shallowRef(false)
const relax = shallowRef(false)
const sleepExpBonus = shallowRef(0)
const sleepIncense = shallowRef(false)

function stepBonus(delta: number) {
  sleepExpBonus.value = Math.min(SLEEP_EXP_BONUS_MAX, Math.max(0, sleepExpBonus.value + delta))
}
const owned = shallowRef(0)
const reserve = shallowRef(0)
const dailyCandy = shallowRef(0)
const boost = shallowRef<'none' | 'mini' | 'normal'>('none')
const boostCandy = shallowRef(0)
const group = shallowRef<'normal' | 'pseudo' | 'legendary' | 'mythical'>('normal')
const { settings } = storeToRefs(useSettingsStore())

watch(uid, (id) => {
  const p = box.pokemon.find((x) => x.uid === id)
  if (!p) return
  from.value = p.level
  nature.value = p.nature
  napping.value = p.napping
})

const result = computed(() => trainPlan({
  from: from.value,
  to: to.value,
  remaining: remaining.value,
  nature: nature.value,
  sleepOnTeam: sleepOnTeam.value && !napping.value,
  napping: napping.value,
  napDays: napDays.value,
  earlyRetrieve: early.value,
  relaxTicket: relax.value,
  sleepScore: settings.value.sleepScore,
  sleepExpBonus: sleepExpBonus.value,
  sleepIncense: sleepIncense.value,
  ownedCandy: owned.value,
  reserveCandy: reserve.value,
  dailyCandy: dailyCandy.value,
  boost: boost.value,
  boostCandy: boostCandy.value,
  group: group.value,
}))
</script>

<template>
  <div class="stack">
    <div class="field">
      <label>从 Box 带入</label>
      <select v-model="uid">
        <option value="">不使用 Box</option>
        <option v-for="p in box.pokemon" :key="p.uid" :value="p.uid">
          {{ POKEDEX.find((x) => x.id === p.pokeId)?.name }} Lv.{{ p.level }}
        </option>
      </select>
    </div>
    <div class="row">
      <div class="field"><label>当前等级</label><input v-model.number="from" type="number"></div>
      <div class="field"><label>目标等级</label><input v-model.number="to" type="number"></div>
    </div>
    <div class="field"><label>距下级剩余 EXP</label><input v-model.number="remaining" type="number"></div>
    <div class="field">
      <label>经验性格</label>
      <select v-model="nature">
        <option v-for="n in NATURES" :key="n.name" :value="n.name">{{ n.name }}</option>
      </select>
    </div>
    <div class="field">
      <label>经验组</label>
      <select v-model="group">
        <option value="normal">普通 ×1</option>
        <option value="pseudo">准神 ×1.5</option>
        <option value="legendary">传说 ×1.8</option>
        <option value="mythical">幻 ×2.2</option>
      </select>
    </div>
    <label class="row"><input v-model="sleepOnTeam" type="checkbox" :disabled="napping"> 上阵睡觉</label>
    <div class="tune-row">
      <span>睡眠 EXP 奖励</span>
      <button type="button" :disabled="sleepExpBonus <= 0" @click="stepBonus(-1)">−</button>
      <b>{{ sleepExpBonus }}</b>
      <button type="button" :disabled="sleepExpBonus >= SLEEP_EXP_BONUS_MAX" @click="stepBonus(1)">+</button>
      <span class="muted">+{{ Math.round(sleepExpBonus * SLEEP_EXP_BONUS * 100) }}%（每个 +14%，加法叠加）</span>
    </div>
    <label class="row"><input v-model="sleepIncense" type="checkbox"> 红香（睡眠 EXP 结算后再 ×2）</label>
    <label class="row"><input v-model="napping" type="checkbox"> 寄放午睡岛（与上阵互斥）</label>
    <template v-if="napping">
      <div class="field"><label>寄放天数</label><input v-model.number="napDays" type="number" min="1"></div>
      <label class="row"><input v-model="relax" type="checkbox"> 午睡放松券 +450</label>
      <label class="row"><input v-model="early" type="checkbox"> 未满 7 天领回（EXP 减半）</label>
      <p class="muted">每天 {{ napDailyExp(relax) }} EXP。寄放中每 24h 回 15 活力，产量仍按未寄放仿真。捡拾箱不计入产糖。</p>
    </template>
    <div class="row">
      <div class="field"><label>已有糖果</label><input v-model.number="owned" type="number"></div>
      <div class="field"><label>进化预留</label><input v-model.number="reserve" type="number"></div>
    </div>
    <div class="field"><label>每日额外产糖</label><input v-model.number="dailyCandy" type="number"></div>
    <div class="field">
      <label>增强窗口</label>
      <select v-model="boost">
        <option value="none">无</option>
        <option value="mini">迷你 ×2 经验 ×4 梦碎</option>
        <option value="normal">常规 ×2 ×5</option>
      </select>
    </div>
    <div class="field"><label>增强期喂糖</label><input v-model.number="boostCandy" type="number"></div>
    <article class="card stack">
      <p>总需求 EXP {{ result.needExp.toLocaleString() }}</p>
      <p class="amber">约 {{ result.days === Infinity ? '∞' : result.days }} 天</p>
      <p>糖果 {{ result.candy }} · 梦碎 {{ result.shards }}</p>
    </article>
    <article class="card stack">
      <h3>路径对照</h3>
      <p v-for="p in result.paths" :key="p.name">{{ p.name }}：{{ p.days === Infinity ? '—' : p.days + ' 天' }}</p>
    </article>
  </div>
</template>
