<script setup lang="ts">
import clientDefaults from '../../data/client-defaults.json'
import { cloneData } from '../../calc/dataClone'

import { computed, shallowRef, watch } from 'vue'
import { NATURES, SUBSKILLS, pokeById } from '../../calc/data'
import { clearIngredientSlot, ingredientColumns, setIngredientChoice } from '../../calc/ingredients'
import { applySilverSeed, exclusiveSubskills, silverSeedCandidates, stepGoldSeed, stepMemberEvolutions, stepSkillLevel, subskillLevelBonus, switchMemberEvolution, undoSilverSeed, SUBSKILL_GATES, type MemberDraft, type MemberTune } from '../../calc/member'
import { evolutionDepth, evolutionStages } from '../../calc/evolution'
import { MEW_SKILLS, normalizeMewSkill } from '../../calc/mew'
import { skillMaxFor } from '../../calc/mainSkills'
import { RIBBON_HOURS, ribbonBonus, stagesLeft } from '../../calc/ribbon'
import { isAllRounder } from '../../calc/specialty'
import { POKEMON_LEVEL_MAX } from '../../calc/xp'
import type { CarryMode, OcrMissingField } from '../../types'
import IngredientIcon from '../shared/IngredientIcon.vue'
import PokeSprite from '../shared/PokeSprite.vue'
import MainSkillIcon from '../shared/MainSkillIcon.vue'
import SubskillIcon from '../shared/SubskillIcon.vue'
const components_team_MemberEditor_config_clientDefaults = clientDefaults.modules.components_team_MemberEditor


const model = defineModel<MemberDraft>({ required: true })
const props = withDefaults(defineProps<{ actions?: boolean, shiny?: boolean }>(), { actions: true, shiny: false })
const emit = defineEmits<{ copy: [], remove: [], confirm: [field: OcrMissingField] }>()

const LEVELS = cloneData(components_team_MemberEditor_config_clientDefaults["LEVELS"])
const MODES: { id: CarryMode, label: string }[] = (cloneData(components_team_MemberEditor_config_clientDefaults["MODES"]) as unknown as { id: CarryMode, label: string }[])
const STAT: Record<string, string> = (cloneData(components_team_MemberEditor_config_clientDefaults["STAT"]) as unknown as Record<string, string>)

function natureMark(stat: string | null, arrow: string) {
  if (!stat || !STAT[stat]) return ''
  return `${STAT[stat]}${arrow}`
}

const natureOpen = shallowRef(components_team_MemberEditor_config_clientDefaults["natureOpenInitial"])
const subPick = shallowRef<number | null>((components_team_MemberEditor_config_clientDefaults["subPickInitial"] as unknown as number | null))
const silverOpen = shallowRef(components_team_MemberEditor_config_clientDefaults["silverOpenInitial"])
const silverChoices = computed(() => silverSeedCandidates(model.value.level, model.value.subskills))
const skillBonus = computed(() => subskillLevelBonus(model.value.level, model.value.subskills))
const poke = computed(() => pokeById(model.value.pokeId))
const stages = computed(() => evolutionStages(model.value.pokeId))
const maxEvolutions = computed(() => evolutionDepth(model.value.pokeId))
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

watch(() => [model.value.pokeId, model.value.tune.evolutions], () => {
  const evolutions = Math.min(maxEvolutions.value, Math.max(0, model.value.tune.evolutions))
  if (evolutions !== model.value.tune.evolutions) patchTune({ evolutions })
}, { immediate: true })

function switchEvolution(id: number) {
  if (id === model.value.pokeId) return
  model.value = switchMemberEvolution(model.value, id)
  emit('confirm', 'skillLevel')
}

function setLevel(level: number) {
  patch({ level: Math.min(POKEMON_LEVEL_MAX, Math.max(1, level)) })
}

function setSub(index: number, id: string) {
  const next = [...model.value.subskills]
  while (next.length < 5) next.push('')
  if (id && next.some((current, slot) => current === id && slot !== index)) return
  next[index] = id
  patch({ subskills: next, tune: { ...model.value.tune, silverSeedHistory: [] } })
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
  const next = stepGoldSeed({ skillLevel: model.value.skillLevel, goldSeeds: model.value.tune.goldSeeds }, delta, skillMax.value, skillBonus.value)
  if (next) {
    model.value = { ...model.value, skillLevel: next.skillLevel, tune: { ...model.value.tune, goldSeeds: next.goldSeeds } }
    emit('confirm', 'skillLevel')
  }
}

function stepSilver(index?: number) {
  const next = index == null ? undoSilverSeed(model.value) : applySilverSeed(model.value, index)
  if (next) {
    model.value = next
    if (index != null) emit('confirm', `subskill${index}` as OcrMissingField)
  }
  silverOpen.value = false
}

function stepEvolution(delta: number) {
  const next = stepMemberEvolutions(model.value, delta)
  if (next === model.value) return
  model.value = next
  emit('confirm', 'skillLevel')
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

    <section v-if="stages.length > 1" class="evo-chain" aria-label="进化链">
      <h3>进化链</h3>
      <div class="evo-stages">
        <template v-for="(stage, index) in stages" :key="index">
          <span v-if="index" class="evo-arrow" aria-hidden="true">↓</span>
          <div class="evo-stage">
            <button v-for="node in stage" :key="node.id" type="button" class="evo-node"
              :class="{ on: node.id === model.pokeId }" :aria-pressed="node.id === model.pokeId"
              @click="switchEvolution(node.id)">
              <PokeSprite :id="node.id" :name="node.name" :shiny="props.shiny" />
              <span>{{ node.name }}</span>
            </button>
          </div>
        </template>
      </div>
    </section>

    <label v-if="poke?.id === 151" class="field">
      <span>十项全能 · 当前习得技能</span>
      <select :value="normalizeMewSkill(model.mewSkill)" @change="patch({ mewSkill: Number(($event.target as HTMLSelectElement).value) })">
        <option v-for="skill in MEW_SKILLS" :key="skill.id" :value="skill.id">{{ skill.name }} · {{ (skill.rate * 100).toFixed(2) }}%</option>
      </select>
      <small class="muted">保留十项全能等级，效果按所选技能等级上限计算。</small>
    </label>

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
        <button v-if="isAllRounder(poke) && colIndex > 0" type="button" class="ing-token" :class="{ on: model.ingredientSlots[colIndex] == null }" @click="clearIngredient(colIndex)">空</button>
        <p v-if="isAllRounder(poke) && colIndex === 0 && model.ingredientSlots[0] == null" class="amber" role="alert">Lv.1 食材不能为空，请选择实际食材。</p>
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
    <p class="muted">亮着的是当前食材组合。30 级点选决定第 2 槽，60 级点选决定第 3 槽。{{ isAllRounder(poke) ? 'Lv.1 必须选择食材，不能留空。' : '第 1 槽固定。' }}</p>

    <div class="tune-row">
      <span>进化次数</span>
      <button type="button" :disabled="model.tune.evolutions <= 0" @click="stepEvolution(-1)">−</button>
      <b>{{ model.tune.evolutions }}</b>
      <button type="button" :disabled="model.tune.evolutions >= maxEvolutions" @click="stepEvolution(1)">+</button>
    </div>
    <div class="tune-row">
      <span>金种子</span>
      <button type="button" :disabled="model.tune.goldSeeds <= 0" @click="stepGold(-1)">−</button>
      <b>{{ model.tune.goldSeeds }}</b>
      <button type="button" :disabled="model.skillLevel + skillBonus >= skillMax" @click="stepGold(1)">+</button>
      <span>银种子</span>
      <button type="button" :disabled="model.tune.silverSeeds <= 0" @click="stepSilver()">−</button>
      <b>{{ model.tune.silverSeeds }}</b>
      <button type="button" :disabled="!silverChoices.length || model.tune.silverSeeds >= 9" @click="silverOpen = !silverOpen">+</button>
    </div>
    <div v-if="silverOpen" class="picker-opts">
      <button v-for="choice in silverChoices" :key="choice.index" type="button" @click="stepSilver(choice.index)">
        Lv.{{ SUBSKILL_GATES[choice.index] }} · {{ subName(choice.from) }} → {{ subName(choice.to) }}
      </button>
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
