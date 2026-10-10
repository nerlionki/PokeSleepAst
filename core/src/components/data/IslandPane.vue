<script setup lang="ts">
import { computed, ref, shallowRef } from 'vue'
import { ISLANDS, type PokeRow } from '../../calc/data'
import { formatDp, islandBands, islandPokemon, islandUnlock } from '../../calc/islandMeta'
import { useSettingsStore } from '../../stores/settings'
import { textHit } from '../../calc/text'
import type { IslandId } from '../../types'
import BerryIcon from '../shared/BerryIcon.vue'
import DataRow from '../shared/DataRow.vue'
import PokeSprite from '../shared/PokeSprite.vue'

const store = useSettingsStore()
const props = defineProps<{ q: string }>()
const openId = shallowRef<IslandId | ''>('')
const view = shallowRef<'band' | 'spread'>('band')
const folded = ref(new Set<string>())

function toggleSleep(sleep: string) {
  if (folded.value.has(sleep)) folded.value.delete(sleep)
  else folded.value.add(sleep)
}

const SLEEP_ORDER = ['淺淺入夢', '安然入睡', '深深入眠', '没有特征']

const islands = computed(() => ISLANDS.filter((i) => textHit(`${i.name} ${islandUnlock(i.id as IslandId)}`, props.q)))
const pokemonOf = new Map(ISLANDS.map((i) => [i.id, islandPokemon(i.id as IslandId)]))

function groups(id: string) {
  const buckets = new Map<string, PokeRow[]>()
  for (const poke of pokemonOf.get(id) ?? []) {
    const list = buckets.get(poke.sleepType) ?? []
    list.push(poke)
    buckets.set(poke.sleepType, list)
  }
  return [...buckets.entries()].sort((a, b) => {
    const ia = SLEEP_ORDER.indexOf(a[0])
    const ib = SLEEP_ORDER.indexOf(b[0])
    return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib)
  })
}
</script>

<template>
  <div>
    <article v-for="i in islands" :key="i.id" class="acc">
      <DataRow
        :title="i.name"
        :subtitle="`${islandUnlock(i.id as IslandId)} · ${pokemonOf.get(i.id)?.length ?? 0} 种`"
        @click="openId = openId === i.id ? '' : (i.id as IslandId)"
      >
        <template #lead>
          <span class="row" style="gap: 2px">
            <BerryIcon v-for="b in i.berries.slice(0, 3)" :key="b" :name="b" />
            <span v-if="!i.berries.length" class="ing-mark sm">岛</span>
          </span>
        </template>
        <template #trail>
          <span class="data-row-chev">{{ openId === i.id ? '⌃' : '›' }}</span>
        </template>
      </DataRow>
      <div v-if="openId === i.id" class="acc-body plain">
        <label class="field">
          <span>营地加成 {{ Math.round(store.islandBonus(i.id as IslandId) * 100) }}%{{ store.settings.island === i.id ? ' · 当前营地' : '' }}</span>
          <input type="range" min="0" max="0.85" step="0.01" :value="store.islandBonus(i.id as IslandId)" @change="store.setIslandBonus(i.id as IslandId, Number(($event.target as HTMLInputElement).value))">
        </label>
        <p class="muted berry-inline">
          {{ islandUnlock(i.id as IslandId) }} · {{ i.id === 'cyanex' ? '主树果三选一' : '喜好' }}
          <template v-if="i.berries.length">
            <span v-for="b in i.berries" :key="b" class="berry-name"><BerryIcon :name="b" small />{{ b }}</span>
          </template>
          <template v-else>每周随机三颗</template>
        </p>
        <p v-if="i.id === 'cyanex'" class="muted">副树果从排除已选主树果后的其余 17 种中任选两种，不可重复。</p>
        <div class="seg">
          <button type="button" :class="{ on: view === 'band' }" @click="view = 'band'">只数</button>
          <button type="button" :class="{ on: view === 'spread' }" @click="view = 'spread'">分布</button>
        </div>
        <template v-if="view === 'band'">
          <p v-for="b in islandBands(i.id as IslandId)" :key="b.count">
            {{ b.count }} 只 · 卡比兽能量 {{ formatDp(b.min) }}{{ b.max == null ? ' 及以上' : ` – ${formatDp(b.max)}` }}
          </p>
        </template>
        <template v-else>
          <section v-for="[sleep, list] in groups(i.id)" :key="sleep" class="sleep-group">
            <h3>
              <button type="button" class="sleep-group-head" :aria-expanded="!folded.has(sleep)" @click="toggleSleep(sleep)">
                <span>{{ sleep }} · {{ list.length }}</span>
                <span class="data-row-chev">{{ folded.has(sleep) ? '›' : '⌃' }}</span>
              </button>
            </h3>
            <div v-if="!folded.has(sleep)" class="poke-wall">
              <div v-for="p in list" :key="p.id" class="poke-wall-cell">
                <PokeSprite :id="p.id" :name="p.name" />
                <span>{{ p.name }}</span>
              </div>
            </div>
          </section>
        </template>
      </div>
    </article>
  </div>
</template>
