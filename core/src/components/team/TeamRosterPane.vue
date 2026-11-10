<script setup lang="ts">
import { recipeById } from '../../calc/catalogIds'
import { gameText, t as translateUi } from '../../ui/i18n'


import { confirmRemoval } from '#platform/confirm'
import clientDefaults from '../../data/client-defaults.resource'
import { cloneData } from '../../calc/dataClone'

import { computed, shallowRef } from 'vue'
import { storeToRefs } from 'pinia'
import { boxLabel } from '../../calc/boxFilter'
import { defaultTune, type MemberDraft } from '../../calc/member'
import { memberDraftToBox } from '../../calc/memberDraft'
import LevelSelector from '../shared/LevelSelector.vue'
import ToggleField from '../shared/ToggleField.vue'
import { teamProduce } from '../../calc/team'
import { clockOf } from '../../calc/timeline'
import { teamRestrictionError } from '../../calc/teamRestrictions'
import { useBoxStore } from '../../stores/box'
import { useRosterStore, type TeamCustom } from '../../stores/roster'
import { useSettingsStore } from '../../stores/settings'
import { useProductionActivity } from '../../composables/useProductionActivity'
import type { ProduceInput } from '../../types'
import PokeSprite from '../shared/PokeSprite.vue'
import SpeciesSheet from '../shared/SpeciesSheet.vue'
import MemberCard from './MemberCard.vue'
import PokemonPreview from '../pokemon/PokemonPreview.vue'
import MemberEditor from './MemberEditor.vue'
const components_team_TeamRosterPane_config_clientDefaults = clientDefaults.modules.components_team_TeamRosterPane


const props = withDefaults(defineProps<{ editorOnly?: boolean; productionOnly?: boolean }>(), { editorOnly: false, productionOnly: false })

const LEVELS = cloneData(components_team_TeamRosterPane_config_clientDefaults["LEVELS"])

const box = useBoxStore()
const roster = useRosterStore()
const { settings } = storeToRefs(useSettingsStore())
const { enabled: activityEnabled, settings: calculationSettings } = useProductionActivity('team', settings)
const view = shallowRef<'overview' | 'detail' | 'time'>((components_team_TeamRosterPane_config_clientDefaults["viewInitial"] as unknown as 'overview' | 'detail' | 'time'))
const level = shallowRef<number | null>((components_team_TeamRosterPane_config_clientDefaults["levelInitial"] as unknown as number | null))
const picking = shallowRef<number | null>((components_team_TeamRosterPane_config_clientDefaults["pickingInitial"] as unknown as number | null))
const adding = shallowRef<number | null>((components_team_TeamRosterPane_config_clientDefaults["addingInitial"] as unknown as number | null))
const editing = shallowRef<string | null>((components_team_TeamRosterPane_config_clientDefaults["editingInitial"] as unknown as string | null))

interface SlotMember extends MemberDraft {
  uid: string
  custom: boolean
  napping: boolean
  name: string
}

const members = computed(() => roster.slots.map((uid): SlotMember | null => {
  if (!uid) return null
  const custom = roster.customs.find((item) => item.uid === uid)
  if (custom) return { ...custom, name: '', tune: { ...defaultTune(), ...custom.tune }, custom: true, napping: false }
  const owned = box.pokemon.find((item) => item.uid === uid)
  if (!owned) return null
  return { ...owned, name: owned.name, tune: { ...defaultTune(), ...roster.tunes[uid], ...owned.tune }, custom: false }
}))

function toInput(member: SlotMember): ProduceInput & { uid: string, name: string, napping: boolean } {
  return {
    uid: member.uid,
    pokeId: member.pokeId,
    level: level.value ?? member.level,
    nature: member.nature,
    natureMinted: member.natureMinted,
    subskills: member.subskills,
    ingredientSlots: member.ingredientSlots,
    skillLevel: member.skillLevel,
    mewSkill: member.mewSkill,
    name: member.name,
    napping: member.napping,
    carryMode: member.tune.carryMode,
    ribbonHours: member.tune.ribbonHours,
    displayName: boxLabel(member),
  }
}

const analyzed = computed(() => members.value.flatMap((member) => (member && !member.napping ? [toInput(member)] : [])))
const teamError = computed(() => teamRestrictionError(members.value.flatMap(member => member ? [member] : [])))
const result = computed(() => props.editorOnly ? null : teamProduce(calculationSettings.value, teamError.value ? [] : analyzed.value))

const slotResult = computed(() => {
  let cursor = components_team_TeamRosterPane_config_clientDefaults["cursor"]
  return members.value.map((member) => {
    if (!member || member.napping) return null
    return result.value?.members[cursor++] ?? null
  })
})

const bagRows = computed(() => Object.entries(result.value?.bag ?? {}).sort((a, b) => b[1] - a[1]))
const events = computed(() => (result.value?.events ?? []).slice(0, settings.value.period === 'week' ? 40 : 24))

const editingDraft = computed({
  get(): MemberDraft | null {
    const uid = editing.value
    if (!uid) return null
    return members.value.find((member) => member?.uid === uid) ?? null
  },
  set(next: MemberDraft | null) {
    const uid = editing.value
    if (!uid || !next) return
    if (uid.startsWith('custom-')) roster.updateCustom(uid, next as TeamCustom)
    else {
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
      roster.setTune(uid, next.tune)
    }
  },
})

function kindLabel(kind: string) {
  if (kind === 'healAll') return '全体疗愈'
  if (kind === 'healOne') return '单体疗愈'
  if (kind === 'healSelf') return '自回'
  if (kind === 'support') return '帮手支援'
  if (kind === 'typeAccel') return '属性加速'
  if (kind === 'helpAccel') return '帮手加速'
  if (kind === 'charge') return '能量填充'
  return kind
}

function put(uid: string) {
  if (picking.value == null) return
  if (!roster.setSlot(picking.value, uid)) return
  picking.value = null
}

function pickSpecies(id: number) {
  if (adding.value == null) return
  const uid = roster.addCustom(adding.value, id)
  adding.value = null
  if (!uid) return
  editing.value = uid
}

function copySlot(index: number) {
  const uid = roster.slots[index]
  if (!uid) return
  if (uid.startsWith('custom-')) roster.duplicateCustom(uid)
  else {
    const empty = roster.slots.findIndex((slot) => !slot)
    if (empty >= 0) roster.setSlot(empty, uid)
  }
}

async function removeSlot(index: number) {
  if (!await confirmRemoval('确认从队伍移除此宝可梦？')) return
  const uid = roster.slots[index]
  roster.setSlot(index, null)
  if (editing.value === uid) editing.value = null
}

function saveCustomToBox() {
  const uid = editing.value
  const draft = editingDraft.value
  if (!uid?.startsWith('custom-') || !draft) return
  const index = roster.slots.indexOf(uid)
  const created = box.create(memberDraftToBox(draft))
  if (index >= 0) roster.setSlot(index, created.uid)
  editing.value = null
}
</script>

<template>
  <div class="stack">
    <ToggleField v-if="!props.editorOnly" v-model="activityEnabled" :label="translateUi('计入活动加成')" />
    <p v-if="teamError || roster.error" class="amber" role="alert">{{ teamError || roster.error }}{{ translateUi("请调整队伍后计算。") }}</p>
    <template v-if="!props.editorOnly && result">
    <LevelSelector v-model="level" :levels="LEVELS" allow-original />
    <div class="seg seg-2">
      <button type="button" :class="{ on: settings.period === 'day' }" @click="settings.period = 'day'">{{ translateUi("每日") }}</button>
      <button type="button" :class="{ on: settings.period === 'week' }" @click="settings.period = 'week'">{{ translateUi("每周") }}</button>
    </div>
    <div class="seg seg-3">
      <button type="button" :class="{ on: view === 'overview' }" @click="view = 'overview'">{{ translateUi("概览") }}</button>
      <button type="button" :class="{ on: view === 'detail' }" @click="view = 'detail'">{{ translateUi("详细") }}</button>
      <button type="button" :class="{ on: view === 'time' }" @click="view = 'time'">{{ translateUi("时间") }}</button>
    </div>

    <article v-if="view === 'overview' && !teamError" class="card stack">
      <p class="muted">{{ translateUi("卡比兽能量 ·") }} {{ settings.period === 'week' ? translateUi("周") : translateUi("日") }}{{ level == null ? '' : translateUi("· 按 Lv.{arg1}", { arg1: String(level) }) }}</p>
      <div class="big amber">{{ Math.round(result.totalEnergy).toLocaleString() }}</div>
      <p>{{ translateUi("树果") }} {{ Math.round(result.berryEnergy).toLocaleString() }} {{ translateUi("· 料理") }} {{ Math.round(result.cookEnergy).toLocaleString() }} {{ translateUi("· 技能") }} {{ Math.round(result.skillEnergy).toLocaleString() }}</p>
      <p class="muted">{{ translateUi("帮手奖励") }} {{ result.helpingBonus }} {{ translateUi("层") }}</p>
      <p class="muted">{{ translateUi("技能食材、活力与扩锅采用期望状态近似，料理暴击保留概率分支。挥指按 26 种候选等概率估算；道具奖励单列，不自动使用。变身／模仿按队友等概率估算，抽到特殊宝可梦或复制技能时失败并使用能量填充S。") }}</p>
    </article>

    </template>
    <div class="slot-grid">
      <article v-for="(member, idx) in members" v-show="!props.productionOnly || member" :key="idx" class="slot-card roster-slot" :class="{ rich: member }">
        <template v-if="member">
          <MemberCard
            :environment="calculationSettings"
            v-if="!props.editorOnly && slotResult[idx] && result"
            :poke-id="member.pokeId"
            :level="level ?? member.level"
            :nature="member.nature"
            :nature-minted="member.natureMinted"
            :subskills="member.subskills"
            :ingredient-slots="member.ingredientSlots"
            :skill-level="member.skillLevel"
            :mew-skill="member.mewSkill"
            :result="slotResult[idx]!"
            :carry-mode="member.tune.carryMode"
            :ribbon-hours="member.tune.ribbonHours"
            :helping-bonus="result.helpingBonus"
            :label="boxLabel(member)"
          />
          <PokemonPreview v-else-if="props.editorOnly" :pokemon="member" />
          <p v-else class="muted">{{ boxLabel(member) }}{{ teamError ? translateUi("：队伍不符合限制，已暂停计算。") : " " + translateUi("在午睡岛，不计入产量。") }}</p>
          <div v-if="!props.productionOnly" class="row">
            <button class="btn ghost" type="button" @click="editing = member.uid">{{ translateUi("编辑") }}</button>
            <button class="btn ghost" type="button" @click="copySlot(idx)">{{ translateUi("复制") }}</button>
            <button class="btn ghost" type="button" @click="removeSlot(idx)">{{ translateUi("移除") }}</button>
          </div>
        </template>
        <template v-else-if="!props.productionOnly">
          <span class="slot-empty">{{ translateUi("空") }}</span>
          <button class="btn" type="button" @click="picking = idx">{{ translateUi("从盒子") }}</button>
          <button class="btn ghost" type="button" @click="adding = idx">{{ translateUi("自定义") }}</button>
        </template>
      </article>
    </div>

    <template v-if="!props.editorOnly && result && view === 'detail'">
      <article class="card stack">
        <h3>{{ translateUi("食材袋") }}</h3>
        <p v-if="!bagRows.length" class="muted">{{ translateUi("还没有入库食材。") }}</p>
        <p v-for="[name, n] in bagRows" :key="name">{{ gameText(name) }} ×{{ n }}</p>
      </article>
      <article class="card">
        <h3>{{ translateUi("三餐") }}</h3>
        <p class="muted">{{ translateUi("每天 08:00／12:00／18:00，最多每周 21 顿。餐点与睡眠重叠时无法做饭，请调整全局睡眠时间。") }}</p>
        <p v-for="(meal, i) in result.meals.slice(0, settings.period === 'week' ? 21 : 3)" :key="i">{{ translateUi("第") }} {{ Math.floor((meal.minute ?? 0) / 1440) + 1 }} {{ translateUi("天") }} {{ clockOf(meal.minute ?? 0) }} · {{ gameText(recipeById(meal.recipeId)?.name ?? meal.name) }} · {{ meal.energy.toLocaleString() }} {{ translateUi("· 锅") }} {{ meal.potSize }} {{ translateUi("· 暴击") }} {{ ((meal.critChance ?? 0) * 100).toFixed(1) }}%</p>
      </article>
    </template>

    <article v-else-if="!props.editorOnly && result && view === 'time'" class="card stack">
      <h3>{{ translateUi("技能发动时点") }}</h3>
      <p v-if="!events.length" class="muted">{{ translateUi("本周期没有发动记录。") }}</p>
      <p v-for="(event, i) in events" :key="i" class="muted">{{ clockOf(event.minute) }} · {{ gameText(event.name) }} · {{ kindLabel(event.kind) }}</p>
    </article>

    <div v-if="picking !== null" v-back="() => { picking = null }" @touchstart.stop @touchend.stop @touchcancel.stop class="overlay" @click.self="picking = null">
      <section class="sheet stack">
        <h3>{{ translateUi("放入槽位") }} {{ picking + 1 }}</h3>
        <p v-if="roster.error" class="amber" role="alert">{{ translateUi(roster.error) }}</p>
        <button v-for="p in box.pokemon" :key="p.uid" class="data-row" type="button" :disabled="p.napping" @click="put(p.uid)">
          <PokeSprite :id="p.pokeId" :name="boxLabel(p)" :shiny="p.shiny" :ribbon-hours="p.tune?.ribbonHours" />
          <span>{{ boxLabel(p) }} Lv.{{ p.level }}{{ p.napping ? translateUi("（午睡岛）") : '' }}</span>
        </button>
        <p v-if="!box.pokemon.length" class="muted">{{ translateUi("盒子是空的，可以用自定义。") }}</p>
        <button class="btn ghost" type="button" @click="picking = null">{{ translateUi("关闭") }}</button>
      </section>
    </div>

    <SpeciesSheet v-if="adding !== null" @close="adding = null" @pick="pickSpecies" />

    <div v-if="editingDraft" v-back="() => { editing = null }" @touchstart.stop @touchend.stop @touchcancel.stop class="overlay" @click.self="editing = null">
      <section class="sheet stack">
        <div class="row">
          <h3>{{ editingDraft && editing?.startsWith('custom-') ? translateUi("自定义面板") : translateUi("编辑个体") }}</h3>
        </div>
        <MemberEditor v-model="editingDraft" @copy="copySlot(roster.slots.indexOf(editing))" @remove="removeSlot(roster.slots.indexOf(editing))" />
        <button v-if="editing?.startsWith('custom-')" class="btn" type="button" :disabled="[151, 491].includes(editingDraft.pokeId) && editingDraft.ingredientSlots[0] == null" @click="saveCustomToBox">{{ translateUi("保存到盒子") }}</button>
        <button class="btn" type="button" :disabled="[151, 491].includes(editingDraft.pokeId) && editingDraft.ingredientSlots[0] == null" @click="editing = null">{{ translateUi("完成") }}</button>
      </section>
    </div>
  </div>
</template>
