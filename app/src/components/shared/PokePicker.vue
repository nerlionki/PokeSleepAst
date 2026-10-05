<script setup lang="ts">
import { computed, shallowRef } from 'vue'
import { BERRIES, INGREDIENTS, POKEDEX } from '../../calc/data'
import { pokeHit } from '../../calc/pokeSearch'
import { SPECIALTY_FILTERS, specialtyHit } from '../../calc/specialty'
import BerryIcon from './BerryIcon.vue'
import PokeSprite from './PokeSprite.vue'

const model = defineModel<number>({ required: true })
const props = defineProps<{ allowedIds?: readonly number[] }>()
const allowed = computed(() => props.allowedIds ? new Set(props.allowedIds) : null)
const open = shallowRef(false)
const q = shallowRef('')
const panel = shallowRef<'none' | 'spec' | 'type' | 'sleep' | 'ing'>('none')
const spec = shallowRef('')
const type = shallowRef('')
const sleep = shallowRef('')
const ing = shallowRef('')

const specs = ['全部', ...SPECIALTY_FILTERS]
const types = computed(() => [...new Set(BERRIES.map((b) => b.type))])
const sleeps = computed(() => [...new Set(POKEDEX.map((p) => p.sleepType))])

const current = computed(() => POKEDEX.find((p) => p.id === model.value) ?? POKEDEX[0]!)

const list = computed(() => POKEDEX.filter((p) => {
  if (allowed.value && !allowed.value.has(p.id)) return false
  if (!specialtyHit(p.specialty, spec.value)) return false
  if (type.value && p.berryType !== type.value) return false
  if (sleep.value && p.sleepType !== sleep.value) return false
  if (ing.value && !p.ingredients.some((x) => x.name === ing.value)) return false
  const extra = [p.berryType, p.berry, p.specialty, p.sleepType, ...p.ingredients.map((x) => x.name)].join(' ')
  return pokeHit(p, q.value, extra)
}))

function pick(id: number) {
  model.value = id
  open.value = false
}

function toggle(which: typeof panel.value) {
  panel.value = panel.value === which ? 'none' : which
}

function clearFilters() {
  spec.value = ''
  type.value = ''
  sleep.value = ''
  ing.value = ''
  q.value = ''
  panel.value = 'none'
}

const filterOn = computed(() => Boolean(spec.value || type.value || sleep.value || ing.value))
</script>

<template>
  <div>
    <button class="poke-pick" type="button" @click="open = true">
      <PokeSprite :id="current.id" :name="current.name" />
      <div class="poke-pick-txt">
        <strong>{{ current.name }}</strong>
        <span class="muted berry-name">#{{ current.id }} · <BerryIcon :name="current.berry" small />{{ current.berryType }}</span>
      </div>
    </button>
    <Teleport to="body">
      <div v-if="open" v-back="() => { open = false }" class="overlay picker-overlay" @click.self="open = false">
        <section class="sheet picker-sheet stack">
          <div class="row">
            <h3>选择宝可梦</h3>
            <button class="btn ghost" type="button" @click="open = false">关闭</button>
          </div>
          <input v-model="q" class="picker-search" placeholder="搜索中文、英文、属性或编号">
          <div class="picker-filters">
            <button type="button" :class="{ on: panel === 'spec' || spec }" @click="toggle('spec')">定位</button>
            <button type="button" :class="{ on: panel === 'type' || type }" @click="toggle('type')">属性</button>
            <button type="button" :class="{ on: panel === 'sleep' || sleep }" @click="toggle('sleep')">睡眠类型</button>
            <button type="button" :class="{ on: panel === 'ing' || ing }" @click="toggle('ing')">食材</button>
            <button type="button" class="ghost" @click="clearFilters">清空筛选</button>
          </div>
          <div v-if="panel === 'spec'" class="picker-opts">
            <button v-for="s in specs" :key="s" type="button" :class="{ on: s === '全部' ? !spec : spec === s }" @click="spec = s === '全部' || spec === s ? '' : s">{{ s }}</button>
          </div>
          <div v-else-if="panel === 'type'" class="picker-opts">
            <button v-for="t in types" :key="t" type="button" :class="{ on: type === t }" @click="type = type === t ? '' : t">{{ t }}</button>
          </div>
          <div v-else-if="panel === 'sleep'" class="picker-opts">
            <button v-for="s in sleeps" :key="s" type="button" :class="{ on: sleep === s }" @click="sleep = sleep === s ? '' : s">{{ s }}</button>
          </div>
          <div v-else-if="panel === 'ing'" class="picker-opts">
            <button v-for="i in INGREDIENTS" :key="i.id" type="button" :class="{ on: ing === i.name }" @click="ing = ing === i.name ? '' : i.name">{{ i.name }}</button>
          </div>
          <p class="muted">{{ list.length }} 只宝可梦{{ filterOn ? ' · 已筛选' : ' · 食材按可携带种类筛选' }}</p>
          <div class="poke-grid">
            <button v-for="p in list" :key="p.id + p.name" type="button" class="poke-cell" :class="{ on: p.id === model }" @click="pick(p.id)">
              <PokeSprite :id="p.id" :name="p.name" />
              <span>{{ p.name }}</span>
              <em class="berry-name"><BerryIcon :name="p.berry" small />{{ p.berryType }}</em>
            </button>
          </div>
          <p class="muted">超梦等部分种类若缺定位/食材，对应筛选不会命中。</p>
        </section>
      </div>
    </Teleport>
  </div>
</template>
