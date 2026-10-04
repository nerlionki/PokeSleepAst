<script setup lang="ts">
import { computed, reactive, ref, shallowRef, useTemplateRef } from 'vue'
import { FILTER_CATALOG, boxLabel, boxMatches, EMPTY_BOX_QUERY, filterCount, type BoxQuery } from '../../calc/boxFilter'
import { defaultTune } from '../../calc/member'
import { importScreenshotFiles } from '../../calc/ocrImport'
import { hasShiny } from '../../calc/raeImage'
import { useBoxStore } from '../../stores/box'
import type { BoxPokemon, MemberTune } from '../../types'
import BerryIcon from '../shared/BerryIcon.vue'
import IngredientIcon from '../shared/IngredientIcon.vue'
import SpeciesSheet from '../shared/SpeciesSheet.vue'
import PokeSprite from '../shared/PokeSprite.vue'
import MainSkillIcon from '../shared/MainSkillIcon.vue'
import SubskillIcon from '../shared/SubskillIcon.vue'
import ShinyMark from '../shared/ShinyMark.vue'
import MemberEditor from '../team/MemberEditor.vue'
import { SPECIALTY_FILTERS } from '../../calc/specialty'

const TYPES = SPECIALTY_FILTERS

const box = useBoxStore()
const picking = shallowRef(false)
const ocrBusy = shallowRef(false)
const ocrMsg = shallowRef('')
const shotInput = useTemplateRef('shotInput')
const filtering = shallowRef(false)
const query = reactive<BoxQuery>({ ...EMPTY_BOX_QUERY, ingredients: [], subskills: [] })

interface BoxDraft extends BoxPokemon {
  tune: MemberTune
}

const editing = ref<BoxDraft | null>(null)

function blank(pokeId: number): BoxDraft {
  return {
    uid: '',
    pokeId,
    level: 30,
    nature: '勤奋',
    subskills: ['', '', '', '', ''],
    ingredientSlots: [0, 1, 2],
    skillLevel: 1,
    name: '',
    napping: false,
    tune: defaultTune(),
  }
}

function pickShots() {
  shotInput.value?.click()
}

async function onShots(event: Event) {
  const input = event.target as HTMLInputElement
  const files = [...(input.files ?? [])]
  input.value = ''
  if (!files.length) return
  ocrBusy.value = true
  ocrMsg.value = '正在识别…'
  try {
    const result = await importScreenshotFiles(files, box.pokemon)
    for (const pokemon of result.accepted) box.create(pokemon)
    ocrMsg.value = `写入 ${result.accepted.length} 只，跳过 ${result.skipped} 只，丢弃 ${result.discarded} 只`
  }
  catch {
    ocrMsg.value = '模型没有加载成功'
  }
  finally {
    ocrBusy.value = false
  }
}

function pickSpecies(id: number) {
  picking.value = false
  editing.value = blank(id)
}

function openEdit(pokemon: BoxPokemon) {
  editing.value = {
    ...pokemon,
    subskills: [...pokemon.subskills],
    ingredientSlots: [pokemon.ingredientSlots[0], pokemon.ingredientSlots[1], pokemon.ingredientSlots[2]],
    tune: { ...defaultTune(), ...pokemon.tune },
  }
}

function save() {
  const draft = editing.value
  if (!draft) return
  if (!draft.uid) box.create({ ...draft })
  else box.update(draft.uid, draft)
  editing.value = null
}

function toggle(list: string[], id: string) {
  const index = list.indexOf(id)
  if (index >= 0) list.splice(index, 1)
  else list.push(id)
}

function clearFilters() {
  query.text = ''
  query.berryType = ''
  query.specialty = ''
  query.mainSkill = ''
  query.ingredients = []
  query.subskills = []
  query.ingredientLock = 'unlocked'
  query.subskillLock = 'unlocked'
  query.subskillCombine = 'and'
}

const filtered = computed(() => [...box.pokemon].reverse().filter((pokemon) => boxMatches(pokemon, query)))
const activeFilters = computed(() => filterCount(query))
</script>

<template>
  <div class="stack">
    <div class="row">
      <button class="btn" type="button" @click="picking = true">从种族新建</button>
      <button class="btn" type="button" :disabled="ocrBusy" @click="pickShots">从截图导入</button>
      <button v-if="box.pokemon.length" class="btn" type="button" :class="{ on: activeFilters }" @click="filtering = true">{{ activeFilters ? `筛选 ${activeFilters}` : '筛选' }}</button>
      <input ref="shotInput" hidden type="file" accept="image/*" multiple @change="onShots">
    </div>
    <p v-if="ocrMsg" class="amber">{{ ocrMsg }}</p>

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
          <div class="muted">Lv.{{ pokemon.level }} · {{ pokemon.nature }}{{ pokemon.napping ? ' · 午睡岛' : '' }}</div>
        </div>
        <div class="stack">
          <button class="btn ghost" type="button" @click="openEdit(pokemon)">编辑</button>
          <button class="btn ghost" type="button" @click="box.remove(pokemon.uid)">删除</button>
        </div>
      </div>
    </div>
    <div v-if="filtering" class="overlay" @click.self="filtering = false">
      <section class="sheet stack">
        <div class="row">
          <h3>筛选</h3>
          <button class="btn ghost" type="button" @click="clearFilters">清除</button>
          <button class="btn ghost" type="button" @click="filtering = false">完成</button>
        </div>
        <div class="field">
          <label>名称</label>
          <input v-model="query.text" placeholder="搜索名称">
        </div>
        <p class="muted">树果属性</p>
        <div class="picker-opts">
          <button type="button" :class="{ on: !query.berryType }" @click="query.berryType = ''">不限</button>
          <button v-for="item in FILTER_CATALOG.berries" :key="item.name" type="button" :class="{ on: query.berryType === item.type }" @click="query.berryType = item.type">
            <BerryIcon :name="item.name" />{{ item.name }}
          </button>
        </div>
        <p class="muted">类型</p>
        <div class="picker-opts">
          <button type="button" :class="{ on: !query.specialty }" @click="query.specialty = ''">不限</button>
          <button v-for="item in TYPES" :key="item" type="button" :class="{ on: query.specialty === item }" @click="query.specialty = item">{{ item }}</button>
        </div>
        <div class="row">
          <p class="muted">食材</p>
          <div class="seg">
            <button type="button" :class="{ on: query.ingredientLock === 'unlocked' }" @click="query.ingredientLock = 'unlocked'">已解锁</button>
            <button type="button" :class="{ on: query.ingredientLock === 'locked' }" @click="query.ingredientLock = 'locked'">未解锁</button>
          </div>
        </div>
        <div class="picker-opts">
          <button v-for="item in FILTER_CATALOG.ingredients" :key="item.id" type="button" :class="{ on: query.ingredients.includes(item.name) }" @click="toggle(query.ingredients, item.name)">
            <IngredientIcon :id="item.id" :name="item.name" small />{{ item.name }}
          </button>
        </div>
        <p class="muted">主技能</p>
        <div class="picker-opts">
          <button type="button" :class="{ on: !query.mainSkill }" @click="query.mainSkill = ''">不限</button>
          <button v-for="item in FILTER_CATALOG.skills" :key="item" type="button" :class="{ on: query.mainSkill === item }" @click="query.mainSkill = item"><MainSkillIcon :name="item" />{{ item }}</button>
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
          <button v-for="item in FILTER_CATALOG.subskills" :key="item.id" type="button" :class="{ on: query.subskills.includes(item.id) }" @click="toggle(query.subskills, item.id)">
            <SubskillIcon :id="item.id" />{{ item.name }}
          </button>
        </div>
      </section>
    </div>
    <SpeciesSheet v-if="picking" @close="picking = false" @pick="pickSpecies" />
    <div v-if="editing" class="overlay" @click.self="editing = null">
      <section class="sheet stack">
        <div class="row">
          <h3>{{ editing.uid ? '编辑个体' : '新建个体' }}<ShinyMark v-if="editing.shiny" /></h3>
          <button class="btn ghost" type="button" @click="editing = null">取消</button>
        </div>
        <MemberEditor v-model="editing" :actions="false" :shiny="editing.shiny" />
        <div class="field"><label>名称</label><input v-model="editing.name" placeholder="留空则显示种族名"></div>
        <label v-if="hasShiny(editing.pokeId)" class="row"><input v-model="editing.shiny" type="checkbox"> 闪光<ShinyMark v-if="editing.shiny" /></label>
        <label class="row"><input v-model="editing.napping" type="checkbox"> 寄放午睡岛</label>
        <button class="btn" type="button" @click="save">保存</button>
      </section>
    </div>
  </div>
</template>
