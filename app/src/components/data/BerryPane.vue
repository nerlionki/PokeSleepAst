<script setup lang="ts">
import { computed, shallowRef } from 'vue'
import { berryEnergySnaps, berryEnergyTable } from '../../calc/berry'
import { BERRIES } from '../../calc/data'
import { textHit } from '../../calc/text'
import BerryIcon from '../shared/BerryIcon.vue'
import DrawerSheet from '../shared/DrawerSheet.vue'

const props = defineProps<{ q: string }>()
const open = shallowRef('')

const list = computed(() => BERRIES.filter((b) => textHit(`${b.name} ${b.type}`, props.q)))
const current = computed(() => BERRIES.find((b) => b.name === open.value))
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
        @click="open = b.name"
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
          <p class="muted">点选树果查看 1–100 级能量</p>
        </div>
      </div>
      <p class="berry-snaps">
        <span v-for="s in berryEnergySnaps(current.name)" :key="s.level">Lv{{ s.level }} {{ s.energy }}</span>
      </p>
      <div class="energy-table">
        <div v-for="row in berryEnergyTable(current.name)" :key="row.level" class="energy-row">
          <span>Lv{{ row.level }}</span>
          <strong>{{ row.energy }}</strong>
        </div>
      </div>
    </DrawerSheet>
  </div>
</template>
