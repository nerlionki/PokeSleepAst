<script setup lang="ts">
import { gameText, t as translateUi } from '../../ui/i18n'
import { computed, useSlots } from 'vue'
import type { BoxPokemon } from '../../types'
import { boxLabel } from '../../calc/boxFilter'
import { pokeById, SUBSKILLS } from '../../calc/data'
import { INGREDIENT_GATES, slotDrop } from '../../calc/ingredients'
import { SUBSKILL_GATES } from '../../calc/member'
import PokeSprite from '../shared/PokeSprite.vue'
import ShinyMark from '../shared/ShinyMark.vue'
import IngredientIcon from '../shared/IngredientIcon.vue'
import SubskillIcon from '../shared/SubskillIcon.vue'

type PreviewPokemon = Pick<BoxPokemon, 'pokeId' | 'level' | 'nature' | 'ingredientSlots' | 'subskills'>
  & Partial<Pick<BoxPokemon, 'name' | 'shiny' | 'natureMinted' | 'napping' | 'tune' | 'ocrMissing'>>
const props = defineProps<{ pokemon: PreviewPokemon }>()
const slots = useSlots()
const species = computed(() => pokeById(props.pokemon.pokeId))
const displayName = computed(() => props.pokemon.name?.trim() || gameText(boxLabel(props.pokemon)))
const ingredients = computed(() => INGREDIENT_GATES.map((level, index) => {
  const choice = props.pokemon.ingredientSlots[index]
  const lines = species.value?.ingredients ?? []
  const drop = choice != null && choice >= 0 && choice < lines.length ? slotDrop(lines, index, choice) : null
  return { level, drop, locked: props.pokemon.level < level }
}))
const skills = computed(() => SUBSKILL_GATES.map((level, index) => ({
  level,
  skill: SUBSKILLS.find(skill => skill.id === props.pokemon.subskills[index]),
  locked: props.pokemon.level < level,
})))
</script>
<template>
  <div class="pokemon-preview" :class="{ 'with-actions': !!slots.actions }">
    <PokeSprite :id="pokemon.pokeId" :name="displayName" :shiny="pokemon.shiny" :ribbon-hours="pokemon.tune?.ribbonHours" />
    <div class="preview-details">
      <strong>{{ displayName }}<ShinyMark v-if="pokemon.shiny" /></strong>
      <div class="muted">Lv.{{ pokemon.level }} · {{ gameText(pokemon.nature) }}{{ pokemon.natureMinted ? " " + translateUi("· 净白薄荷") : '' }}{{ pokemon.napping ? " " + translateUi("· 午睡岛") : '' }}</div>
      <span v-if="pokemon.ocrMissing?.length" class="amber">{{ pokemon.ocrMissing.length }} {{ translateUi("项待补全") }}</span>
      <div class="preview-ingredients" :aria-label="translateUi('食材组合')">
        <div v-for="item in ingredients" :key="item.level" class="preview-ingredient" :class="{ locked: item.locked }" :title="`Lv.${item.level}${item.locked ? ' · 未解锁' : ''}`">
          <span class="muted preview-level">Lv.{{ item.level }}</span>
          <IngredientIcon v-if="item.drop" :id="item.drop.id" :name="item.drop.name" small />
          <span v-if="item.drop">×{{ item.drop.amount }}</span>
          <span v-else class="muted">{{ translateUi("未选择") }}</span>
        </div>
      </div>
      <div class="preview-subskills" :aria-label="translateUi('副技能组合')">
        <div v-for="item in skills" :key="item.level" class="preview-subskill" :title="`Lv.${item.level} · ${item.skill?.name ?? '未选择'}${item.locked ? ' · 未解锁' : ''}`">
          <span class="muted preview-level">{{ item.level }}</span>
          <SubskillIcon v-if="item.skill" :id="item.skill.id" :locked="item.locked" />
          <span v-else class="muted">—</span>
        </div>
      </div>
    </div>
    <div v-if="slots.actions" class="preview-actions stack"><slot name="actions" /></div>
  </div>
</template>
<style scoped>
.pokemon-preview { display: grid; grid-template-columns: 56px minmax(0, 1fr); align-items: start; gap: 10px; width: 100%; }
.pokemon-preview.with-actions { grid-template-columns: 56px minmax(0, 1fr) auto; }
.preview-details { min-width: 0; }
.preview-details strong { overflow-wrap: anywhere; }
.preview-ingredients, .preview-subskills { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 8px; }
.preview-ingredient, .preview-subskill { display: inline-flex; align-items: center; gap: 3px; font-size: var(--font-12); }
.preview-ingredient.locked { opacity: 0.45; }
.preview-level { font-size: var(--font-10); font-variant-numeric: tabular-nums; }
.preview-actions { align-self: center; }
</style>
