<script setup lang="ts">
import HorizontalStrip from '#platform/HorizontalStrip.vue'
import { gameText, t as translateUi } from '../../ui/i18n'
import clientDefaults from '../../data/client-defaults.resource'

import { computed, ref, shallowRef, watch } from 'vue'
import { BERRIES, INGREDIENTS, POKEDEX } from '../../calc/data'
import { matchesChoice, toggleChoice } from '../../calc/multiChoice'
import { pokeHit } from '../../calc/pokeSearch'
import { compareDex } from '../../calc/pokedexOrder'
import { SPECIALTY_FILTERS, specialtyHit } from '../../calc/specialty'
import PokeSprite from './PokeSprite.vue'
const components_shared_SpeciesSheet_config_clientDefaults = clientDefaults.modules.components_shared_SpeciesSheet


const emit = defineEmits<{ pick: [id: number], close: [] }>()
const q = shallowRef(components_shared_SpeciesSheet_config_clientDefaults["qInitial"])
const panels = { spec: '定位', type: '属性', sleep: '睡眠类型', ing: '食材' } as const
type Filter = keyof typeof panels
const panel = shallowRef<Filter | null>(null)
const selected = ref<Record<Filter, string[]>>({ spec: [], type: [], sleep: [], ing: [] })
const options = computed(() => ({
  spec: SPECIALTY_FILTERS,
  type: [...new Set(BERRIES.map(berry => berry.type))],
  sleep: [...new Set(POKEDEX.map(poke => poke.sleepType))],
  ing: INGREDIENTS.map(item => String(item.id))
}))
const activeOptions = computed(() => panel.value ? options.value[panel.value] : [])
const activeSelection = computed(() => panel.value ? selected.value[panel.value] : [])

const list = computed(() => {
  const { spec, type, sleep, ing } = selected.value
  return POKEDEX.filter(poke =>
    (!spec.length || spec.some(value => specialtyHit(poke.specialty, value))) &&
    matchesChoice(type, poke.berryType) &&
    matchesChoice(sleep, poke.sleepType) &&
    (!ing.length || poke.ingredients?.some(item => ing.includes(String(item.id)))) &&
    pokeHit(poke, q.value)
  ).sort(compareDex)
})

const resultsRevision = shallowRef(0)
watch([q, selected], () => { resultsRevision.value++ }, { deep: true })

function clearFilters() {
  selected.value = { spec: [], type: [], sleep: [], ing: [] }
  panel.value = null
  q.value = ''
}
</script>

<template>
  <div v-back="() => emit('close')" class="overlay" @click.self="emit('close')">
    <section class="sheet stack species-sheet">
      <div class="row species-sheet-header">
        <h3>{{ translateUi("添加宝可梦") }}</h3>
        <button class="btn ghost" type="button" @click="emit('close')">{{ translateUi("关闭") }}</button>
      </div>
      <input v-model="q" class="picker-search" :placeholder="translateUi('搜索中文、英文或编号')">
      <div class="picker-filters">
        <button
          v-for="(label, key) in panels"
          :key="key"
          type="button"
          :class="{ on: panel === key || selected[key].length > 0 }"
          @click="panel = panel === key ? null : key"
        >{{ translateUi(label) }}</button>
        <button class="ghost" type="button" @click="clearFilters">{{ translateUi("清空筛选") }}</button>
      </div>
      <HorizontalStrip v-if="panel">
        <div class="picker-opts">
          <button type="button" :class="{ on: !activeSelection.length }" @click="activeSelection.splice(0)">
            {{ translateUi("全部") }}
          </button>
          <button
            v-for="value in activeOptions"
            :key="value"
            type="button"
            :class="{ on: activeSelection.includes(value) }"
            @click="toggleChoice(activeSelection, value, activeOptions)"
          >{{ gameText(panel === 'ing' ? INGREDIENTS.find(item => String(item.id) === value)?.name : value) }}</button>
        </div>
      </HorizontalStrip>
      <div :key="resultsRevision" class="poke-wall">
        <button v-for="poke in list" :key="poke.id" type="button" class="poke-wall-cell" @click="emit('pick', poke.id)">
          <PokeSprite :id="poke.id" :name="poke.name" />
          <span>{{ gameText(poke.name) }}</span>
        </button>
      </div>
      <p v-if="!list.length" class="muted">{{ translateUi("没有匹配的宝可梦。") }}</p>
    </section>
  </div>
</template>

<style scoped>
.species-sheet-header { justify-content: space-between; align-items: center; }
.species-sheet .picker-opts { flex-wrap: nowrap; }
.species-sheet .picker-opts button { flex: none; }
</style>
