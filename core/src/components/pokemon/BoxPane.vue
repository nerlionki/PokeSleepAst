<script setup lang="ts">
import { editorMemberFields } from '../../calc/memberPresets'


import { defaultSkillLevel } from '../../calc/member'

import { confirmRemoval } from '#platform/confirm'
import clientDefaults from '../../data/client-defaults.resource'
import { cloneData } from '../../calc/dataClone'

import { computed, reactive, ref, shallowRef } from 'vue'
import ProgressDialog from '../shared/ProgressDialog.vue'
import type { ImportProgress } from '../../calc/ocrImportCore'
import { useRoute, useRouter } from 'vue-router'
import BoxOverview from './BoxOverview.vue'
import { FILTER_CATALOG, boxLabel, boxMatches, EMPTY_BOX_QUERY, filterCount, type BoxQuery } from '../../calc/boxFilter'
import { selectionList, toggleChoice } from '../../calc/multiChoice'
import { NEUTRAL_NATURE, POKEDEX } from '../../calc/data'
import { defaultTune } from '../../calc/member'
import { cloneMemberDraft } from '../../calc/memberDraft'
import { importScreenshotSelection } from '#platform/screenshots'
import { hasShiny } from '../../calc/raeImage'
import { useBoxStore } from '../../stores/box'
import type { BoxPokemon, MemberTune, OcrMissingField } from '../../types'
import BerryIcon from '../shared/BerryIcon.vue'
import IngredientIcon from '../shared/IngredientIcon.vue'
import SpeciesSheet from '../shared/SpeciesSheet.vue'
import PokeSprite from '../shared/PokeSprite.vue'
import MainSkillIcon from '../shared/MainSkillIcon.vue'
import SubskillIcon from '../shared/SubskillIcon.vue'
import ShinyMark from '../shared/ShinyMark.vue'
import MemberEditor from '../team/MemberEditor.vue'
import { SPECIALTY_FILTERS } from '../../calc/specialty'
import OcrCompletionDialog from './OcrCompletionDialog.vue'
import { confirmEditedOcrField, normalizeOcrMissing } from '../../calc/ocrCompletion'
const components_pokemon_BoxPane_config_clientDefaults = clientDefaults.modules.components_pokemon_BoxPane


const TYPES = SPECIALTY_FILTERS
const sleepTypes = [...new Set(POKEDEX.map(poke => poke.sleepType))]

const route = useRoute()
const router = useRouter()
const overviewOpen = computed(() => route.query.boxOverview === '1')
function openOverview() { void router.push({ path: route.path, query: { ...route.query, tab: 'box', boxOverview: '1' } }) }
function closeOverview() {
  const query = { ...route.query }
  delete query.boxOverview
  if ('replace' in router && typeof router.replace === 'function') void router.replace({ path: route.path, query })
  else void router.push({ path: route.path, query })
}
function completeFromOverview(uids: string[]) { closeOverview(); completionQueue.value = uids }
const box = useBoxStore()
const picking = shallowRef(components_pokemon_BoxPane_config_clientDefaults["pickingInitial"])
const ocrBusy = shallowRef(components_pokemon_BoxPane_config_clientDefaults["ocrBusyInitial"])
const ocrMsg = shallowRef(components_pokemon_BoxPane_config_clientDefaults["ocrMsgInitial"])
const ocrProgress = shallowRef<ImportProgress>((cloneData(components_pokemon_BoxPane_config_clientDefaults["ocrProgressInitial"]) as unknown as ImportProgress))
const filterPanel = shallowRef<'none' | 'sleep' | 'berry' | 'skill' | 'advanced'>('none')
const query = reactive<Omit<BoxQuery, 'berryType' | 'specialty' | 'mainSkill'> & { berryType: string[]; specialty: string[]; mainSkill: string[]; sleepTypes: string[] }>({ ...EMPTY_BOX_QUERY, berryType: selectionList(EMPTY_BOX_QUERY.berryType), specialty: selectionList(EMPTY_BOX_QUERY.specialty), mainSkill: selectionList(EMPTY_BOX_QUERY.mainSkill), sleepTypes: [], ingredients: [], subskills: [] })

interface BoxDraft extends BoxPokemon {
  tune: MemberTune
}

const editing = ref<BoxDraft | null>((components_pokemon_BoxPane_config_clientDefaults["editingInitial"] as unknown as BoxDraft | null))
const completionQueue = shallowRef<string[]>((cloneData(components_pokemon_BoxPane_config_clientDefaults["completionQueueInitial"]) as unknown as string[]))
const pendingOcr = computed(() => box.pokemon.filter((pokemon) => normalizeOcrMissing(pokemon.ocrMissing).length))
const completing = computed(() => completionQueue.value.map((uid) => box.pokemon.find((pokemon) => pokemon.uid === uid))
  .find((pokemon) => pokemon && normalizeOcrMissing(pokemon.ocrMissing).length))

function resumeCompletion(pokemon?: BoxPokemon) {
  completionQueue.value = pokemon ? [pokemon.uid] : pendingOcr.value.map((item) => item.uid)
}

function persistCompletion(pokemon: BoxPokemon) {
  box.update(pokemon.uid, { ...pokemon, ocrMissing: pokemon.ocrMissing ?? [] })
}

function saveCompletion(pokemon: BoxPokemon) {
  persistCompletion(pokemon)
  completionQueue.value = completionQueue.value.filter((uid) => uid !== pokemon.uid)
}

function pauseCompletion(pokemon: BoxPokemon) {
  persistCompletion(pokemon)
  completionQueue.value = []
}

async function removePokemon(uid: string) {
  if (await confirmRemoval('确认从盒子删除此宝可梦？')) box.remove(uid)
}

function blank(pokeId: number): BoxDraft {
  return {
    uid: '',
    pokeId,
    ...editorMemberFields(),
    nature: NEUTRAL_NATURE,
    skillLevel: defaultSkillLevel(pokeId),
    name: '',
    napping: false,
    tune: defaultTune(pokeId),
  }
}

async function pickShots() {
  if (ocrBusy.value) return
  ocrProgress.value = { stage: '请选择截图', completed: 0, total: 0, percent: 0 }
  ocrBusy.value = true
  ocrMsg.value = '正在识别…'
  try {
    const result = await importScreenshotSelection(box.pokemon, value => { ocrProgress.value = value })
    if (!result) { ocrMsg.value = ''; return }
    const imported = result.accepted.map((pokemon) => box.create(pokemon))
    completionQueue.value = imported.filter((pokemon) => normalizeOcrMissing(pokemon.ocrMissing).length).map((pokemon) => pokemon.uid)
    ocrMsg.value = `写入 ${result.accepted.length} 只，跳过 ${result.skipped} 只，丢弃 ${result.discarded} 只`
  }
  catch (cause) {
    ocrMsg.value = cause instanceof Error ? cause.message : '模型没有加载成功'
  }
  finally {
    ocrBusy.value = false
  }
}

function pickSpecies(id: number) {
  picking.value = false
  editing.value = blank(id)
}

function confirmEditingField(field: OcrMissingField) {
  if (editing.value) editing.value = confirmEditedOcrField(editing.value, field)
}

function openEdit(pokemon: BoxPokemon) {
  completionQueue.value = []
  editing.value = cloneMemberDraft({
    ...pokemon,
    tune: { ...defaultTune(), ...pokemon.tune },
  })
}

function save() {
  const draft = editing.value
  if (!draft) return
  if (!draft.uid) box.create({ ...draft })
  else box.update(draft.uid, { ...draft, ocrMissing: draft.ocrMissing ?? [] })
  editing.value = null
}

function clearFilters() {
  filterPanel.value = 'none'
  query.text = ''; query.sleepTypes = []
  query.berryType = []
  query.specialty = []
  query.mainSkill = []
  query.ingredients = []
  query.subskills = []
  query.ingredientLock = 'unlocked'
  query.subskillLock = 'unlocked'
  query.subskillCombine = 'and'
}

const filtered = computed(() => [...box.pokemon].reverse().filter((pokemon) => boxMatches(pokemon, query)))
const activeFilters = computed(() => filterCount(query))
function toggleFilter(panel: typeof filterPanel.value) { filterPanel.value = filterPanel.value === panel ? 'none' : panel }
const advancedCount = computed(() => Number(query.ingredients.length > 0) + Number(query.subskills.length > 0))
</script>

<template>
  <ProgressDialog :open="ocrBusy" title="正在导入 Box 截图" :progress="ocrProgress.total ? ocrProgress.percent : null" :stage="ocrProgress.stage"
    :detail="ocrProgress.total ? '已处理 ' + ocrProgress.completed + ' / ' + ocrProgress.total + ' 张' : ''"
    hint="导入完成后可切换页面，请保持当前页面。" />
  <BoxOverview v-if="overviewOpen" @back="closeOverview" @complete="completeFromOverview" />
  <div v-else class="stack" :inert="ocrBusy">
    <div class="row">
      <button class="btn" type="button" @click="openOverview">Box 概览</button>
      <button class="btn" type="button" @click="picking = true">新增宝可梦</button>
      <button class="btn" type="button" :disabled="ocrBusy" @click="pickShots">导入</button>
    </div>
    <div class="row box-search">
      <input v-model="query.text" class="picker-search" placeholder="搜索昵称、中文、英文或图鉴编号">
      <button class="btn ghost" type="button" @click="clearFilters">重置</button>
    </div>
    <div class="picker-filters">
      <button v-for="item in ['全部', ...TYPES]" :key="item" type="button" :class="{ on: item === '全部' ? !query.specialty.length : query.specialty.includes(item) }" @click="toggleChoice(query.specialty, item, TYPES)">{{ item }}</button>
      <button type="button" :class="{ on: filterPanel === 'sleep' || query.sleepTypes.length > 0 }" :aria-expanded="filterPanel === 'sleep'" @click="toggleFilter('sleep')">睡眠</button>
      <button type="button" :class="{ on: filterPanel === 'berry' || query.berryType.length > 0 }" :aria-expanded="filterPanel === 'berry'" @click="toggleFilter('berry')">树果</button>
      <button type="button" :class="{ on: filterPanel === 'skill' || query.mainSkill.length > 0 }" :aria-expanded="filterPanel === 'skill'" @click="toggleFilter('skill')">技能</button>
      <button type="button" :class="{ on: filterPanel === 'advanced' || advancedCount > 0 }" :aria-expanded="filterPanel === 'advanced'" @click="toggleFilter('advanced')">更多筛选{{ advancedCount ? ` ${advancedCount}` : '' }}</button>
    </div>
    <div v-if="filterPanel === 'sleep'" class="picker-opts">
      <button type="button" :class="{ on: !query.sleepTypes.length }" @click="query.sleepTypes = []">全部</button>
      <button v-for="item in sleepTypes" :key="item" type="button" :class="{ on: query.sleepTypes.includes(item) }" @click="toggleChoice(query.sleepTypes, item, sleepTypes)">{{ item }}</button>
    </div>
    <div v-else-if="filterPanel === 'berry'" class="picker-opts">
      <button type="button" :class="{ on: !query.berryType.length }" @click="query.berryType = []">全部</button>
      <button v-for="item in FILTER_CATALOG.berries" :key="item.name" type="button" :class="{ on: query.berryType.includes(item.type) }" @click="toggleChoice(query.berryType, item.type, FILTER_CATALOG.berries.map(item => item.type))"><BerryIcon :name="item.name" />{{ item.name }}</button>
    </div>
    <div v-else-if="filterPanel === 'skill'" class="picker-opts">
      <button type="button" :class="{ on: !query.mainSkill.length }" @click="query.mainSkill = []">全部</button>
      <button v-for="item in FILTER_CATALOG.skills" :key="item" type="button" :class="{ on: query.mainSkill.includes(item) }" @click="toggleChoice(query.mainSkill, item, FILTER_CATALOG.skills)"><MainSkillIcon :name="item" decorative />{{ item }}</button>
    </div>
    <section v-else-if="filterPanel === 'advanced'" class="stack" aria-label="Box 专有筛选">
      <div class="row">
        <p class="muted">食材</p>
        <div class="seg">
          <button type="button" :class="{ on: query.ingredientLock === 'unlocked' }" @click="query.ingredientLock = 'unlocked'">已解锁</button>
          <button type="button" :class="{ on: query.ingredientLock === 'locked' }" @click="query.ingredientLock = 'locked'">未解锁</button>
        </div>
      </div>
      <div class="picker-opts">
        <button type="button" :class="{ on: !query.ingredients.length }" @click="query.ingredients = []">全部</button>
        <button v-for="item in FILTER_CATALOG.ingredients" :key="item.id" type="button" :class="{ on: query.ingredients.includes(item.name) }" @click="toggleChoice(query.ingredients, item.name, FILTER_CATALOG.ingredients.map(item => item.name))">
          <IngredientIcon :id="item.id" :name="item.name" small />{{ item.name }}
        </button>
      </div>
      <div class="row">
        <p class="muted">副技能</p>
        <div class="seg">
          <button type="button" :class="{ on: query.subskillCombine === 'and' }" @click="query.subskillCombine = 'and'">并且</button>
          <button type="button" :class="{ on: query.subskillCombine === 'or' }" @click="query.subskillCombine = 'or'">或者</button>
        </div>
        <div class="seg">
          <button type="button" :class="{ on: query.subskillLock === 'unlocked' }" @click="query.subskillLock = 'unlocked'">已解锁</button>
          <button type="button" :class="{ on: query.subskillLock === 'locked' }" @click="query.subskillLock = 'locked'">未解锁</button>
        </div>
      </div>
      <div class="picker-opts">
        <button type="button" :class="{ on: !query.subskills.length }" @click="query.subskills = []">全部</button>
        <button v-for="item in FILTER_CATALOG.subskills" :key="item.id" type="button" :class="{ on: query.subskills.includes(item.id) }" @click="toggleChoice(query.subskills, item.id, FILTER_CATALOG.subskills.map(item => item.id))">
          <SubskillIcon :id="item.id" decorative />{{ item.name }}
        </button>
      </div>
    </section>
    <p class="muted">{{ filtered.length }} / {{ box.pokemon.length }} 只{{ activeFilters ? ` · 已启用 ${activeFilters} 项筛选` : '' }}</p>
    <p v-if="ocrMsg" class="amber">{{ ocrMsg }}</p>
    <div v-if="pendingOcr.length" class="card row">
      <span class="muted">{{ pendingOcr.length }} 只宝可梦有待补全字段</span>
      <button class="btn ghost" type="button" @click="resumeCompletion()">继续补全</button>
    </div>

    <div v-if="!box.pokemon.length" class="card muted">还没有盒子成员</div>
    <div v-else-if="!filtered.length" class="card stack">
      <p class="muted">暂无满足条件的宝可梦</p>
      <button class="btn ghost" type="button" @click="clearFilters">清除筛选</button>
    </div>
    <div v-for="pokemon in filtered" :key="pokemon.uid" class="card">
      <div class="list-item" style="border: 0">
        <PokeSprite :id="pokemon.pokeId" :name="boxLabel(pokemon)" :shiny="pokemon.shiny" />
        <div>
          <strong>{{ boxLabel(pokemon) }}<ShinyMark v-if="pokemon.shiny" /></strong>
          <div class="muted">Lv.{{ pokemon.level }} · {{ pokemon.nature }}{{ pokemon.natureMinted ? " · 净白薄荷" : "" }}{{ pokemon.napping ? ' · 午睡岛' : '' }}</div>
          <span v-if="pokemon.ocrMissing?.length" class="amber">{{ pokemon.ocrMissing.length }} 项待补全</span>
        </div>
        <div class="stack">
          <button v-if="pokemon.ocrMissing?.length" class="btn" type="button" @click="resumeCompletion(pokemon)">补全</button>
          <button class="btn ghost" type="button" @click="openEdit(pokemon)">编辑</button>
          <button class="btn ghost" type="button" @click="removePokemon(pokemon.uid)">删除</button>
        </div>
      </div>
    </div>
    <SpeciesSheet v-if="picking" @close="picking = false" @pick="pickSpecies" />
    <div v-if="editing" v-back="() => { editing = null }" @touchstart.stop @touchend.stop @touchcancel.stop class="overlay" @click.self="editing = null">
      <section class="sheet stack">
        <div class="row">
          <h3>{{ editing.uid ? '编辑个体' : '新建个体' }}<ShinyMark v-if="editing.shiny" /></h3>
          <button class="btn ghost" type="button" @click="editing = null">取消</button>
        </div>
        <MemberEditor v-model="editing" :actions="false" :shiny="editing.shiny" @confirm="confirmEditingField" />
        <p v-if="editing.ocrMissing?.length" class="amber">还有 {{ editing.ocrMissing.length }} 项待确认；请点选对应字段。未修改的识别占位值仍会保留待补全标记。</p>
        <div class="field"><label>名称</label><input v-model="editing.name" placeholder="留空则显示宝可梦名"></div>
        <label v-if="hasShiny(editing.pokeId)" class="row"><input v-model="editing.shiny" type="checkbox"> 闪光<ShinyMark v-if="editing.shiny" /></label>
        <label class="row"><input v-model="editing.napping" type="checkbox"> 寄放午睡岛</label>
        <button class="btn" type="button" :disabled="[151, 491].includes(editing.pokeId) && editing.ingredientSlots[0] == null" @click="save">保存</button>
      </section>
    </div>
    <OcrCompletionDialog v-if="completing && !editing" :key="completing.uid" :pokemon="completing" :remaining="completionQueue.length" @save="saveCompletion" @pause="pauseCompletion" />
  </div>
</template>

<style scoped>
.box-search { flex-wrap: nowrap; }
.box-search > .picker-search { flex: 1; min-width: 0; width: 0; }
.box-search > button { flex-shrink: 0; }
</style>
