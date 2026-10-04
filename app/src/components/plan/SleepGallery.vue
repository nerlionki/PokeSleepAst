<script setup lang="ts">
import { computed, shallowRef } from 'vue'
import { pokeHit } from '../../calc/pokeSearch'
import { storeToRefs } from 'pinia'
import { BERRIES, ISLANDS, POKEDEX, SLEEP_STYLES } from '../../calc/data'
import { resolvedSleepdex, styleKey } from '../../calc/sleep'
import { usePlanStore } from '../../stores/plans'
import { useSettingsStore } from '../../stores/settings'
import type { IslandId } from '../../types'
import PokeSprite from '../shared/PokeSprite.vue'

const planStore = usePlanStore()
const { plan } = storeToRefs(planStore)
const { settings } = storeToRefs(useSettingsStore())

const islandIds = new Set(ISLANDS.map((island) => island.id))
const pokeOf = new Map(POKEDEX.map((poke) => [poke.id, poke]))
const island = shallowRef<IslandId | 'all'>(settings.value.island)
const nameQuery = shallowRef('')
const stars = shallowRef(0)
const view = shallowRef<'all' | 'found' | 'missing'>('all')
const berryType = shallowRef('')
const specialty = shallowRef('')
const sleepType = shallowRef('')
const panel = shallowRef<'none' | 'type' | 'spec' | 'sleep'>('none')
const page = shallowRef(0)
const PAGE = 48

const types = computed(() => [...new Set(BERRIES.map((berry) => berry.type))])
const specs = computed(() => [...new Set(POKEDEX.map((poke) => poke.specialty).filter((item) => item !== '全部'))])
const sleeps = computed(() => [...new Set(POKEDEX.map((poke) => poke.sleepType))])

const foundKeys = computed(() => new Set(resolvedSleepdex(plan.value)))

const filtered = computed(() => {
  const found = foundKeys.value
  return SLEEP_STYLES.filter((style) => {
    if (!islandIds.has(style.island)) return false
    if (island.value !== 'all' && style.island !== island.value) return false
    const poke = pokeOf.get(style.pokeId)
    if (nameQuery.value && !(poke ? pokeHit(poke, nameQuery.value, style.name) : false)) return false
    if (stars.value && style.stars !== stars.value) return false
    const key = styleKey(style.pokeId, style.stars, style.styleId)
    if (view.value === 'found' && !found.has(key)) return false
    if (view.value === 'missing' && found.has(key)) return false
    if (berryType.value && poke?.berryType !== berryType.value) return false
    if (specialty.value && poke?.specialty !== specialty.value) return false
    if (sleepType.value && style.sleepType !== sleepType.value) return false
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
}

function pickIsland(id: IslandId | 'all') {
  island.value = id
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
  current.value = current.value === value ? '' : value
  resetPage()
}
</script>

<template>
  <div class="stack">
    <article class="card stack">
      <h3>睡姿图鉴墙</h3>
      <p class="muted">用图鉴立绘铺成照片墙，不抓取游戏内睡姿照片。默认每一张都已选中，表示这些睡姿都收集过。点卡片可以取消或重新选中。反选后，亮着的都是还没收集到的睡姿。</p>
    </article>
    <div class="field">
      <label>地图</label>
      <select :value="island" @change="pickIsland(($event.target as HTMLSelectElement).value as IslandId | 'all')">
        <option value="all">全部地图</option>
        <option v-for="item in ISLANDS" :key="item.id" :value="item.id">{{ item.name }}</option>
      </select>
    </div>
    <div class="field">
      <label>种族</label>
      <input :value="nameQuery" placeholder="宝可梦名称" @input="setName(($event.target as HTMLInputElement).value)">
    </div>
    <div class="seg">
      <button type="button" :class="{ on: stars === 0 }" @click="stars = 0; resetPage()">全部星</button>
      <button v-for="n in 5" :key="n" type="button" :class="{ on: stars === n }" @click="stars = n; resetPage()">★{{ n }}</button>
    </div>
    <div class="seg">
      <button type="button" :class="{ on: view === 'all' }" @click="view = 'all'; resetPage()">全部</button>
      <button type="button" :class="{ on: view === 'found' }" @click="view = 'found'; resetPage()">已发现</button>
      <button type="button" :class="{ on: view === 'missing' }" @click="invert">反选</button>
    </div>
    <div class="picker-filters">
      <button type="button" :class="{ on: panel === 'type' || berryType }" @click="togglePanel('type')">属性</button>
      <button type="button" :class="{ on: panel === 'spec' || specialty }" @click="togglePanel('spec')">类型</button>
      <button type="button" :class="{ on: panel === 'sleep' || sleepType }" @click="togglePanel('sleep')">睡眠类型</button>
    </div>
    <div v-if="panel === 'type'" class="picker-opts">
      <button v-for="item in types" :key="item" type="button" :class="{ on: berryType === item }" @click="pickChip('type', item)">{{ item }}</button>
    </div>
    <div v-else-if="panel === 'spec'" class="picker-opts">
      <button v-for="item in specs" :key="item" type="button" :class="{ on: specialty === item }" @click="pickChip('spec', item)">{{ item }}</button>
    </div>
    <div v-else-if="panel === 'sleep'" class="picker-opts">
      <button v-for="item in sleeps" :key="item" type="button" :class="{ on: sleepType === item }" @click="pickChip('sleep', item)">{{ item }}</button>
    </div>
    <p v-if="view === 'missing'" class="muted">当前选中的是还没有收集到的睡姿。</p>
    <p class="muted">{{ filtered.length }} 个睡姿 · 第 {{ Math.min(page + 1, pages) }}/{{ pages }} 页</p>
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
        <strong>{{ style.name }}</strong>
        <span>★{{ style.stars }}{{ style.styleName ? ` · ${style.styleName}` : '' }}</span>
        <em v-if="style.limited" class="amber">活动限定睡姿</em>
        <em>{{ islandName(style.island) }}</em>
      </button>
    </div>
    <div class="row">
      <button class="btn ghost" type="button" :disabled="page <= 0" @click="page -= 1">上一页</button>
      <button class="btn ghost" type="button" :disabled="page >= pages - 1" @click="page += 1">下一页</button>
    </div>
  </div>
</template>
