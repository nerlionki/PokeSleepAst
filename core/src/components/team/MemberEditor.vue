<script setup lang="ts">
import { computed, shallowRef } from 'vue'
import { NATURES, SUBSKILLS, pokeById } from '../../calc/data'
import { clearIngredientSlot, ingredientColumns, setIngredientChoice } from '../../calc/ingredients'
import { exclusiveSubskills, stepGoldSeed, stepSkillLevel, SUBSKILL_GATES, type MemberDraft, type MemberTune } from '../../calc/member'
import { skillMaxFor } from '../../calc/mainSkills'
import { RIBBON_HOURS, ribbonBonus, stagesLeft } from '../../calc/ribbon'
import { isAllRounder } from '../../calc/specialty'
import { POKEMON_LEVEL_MAX } from '../../calc/xp'
import type { CarryMode, OcrMissingField } from '../../types'
import IngredientIcon from '../shared/IngredientIcon.vue'
import PokeSprite from '../shared/PokeSprite.vue'
import MainSkillIcon from '../shared/MainSkillIcon.vue'
import SubskillIcon from '../shared/SubskillIcon.vue'

const model = defineModel<MemberDraft>({ required: true })
const props = withDefaults(defineProps<{ actions?: boolean, shiny?: boolean }>(), { actions: true, shiny: false })
const emit = defineEmits<{ copy: [], remove: [], confirm: [field: OcrMissingField] }>()

const LEVELS = [1, 10, 25, 30, 50, 60, 70, 80, 100]
const MODES: { id: CarryMode, label: string }[] = [
  { id: 'preset', label: '预设' },
  { id: 'normal', label: '一般' },
  { id: 'full', label: '全时满包' },
  { id: 'unlimited', label: '持有无上限' },
]
const STAT: Record<string, string> = { help: '帮忙', energy: '活力', ingredient: '食材', skill: '技能', exp: '经验' }

function natureMark(stat: string | null, arrow: string) {
  if (!stat || !STAT[stat]) return ''
  return `${STAT[stat]}${arrow}`
}

const natureOpen = shallowRef(false)
const subPick = shallowRef<number | null>(null)
const poke = computed(() => pokeById(model.value.pokeId))
const board = computed(() => poke.value ? ingredientColumns(poke.value.ingredients) : [])
const skillMax = computed(() => skillMaxFor(poke.value?.mainSkill ?? ''))
const ribbon = computed(() => ribbonBonus(model.value.tune.ribbonHours, stagesLeft(model.value.pokeId)))
const subChoices = computed(() => exclusiveSubskills(SUBSKILLS, model.value.subskills, subPick.value ?? -1))

function patch(partial: Partial<MemberDraft>) {
  model.value = { ...model.value, ...partial }
  if ('level' in partial) emit('confirm', 'level')
  if ('nature' in partial) emit('confirm', 'nature')
}

function patchTune(partial: Partial<MemberTune>) {
  model.value = { ...model.value, tune: { ...model.value.tune, ...partial } }
}

function setLevel(level: number) {
  patch({ level: Math.min(POKEMON_LEVEL_MAX, Math.max(1, level)) })
}

function setSub(index: number, id: string) {
  const next = [...model.value.subskills]
  while (next.length < 5) next.push('')
  if (id && next.some((current, slot) => current === id && slot !== index)) return
  next[index] = id
  patch({ subskills: next })
  emit('confirm', `subskill${index}` as OcrMissingField)
  subPick.value = null
}

function subName(id: string) {
  return SUBSKILLS.find((item) => item.id === id)?.name ?? ''
}

function chooseIngredient(column: number, lineIndex: number) {
  if (!poke.value) return
  const next = setIngredientChoice(poke.value.ingredients.length, model.value.ingredientSlots, column, lineIndex)
  if (next) patch({ ingredientSlots: next })
  emit('confirm', `ingredient${column}` as OcrMissingField)
}

function clearIngredient(column: number) {
  if (!poke.value) return
  const next = clearIngredientSlot(poke.value.id, model.value.ingredientSlots, column)
  if (next) patch({ ingredientSlots: next })
  emit('confirm', `ingredient${column}` as OcrMissingField)
}

function setSkill(level: number) {
  const next = stepSkillLevel({ skillLevel: model.value.skillLevel, goldSeeds: model.value.tune.goldSeeds }, level, skillMax.value)
  model.value = { ...model.value, skillLevel: next.skillLevel, tune: { ...model.value.tune, goldSeeds: next.goldSeeds } }
  emit('confirm', 'skillLevel')
}

function stepGold(delta: number) {
  const next = stepGoldSeed({ skillLevel: model.value.skillLevel, goldSeeds: model.value.tune.goldSeeds }, delta, skillMax.value)
  if (next) {
    model.value = { ...model.value, skillLevel: next.skillLevel, tune: { ...model.value.tune, goldSeeds: next.goldSeeds } }
    emit('confirm', 'skillLevel')
  }
}

function stepTune(key: 'evolutions' | 'silverSeeds', delta: number, max: number) {
  const value = Math.min(max, Math.max(0, model.value.tune[key] + delta))
  patchTune({ [key]: value })
}
</script>

<template>
  <div class="stack member-editor">
    <div v-if="poke" class="row">
      <PokeSprite :id="poke.id" :name="poke.name" :shiny="props.shiny" />
      <div>
        <strong>{{ poke.name }}</strong>
        <p class="muted"><MainSkillIcon :name="poke.mainSkill" /> {{ poke.mainSkill }}</p>
      </div>
    </div>

    <div class="lv-row">
      <span class="muted">LV</span>
      <button v-for="lv in LEVELS" :key="lv" type="button" :class="{ on: model.level === lv }" @click="setLevel(lv)">{{ lv }}</button>
    </div>
    <label class="level-slider">
      <input :value="model.level" type="range" min="1" :max="POKEMON_LEVEL_MAX" @input="setLevel(Number(($event.target as HTMLInputElement).value))">
      <b>Lv.{{ model.level }}</b>
    </label>
    <label class="field">
      <span>LV↑ EXP</span>
      <input :value="model.tune.exp" type="number" min="0" @input="patchTune({ exp: Math.max(0, Number(($event.target as HTMLInputElement).value) || 0) })">
    </label>

    <div class="ing-board">
      <section v-for="(col, colIndex) in board" :key="colIndex" class="ing-col">
        <h3>Lv {{ [1, 30, 60][colIndex] }}</h3>
        <button v-if="isAllRounder(poke)" type="button" class="ing-token" :class="{ on: model.ingredientSlots[colIndex] == null }" @click="clearIngredient(colIndex)">空</button>
        <div class="ing-col-items">
          <button
            v-for="(cell, cellIndex) in col"
            :key="`${colIndex}-${cellIndex}`"
            type="button"
            class="ing-token"
            :class="{ on: model.ingredientSlots[colIndex] === cell.index }"
            @click="chooseIngredient(colIndex, cell.index)"
          >
            <IngredientIcon :id="cell.id" :name="cell.name" />
            <span class="ing-qty">{{ cell.amount }}</span>
          </button>
        </div>
      </section>
    </div>
    <p class="muted">亮着的是当前食材组合。30 级点选决定第 2 槽，60 级点选决定第 3 槽，第 1 槽固定。</p>

    <div class="tune-row">
      <span>进化次数</span>
      <button type="button" @click="stepTune('evolutions', -1, 3)">−</button>
      <b>{{ model.tune.evolutions }}</b>
      <button type="button" @click="stepTune('evolutions', 1, 3)">+</button>
    </div>
    <div class="tune-row">
      <span>金种子</span>
      <button type="button" :disabled="model.tune.goldSeeds <= 0" @click="stepGold(-1)">−</button>
      <b>{{ model.tune.goldSeeds }}</b>
      <button type="button" :disabled="model.skillLevel >= skillMax" @click="stepGold(1)">+</button>
      <span>银种子</span>
      <button type="button" @click="stepTune('silverSeeds', -1, 9)">−</button>
      <b>{{ model.tune.silverSeeds }}</b>
      <button type="button" @click="stepTune('silverSeeds', 1, 9)">+</button>
    </div>
    <div class="tune-row">
      <span>技能</span>
      <button type="button" @click="setSkill(model.skillLevel - 1)">−</button>
      <b>LV {{ model.skillLevel }} / {{ skillMax }}</b>
      <button type="button" @click="setSkill(model.skillLevel + 1)">+</button>
      <button type="button" @click="setSkill(skillMax)">MAX</button>
    </div>

    <div class="sub-grid">
      <button v-for="(gate, index) in SUBSKILL_GATES" :key="gate" type="button" class="sub-slot" @click="subPick = subPick === index ? null : index">
        <span class="chip">{{ gate }}</span>
        <SubskillIcon v-if="model.subskills[index]" :id="model.subskills[index]" />
        <span>{{ subName(model.subskills[index] ?? '') || '—' }}</span>
        <span v-if="model.subskills[index]" class="muted" @click.stop="setSub(index, '')">×</span>
      </button>
    </div>
    <div v-if="subPick !== null" class="picker-opts">
      <button v-for="item in subChoices" :key="item.id" type="button" :class="{ on: model.subskills[subPick] === item.id }" @click="setSub(subPick, item.id)">
        <SubskillIcon :id="item.id" />
        {{ item.name }}
      </button>
    </div>

    <button class="btn ghost" type="button" @click="natureOpen = !natureOpen">性格 · {{ model.nature }}</button>
    <div v-if="natureOpen" class="picker-opts">
      <button v-for="nature in NATURES" :key="nature.name" type="button" :class="{ on: model.nature === nature.name }" @click="patch({ nature: nature.name }); natureOpen = false">
        {{ nature.name }} {{ natureMark(nature.up, '↑') }} {{ natureMark(nature.down, '↓') }}
      </button>
    </div>

    <p class="muted">睡饱饱勋章 · 还能进化 {{ stagesLeft(model.pokeId) }} 次</p>
    <div class="lv-row">
      <button v-for="hours in RIBBON_HOURS" :key="hours" type="button" :class="{ on: model.tune.ribbonHours === hours }" @click="patchTune({ ribbonHours: hours })">
        {{ hours === 0 ? '无' : `${hours}小时` }}
      </button>
    </div>
    <p class="muted">持有 +{{ ribbon.carry }}{{ ribbon.speedCut ? `，帮忙间隔缩短 ${Math.round(ribbon.speedCut * 100)}%，帮忙速度变快` : '，帮忙间隔不变' }}</p>

    <p class="muted">持有上限计算模式</p>
    <div class="seg seg-4">
      <button v-for="mode in MODES" :key="mode.id" type="button" :class="{ on: model.tune.carryMode === mode.id }" @click="patchTune({ carryMode: mode.id })">{{ mode.label }}</button>
    </div>

    <div v-if="props.actions" class="row editor-actions">
      <button class="btn ghost" type="button" @click="emit('copy')">复制</button>
      <button class="btn ghost rose" type="button" @click="emit('remove')">移除</button>
    </div>
  </div>
</template>
