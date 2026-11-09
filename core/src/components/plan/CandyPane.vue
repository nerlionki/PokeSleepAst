<script setup lang="ts">
import { t as translateUi, gameText } from '../../ui/i18n'
import { INPUT_RANGES } from '../../calc/inputRanges'
const INPUT_LIMITS = INPUT_RANGES.CandyPane

import { confirmRemoval } from '#platform/confirm'
import clientDefaults from '../../data/client-defaults.resource'

import FormField from '../shared/FormField.vue'
import { useCandyViewport } from '#platform/candyViewport'
import { newUid } from '../../calc/uid'
import { computed, ref, shallowRef } from 'vue'
import { storeToRefs } from 'pinia'
import { boxLabel } from '../../calc/boxFilter'
import { pokeById } from '../../calc/data'
import { CANDY_BOOSTS, CANDY_PRESETS, CANDY_PLANNING_ACTIVITY, candyBoostPolicy, candyRowFromBox, evolutionLevels, familyOf, planCandy, type CandyBoostId, type CandyRow } from '../../calc/candyPlan'
import { useBoxStore } from '../../stores/box'
import { usePlanStore } from '../../stores/plans'
import type { BoxPokemon } from '../../types'
import PokePicker from '../shared/PokePicker.vue'
import PokeSprite from '../shared/PokeSprite.vue'
const components_plan_CandyPane_config_clientDefaults = clientDefaults.modules.components_plan_CandyPane
const candyViewport = useCandyViewport()


const planStore = usePlanStore()
const { plan } = storeToRefs(planStore)
const box = useBoxStore()
const mode = shallowRef<Exclude<CandyBoostId, 'normal'>>(components_plan_CandyPane_config_clientDefaults.modeInitial === 'mini' ? 'mini' : 'christmas')
const importing = shallowRef(components_plan_CandyPane_config_clientDefaults["importingInitial"])
const imported = ref(new Set<string>())
const expandedRows = ref(new Set<string>())
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
  normal: planCandy(plan.value.candyRows, plan.value.candyStocks, 'normal', CANDY_PLANNING_ACTIVITY),
  christmas: planCandy(plan.value.candyRows, plan.value.candyStocks, 'christmas', CANDY_PLANNING_ACTIVITY),
  mini: planCandy(plan.value.candyRows, plan.value.candyStocks, 'mini', CANDY_PLANNING_ACTIVITY),
}))
const active = computed(() => plans.value[mode.value])
const boost = computed(() => candyBoostPolicy(mode.value, CANDY_PLANNING_ACTIVITY))

function addRow() {
  const id = newUid()
  plan.value.candyRows.push({
    id,
    pokeId: 1,
    method: 'target',
    start: 1,
    target: 30,
    use: 50,
    useAll: false,
    nature: 'flat',
    remaining: null,
  })
  expandedRows.value.add(id)
}

async function removeRow(id: string) {
  if (!await confirmRemoval('确认删除此糖果规划？')) return
  plan.value.candyRows = plan.value.candyRows.filter((row) => row.id !== id)
  expandedRows.value.delete(id)
}

function toggleRow(id: string) {
  if (expandedRows.value.has(id)) expandedRows.value.delete(id)
  else expandedRows.value.add(id)
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

function missingOf(index: number) {
  const result = active.value.results[index]
  if (!result || result.error) return statusOf(index)
  return `缺糖 ${result.missing.toLocaleString('zh-CN')} 颗`
}

const presets = CANDY_PRESETS
</script>

<template>
  <div class="stack candy-pane">
    <div class="stack candy-context">
    <p class="muted">{{ translateUi("同一进化家族共用当前糖果，按行顺序扣。普通培养经验 ×") }}{{ CANDY_BOOSTS.normal.exp }}{{ translateUi("、梦碎 ×") }}{{ CANDY_BOOSTS.normal.shards }}{{ translateUi("，无增强额度限制。大型增强经验 ×") }}{{ CANDY_BOOSTS.christmas.exp }}{{ translateUi("、梦碎 ×") }}{{ CANDY_BOOSTS.christmas.shards }}{{ translateUi("、额度") }} {{ CANDY_BOOSTS.christmas.quota.toLocaleString('zh-CN') }}{{ translateUi("。迷你增强经验 ×") }}{{ CANDY_BOOSTS.mini.exp }}{{ translateUi("、梦碎 ×") }}{{ CANDY_BOOSTS.mini.shards }}{{ translateUi("、额度") }} {{ CANDY_BOOSTS.mini.quota.toLocaleString('zh-CN') }}{{ translateUi("。随时可规划，不受活动日期限制，不含睡眠经验。") }}</p>
    <div class="seg">
      <button type="button" :class="{ on: mode === 'christmas' }" @click="mode = 'christmas'">{{ translateUi("大型增强") }}</button>
        <button type="button" :class="{ on: mode === 'mini' }" @click="mode = 'mini'">{{ translateUi("迷你增强") }}</button>
    </div>
    </div>
    <div class="stack candy-workspace" :style="candyViewport">
    <div class="stack candy-toolbar">
    <div class="candy-boost-stats">
      <article class="card candy-boost-stat">
        <p class="muted">{{ translateUi("普通培养") }}</p>
        <p>{{ plans.normal.candies.toLocaleString('zh-CN') }} {{ translateUi("颗") }}</p>
        <p>{{ translateUi("梦碎") }} {{ plans.normal.shards.toLocaleString('zh-CN') }}</p>
      </article>
      <article class="card candy-boost-stat">
        <p class="muted">{{ translateUi("大型增强") }}</p>
        <p>{{ plans.christmas.candies.toLocaleString('zh-CN') }} / {{ CANDY_BOOSTS.christmas.quota.toLocaleString('zh-CN') }} {{ translateUi("颗") }}</p>
        <p>{{ translateUi("梦碎") }} {{ plans.christmas.shards.toLocaleString('zh-CN') }}</p>
      </article>
      <article class="card candy-boost-stat">
        <p class="muted">{{ translateUi("迷你增强") }}</p>
        <p>{{ plans.mini.candies.toLocaleString('zh-CN') }} / {{ plans.mini.quota.toLocaleString('zh-CN') }} {{ translateUi("颗") }}</p>
        <p>{{ translateUi("梦碎") }} {{ plans.mini.shards.toLocaleString('zh-CN') }}</p>
      </article>
    </div>
    <p v-if="active.over" class="amber">{{ translateUi("超出") }}{{ translateUi(boost.name) }}{{ translateUi("额度") }} {{ active.over.toLocaleString('zh-CN') }} {{ translateUi("颗") }}</p>
    <p v-if="active.missing" class="amber">{{ translateUi("缺糖") }} {{ active.missing.toLocaleString('zh-CN') }} {{ translateUi("颗") }}</p>
    <div class="row">
      <button class="btn" type="button" @click="addRow">{{ translateUi("新增宝可梦") }}</button>
      <button class="btn" type="button" :disabled="!box.pokemon.length" @click="openImport">{{ translateUi("从 Box 导入") }}</button>
    </div>
    </div>
    <div class="stack candy-list" :aria-label="translateUi('糖果增强宝可梦列表')" tabindex="0">
    <article v-for="(row, index) in plan.candyRows" :key="row.id" class="card stack">
      <div class="candy-row-top">
        <template v-if="expandedRows.has(row.id)">
          <span class="muted">{{ index + 1 }}</span>
          <PokePicker v-model="row.pokeId" class="candy-row-picker" />
        </template>
        <template v-else>
          <PokeSprite :id="row.pokeId" :name="pokeById(row.pokeId)?.name" large />
          <strong class="candy-missing" :class="{ amber: active.results[index]?.missing || active.results[index]?.error }">{{ missingOf(index) }}</strong>
        </template>
        <button
          class="candy-info-toggle"
          :class="{ on: expandedRows.has(row.id) }"
          type="button"
          :aria-expanded="expandedRows.has(row.id)"
          :aria-label="expandedRows.has(row.id) ? translateUi('收起糖果规划') : translateUi('查看糖果规划详情')"
          :title="expandedRows.has(row.id) ? translateUi('收起糖果规划') : translateUi('查看糖果规划详情')"
          @click="toggleRow(row.id)"
        >{{ expandedRows.has(row.id) ? translateUi("收起") : translateUi("详情") }}</button>
      </div>
      <template v-if="expandedRows.has(row.id)">
      <div class="row">
        <FormField v-slot="{ id }" :label="translateUi('当前糖果')"><input :id="id" :value="stockOf(row.pokeId)" type="number" :min="INPUT_LIMITS.stockOf_row_pokeId.min" @change="setStock(row.pokeId, Number(($event.target as HTMLInputElement).value))"></FormField>
        <FormField v-slot="{ id }" :label="translateUi('输入方式')"><select :id="id" v-model="row.method">
            <option value="target">{{ translateUi("目标等级") }}</option>
            <option value="manual">{{ translateUi("指定糖果") }}</option>
          </select></FormField>
      </div>
      <div class="row">
        <FormField v-slot="{ id }" :label="translateUi('当前等级')"><input :id="id" v-model.number="row.start" type="number" :min="INPUT_LIMITS.row_start.min" :max="INPUT_LIMITS.row_start.max"></FormField>
        <div v-if="row.method === 'target'" class="field">
          <label>{{ translateUi("目标等级") }}</label>
          <input v-model.number="row.target" type="number" :min="INPUT_LIMITS.row_target.min" :max="INPUT_LIMITS.row_target.max">
        </div>
        <div v-else class="field">
          <label>{{ translateUi("使用糖果") }}</label>
          <input v-model.number="row.use" type="number" :min="INPUT_LIMITS.row_use.min" :disabled="row.useAll">
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
        >{{ translateUi("进化") }} {{ lv }}</button>
      </div>
      <label v-else class="row"><input v-model="row.useAll" type="checkbox"> {{ translateUi("用光当前剩余糖果") }}</label>
      <div class="row">
        <FormField v-slot="{ id }" :label="translateUi('经验修正')"><select :id="id" v-model="row.nature">
            <option value="flat">{{ translateUi("无修正") }}</option>
            <option value="up">+EXP</option>
            <option value="down">−EXP</option>
          </select></FormField>
        <FormField v-slot="{ id }" :label="translateUi('升级还需 EXP')"><input :id="id"
            :value="row.remaining ?? ''"
            type="number"
            :min="INPUT_LIMITS.row_remaining.min"
            :placeholder="translateUi('留空＝刚到本级')"
            @change="setRemaining(row, ($event.target as HTMLInputElement).value)"
          ></FormField>
      </div>
      <p v-if="active.results[index] && !active.results[index].error">
        {{ translateUi("使用") }} {{ active.results[index].candies.toLocaleString('zh-CN') }} {{ translateUi("颗 · 梦碎") }} {{ active.results[index].shards.toLocaleString('zh-CN') }}
        {{ translateUi("· 到 Lv.") }}{{ active.results[index].level }}
      </p>
      <p :class="active.results[index]?.error || active.results[index]?.missing ? 'amber' : 'muted'">{{ statusOf(index) }}</p>
      <div class="row">
        <button class="btn ghost" type="button" :disabled="index === 0" @click="moveRow(index, -1)">{{ translateUi("上移") }}</button>
        <button class="btn ghost" type="button" :disabled="index === plan.candyRows.length - 1" @click="moveRow(index, 1)">{{ translateUi("下移") }}</button>
        <button class="btn ghost" type="button" @click="removeRow(row.id)">{{ translateUi("删除") }}</button>
      </div>
      </template>
    </article>
    <p v-if="!plan.candyRows.length" class="muted">{{ translateUi("新增宝可梦，填写目标等级或要花的糖果。") }}</p>
    </div>
    </div>
    <div v-if="importing" v-back="() => { importing = false }" class="overlay" @click.self="importing = false">
      <section class="sheet stack">
        <div class="row">
          <h3>{{ translateUi("从 Box 导入") }}</h3>
          <button class="btn ghost" type="button" @click="importing = false">{{ translateUi("完成") }}</button>
        </div>
        <p class="muted">{{ translateUi("带入等级、经验性格和升级还需 EXP，目标等级默认下一档。可连续点选多只。") }}</p>
        <button v-for="p in boxList" :key="p.uid" class="data-row" type="button" @click="importFromBox(p)">
          <PokeSprite :id="p.pokeId" :name="boxLabel(p)" :shiny="p.shiny" :ribbon-hours="p.tune?.ribbonHours" />
          <span>{{ boxLabel(p) }} Lv.{{ p.level }} · {{ gameText(p.nature) }}</span>
          <span v-if="imported.has(p.uid)" class="chip">{{ translateUi("已加入") }}</span>
        </button>
      </section>
    </div>
  </div>
</template>

<style scoped>
.candy-workspace { height: var(--candy-frame-height, calc(100vh - 12px)); height: var(--candy-frame-height, calc(100dvh - 12px)); min-height: 0; display: flex; flex-direction: column; }
.candy-context, .candy-toolbar { flex: 0 0 auto; }
.candy-toolbar { position: sticky; top: var(--candy-sticky-top, 0px); z-index: 4; background: var(--ink); }
.candy-list { flex: 1; min-height: 0; overflow-y: auto; overflow-x: hidden; align-content: start; overscroll-behavior-y: contain; padding: 2px; }
.candy-boost-stats { display: flex; flex-wrap: nowrap; align-items: stretch; gap: 10px; min-width: 0; }
.candy-boost-stat { display: flex; flex-direction: column; flex: 1 1 0; min-width: 0; gap: 4px; padding: 10px; font-size: var(--font-12); overflow-wrap: anywhere; }
.candy-boost-stat p { margin: 0; }
.candy-row-top { display: flex; align-items: center; gap: 8px; min-width: 0; }
.candy-row-picker, .candy-missing { flex: 1; min-width: 0; }
.candy-info-toggle { display: inline-flex; align-items: center; justify-content: center; flex: 0 0 auto; min-width: 44px; height: 44px; margin: 0; padding: 0 10px; border: 1px solid var(--line); border-radius: 8px; background: transparent; color: var(--text); font: inherit; font-size: var(--font-12); line-height: 1; white-space: nowrap; }
.candy-info-toggle.on { border-color: var(--amber); color: var(--amber); }
.candy-info-toggle:focus-visible { outline: 2px solid var(--sage); outline-offset: 2px; }
</style>
