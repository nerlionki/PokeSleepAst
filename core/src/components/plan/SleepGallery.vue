<script setup lang="ts">
import { gameText, sleepStyleText, t as translateUi } from '../../ui/i18n'


import clientDefaults from '../../data/client-defaults.resource'

import { computed, ref, shallowRef } from 'vue'
import { selectionList, toggleChoice, matchesChoice } from '../../calc/multiChoice'
import { specialtyHit } from '../../calc/specialty'
import { pokeHit } from '../../calc/pokeSearch'
import { storeToRefs } from 'pinia'
import { BERRIES, ISLANDS, POKEDEX, SLEEP_STYLES } from '../../calc/data'
import { resolvedSleepdex, styleKey } from '../../calc/sleep'
import { sleepReward } from '../../calc/sleepRewards'
import { usePlanStore } from '../../stores/plans'
import { useSettingsStore } from '../../stores/settings'
import { useActivities } from '../../composables/useActivities'
import { activitySleepStyles } from '../../calc/activities'
import PokeSprite from '../shared/PokeSprite.vue'
import { resetPageScroll } from '#platform/pageScroll'
const components_plan_SleepGallery_config_clientDefaults = clientDefaults.modules.components_plan_SleepGallery


const planStore = usePlanStore()
const { plan } = storeToRefs(planStore)
const { settings } = storeToRefs(useSettingsStore())
const activity = useActivities(settings, () => settings.value.island)

const islandIds = new Set(ISLANDS.map((island) => island.id))
const pokeOf = new Map(POKEDEX.map((poke) => [poke.id, poke]))
const island = ref<string[]>([settings.value.island])
const nameQuery = shallowRef(components_plan_SleepGallery_config_clientDefaults["nameQueryInitial"])
const stars = ref<number[]>([])
const view = shallowRef<'all' | 'found' | 'missing'>((components_plan_SleepGallery_config_clientDefaults["viewInitial"] as unknown as 'all' | 'found' | 'missing'))
const berryType = ref(selectionList(components_plan_SleepGallery_config_clientDefaults["berryTypeInitial"]))
const specialty = ref(selectionList(components_plan_SleepGallery_config_clientDefaults["specialtyInitial"]))
const sleepType = ref(selectionList(components_plan_SleepGallery_config_clientDefaults["sleepTypeInitial"]))
const panel = shallowRef<'none' | 'type' | 'spec' | 'sleep'>((components_plan_SleepGallery_config_clientDefaults["panelInitial"] as unknown as 'none' | 'type' | 'spec' | 'sleep'))
const page = shallowRef(components_plan_SleepGallery_config_clientDefaults["pageInitial"])
const PAGE = (components_plan_SleepGallery_config_clientDefaults["PAGE"] as 48)

const types = computed(() => [...new Set(BERRIES.map((berry) => berry.type))])
const specs = computed(() => [...new Set(POKEDEX.map((poke) => poke.specialty).filter((item) => item !== '全部'))])
const sleeps = computed(() => [...new Set(POKEDEX.map((poke) => poke.sleepType))])

const foundKeys = computed(() => new Set(resolvedSleepdex(plan.value)))

const filtered = computed(() => {
  const found = foundKeys.value
  return [...activitySleepStyles(SLEEP_STYLES, activity.context.value), ...SLEEP_STYLES.filter(style => style.limited)].filter((style) => {
    if (!islandIds.has(style.island)) return false
    if (!matchesChoice(island.value, style.island)) return false
    const poke = pokeOf.get(style.pokeId)
    if (nameQuery.value && !(poke ? pokeHit(poke, nameQuery.value, style.name) : false)) return false
    if (stars.value.length && !stars.value.includes(style.stars)) return false
    const key = styleKey(style.pokeId, style.stars, style.styleId)
    if (view.value === 'found' && !found.has(key)) return false
    if (view.value === 'missing' && found.has(key)) return false
    if (!matchesChoice(berryType.value, poke?.berryType)) return false
    if (specialty.value.length && !specialty.value.some(value => specialtyHit(poke?.specialty ?? '', value))) return false
    if (!matchesChoice(sleepType.value, style.sleepType)) return false
    return true
  })
})

const pages = computed(() => Math.max(1, Math.ceil(filtered.value.length / PAGE)))
const slice = computed(() => {
  const start = Math.min(page.value, pages.value - 1) * PAGE
  return filtered.value.slice(start, start + PAGE)
})

function islandName(id: string) {
  return ISLANDS.find((item) => item.id === id)?.name ?? id
}

function found(style: { pokeId: number, stars: number, styleId?: number }) {
  return foundKeys.value.has(styleKey(style.pokeId, style.stars, style.styleId))
}

function setName(value: string) {
  nameQuery.value = value
  resetPage()
}

function resetPage() {
  page.value = 0
  resetPageScroll()
}

function pickIsland(id: string) {
  if (id === 'all') island.value = []
  else toggleChoice(island.value, id, ISLANDS.map(item => item.id))
  resetPage()
}

function invert() {
  view.value = view.value === 'missing' ? 'all' : 'missing'
  resetPage()
}

function togglePanel(which: typeof panel.value) {
  panel.value = panel.value === which ? 'none' : which
}

function pickChip(which: 'type' | 'spec' | 'sleep', value: string) {
  const current = which === 'type' ? berryType : which === 'spec' ? specialty : sleepType
  toggleChoice(current.value, value, which === 'type' ? types.value : which === 'spec' ? specs.value : sleeps.value)
  resetPage()
}
function resetFilters() { nameQuery.value = ''; berryType.value = []; specialty.value = []; sleepType.value = []; island.value = [settings.value.island]; stars.value = []; view.value = 'all'; panel.value = 'none'; resetPage() }
</script>

<template>
  <div class="stack">
    <article class="card stack">
      <h3>{{ translateUi("睡姿图鉴墙") }}</h3>
      <p class="muted">{{ translateUi("用图鉴立绘铺成照片墙，不抓取游戏内睡姿照片。默认每一张都已选中，表示这些睡姿都收集过。点卡片可以取消或重新选中。反选后，亮着的都是还没收集到的睡姿。") }}</p>
    </article>
    <div class="field">
      <label>{{ translateUi("地图") }}</label>
      <div class="picker-opts"><button type="button" :class="{ on: !island.length }" @click="pickIsland('all')">{{ translateUi("全部地图") }}</button><button v-for="item in ISLANDS" :key="item.id" type="button" :class="{ on: island.includes(item.id) }" @click="pickIsland(item.id)">{{ gameText(item.name) }}</button></div>
    </div>
    <div class="field">
      <label>{{ translateUi("宝可梦") }}</label>
      <div class="row gallery-search"><input :value="nameQuery" :placeholder="translateUi('宝可梦名称')" @input="setName(($event.target as HTMLInputElement).value)"><button class="btn ghost" type="button" @click="resetFilters">{{ translateUi("重置") }}</button></div>
    </div>
    <div class="seg seg-4">
      <button type="button" :class="{ on: !stars.length }" @click="stars = []; resetPage()">{{ translateUi("全部星") }}</button>
      <button v-for="n in 5" :key="n" type="button" :class="{ on: stars.includes(n) }" @click="toggleChoice(stars, n, [1, 2, 3, 4, 5]); resetPage()">★{{ n }}</button>
    </div>
    <div class="seg seg-3">
      <button type="button" :class="{ on: view === 'all' }" @click="view = 'all'; resetPage()">{{ translateUi("全部") }}</button>
      <button type="button" :class="{ on: view === 'found' }" @click="view = 'found'; resetPage()">{{ translateUi("已发现") }}</button>
      <button type="button" :class="{ on: view === 'missing' }" @click="invert">{{ translateUi("反选") }}</button>
    </div>
    <div class="picker-filters">
      <button type="button" :class="{ on: panel === 'type' || berryType.length > 0 }" @click="togglePanel('type')">{{ translateUi("属性") }}</button>
      <button type="button" :class="{ on: panel === 'spec' || specialty.length > 0 }" @click="togglePanel('spec')">{{ translateUi("类型") }}</button>
      <button type="button" :class="{ on: panel === 'sleep' || sleepType.length > 0 }" @click="togglePanel('sleep')">{{ translateUi("睡眠类型") }}</button>
    </div>
    <div v-if="panel === 'type'" class="picker-opts">
      <button type="button" :class="{ on: !berryType.length }" @click="pickChip('type', '全部')">{{ translateUi("全部") }}</button>
      <button v-for="item in types" :key="item" type="button" :class="{ on: berryType.includes(item) }" @click="pickChip('type', item)">{{ gameText(item) }}</button>
    </div>
    <div v-else-if="panel === 'spec'" class="picker-opts">
      <button type="button" :class="{ on: !specialty.length }" @click="pickChip('spec', '全部')">{{ translateUi("全部") }}</button>
      <button v-for="item in specs" :key="item" type="button" :class="{ on: specialty.includes(item) }" @click="pickChip('spec', item)">{{ gameText(item) }}</button>
    </div>
    <div v-else-if="panel === 'sleep'" class="picker-opts">
      <button type="button" :class="{ on: !sleepType.length }" @click="pickChip('sleep', '全部')">{{ translateUi("全部") }}</button>
      <button v-for="item in sleeps" :key="item" type="button" :class="{ on: sleepType.includes(item) }" @click="pickChip('sleep', item)">{{ gameText(item) }}</button>
    </div>
    <p v-if="view === 'missing'" class="muted">{{ translateUi("当前选中的是还没有收集到的睡姿。") }}</p>
    <p class="muted">{{ filtered.length }} {{ translateUi("个睡姿 · 第") }} {{ Math.min(page + 1, pages) }}/{{ pages }} {{ translateUi("页") }}</p>
    <div class="style-wall">
      <button
        v-for="style in slice"
        :key="style.id"
        type="button"
        class="style-card"
        :class="{ on: view === 'missing' ? !found(style) : found(style) }"
        @click="planStore.toggleStyle(styleKey(style.pokeId, style.stars, style.styleId))"
      >
        <PokeSprite :id="style.pokeId" :name="style.name" />
        <strong>{{ gameText(style.name) }}</strong>
        <span>★{{ style.stars }}{{ style.styleName ? ` · ${sleepStyleText(style)}` : '' }}</span>
        <span v-if="sleepReward(style)" class="style-rewards">EXP {{ sleepReward(style)?.researchExp }} {{ translateUi("· 梦碎") }} {{ sleepReward(style)?.shards }} {{ translateUi("· 糖果") }} {{ sleepReward(style)?.candy }}</span>
        <em v-if="style.limited" class="amber">{{ translateUi("活动限定睡姿") }}</em>
        <em>{{ islandName(style.island) }}</em>
      </button>
    </div>
    <div class="row">
      <button class="btn ghost" type="button" :disabled="page <= 0" @click="page -= 1">{{ translateUi("上一页") }}</button>
      <button class="btn ghost" type="button" :disabled="page >= pages - 1" @click="page += 1">{{ translateUi("下一页") }}</button>
    </div>
  </div>
</template>

<style scoped>
.gallery-search { flex-wrap: nowrap; }
.gallery-search > input { flex: 1; min-width: 0; width: 0; }
.gallery-search > button { flex-shrink: 0; }
</style>
