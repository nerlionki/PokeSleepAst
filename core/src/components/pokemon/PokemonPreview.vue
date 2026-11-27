<script setup lang="ts">
import { gameText, t as translateUi } from '../../ui/i18n'
import { computed, useSlots } from 'vue'
import type { BoxPokemon, NatureStat } from '../../types'
import { boxLabel } from '../../calc/boxFilter'
import { NATURES, pokeById, SUBSKILLS } from '../../calc/data'
import { INGREDIENT_GATES, slotDrop } from '../../calc/ingredients'
import { SUBSKILL_GATES } from '../../calc/member'
import { STAT_DOWN, STAT_LABEL, STAT_UP } from '../../calc/natureLabels'
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
const nature = computed(() => props.pokemon.ocrMissing?.includes('nature')
  ? undefined : NATURES.find(row => row.name === props.pokemon.nature))
const natureUp = computed(() => nature.value?.up as NatureStat | undefined)
const natureDown = computed(() => nature.value?.down as NatureStat | undefined)
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
  <div class="pokemon-preview">
    <div class="preview-header">
      <PokeSprite :id="pokemon.pokeId" :name="displayName" :shiny="pokemon.shiny" :ribbon-hours="pokemon.tune?.ribbonHours" />
      <strong>{{ displayName }}<ShinyMark v-if="pokemon.shiny" /></strong>
      <span class="muted preview-header-level">Lv.{{ pokemon.level }}</span>
    </div>
    <div class="preview-ingredients" :aria-label="translateUi('食材组合')">
      <div v-for="item in ingredients" :key="item.level" class="preview-ingredient" :class="{ locked: item.locked }" :title="`Lv.${item.level}${item.locked ? ' · ' + translateUi('未解锁') : ''}`">
        <span class="muted preview-level">Lv.{{ item.level }}</span>
        <IngredientIcon v-if="item.drop" :id="item.drop.id" :name="item.drop.name" small />
        <span v-if="item.drop">×{{ item.drop.amount }}</span>
        <span v-else class="muted">{{ translateUi("未选择") }}</span>
      </div>
    </div>
    <div class="preview-subskills" :aria-label="translateUi('副技能组合')">
      <div v-for="item in skills" :key="item.level" class="preview-subskill" :title="`Lv.${item.level} · ${item.skill ? gameText(item.skill.name) : translateUi('未选择')}${item.locked ? ' · ' + translateUi('未解锁') : ''}`">
        <span class="muted preview-level">{{ item.level }}</span>
        <SubskillIcon v-if="item.skill" :id="item.skill.id" :locked="item.locked" />
        <span v-else class="muted">—</span>
      </div>
    </div>
    <div class="preview-nature" :aria-label="translateUi('性格')">
      <strong>{{ nature ? gameText(nature.name) : translateUi('未选择') }}</strong>
      <template v-if="pokemon.natureMinted || nature">
        <span v-if="pokemon.natureMinted || (!natureUp && !natureDown)" class="muted">{{ translateUi('无性格修正') }}</span>
        <template v-else>
          <span v-if="natureUp" class="sage">↑ {{ gameText(STAT_LABEL[natureUp]) }} {{ STAT_UP[natureUp] }}</span>
          <span v-if="natureDown" class="rose">↓ {{ gameText(STAT_LABEL[natureDown]) }} {{ STAT_DOWN[natureDown] }}</span>
        </template>
      </template>
      <span v-if="pokemon.natureMinted" class="muted">{{ translateUi('· 净白薄荷') }}</span>
      <span v-if="pokemon.napping" class="muted">{{ translateUi('· 午睡岛') }}</span>
    </div>
    <span v-if="pokemon.ocrMissing?.length" class="amber">{{ pokemon.ocrMissing.length }} {{ translateUi("项待补全") }}</span>
    <div v-if="slots.actions" class="preview-actions stack"><slot name="actions" /></div>
  </div>
</template>
<style scoped>
.pokemon-preview { display: flex; flex-direction: column; min-width: 0; gap: 8px; width: 100%; }
.preview-header { display: flex; align-items: center; gap: 8px; min-width: 0; }
.preview-header strong { min-width: 0; overflow-wrap: anywhere; }
.preview-header-level { flex: none; white-space: nowrap; }
.preview-ingredients, .preview-subskills, .preview-nature { display: flex; flex-wrap: wrap; align-items: center; gap: 6px 10px; min-width: 0; }
.preview-nature { font-size: var(--font-12); overflow-wrap: anywhere; }
.preview-ingredient, .preview-subskill { display: inline-flex; align-items: center; gap: 3px; font-size: var(--font-12); }
.preview-ingredient.locked { opacity: 0.45; }
.preview-level { font-size: var(--font-10); font-variant-numeric: tabular-nums; }
.preview-actions { display: flex; flex-wrap: wrap; align-self: center; }
.preview-actions > .btn { flex: 1 1 auto; }
.pokemon-preview.box-preview { text-align: center; }
.box-preview .preview-header,
.box-preview .preview-ingredients,
.box-preview .preview-subskills,
.box-preview .preview-nature { justify-content: center; }
</style>
