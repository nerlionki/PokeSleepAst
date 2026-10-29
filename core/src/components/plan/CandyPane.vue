<script setup lang="ts">
import clientDefaults from '../../data/client-defaults.resource'

import { useActivities } from '../../composables/useActivities'
import { useSettingsStore } from '../../stores/settings'
import FormField from '../shared/FormField.vue'
import { newUid } from '../../calc/uid'
import { computed, ref, shallowRef } from 'vue'
import { storeToRefs } from 'pinia'
import { boxLabel } from '../../calc/boxFilter'
import { CANDY_BOOSTS, CANDY_PRESETS, candyBoostPolicy, candyRowFromBox, evolutionLevels, familyOf, planCandy, type CandyBoostId, type CandyRow } from '../../calc/candyPlan'
import { useBoxStore } from '../../stores/box'
import { usePlanStore } from '../../stores/plans'
import type { BoxPokemon } from '../../types'
import PokePicker from '../shared/PokePicker.vue'
import PokeSprite from '../shared/PokeSprite.vue'
const components_plan_CandyPane_config_clientDefaults = clientDefaults.modules.components_plan_CandyPane


const { settings } = storeToRefs(useSettingsStore())
const activity = useActivities(settings, () => settings.value.island)
const planStore = usePlanStore()
const { plan } = storeToRefs(planStore)
const box = useBoxStore()
const mode = shallowRef<CandyBoostId>((components_plan_CandyPane_config_clientDefaults["modeInitial"] as unknown as CandyBoostId))
const importing = shallowRef(components_plan_CandyPane_config_clientDefaults["importingInitial"])
const imported = ref(new Set<string>())
const boxList = computed(() => [...box.pokemon].reverse())

function openImport() {
  imported.value = new Set()
  importing.value = true
}

function importFromBox(pokemon: BoxPokemon) {
  plan.value.candyRows.push(candyRowFromBox(pokemon))
  imported.value.add(pokemon.uid)
}

const plans = computed(() => ({
  christmas: planCandy(plan.value.candyRows, plan.value.candyStocks, 'christmas', activity.context.value, settings.value.island),
  mini: planCandy(plan.value.candyRows, plan.value.candyStocks, 'mini', activity.context.value, settings.value.island),
}))
const active = computed(() => plans.value[mode.value])
const boost = computed(() => candyBoostPolicy(mode.value, activity.context.value))

function addRow() {
  plan.value.candyRows.push({
    id: newUid(),
    pokeId: 1,
    method: 'target',
    start: 1,
    target: 30,
    use: 50,
    useAll: false,
    nature: 'flat',
    remaining: null,
  })
}

function removeRow(id: string) {
  plan.value.candyRows = plan.value.candyRows.filter((row) => row.id !== id)
}

function moveRow(index: number, step: number) {
  const next = index + step
  const rows = plan.value.candyRows
  if (next < 0 || next >= rows.length) return
  const [row] = rows.splice(index, 1)
  rows.splice(next, 0, row)
}

function stockOf(pokeId: number) {
  return plan.value.candyStocks[familyOf(pokeId)] ?? 0
}

function setStock(pokeId: number, value: number) {
  plan.value.candyStocks[familyOf(pokeId)] = Math.max(0, Math.floor(Number(value)) || 0)
}

function setRemaining(row: CandyRow, raw: string) {
  row.remaining = raw === '' ? null : Math.max(0, Math.floor(Number(raw)) || 0)
}

function statusOf(index: number) {
  const row = active.value.results[index]
  if (!row || row.error) return row?.error ?? '待计算'
  if (row.missing) return `缺糖 ${row.missing.toLocaleString('zh-CN')} 颗`
  if (row.unused) return `${row.unused.toLocaleString('zh-CN')} 颗未用完`
  return '充足'
}

const presets = CANDY_PRESETS
</script>

<template>
  <div class="stack">
    <p class="muted">同一进化家族共用当前糖果，按行顺序扣。大型增强经验 ×{{ CANDY_BOOSTS.christmas.exp }}、梦碎 ×{{ CANDY_BOOSTS.christmas.shards }}、额度 {{ CANDY_BOOSTS.christmas.quota.toLocaleString('zh-CN') }}。迷你增强按活动日期开放并计算当日额度，不含睡眠经验。</p>
    <p v-if="mode === 'mini' && !active.available" class="amber">当前活动日期未开放迷你糖果增强。</p>
    <div class="seg">
      <button type="button" :class="{ on: mode === 'christmas' }" @click="mode = 'christmas'">大型增强</button>
        <button type="button" :class="{ on: mode === 'mini' }" @click="mode = 'mini'">迷你增强</button>
    </div>
    <div class="row">
      <article class="card">
        <p class="muted">大型增强 · {{ plans.christmas.candies.toLocaleString('zh-CN') }} / {{ CANDY_BOOSTS.christmas.quota.toLocaleString('zh-CN') }} 颗</p>
        <p>梦碎 {{ plans.christmas.shards.toLocaleString('zh-CN') }}</p>
      </article>
      <article class="card">
        <p class="muted">迷你增强 · {{ plans.mini.candies.toLocaleString('zh-CN') }} / {{ plans.mini.quota.toLocaleString('zh-CN') }} 颗{{ plans.mini.daily ? '（当天）' : '' }}</p>
        <p>梦碎 {{ plans.mini.shards.toLocaleString('zh-CN') }}</p>
      </article>
    </div>
    <p v-if="active.over" class="amber">超出{{ boost.name }}额度 {{ active.over.toLocaleString('zh-CN') }} 颗</p>
    <p v-if="active.missing" class="amber">缺糖 {{ active.missing.toLocaleString('zh-CN') }} 颗</p>
    <div class="row">
      <button class="btn" type="button" @click="addRow">新增宝可梦</button>
      <button class="btn" type="button" :disabled="!box.pokemon.length" @click="openImport">从 Box 导入</button>
    </div>
    <article v-for="(row, index) in plan.candyRows" :key="row.id" class="card stack">
      <div class="plan-goal-top">
        <span class="muted">{{ index + 1 }}</span>
        <PokePicker v-model="row.pokeId" />
      </div>
      <div class="row">
        <FormField v-slot="{ id }" label="当前糖果"><input :id="id" :value="stockOf(row.pokeId)" type="number" min="0" @change="setStock(row.pokeId, Number(($event.target as HTMLInputElement).value))"></FormField>
        <FormField v-slot="{ id }" label="输入方式"><select :id="id" v-model="row.method">
            <option value="target">目标等级</option>
            <option value="manual">指定糖果</option>
          </select></FormField>
      </div>
      <div class="row">
        <FormField v-slot="{ id }" label="当前等级"><input :id="id" v-model.number="row.start" type="number" min="1" max="70"></FormField>
        <div v-if="row.method === 'target'" class="field">
          <label>目标等级</label>
          <input v-model.number="row.target" type="number" min="1" max="70">
        </div>
        <div v-else class="field">
          <label>使用糖果</label>
          <input v-model.number="row.use" type="number" min="0" :disabled="row.useAll">
        </div>
      </div>
      <div v-if="row.method === 'target'" class="picker-opts">
        <button v-for="lv in presets" :key="lv" type="button" :class="{ on: row.target === lv }" @click="row.target = lv">{{ lv }}</button>
        <button
          v-for="lv in evolutionLevels(row.pokeId)"
          :key="'e' + lv"
          type="button"
          :class="{ on: row.target === lv }"
          @click="row.target = lv"
        >进化 {{ lv }}</button>
      </div>
      <label v-else class="row"><input v-model="row.useAll" type="checkbox"> 用光当前剩余糖果</label>
      <div class="row">
        <FormField v-slot="{ id }" label="经验修正"><select :id="id" v-model="row.nature">
            <option value="flat">无修正</option>
            <option value="up">+EXP</option>
            <option value="down">−EXP</option>
          </select></FormField>
        <FormField v-slot="{ id }" label="升级还需 EXP"><input :id="id"
            :value="row.remaining ?? ''"
            type="number"
            min="0"
            placeholder="留空＝刚到本级"
            @change="setRemaining(row, ($event.target as HTMLInputElement).value)"
          ></FormField>
      </div>
      <p v-if="active.results[index] && !active.results[index].error">
        使用 {{ active.results[index].candies.toLocaleString('zh-CN') }} 颗
        · 梦碎 {{ active.results[index].shards.toLocaleString('zh-CN') }}
        · 到 Lv.{{ active.results[index].level }}
      </p>
      <p :class="active.results[index]?.error || active.results[index]?.missing ? 'amber' : 'muted'">{{ statusOf(index) }}</p>
      <div class="row">
        <button class="btn ghost" type="button" :disabled="index === 0" @click="moveRow(index, -1)">上移</button>
        <button class="btn ghost" type="button" :disabled="index === plan.candyRows.length - 1" @click="moveRow(index, 1)">下移</button>
        <button class="btn ghost" type="button" @click="removeRow(row.id)">删除</button>
      </div>
    </article>
    <p v-if="!plan.candyRows.length" class="muted">新增宝可梦，填写目标等级或要花的糖果。</p>
    <div v-if="importing" v-back="() => { importing = false }" class="overlay" @click.self="importing = false">
      <section class="sheet stack">
        <div class="row">
          <h3>从 Box 导入</h3>
          <button class="btn ghost" type="button" @click="importing = false">完成</button>
        </div>
        <p class="muted">带入等级、经验性格和升级还需 EXP，目标等级默认下一档。可连续点选多只。</p>
        <button v-for="p in boxList" :key="p.uid" class="data-row" type="button" @click="importFromBox(p)">
          <PokeSprite :id="p.pokeId" :name="boxLabel(p)" :shiny="p.shiny" />
          <span>{{ boxLabel(p) }} Lv.{{ p.level }} · {{ p.nature }}</span>
          <span v-if="imported.has(p.uid)" class="chip">已加入</span>
        </button>
      </section>
    </div>
  </div>
</template>
