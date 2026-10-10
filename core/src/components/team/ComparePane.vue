<script setup lang="ts">
import { newUid } from '../../calc/uid'
import { computed, ref, shallowRef, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { useRoute } from 'vue-router'
import { boxLabel, speciesName } from '../../calc/boxFilter'
import { ingredientByName } from '../../calc/data'
import { compareHelpingBonus, defaultTune, type MemberDraft } from '../../calc/member'
import { produce } from '../../calc/produce'
import { useBoxStore } from '../../stores/box'
import { useSettingsStore } from '../../stores/settings'
import type { ProduceResult } from '../../types'
import MemberCard from './MemberCard.vue'
import MemberEditor from './MemberEditor.vue'
import PokeSprite from '../shared/PokeSprite.vue'
import SpeciesSheet from '../shared/SpeciesSheet.vue'

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
  subskills: string[]
  ingredientSlots: [number | null, number | null, number | null]
  skillLevel: number
  mewSkill?: number
  carryMode?: MemberDraft['tune']['carryMode']
  ribbonHours?: number
  bonus: number
  r: ProduceResult
}

const LEVELS = [1, 10, 25, 30, 50, 60, 70]

const box = useBoxStore()
const { settings } = storeToRefs(useSettingsStore())
const route = useRoute()
const selected = ref<string[]>([])
const customs = ref<CustomPanel[]>([])
const editing = ref<string | null>(null)
const level = shallowRef<number | null>(null)
const picking = shallowRef(false)
const adding = shallowRef(false)

watch(() => route.query.uid, (uid) => {
  if (typeof uid === 'string' && uid && !selected.value.includes(uid)) selected.value = [...selected.value, uid]
}, { immediate: true })

function blank(pokeId: number, uid = `c-${newUid()}`): CustomPanel {
  return {
    uid,
    pokeId,
    level: 30,
    nature: '勤奋',
    subskills: ['', '', '', '', ''],
    ingredientSlots: [0, 1, 2],
    skillLevel: 1,
    tune: defaultTune(),
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
  return {
    pokeId: owned.pokeId,
    level: owned.level,
    nature: owned.nature,
    subskills: [...owned.subskills],
    ingredientSlots: [owned.ingredientSlots[0], owned.ingredientSlots[1], owned.ingredientSlots[2]],
    skillLevel: owned.skillLevel,
    mewSkill: owned.mewSkill,
    tune: { ...defaultTune(), ...owned.tune },
  }
}

function copyRow(uid: string) {
  const source = draftOf(uid)
  if (!source) return
  const row: CustomPanel = {
    ...source,
    subskills: [...source.subskills],
    ingredientSlots: [source.ingredientSlots[0], source.ingredientSlots[1], source.ingredientSlots[2]],
    tune: { ...source.tune },
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

function remove(uid: string) {
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
    level: next.level,
    nature: next.nature,
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
    wakeEnergy: 100,
  }
  const bonus = compareHelpingBonus(input.level, source.subskills, settings.value.helpingBonus)
  return {
    uid,
    pokeId: source.pokeId,
    custom: !!custom,
    name: custom ? nameOf(source.pokeId) : boxLabel(boxP!),
    level: input.level,
    nature: source.nature,
    subskills: source.subskills,
    ingredientSlots: source.ingredientSlots,
    skillLevel: source.skillLevel,
    mewSkill: source.mewSkill,
    carryMode: tune?.carryMode,
    ribbonHours: tune?.ribbonHours,
    bonus,
    r: produce(settings.value, input, bonus),
  }
}).filter((row): row is CompareRow => row !== null))

function strength(row: CompareRow) {
  const ingredients = Object.entries(row.r.ingredients).reduce((sum, [name, count]) => sum + count * (ingredientByName(name)?.energy ?? 0), 0)
  return row.r.berryEnergy + (row.r.cooking?.energy ?? ingredients) + row.r.skillEnergy
}

const peak = computed(() => Math.max(0, ...rows.value.map(strength)))

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
  const created = box.create({
    pokeId: draft.pokeId,
    level: draft.level,
    nature: draft.nature,
    subskills: [...draft.subskills],
    ingredientSlots: [draft.ingredientSlots[0], draft.ingredientSlots[1], draft.ingredientSlots[2]],
    skillLevel: draft.skillLevel,
    mewSkill: draft.mewSkill,
    name: '',
    napping: false,
    tune: { ...draft.tune },
  })
  selected.value = selected.value.map((id) => (id === uid ? created.uid : id))
  customs.value = customs.value.filter((item) => item.uid !== uid)
  editing.value = null
}
</script>

<template>
  <div class="stack">
    <div class="lv-row">
      <span class="muted">LV</span>
      <button type="button" :class="{ on: level === null }" @click="level = null">原级</button>
      <button v-for="lv in LEVELS" :key="lv" type="button" :class="{ on: level === lv }" @click="level = lv">{{ lv }}</button>
    </div>
    <div class="seg">
      <button type="button" :class="{ on: settings.period === 'day' }" @click="settings.period = 'day'">每日</button>
      <button type="button" :class="{ on: settings.period === 'week' }" @click="settings.period = 'week'">每周</button>
    </div>
    <p class="muted">并排比较个体产量，同一行里最高的数字会高亮。按全天满活力计算；自身有帮手奖励时按 5 层。</p>
    <div class="cmp-board">
      <article v-for="row in rows" :key="row.uid" class="card cmp-col">
        <MemberCard
          :poke-id="row.pokeId"
          :level="row.level"
          :nature="row.nature"
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
        <span v-if="best(strength(row))" class="chip">最高</span>
        <div class="row">
          <button class="btn ghost" type="button" @click="editing = row.uid">编辑</button>
          <button class="btn ghost" type="button" @click="copyRow(row.uid)">复制</button>
          <button class="btn ghost" type="button" @click="remove(row.uid)">移除</button>
        </div>
      </article>
      <article class="card cmp-col slot-card">
        <span class="slot-empty">＋</span>
        <button class="btn" type="button" @click="picking = true">从盒子</button>
        <button class="btn ghost" type="button" @click="adding = true">自定义</button>
      </article>
    </div>

    <div v-if="picking" v-back="() => { picking = false }" class="overlay" @click.self="picking = false">
      <section class="sheet stack">
        <h3>加入比较</h3>
        <button v-for="p in box.pokemon" :key="p.uid" class="data-row" type="button" @click="take(p.uid)">
          <PokeSprite :id="p.pokeId" :name="boxLabel(p)" :shiny="p.shiny" />
          <span>{{ boxLabel(p) }} Lv.{{ p.level }} · {{ p.nature }}</span>
        </button>
        <p v-if="!box.pokemon.length" class="muted">盒子是空的，可以用自定义面板。</p>
        <button class="btn ghost" type="button" @click="picking = false">关闭</button>
      </section>
    </div>

    <SpeciesSheet v-if="adding" @close="adding = false" @pick="addCustom" />

    <div v-if="editingPanel" v-back="() => { editing = null }" class="overlay" @click.self="editing = null">
      <section class="sheet stack">
        <div class="row">
          <h3>{{ customs.some((item) => item.uid === editing) ? '自定义面板' : '编辑个体' }}</h3>
          <button v-if="customs.some((item) => item.uid === editing)" class="btn" type="button" @click="saveCustomToBox">保存到盒子</button>
          <button class="btn ghost" type="button" @click="editing = null">完成</button>
        </div>
        <MemberEditor v-model="editingPanel" @copy="duplicateEditing" @remove="remove(editing ?? '')" />
      </section>
    </div>
  </div>
</template>
