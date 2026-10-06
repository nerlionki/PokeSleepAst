<script setup lang="ts">
import { computed, reactive } from 'vue'
import type { BoxPokemon } from '../../types'
import { boxLabel } from '../../calc/boxFilter'
import { completeOcrFields, normalizeOcrMissing, OCR_FIELD_LABELS, ocrChoices, type OcrSelections } from '../../calc/ocrCompletion'
import { POKEMON_LEVEL_MAX } from '../../calc/xp'
import { pokeById } from '../../calc/data'
import { skillMaxFor } from '../../calc/mainSkills'
import PokeSprite from '../shared/PokeSprite.vue'

const props = defineProps<{ pokemon: BoxPokemon; remaining: number }>()
const emit = defineEmits<{ save: [pokemon: BoxPokemon]; pause: [pokemon: BoxPokemon] }>()
const selections = reactive<OcrSelections>({})
const fields = computed(() => normalizeOcrMissing(props.pokemon.ocrMissing))
const completed = computed(() => completeOcrFields(props.pokemon, selections))
const pending = computed(() => normalizeOcrMissing(completed.value.ocrMissing).length)
const skillMax = computed(() => skillMaxFor(pokeById(props.pokemon.pokeId)?.mainSkill ?? ''))
function pause() { emit('pause', completed.value) }
</script>

<template>
  <Teleport to="body">
    <div v-back="pause" class="overlay ocr-overlay" @click.self="pause">
      <section class="sheet stack" role="dialog" aria-modal="true" aria-labelledby="ocr-completion-title">
        <div class="row">
          <h2 id="ocr-completion-title">补全识别结果</h2>
          <button class="btn ghost" type="button" @click="pause">稍后补全</button>
        </div>
        <div class="row">
          <PokeSprite :id="pokemon.pokeId" :name="boxLabel(pokemon)" :shiny="pokemon.shiny" />
          <strong>{{ boxLabel(pokemon) }}</strong>
          <span class="muted">待补全 {{ remaining }} 只</span>
        </div>
        <p class="muted">已导入 Box。下列字段未识别，请选择或确认；已识别内容会保留。稍后补全会保存已选项。</p>
        <div v-for="field in fields" :key="field" class="field">
          <label :for="`ocr-${field}`">{{ OCR_FIELD_LABELS[field] }}</label>
          <template v-if="field === 'level' || field === 'skillLevel'">
            <input :id="`ocr-${field}`" v-model="selections[field]" type="number" min="1" :max="field === 'level' ? POKEMON_LEVEL_MAX : skillMax" placeholder="请输入等级">
            <button class="btn ghost" type="button" @click="selections[field] = String(pokemon[field])">确认使用当前值 {{ pokemon[field] }}</button>
          </template>
          <select v-else :id="`ocr-${field}`" v-model="selections[field]">
            <option :value="undefined" disabled>请选择</option>
            <option v-for="choice in ocrChoices(pokemon, field)" :key="choice.value" :value="choice.value">{{ choice.label }}</option>
          </select>
          <span v-if="selections[field] && completed.ocrMissing?.includes(field)" class="ocr-warning">选择无效：请检查等级范围或重复的副技能。</span>
        </div>
        <p class="muted" role="status">{{ pending ? `还有 ${pending} 项待确认` : '当前记录已补全' }}</p>
        <button class="btn" type="button" :disabled="pending > 0" @click="emit('save', completed)">保存并继续</button>
      </section>
    </div>
  </Teleport>
</template>

<style scoped>
.ocr-overlay { z-index: 50; }
.ocr-warning { color: var(--rose); font-size: 13px; }
button:disabled { opacity: .5; cursor: default; }
</style>
