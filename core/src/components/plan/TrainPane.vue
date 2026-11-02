<script setup lang="ts">
import clientDefaults from '../../data/client-defaults.resource'

import { useActivities } from '../../composables/useActivities'
import { CANDY_BOOSTS, candyBoostPolicy } from '../../calc/candyPlan'
import FormField from '../shared/FormField.vue'
import { computed, shallowRef, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { NATURES, POKEDEX } from '../../calc/data'
import { napDailyExp, SLEEP_EXP_BONUS, SLEEP_EXP_BONUS_MAX, trainPlan } from '../../calc/train'
import { useBoxStore } from '../../stores/box'
import { useSettingsStore } from '../../stores/settings'
const components_plan_TrainPane_config_clientDefaults = clientDefaults.modules.components_plan_TrainPane


const box = useBoxStore()
const uid = shallowRef(components_plan_TrainPane_config_clientDefaults["uidInitial"])
const from = shallowRef(components_plan_TrainPane_config_clientDefaults["fromInitial"])
const to = shallowRef(components_plan_TrainPane_config_clientDefaults["toInitial"])
const remaining = shallowRef(components_plan_TrainPane_config_clientDefaults["remainingInitial"])
const nature = shallowRef(components_plan_TrainPane_config_clientDefaults["natureInitial"])
const sleepOnTeam = shallowRef(components_plan_TrainPane_config_clientDefaults["sleepOnTeamInitial"])
const napping = shallowRef(components_plan_TrainPane_config_clientDefaults["nappingInitial"])
const napDays = shallowRef(components_plan_TrainPane_config_clientDefaults["napDaysInitial"])
const relax = shallowRef(components_plan_TrainPane_config_clientDefaults["relaxInitial"])
const sleepExpBonus = shallowRef(components_plan_TrainPane_config_clientDefaults["sleepExpBonusInitial"])
const sleepIncense = shallowRef(components_plan_TrainPane_config_clientDefaults["sleepIncenseInitial"])

function stepBonus(delta: number) {
  sleepExpBonus.value = Math.min(SLEEP_EXP_BONUS_MAX, Math.max(0, sleepExpBonus.value + delta))
}
const owned = shallowRef(components_plan_TrainPane_config_clientDefaults["ownedInitial"])
const reserve = shallowRef(components_plan_TrainPane_config_clientDefaults["reserveInitial"])
const dailyCandy = shallowRef(components_plan_TrainPane_config_clientDefaults["dailyCandyInitial"])
const boost = shallowRef<'none' | 'mini' | 'normal'>((components_plan_TrainPane_config_clientDefaults["boostInitial"] as unknown as 'none' | 'mini' | 'normal'))
const boostCandy = shallowRef(components_plan_TrainPane_config_clientDefaults["boostCandyInitial"])
const group = shallowRef<'normal' | 'pseudo' | 'legendary' | 'mythical'>((components_plan_TrainPane_config_clientDefaults["groupInitial"] as unknown as 'normal' | 'pseudo' | 'legendary' | 'mythical'))
const { settings } = storeToRefs(useSettingsStore())
const activity = useActivities(settings, () => settings.value.island)
const miniBoost = computed(() => candyBoostPolicy('mini', activity.context.value))

watch(uid, (id) => {
  const p = box.pokemon.find((x) => x.uid === id)
  if (!p) return
  from.value = p.level
  nature.value = p.nature
  napping.value = p.napping
  remaining.value = p.tune?.exp ?? 0
})

const result = computed(() => trainPlan({
  activity: activity.context.value,
  island: settings.value.island,
  pokeId: box.pokemon.find(p => p.uid === uid.value)?.pokeId,
  from: from.value,
  to: to.value,
  remaining: remaining.value,
  nature: nature.value,
  sleepOnTeam: sleepOnTeam.value && !napping.value,
  napping: napping.value,
  napDays: napDays.value,
  earlyRetrieve: napDays.value < 7,
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
    <FormField v-slot="{ id }" label="从 Box 带入"><select :id="id" v-model="uid">
        <option value="">不使用 Box</option>
        <option v-for="p in box.pokemon" :key="p.uid" :value="p.uid">
          {{ POKEDEX.find((x) => x.id === p.pokeId)?.name }} Lv.{{ p.level }}
        </option>
      </select></FormField>
    <div class="row">
      <FormField v-slot="{ id }" label="当前等级"><input :id="id" v-model.number="from" type="number"></FormField>
      <FormField v-slot="{ id }" label="目标等级"><input :id="id" v-model.number="to" type="number"></FormField>
    </div>
    <FormField v-slot="{ id }" label="距下级剩余 EXP"><input :id="id" v-model.number="remaining" type="number"></FormField>
    <FormField v-slot="{ id }" label="经验性格"><select :id="id" v-model="nature">
        <option v-for="n in NATURES" :key="n.name" :value="n.name">{{ n.name }}</option>
      </select></FormField>
    <FormField v-slot="{ id }" label="经验组"><select :id="id" v-model="group">
        <option value="normal">普通 ×1</option>
        <option value="pseudo">准神 ×1.5</option>
        <option value="legendary">传说 ×1.8</option>
        <option value="mythical">幻 ×2.2</option>
      </select></FormField>
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
      <FormField v-slot="{ id }" label="寄放天数"><input :id="id" v-model.number="napDays" type="number" min="1"></FormField>
      <label class="row"><input v-model="relax" type="checkbox"> 午睡放松券 +450</label>
      <p class="muted">每天 {{ napDailyExp(relax, nature) }} EXP。寄放中每 24h 回 15 活力，产量仍按未寄放仿真。捡拾箱不计入产糖。</p>
    </template>
    <div class="row">
      <FormField v-slot="{ id }" label="已有糖果"><input :id="id" v-model.number="owned" type="number"></FormField>
      <FormField v-slot="{ id }" label="进化预留"><input :id="id" v-model.number="reserve" type="number"></FormField>
    </div>
    <FormField v-slot="{ id }" label="每日额外产糖"><input :id="id" v-model.number="dailyCandy" type="number"></FormField>
    <FormField v-slot="{ id }" label="增强窗口"><select :id="id" v-model="boost">
        <option value="none">无</option>
        <option value="mini" :disabled="!miniBoost.available">{{ miniBoost.name }} ×{{ miniBoost.exp }} 经验 ×{{ miniBoost.shards }} 梦碎{{ miniBoost.available ? `（当天${miniBoost.quota}颗）` : '（未开放）' }}</option>
        <option value="normal">{{ CANDY_BOOSTS.christmas.name }} ×{{ CANDY_BOOSTS.christmas.exp }} 经验 ×{{ CANDY_BOOSTS.christmas.shards }} 梦碎</option>
      </select></FormField>
    <FormField v-slot="{ id }" label="增强期喂糖"><input :id="id" v-model.number="boostCandy" type="number"></FormField>
    <p v-if="result.error" class="amber" role="alert">无法计算：{{ result.error }}</p>
    <article v-else class="card stack">
      <p>总需求 EXP {{ result.needExp.toLocaleString() }}</p>
      <p class="amber">约 {{ result.days === Infinity ? '∞' : result.days }} 天</p>
      <p>糖果 {{ result.candy }} · 梦碎 {{ result.shards }}</p>
    </article>
    <article v-if="!result.error" class="card stack">
      <h3>路径对照</h3>
      <p v-for="p in result.paths" :key="p.name">{{ p.name }}：{{ p.days === Infinity ? '—' : p.days + ' 天' }}</p>
    </article>
  </div>
</template>
