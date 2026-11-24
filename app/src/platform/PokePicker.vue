<script setup lang="ts">
import HorizontalStrip from '#platform/HorizontalStrip.vue'
import { t as translateUi, gameText } from '../../../core/src/ui/i18n'
import clientDefaults from '../../../core/src/data/client-defaults.resource'

import { computed, ref, shallowRef, watch } from 'vue'
import { BERRIES, INGREDIENTS, POKEDEX, berryByType } from '../../../core/src/calc/data'
import { selectionList, toggleChoice, matchesChoice } from '../../../core/src/calc/multiChoice'
import { pokeHit } from '../../../core/src/calc/pokeSearch'
import { compareDex } from '../../../core/src/calc/pokedexOrder'
import { SPECIALTY_FILTERS, specialtyHit } from '../../../core/src/calc/specialty'
import BerryIcon from '../../../core/src/components/shared/BerryIcon.vue'
import IngredientIcon from '../../../core/src/components/shared/IngredientIcon.vue'
import PokeSprite from '../../../core/src/components/shared/PokeSprite.vue'
const components_shared_PokePicker_config_clientDefaults = clientDefaults.modules.components_shared_PokePicker


const model = defineModel<number>({ required: true })
const props = defineProps<{ allowedIds?: readonly number[], nameOverrides?: Record<number, string> }>()
const allowed = computed(() => props.allowedIds ? new Set(props.allowedIds) : null)
const open = shallowRef(components_shared_PokePicker_config_clientDefaults["openInitial"])
const q = shallowRef(components_shared_PokePicker_config_clientDefaults["qInitial"])
const panel = shallowRef<'none' | 'spec' | 'type' | 'sleep' | 'ing'>((components_shared_PokePicker_config_clientDefaults["panelInitial"] as unknown as 'none' | 'spec' | 'type' | 'sleep' | 'ing'))
const spec = ref(selectionList(components_shared_PokePicker_config_clientDefaults["specInitial"]))
const type = ref(selectionList(components_shared_PokePicker_config_clientDefaults["typeInitial"]))
const sleep = ref(selectionList(components_shared_PokePicker_config_clientDefaults["sleepInitial"]))
const ing = ref(selectionList(components_shared_PokePicker_config_clientDefaults["ingInitial"]))

const specs = ['全部', ...SPECIALTY_FILTERS]
const types = computed(() => [...new Set(BERRIES.map((b) => b.type))])
const sleeps = computed(() => [...new Set(POKEDEX.map((p) => p.sleepType))])

const current = computed(() => POKEDEX.find((p) => p.id === model.value) ?? POKEDEX[0]!)

const list = computed<(typeof POKEDEX)[number][]>((previous) => {
  const results = POKEDEX.filter((p) => {
    if (allowed.value && !allowed.value.has(p.id)) return false
    if (spec.value.length && !spec.value.some(value => specialtyHit(p.specialty, value))) return false
    if (!matchesChoice(type.value, p.berryType)) return false
    if (!matchesChoice(sleep.value, p.sleepType)) return false
    const ingredients = p.ingredients ?? []
    if (ing.value.length && !ingredients.some((x) => ing.value.includes(String(x.id)))) return false
    const extra = [p.berryType, p.berry, p.specialty, p.sleepType, ...ingredients.map((x) => x.name)].join(' ')
    return pokeHit(p, q.value, extra)
  }).sort(compareDex)
  return previous?.length === results.length && results.every((poke, index) => poke === previous[index])
    ? previous
    : results
})

function pick(id: number) {
  model.value = id
  open.value = false
}

function toggle(which: typeof panel.value) {
  panel.value = panel.value === which ? 'none' : which
}

function clearFilters() {
  spec.value = []
  type.value = []
  sleep.value = []
  ing.value = []
  q.value = ''
  panel.value = 'none'
}

const resultsRevision = shallowRef(0)
// Keep the scroll container mounted when the parent refreshes eligible Pokémon.
watch([q, spec, type, sleep, ing], () => { resultsRevision.value++ }, { deep: true })
const filterOn = computed(() => Boolean(spec.value.length || type.value.length || sleep.value.length || ing.value.length))
</script>

<template>
  <div>
    <button class="poke-pick" type="button" @click="open = true">
      <PokeSprite :id="current.id" :name="current.name" />
      <div class="poke-pick-txt">
        <strong>{{ props.nameOverrides?.[current.id] ?? gameText(current.name) }}</strong>
        <span class="muted berry-name">#{{ current.id }} · <BerryIcon :name="current.berry" small />{{ gameText(current.berryType) }}</span>
      </div>
    </button>
    <Teleport to="body">
      <div v-if="open" v-back="() => { open = false }" @touchstart.stop @touchend.stop @touchcancel.stop class="overlay picker-overlay" @click.self="open = false">
        <section class="sheet picker-sheet">
          <header class="picker-header">
            <h3>{{ translateUi("选择宝可梦") }}</h3>
            <button class="btn ghost picker-close" type="button" @click="open = false">{{ translateUi("关闭") }}</button>
          </header>
          <div class="picker-body stack">
            <div class="picker-controls stack">
            <input v-model="q" class="picker-search" :placeholder="translateUi('搜索中文、英文、属性或编号')">
            <div class="picker-filters">
              <button type="button" :class="{ on: panel === 'spec' || spec.length > 0 }" @click="toggle('spec')">{{ translateUi("定位") }}</button>
              <button type="button" :class="{ on: panel === 'type' || type.length > 0 }" @click="toggle('type')">{{ translateUi("属性") }}</button>
              <button type="button" :class="{ on: panel === 'sleep' || sleep.length > 0 }" @click="toggle('sleep')">{{ translateUi("睡眠类型") }}</button>
              <button type="button" :class="{ on: panel === 'ing' || ing.length > 0 }" @click="toggle('ing')">{{ translateUi("食材") }}</button>
              <button type="button" class="ghost" @click="clearFilters">{{ translateUi("清空筛选") }}</button>
            </div>
            <HorizontalStrip v-if="panel === 'spec'"><div class="picker-opts">
              <button v-for="s in specs" :key="s" type="button" :class="{ on: s === '全部' ? !spec.length : spec.includes(s) }" @click="toggleChoice(spec, s, specs)">{{ s }}</button>
            </div></HorizontalStrip>
            <HorizontalStrip v-else-if="panel === 'type'"><div class="picker-opts">
              <button type="button" :class="{ on: !type.length }" @click="type = []">{{ translateUi("全部") }}</button>
              <button v-for="t in types" :key="t" type="button" :class="{ on: type.includes(t) }" @click="toggleChoice(type, t, types)">
                <BerryIcon :name="berryByType(t)?.name ?? ''" small />{{ gameText(t) }}
              </button>
            </div></HorizontalStrip>
            <HorizontalStrip v-else-if="panel === 'sleep'"><div class="picker-opts">
              <button type="button" :class="{ on: !sleep.length }" @click="sleep = []">{{ translateUi("全部") }}</button>
              <button v-for="s in sleeps" :key="s" type="button" :class="{ on: sleep.includes(s) }" @click="toggleChoice(sleep, s, sleeps)">{{ gameText(s) }}</button>
            </div></HorizontalStrip>
            <HorizontalStrip v-else-if="panel === 'ing'"><div class="picker-opts">
              <button type="button" :class="{ on: !ing.length }" @click="ing = []">{{ translateUi("全部") }}</button>
              <button v-for="i in INGREDIENTS" :key="i.id" type="button" :class="{ on: ing.includes(String(i.id)) }" @click="toggleChoice(ing, String(i.id), INGREDIENTS.map(item => String(item.id)))">
                <IngredientIcon :id="i.id" :name="i.name" small />{{ gameText(i.name) }}
              </button>
            </div></HorizontalStrip>
            <p class="muted">{{ list.length }} {{ translateUi("只宝可梦") }}{{ filterOn ? " " + translateUi("· 已筛选") : " " + translateUi("· 食材按可携带种类筛选") }}</p>
            </div>
            <div :key="resultsRevision" class="picker-results">
            <div class="poke-grid">
              <button v-for="p in list" :key="p.id + p.name" type="button" class="poke-cell" :class="{ on: p.id === model }" @click="pick(p.id)">
                <PokeSprite :id="p.id" :name="p.name" />
                <div class="poke-cell-details">
                  <span class="poke-cell-name">{{ props.nameOverrides?.[p.id] ?? gameText(p.name) }}</span>
                  <div class="berry-name poke-cell-berry"><BerryIcon :name="p.berry" small />{{ gameText(p.berryType) }}</div>
                </div>
              </button>
            </div>
            <p class="muted">{{ translateUi("超梦等部分种类若缺定位/食材，对应筛选不会命中。") }}</p>
            </div>
            </div>
          </section>
        </div>
      </Teleport>
    </div>
  </template>
