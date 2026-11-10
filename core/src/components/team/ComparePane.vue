<script setup lang="ts">
import { t as translateUi } from '../../ui/i18n'
import { editorMemberFields, MEMBER_PRESETS } from '../../calc/memberPresets'


import { defaultSkillLevel } from '../../calc/member'

import { confirmRemoval } from '#platform/confirm'
import { ingredientEnergyValue } from '../../calc/activityIngredients'
import clientDefaults from '../../data/client-defaults.resource'
import { cloneData } from '../../calc/dataClone'

import { newUid } from '../../calc/uid'
import { computed, ref, shallowRef, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { useRoute } from 'vue-router'
import { boxLabel, speciesName } from '../../calc/boxFilter'
import { NEUTRAL_NATURE } from '../../calc/data'
import { compareHelpingBonus, defaultTune, type MemberDraft } from '../../calc/member'
import { cloneMemberDraft, memberDraftFromBox, memberDraftToBox } from '../../calc/memberDraft'
import LevelSelector from '../shared/LevelSelector.vue'
import ToggleField from '../shared/ToggleField.vue'
import { produce } from '../../calc/produce'
import { useBoxStore } from '../../stores/box'
import { useSettingsStore } from '../../stores/settings'
import { useProductionActivity } from '../../composables/useProductionActivity'
import type { ProduceResult } from '../../types'
import MemberCard from './MemberCard.vue'
import MemberEditor from './MemberEditor.vue'
import PokeSprite from '../shared/PokeSprite.vue'
import SpeciesSheet from '../shared/SpeciesSheet.vue'
const components_team_ComparePane_config_clientDefaults = clientDefaults.modules.components_team_ComparePane


interface CustomPanel extends MemberDraft {
  uid: string
}

interface CompareRow {
  uid: string
  pokeId: number
  custom: boolean
  name: string
  level: number
  nature: string
  natureMinted?: boolean
  subskills: string[]
  ingredientSlots: [number | null, number | null, number | null]
  skillLevel: number
  mewSkill?: number
  carryMode?: MemberDraft['tune']['carryMode']
  ribbonHours?: number
  bonus: number
  r: ProduceResult
}

const LEVELS = cloneData(components_team_ComparePane_config_clientDefaults["LEVELS"])

const box = useBoxStore()
const { settings } = storeToRefs(useSettingsStore())
const { enabled: activityEnabled, settings: calculationSettings } = useProductionActivity('compare', settings)
const route = useRoute()
const selected = ref<string[]>((cloneData(components_team_ComparePane_config_clientDefaults["selectedInitial"]) as unknown as string[]))
const customs = ref<CustomPanel[]>((cloneData(components_team_ComparePane_config_clientDefaults["customsInitial"]) as unknown as CustomPanel[]))
const editing = ref<string | null>((components_team_ComparePane_config_clientDefaults["editingInitial"] as unknown as string | null))
const level = shallowRef<number | null>((components_team_ComparePane_config_clientDefaults["levelInitial"] as unknown as number | null))
const picking = shallowRef(components_team_ComparePane_config_clientDefaults["pickingInitial"])
const adding = shallowRef(components_team_ComparePane_config_clientDefaults["addingInitial"])

watch(() => route.query.uid, (uid) => {
  if (typeof uid === 'string' && uid && !selected.value.includes(uid)) selected.value = [...selected.value, uid]
}, { immediate: true })

function blank(pokeId: number, uid = `c-${newUid()}`): CustomPanel {
  return {
    uid,
    pokeId,
    ...editorMemberFields(),
    nature: NEUTRAL_NATURE,
    skillLevel: defaultSkillLevel(pokeId),
    tune: defaultTune(pokeId),
  }
}

function nameOf(id: number) {
  return speciesName(id)
}

function draftOf(uid: string): MemberDraft | null {
  const custom = customs.value.find((item) => item.uid === uid)
  if (custom) return custom
  const owned = box.pokemon.find((item) => item.uid === uid)
  if (!owned) return null
  return memberDraftFromBox(owned)
}

function copyRow(uid: string) {
  const source = draftOf(uid)
  if (!source) return
  const row: CustomPanel = {
    ...cloneMemberDraft(source),
    uid: `c-${newUid()}`,
  }
  customs.value = [...customs.value, row]
  selected.value = [...selected.value, row.uid]
}

function duplicateEditing() {
  if (editing.value) copyRow(editing.value)
}

function addCustom(pokeId: number) {
  const row = blank(pokeId)
  customs.value = [...customs.value, row]
  selected.value = [...selected.value, row.uid]
  adding.value = false
  editing.value = row.uid
}

async function remove(uid: string) {
  if (!await confirmRemoval('确认移除此对比宝可梦？')) return
  customs.value = customs.value.filter((p) => p.uid !== uid)
  selected.value = selected.value.filter((id) => id !== uid)
  if (editing.value === uid) editing.value = null
}

function updateEditing(next: MemberDraft) {
  const uid = editing.value
  if (!uid) return
  if (customs.value.some((item) => item.uid === uid)) {
    customs.value = customs.value.map((item) => (item.uid === uid ? { ...item, ...next, uid, tune: { ...defaultTune(), ...item.tune, ...next.tune } } : item))
    return
  }
  box.update(uid, {
    pokeId: next.pokeId,
    level: next.level,
    nature: next.nature,
    natureMinted: next.natureMinted === true,
    subskills: next.subskills,
    ingredientSlots: next.ingredientSlots,
    skillLevel: next.skillLevel,
    mewSkill: next.mewSkill,
    tune: next.tune,
  })
}

const editingPanel = computed({
  get: () => (editing.value ? draftOf(editing.value) : null),
  set: (value: MemberDraft | null) => { if (value) updateEditing(value) },
})

const rows = computed<CompareRow[]>(() => selected.value.map((uid): CompareRow | null => {
  const custom = customs.value.find((p) => p.uid === uid)
  const boxP = box.pokemon.find((p) => p.uid === uid)
  const source = custom ?? boxP
  if (!source) return null
  const tune = custom?.tune ?? boxP?.tune
  const input = {
    ...(level.value == null ? source : { ...source, level: level.value }),
    carryMode: tune?.carryMode,
    ribbonHours: tune?.ribbonHours,
    wakeEnergy: MEMBER_PRESETS.comparisonWakeEnergy,
  }
  const bonus = compareHelpingBonus(input.level, source.subskills, settings.value.helpingBonus)
  return {
    uid,
    pokeId: source.pokeId,
    custom: !!custom,
    name: custom ? nameOf(source.pokeId) : boxLabel(boxP!),
    level: input.level,
    nature: source.nature,
    natureMinted: source.natureMinted,
    subskills: source.subskills,
    ingredientSlots: source.ingredientSlots,
    skillLevel: source.skillLevel,
    mewSkill: source.mewSkill,
    carryMode: tune?.carryMode,
    ribbonHours: tune?.ribbonHours,
    bonus,
    r: produce(calculationSettings.value, input, bonus),
  }
}).filter((row): row is CompareRow => row !== null))

function strength(row: CompareRow) {
  if (Object.entries(row.r.ingredients).some(([name, count]) => count > 0 && ingredientEnergyValue(name) == null)) return Number.NaN
  const ingredients = Object.entries(row.r.ingredients).reduce((sum, [name, count]) => sum + count * (ingredientEnergyValue(name) ?? 0), 0)
  return row.r.berryEnergy + (row.r.cooking?.energy ?? ingredients) + row.r.skillEnergy
}

const peak = computed(() => Math.max(0, ...rows.value.map(strength).filter(Number.isFinite)))

function best(value: number) {
  return rows.value.length > 1 && value > 0 && value === peak.value
}

function take(uid: string) {
  if (!selected.value.includes(uid)) selected.value = [...selected.value, uid]
  picking.value = false
}

function saveCustomToBox() {
  const uid = editing.value
  const draft = editingPanel.value
  if (!uid || !draft || !customs.value.some((item) => item.uid === uid)) return
  const created = box.create(memberDraftToBox(draft))
  selected.value = selected.value.map((id) => (id === uid ? created.uid : id))
  customs.value = customs.value.filter((item) => item.uid !== uid)
  editing.value = null
}
</script>

<template>
  <div class="stack">
    <ToggleField v-model="activityEnabled" :label="translateUi('计入活动加成')" />
    <LevelSelector v-model="level" :levels="LEVELS" allow-original />
    <div class="seg">
      <button type="button" :class="{ on: settings.period === 'day' }" @click="settings.period = 'day'">{{ translateUi("每日") }}</button>
      <button type="button" :class="{ on: settings.period === 'week' }" @click="settings.period = 'week'">{{ translateUi("每周") }}</button>
    </div>
    <p class="muted">{{ translateUi("并排比较个体产量，同一行里最高的数字会高亮。按全天满活力计算；自身有帮手奖励时按 5 层。") }}</p>
    <div class="cmp-board">
      <article v-for="row in rows" :key="row.uid" class="card cmp-col">
        <MemberCard
          :environment="calculationSettings"
          :poke-id="row.pokeId"
          :level="row.level"
          :nature="row.nature"
          :nature-minted="row.natureMinted"
          :subskills="row.subskills"
          :ingredient-slots="row.ingredientSlots"
          :skill-level="row.skillLevel"
          :mew-skill="row.mewSkill"
          :result="row.r"
          :carry-mode="row.carryMode"
          :ribbon-hours="row.ribbonHours"
          :wake-energy="100"
          :helping-bonus="row.bonus"
          :label="row.name"
        />
        <span v-if="best(strength(row))" class="chip">{{ translateUi("最高") }}</span>
        <div class="row">
          <button class="btn ghost" type="button" @click="editing = row.uid">{{ translateUi("编辑") }}</button>
          <button class="btn ghost" type="button" @click="copyRow(row.uid)">{{ translateUi("复制") }}</button>
          <button class="btn ghost" type="button" @click="remove(row.uid)">{{ translateUi("移除") }}</button>
        </div>
      </article>
      <article class="card cmp-col slot-card">
        <span class="slot-empty">＋</span>
        <button class="btn" type="button" @click="picking = true">{{ translateUi("从盒子") }}</button>
        <button class="btn ghost" type="button" @click="adding = true">{{ translateUi("自定义") }}</button>
      </article>
    </div>

    <div v-if="picking" v-back="() => { picking = false }" @touchstart.stop @touchend.stop @touchcancel.stop class="overlay" @click.self="picking = false">
      <section class="sheet stack">
        <h3>{{ translateUi("加入比较") }}</h3>
        <button v-for="p in box.pokemon" :key="p.uid" class="data-row" type="button" @click="take(p.uid)">
          <PokeSprite :id="p.pokeId" :name="boxLabel(p)" :shiny="p.shiny" :ribbon-hours="p.tune?.ribbonHours" />
          <span>{{ boxLabel(p) }} Lv.{{ p.level }} · {{ p.nature }}</span>
        </button>
        <p v-if="!box.pokemon.length" class="muted">{{ translateUi("盒子是空的，可以用自定义面板。") }}</p>
        <button class="btn ghost" type="button" @click="picking = false">{{ translateUi("关闭") }}</button>
      </section>
    </div>

    <SpeciesSheet v-if="adding" @close="adding = false" @pick="addCustom" />

    <div v-if="editingPanel" v-back="() => { editing = null }" @touchstart.stop @touchend.stop @touchcancel.stop class="overlay" @click.self="editing = null">
      <section class="sheet stack">
        <div class="row">
          <h3>{{ customs.some((item) => item.uid === editing) ? translateUi("自定义面板") : translateUi("编辑个体") }}</h3>
        </div>
        <MemberEditor v-model="editingPanel" @copy="duplicateEditing" @remove="remove(editing ?? '')" />
        <button v-if="customs.some((item) => item.uid === editing)" class="btn" type="button" :disabled="[151, 491].includes(editingPanel.pokeId) && editingPanel.ingredientSlots[0] == null" @click="saveCustomToBox">{{ translateUi("保存到盒子") }}</button>
        <button class="btn" type="button" :disabled="[151, 491].includes(editingPanel.pokeId) && editingPanel.ingredientSlots[0] == null" @click="editing = null">{{ translateUi("完成") }}</button>
      </section>
    </div>
  </div>
</template>
