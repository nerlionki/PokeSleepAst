<script setup lang="ts">
import { computed } from 'vue'
import type { OverviewRank } from '../../calc/boxOverview'
import { boxLabel } from '../../calc/boxFilter'
import { pokeById, SUBSKILLS } from '../../calc/data'
import { slotDrop } from '../../calc/ingredients'
import { SUBSKILL_GATES } from '../../calc/member'
import PokeSprite from '../shared/PokeSprite.vue'
import IngredientIcon from '../shared/IngredientIcon.vue'
const props = defineProps<{ row: OverviewRank; rank: number; unit: string; ingredients?: boolean }>()
const mon = computed(() => props.row.pokemon)
const species = computed(() => pokeById(mon.value.pokeId))
const skills = computed(() => mon.value.subskills.flatMap((id, index) => mon.value.level >= (SUBSKILL_GATES[index] ?? Infinity) ? [SUBSKILLS.find((s) => s.id === id)?.name].filter(Boolean) : []).join(' / '))
const slots = computed(() => mon.value.ingredientSlots.slice(0, mon.value.level >= 60 ? 3 : mon.value.level >= 30 ? 2 : 1).flatMap((index, slot) => {
  const drop = index == null || !species.value ? null : slotDrop(species.value.ingredients, slot, index)
  return drop ? [{ ...drop, slot }] : []
}))
const amount = computed(() => props.row.amount.toLocaleString('zh-CN', { maximumFractionDigits: props.ingredients ? 1 : 0 }))
</script>
<template>
  <div class="overview-rank">
    <span class="rank-position" :class="{ leading: rank === 1 }">{{ rank }}</span>
    <div class="rank-portrait"><PokeSprite :id="mon.pokeId" :name="boxLabel(mon)" :shiny="mon.shiny" /></div>
    <div class="rank-details">
      <strong>{{ boxLabel(mon) }}</strong>
      <p class="muted">{{ species?.name }} · Lv.{{ mon.level }} · {{ mon.nature }}</p>
      <div v-if="ingredients" class="rank-slots"><span v-for="slot in slots" :key="slot.slot" class="row"><IngredientIcon :id="slot.id" :name="slot.name" small /><span>×{{ slot.amount }}</span></span></div>
      <p v-if="skills" class="muted rank-skills">{{ skills }}</p>
    </div>
    <div class="rank-amount"><strong>{{ amount }}</strong><span class="muted">{{ unit }}/日</span></div>
  </div>
</template>
<style scoped>
.overview-rank { display: grid; grid-template-columns: 20px 48px minmax(0, 1fr) auto; gap: 10px; align-items: center; padding: 16px 0; border-top: 1px solid var(--line); }
.rank-portrait :deep(.sprite), .rank-portrait :deep(.fallback-sprite) { width: 48px; height: 48px; }
.rank-position { color: var(--muted); font-variant-numeric: tabular-nums; }
.rank-position.leading { color: var(--amber); }
.rank-details { min-width: 0; }
.rank-details strong { overflow-wrap: anywhere; }
.rank-details p { margin: 4px 0 0; font-size: 12px; line-height: 1.6; }
.rank-slots { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 6px; font-size: 12px; }
.rank-slots .row { gap: 3px; }
.rank-amount { text-align: right; font-variant-numeric: tabular-nums; }
.rank-amount strong { display: block; color: var(--sage); font-size: 20px; }
.rank-amount span { font-size: 11px; }
@media (max-width: 400px) { .overview-rank { grid-template-columns: 16px 36px minmax(0, 1fr) auto; gap: 7px; } .rank-amount strong { font-size: 17px; } .rank-portrait :deep(.sprite), .rank-portrait :deep(.fallback-sprite) { width: 36px; height: 36px; } }
</style>
