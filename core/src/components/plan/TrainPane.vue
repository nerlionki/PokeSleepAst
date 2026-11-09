<script setup lang="ts">
import { gameText, t as translateUi } from '../../ui/i18n'


import { INPUT_RANGES } from '../../calc/inputRanges'
const INPUT_LIMITS = INPUT_RANGES.TrainPane

import clientDefaults from '../../data/client-defaults.resource'

import { useActivities } from '../../composables/useActivities'
import { CANDY_BOOSTS, candyBoostPolicy } from '../../calc/candyPlan'
import FormField from '../shared/FormField.vue'
import { computed, shallowRef, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { NATURES, NEUTRAL_NATURE, POKEDEX, natureByName } from '../../calc/data'
import { napDailyExp, SLEEP_EXP_BONUS, SLEEP_EXP_BONUS_MAX, trainPlan } from '../../calc/train'
import { useBoxStore } from '../../stores/box'
import { useSettingsStore } from '../../stores/settings'
const components_plan_TrainPane_config_clientDefaults = clientDefaults.modules.components_plan_TrainPane


const box = useBoxStore()
const uid = shallowRef(components_plan_TrainPane_config_clientDefaults["uidInitial"])
const from = shallowRef(components_plan_TrainPane_config_clientDefaults["fromInitial"])
const to = shallowRef(components_plan_TrainPane_config_clientDefaults["toInitial"])
const remaining = shallowRef<number | ''>(components_plan_TrainPane_config_clientDefaults.remainingInitial === 0 ? '' : components_plan_TrainPane_config_clientDefaults.remainingInitial)
const nature = shallowRef(components_plan_TrainPane_config_clientDefaults["natureInitial"])
const expNature = computed(() => {
  const row = natureByName(nature.value)
  return row.up === 'exp' ? 'up' : row.down === 'exp' ? 'down' : 'neutral'
})
function selectExpNature(value: 'up' | 'neutral' | 'down') {
  if (value === expNature.value) return
  const selected = value === 'neutral' ? NEUTRAL_NATURE : NATURES.find(row => row[value] === 'exp')?.name
  if (selected) nature.value = selected
}
const sleepOnTeam = shallowRef(components_plan_TrainPane_config_clientDefaults["sleepOnTeamInitial"])
const napping = shallowRef(components_plan_TrainPane_config_clientDefaults["nappingInitial"])
const napDays = shallowRef(components_plan_TrainPane_config_clientDefaults["napDaysInitial"])
const relaxTicketCount = shallowRef<number | ''>(components_plan_TrainPane_config_clientDefaults.relaxTicketCountInitial as '')
const relax = computed(() => relaxTicketCount.value === '' || Number(relaxTicketCount.value) > 0)
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
  remaining.value = p.tune?.exp || ''
})

const result = computed(() => trainPlan({
  activity: activity.context.value,
  island: settings.value.island,
  pokeId: box.pokemon.find(p => p.uid === uid.value)?.pokeId,
  from: from.value,
  to: to.value,
  remaining: Number(remaining.value),
  nature: nature.value,
  sleepOnTeam: sleepOnTeam.value && !napping.value,
  napping: napping.value,
  napDays: napDays.value,
  earlyRetrieve: napDays.value < 7,
  relaxTicket: relax.value,
  relaxTicketCount: napping.value && relaxTicketCount.value !== '' ? Number(relaxTicketCount.value) : undefined,
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
  <div class="stack train-pane">
    <FormField v-slot="{ id }" :label="translateUi('从 Box 带入')"><select :id="id" v-model="uid">
      <option value="">{{ translateUi("不使用 Box") }}</option>
      <option v-for="p in box.pokemon" :key="p.uid" :value="p.uid">{{ gameText(POKEDEX.find((x) => x.id === p.pokeId)?.name) }} Lv.{{ p.level }}</option>
    </select></FormField>

    <p v-if="result.error" class="amber" role="alert">{{ translateUi("无法计算：") }}{{ translateUi(result.error) }}</p>
    <article v-else class="card stack train-summary">
      <div class="train-summary-line"><h3>{{ translateUi("培养结果") }}</h3><strong class="amber">{{ translateUi("约") }} {{ result.days === Infinity ? '∞' : result.days }} {{ translateUi("天") }}</strong></div>
      <p class="muted">{{ translateUi("总需求 EXP") }} {{ result.needExp.toLocaleString('zh-CN') }}</p>
      <div class="train-fields train-totals">
        <div><span class="muted">{{ translateUi("所需糖果") }}</span><strong>{{ result.candy.toLocaleString('zh-CN') }} {{ translateUi("颗") }}</strong></div>
        <div><span class="muted">{{ translateUi("所需梦碎") }}</span><strong>{{ result.shards.toLocaleString('zh-CN') }}</strong></div>
      </div>
    </article>

    <section class="card stack train-section">
      <h3>{{ translateUi("等级与经验") }}</h3>
      <div class="train-fields">
        <FormField v-slot="{ id }" :label="translateUi('当前等级')"><input :id="id" v-model.number="from" type="number"></FormField>
        <FormField v-slot="{ id }" :label="translateUi('目标等级')"><input :id="id" v-model.number="to" type="number"></FormField>
      </div>
      <div class="train-fields">
        <FormField v-slot="{ id }" :label="translateUi('距下级剩余 EXP')"><input :id="id" v-model.number="remaining" type="number" :placeholder="translateUi('留空＝刚到本级')"></FormField>
        <FormField v-slot="{ id }" :label="translateUi('经验组')"><select :id="id" v-model="group">
          <option value="normal">{{ translateUi("普通 ×1") }}</option><option value="pseudo">{{ translateUi("准神 ×1.5") }}</option><option value="legendary">{{ translateUi("传说 ×1.8") }}</option><option value="mythical">{{ translateUi("幻 ×2.2") }}</option>
        </select></FormField>
      </div>
    <div class="exp-nature-field">
      <span id="train-exp-nature-label">{{ translateUi("性格 EXP 补正") }}</span>
      <div class="exp-nature-control" role="group" aria-labelledby="train-exp-nature-label">
        <button type="button" :class="{ active: expNature === 'up' }" :aria-pressed="expNature === 'up'" :aria-label="translateUi('EXP 上升')" @click="selectExpNature('up')">
          <span>EXP</span><span class="exp-arrow exp-up" aria-hidden="true" />
        </button>
        <button type="button" :class="{ active: expNature === 'neutral' }" :aria-pressed="expNature === 'neutral'" :aria-label="translateUi('EXP 无补正')" @click="selectExpNature('neutral')">
          <span class="exp-neutral" aria-hidden="true" />
        </button>
        <button type="button" :class="{ active: expNature === 'down' }" :aria-pressed="expNature === 'down'" :aria-label="translateUi('EXP 下降')" @click="selectExpNature('down')">
          <span>EXP</span><span class="exp-arrow exp-down" aria-hidden="true" />
        </button>
      </div>
    </div>
    </section>

    <section class="card stack train-section">
      <h3>{{ translateUi("经验来源") }}</h3>
      <label class="train-toggle"><span>{{ translateUi("上阵睡觉") }}</span><input v-model="sleepOnTeam" type="checkbox" :disabled="napping"></label>
      <div class="train-bonus">
        <span>{{ translateUi("睡眠 EXP 奖励") }}</span>
        <div class="tune-row">
          <button type="button" :disabled="sleepExpBonus <= 0" @click="stepBonus(-1)">−</button><b>{{ sleepExpBonus }}</b>
          <button type="button" :disabled="sleepExpBonus >= SLEEP_EXP_BONUS_MAX" @click="stepBonus(1)">+</button>
        </div>
      </div>
      <p class="muted train-hint">+{{ Math.round(sleepExpBonus * SLEEP_EXP_BONUS * 100) }}{{ translateUi("%（每个 +14%，加法叠加）") }}</p>
      <label class="train-toggle"><span>{{ translateUi("红香（睡眠 EXP 结算后再 ×2）") }}</span><input v-model="sleepIncense" type="checkbox"></label>
      <label class="train-toggle"><span>{{ translateUi("寄放午睡岛（与上阵互斥）") }}</span><input v-model="napping" type="checkbox"></label>
      <template v-if="napping">
        <div class="train-fields">
          <FormField v-slot="{ id }" :label="translateUi('寄放天数')"><input :id="id" v-model.number="napDays" type="number" :min="INPUT_LIMITS.napDays.min"></FormField>
          <FormField v-slot="{ id }" :label="translateUi('午睡券张数')"><input :id="id" v-model.number="relaxTicketCount" type="number" :min="INPUT_LIMITS.relaxTicketCount.min" :step="INPUT_LIMITS.relaxTicketCount.step" :placeholder="translateUi('留空按无限张计算')"></FormField>
        </div>
        <p class="muted train-hint">{{ translateUi("留空按无限券计算，填 0 为无券。每张有效 7 天，券耗尽后恢复普通寄放经验；领回不重置剩余券时长。") }}</p>
        <p class="muted train-hint">{{ relax ? translateUi("有券期间") : translateUi("无券时") }}{{ translateUi("每天") }} {{ napDailyExp(relax, nature) }} {{ translateUi("EXP。寄放中每 24h 回 15 活力，产量仍按未寄放仿真。捡拾箱不计入产糖。") }}</p>
        <p class="muted train-hint">{{ translateUi("满 7 天后可在达标当天领回；有每日额外产糖时，按寄放天数间隔领回喂糖。未满 7 天领回，寄放 EXP 减半。") }}</p>
      </template>
    </section>

    <section class="card stack train-section">
      <h3>{{ translateUi("糖果与增强") }}</h3>
      <div class="train-fields">
        <FormField v-slot="{ id }" :label="translateUi('已有糖果')"><input :id="id" v-model.number="owned" type="number"></FormField>
        <FormField v-slot="{ id }" :label="translateUi('进化预留')"><input :id="id" v-model.number="reserve" type="number"></FormField>
      </div>
      <div class="train-fields">
        <FormField v-slot="{ id }" :label="translateUi('每日额外产糖')"><input :id="id" v-model.number="dailyCandy" type="number"></FormField>
        <FormField v-slot="{ id }" :label="translateUi('增强期喂糖')"><input :id="id" v-model.number="boostCandy" type="number"></FormField>
      </div>
      <FormField v-slot="{ id }" :label="translateUi('增强窗口')"><select :id="id" v-model="boost">
        <option value="none">{{ translateUi("无") }}</option>
        <option value="mini" :disabled="!miniBoost.available">{{ translateUi(miniBoost.name) }} ×{{ miniBoost.exp }} {{ translateUi("经验 ×") }}{{ miniBoost.shards }} {{ translateUi("梦碎") }}{{ miniBoost.available ? translateUi("（当天{arg1}颗）", { arg1: String(miniBoost.quota) }) : translateUi("（未开放）") }}</option>
        <option value="normal">{{ translateUi(CANDY_BOOSTS.christmas.name) }} ×{{ CANDY_BOOSTS.christmas.exp }} {{ translateUi("经验 ×") }}{{ CANDY_BOOSTS.christmas.shards }} {{ translateUi("梦碎") }}</option>
      </select></FormField>
    </section>

    <article v-if="!result.error" class="card stack train-section">
      <h3>{{ translateUi("路径对照") }}</h3>
      <div v-for="p in result.paths" :key="p.name" class="train-path"><span>{{ translateUi(p.name) }}</span><strong>{{ p.days === Infinity ? '—' : p.days + ' 天' }}</strong></div>
    </article>
  </div>
</template>

<style scoped>
.train-section h3, .train-summary h3 { margin: 0; font-size: var(--font-16); }
.train-fields { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); align-items: start; gap: 12px; }
.train-summary-line, .train-bonus, .train-toggle { display: flex; align-items: center; justify-content: space-between; gap: 12px; min-width: 0; }
.train-summary-line { flex-wrap: wrap; }
.train-totals > div { display: flex; flex-direction: column; gap: 4px; min-width: 0; overflow-wrap: anywhere; }
.train-toggle { min-height: 44px; }
.train-toggle > span { min-width: 0; }
.train-toggle > input { flex-shrink: 0; }
.train-bonus .tune-row { flex-wrap: nowrap; flex-shrink: 0; }
.train-hint { font-size: var(--font-12); line-height: 1.6; }
.train-path { display: flex; align-items: baseline; justify-content: space-between; gap: 12px; padding: 8px 0; border-bottom: 1px solid var(--line); }
.train-path > span { min-width: 0; overflow-wrap: anywhere; }
.train-path > strong { flex-shrink: 0; font-variant-numeric: tabular-nums; }
@media (max-width: 340px) { .train-fields { grid-template-columns: minmax(0, 1fr); } }

.exp-nature-field { display: flex; flex-direction: column; gap: 10px; }
.exp-nature-control { display: flex; align-self: center; overflow: hidden; border-radius: 24px; background: var(--ink-2); }
.exp-nature-control button { display: flex; align-items: center; justify-content: center; gap: 8px; min-width: 52px; min-height: 44px; padding: 10px 14px; border: 0; border-radius: 0; background: transparent; color: var(--text); font: inherit; font-weight: 700; cursor: pointer; }
.exp-nature-control button.active { background: var(--amber); color: var(--on-accent); }
.exp-nature-control button:focus-visible { outline: 2px solid var(--sage); outline-offset: -3px; }
.exp-arrow { display: block; width: 11px; height: 11px; border-top: 3px solid; border-right: 3px solid; }
.exp-neutral { display: block; width: 19px; height: 3px; background: currentColor; }
.exp-nature-control .exp-up { color: var(--rose); transform: translateY(3px) rotate(-45deg); }
.exp-nature-control .exp-down { color: var(--sage); transform: translateY(-3px) rotate(135deg); }
.exp-nature-control button.active .exp-up, .exp-nature-control button.active .exp-down { color: inherit; }
</style>
