<script setup lang="ts">
import clientDefaults from '../../data/client-defaults.resource'

import { computed, shallowRef } from 'vue'
import { berryEnergySnaps, berryEnergyTable } from '../../calc/berry'
import { fixedBerryProducers } from '../../calc/precomputedProduction'
import { BERRIES } from '../../calc/data'
import { textHit } from '../../calc/text'
import BerryIcon from '../shared/BerryIcon.vue'
import DrawerSheet from '../shared/DrawerSheet.vue'
import PokeSprite from '../shared/PokeSprite.vue'
const components_data_BerryPane_config_clientDefaults = clientDefaults.modules.components_data_BerryPane


const props = defineProps<{ q: string }>()
const open = shallowRef(components_data_BerryPane_config_clientDefaults["openInitial"])

const list = computed(() => BERRIES.filter((b) => textHit(`${b.name} ${b.type}`, props.q)))
const current = computed(() => BERRIES.find((b) => b.name === open.value))
const tab = shallowRef<'energy' | 'production'>('energy')
const producers = computed(() => current.value ? fixedBerryProducers(current.value.name) : [])
function showBerry(name: string) { tab.value = 'energy'; open.value = name }
const amount = (value: number) => value.toFixed(1)
</script>

<template>
  <div class="stack">
    <div class="icon-grid">
      <button
        v-for="b in list"
        :key="b.name"
        type="button"
        class="icon-cell"
        :class="{ on: open === b.name }"
        @click="showBerry(b.name)"
      >
        <BerryIcon :name="b.name" />
        <span>{{ b.name }}</span>
      </button>
    </div>
    <DrawerSheet v-if="current" :title="current.name" @close="open = ''">
      <div class="row">
        <BerryIcon :name="current.name" large />
        <div>
          <strong>{{ current.type }}</strong>
          <p class="muted">{{ tab === 'energy' ? '1–100 级树果能量' : '每日树果总产量' }}</p>
        </div>
      </div>
      <div class="berry-detail-tabs" role="tablist" aria-label="树果详情">
        <button type="button" role="tab" :aria-selected="tab === 'energy'" :class="{ on: tab === 'energy' }" @click="tab = 'energy'">树果能量</button>
        <button type="button" role="tab" :aria-selected="tab === 'production'" :class="{ on: tab === 'production' }" @click="tab = 'production'">产量 Top 5</button>
      </div>
      <template v-if="tab === 'energy'">
      <p class="berry-snaps">
        <span v-for="s in berryEnergySnaps(current.name)" :key="s.level">Lv{{ s.level }} {{ s.energy }}</span>
      </p>
      <div class="energy-table">
        <div v-for="row in berryEnergyTable(current.name)" :key="row.level" class="energy-row">
          <span>Lv{{ row.level }}</span>
          <strong>{{ row.energy }}</strong>
        </div>
      </div>
      </template>
      <div v-else class="berry-production">
        <div v-for="(p, index) in producers" :key="`${p.id}-${p.mode}`" class="berry-producer">
          <span class="berry-producer-rank">{{ index + 1 }}</span>
          <PokeSprite :id="p.id" :name="p.name" />
          <div class="berry-producer-info">
            <strong>{{ p.name }}</strong>
          </div>
          <div class="berry-producer-output">
            <strong>{{ amount(p.total) }}<span> 颗/日</span></strong>
          </div>
        </div>
        <p v-if="!producers.length" class="muted">暂无产出这种树果的宝可梦。</p>
      </div>
    </DrawerSheet>
  </div>
</template>

<style scoped>
.berry-detail-tabs { display: flex; border-bottom: 1px solid var(--line); }
.berry-detail-tabs button { flex: 1; border: 0; border-bottom: 2px solid transparent; background: transparent; color: var(--muted); padding: 12px 8px; font: inherit; }
.berry-detail-tabs button.on { border-bottom-color: var(--sage); color: var(--sage); }
.berry-detail-tabs button:focus-visible { outline: 2px solid var(--sage); outline-offset: -2px; }
.berry-producer { display: flex; align-items: center; gap: 10px; padding: 14px 0; border-bottom: 1px solid var(--line); }
.berry-producer-rank { width: 16px; flex-shrink: 0; color: var(--muted); font-variant-numeric: tabular-nums; }
.berry-producer-info { display: flex; flex: 1; min-width: 0; flex-direction: column; gap: 4px; }
.berry-producer-output { display: flex; flex-direction: column; gap: 4px; text-align: right; font-variant-numeric: tabular-nums; }
.berry-producer-output strong { color: var(--sage); white-space: nowrap; }
.berry-producer-output strong > span { font-size: var(--font-11); font-weight: 400; }
@media (max-width: 360px) { .berry-producer { flex-wrap: wrap; } .berry-producer-output { margin-left: 26px; flex-basis: calc(100% - 26px); flex-direction: row; justify-content: space-between; align-items: baseline; } }
</style>
