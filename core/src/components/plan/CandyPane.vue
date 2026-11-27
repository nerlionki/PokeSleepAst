<script setup lang="ts">
import { useListScroll } from '../../composables/useListScroll'
const candyScroll = useListScroll('candy')
import { t as translateUi, gameText } from '../../ui/i18n'

import { confirmRemoval } from '#platform/confirm'
import clientDefaults from '../../data/client-defaults.resource'

import Dialog from '#platform/Dialog.vue'
import CandyRowFields from './CandyRowFields.vue'
import { newUid } from '../../calc/uid'
import { computed, ref, shallowRef } from 'vue'
import { storeToRefs } from 'pinia'
import { boxLabel } from '../../calc/boxFilter'
import { pokeById } from '../../calc/data'
import { CANDY_BOOSTS, CANDY_PLANNING_ACTIVITY, candyBoostPolicy, candyRowFromBox, familyOf, planCandy, type CandyBoostId, type CandyRow } from '../../calc/candyPlan'
import { useBoxStore } from '../../stores/box'
import { usePlanStore } from '../../stores/plans'
import type { BoxPokemon } from '../../types'
import PokePicker from '#platform/PokePicker.vue'
import PokeSprite from '../shared/PokeSprite.vue'
const components_plan_CandyPane_config_clientDefaults = clientDefaults.modules.components_plan_CandyPane


const planStore = usePlanStore()
const { plan } = storeToRefs(planStore)
const box = useBoxStore()
const mode = shallowRef<Exclude<CandyBoostId, 'normal'>>(components_plan_CandyPane_config_clientDefaults.modeInitial === 'mini' ? 'mini' : 'christmas')
const importing = shallowRef(components_plan_CandyPane_config_clientDefaults["importingInitial"])
const imported = ref(new Set<string>())
const expandedRows = ref(new Set<string>())
const draft = ref<CandyRow | null>(null)
const draftStocks = ref<Partial<Record<string, number>>>({})
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
  draftStocks.value = {}
  draft.value = {
    id: newUid(),
    pokeId: 1,
    method: 'target',
    start: 1,
    target: 30,
    use: 50,
    useAll: false,
    nature: 'flat',
    remaining: null,
  }
}

function saveRow() {
  const row = draft.value
  if (!row) return
  const stock = draftStocks.value[familyOf(row.pokeId)]
  if (stock != null) setStock(row.pokeId, stock)
  plan.value.candyRows.push(row)
  expandedRows.value.add(row.id)
  draft.value = null
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
function statusOf(index: number) {
  const row = active.value.results[index]
  if (!row || row.error) return row?.error ?? '待计算'
  if (row.missing) return translateUi('缺糖 {count} 颗', { count: row.missing.toLocaleString('zh-CN') })
  if (row.unused) return translateUi('{count} 颗未用完', { count: row.unused.toLocaleString('zh-CN') })
  return '充足'
}

function missingOf(index: number) {
  const result = active.value.results[index]
  if (!result || result.error) return statusOf(index)
  return translateUi('缺糖 {count} 颗', { count: result.missing.toLocaleString('zh-CN') })
}

</script>

<template>
  <div class="stack candy-pane">
    <div class="seg">
      <button type="button" :class="{ on: mode === 'christmas' }" @click="mode = 'christmas'">{{ translateUi("大型增强") }}</button>
        <button type="button" :class="{ on: mode === 'mini' }" @click="mode = 'mini'">{{ translateUi("迷你增强") }}</button>
    </div>
    <div class="stack candy-workspace">
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
      <button class="btn" type="button" aria-haspopup="dialog" @click="addRow">{{ translateUi("新增宝可梦") }}</button>
      <button class="btn" type="button" :disabled="!box.pokemon.length" @click="openImport">{{ translateUi("从 Box 导入") }}</button>
    </div>
    </div>
    <div ref="scrollArea" class="stack candy-list" @scroll="candyScroll.trackListScroll" :aria-label="translateUi('糖果增强宝可梦列表')" tabindex="0">
    <article v-for="(row, index) in plan.candyRows" :key="row.id" class="card stack" :class="{ 'candy-row-collapsed': !expandedRows.has(row.id) }">
      <div class="candy-row-top">
        <template v-if="expandedRows.has(row.id)">
          <span class="muted">{{ index + 1 }}</span>
          <PokePicker v-model="row.pokeId" class="candy-row-picker" />
        </template>
        <template v-else>
          <PokeSprite :id="row.pokeId" :name="pokeById(row.pokeId)?.name" />
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
      <CandyRowFields :row="row" :stock="stockOf(row.pokeId)" @stock="setStock(row.pokeId, $event)" />
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
    <Dialog v-if="draft" :title="translateUi('新增宝可梦')" @close="draft = null">
      <PokePicker v-model="draft.pokeId" />
      <CandyRowFields :row="draft" :stock="draftStocks[familyOf(draft.pokeId)] ?? stockOf(draft.pokeId)"
        @stock="draftStocks[familyOf(draft.pokeId)] = $event" />
      <template #footer>
        <button class="btn sage" type="button" @click="saveRow">{{ translateUi("完成") }}</button>
      </template>
    </Dialog>
    <Dialog v-if="importing" :title="translateUi('从 Box 导入')" @close="importing = false">
        <p class="muted">{{ translateUi("带入等级、经验性格和升级还需 EXP，目标等级默认下一档。可连续点选多只。") }}</p>
        <button v-for="p in boxList" :key="p.uid" class="data-row" type="button" @click="importFromBox(p)">
          <PokeSprite :id="p.pokeId" :name="boxLabel(p)" :shiny="p.shiny" :ribbon-hours="p.tune?.ribbonHours" />
          <span>{{ boxLabel(p) }} Lv.{{ p.level }} · {{ gameText(p.nature) }}</span>
          <span v-if="imported.has(p.uid)" class="chip">{{ translateUi("已加入") }}</span>
        </button>
      <template #footer>
        <button class="btn ghost" type="button" @click="importing = false">{{ translateUi("完成") }}</button>
      </template>
    </Dialog>
  </div>
</template>

<style scoped>
.candy-pane, .candy-workspace { flex: 1; min-height: 0; display: flex; flex-direction: column; }
.candy-toolbar { flex: none; gap: 6px; }
.candy-toolbar > p { margin: 0; }
.candy-list { flex: 1; min-height: 0; overflow-y: auto; overflow-x: hidden; align-content: start; overscroll-behavior-y: contain; padding: 2px; }
.candy-boost-stats { display: flex; flex-wrap: nowrap; align-items: stretch; gap: 10px; min-width: 0; }
.candy-boost-stat { display: flex; flex-direction: column; flex: 1 1 0; min-width: 0; gap: 4px; padding: 10px; font-size: var(--font-12); overflow-wrap: anywhere; }
.candy-boost-stat p { margin: 0; }
.candy-row-collapsed { min-height: var(--pokedex-item-height); padding: 8px 14px; align-items: center; }
.candy-row-top { display: flex; align-items: center; gap: 8px; min-width: 0; }
.candy-row-picker, .candy-missing { flex: 1; min-width: 0; }
.candy-info-toggle { display: inline-flex; align-items: center; justify-content: center; flex: 0 0 auto; min-width: 44px; height: 44px; margin: 0; padding: 0 10px; border: 1px solid var(--line); border-radius: 8px; background: transparent; color: var(--text); font: inherit; font-size: var(--font-12); line-height: 1; white-space: nowrap; }
.candy-info-toggle.on { border-color: var(--amber); color: var(--amber); }
.candy-info-toggle:focus-visible { outline: 2px solid var(--sage); outline-offset: 2px; }
</style>
