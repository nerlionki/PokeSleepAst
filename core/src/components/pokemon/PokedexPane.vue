<script setup lang="ts">
import { computed, shallowRef } from 'vue'
import { storeToRefs } from 'pinia'
import { BERRIES, POKEDEX } from '../../calc/data'
import { pokeHit } from '../../calc/pokeSearch'
import { compareDex } from '../../calc/pokedexOrder'
import { evolutionStages } from '../../calc/evolution'
import { homeText } from '../../calc/islandMeta'
import { berryCount, friendTiers, ingredientColumns } from '../../calc/ingredients'
import { mythicalSeed, SPECIALTY_FILTERS, specialtyHit, specialtyLabel } from '../../calc/specialty'
import { useSettingsStore } from '../../stores/settings'
import BerryIcon from '../shared/BerryIcon.vue'
import MainSkillIcon from '../shared/MainSkillIcon.vue'
import DrawerSheet from '../shared/DrawerSheet.vue'
import IngredientIcon from '../shared/IngredientIcon.vue'
import PokeSprite from '../shared/PokeSprite.vue'

const q = shallowRef('')
const spec = shallowRef('全部')
const panel = shallowRef<'none' | 'sleep' | 'berry' | 'skill'>('none')
const sleep = shallowRef('全部')
const berry = shallowRef('全部')
const skill = shallowRef('全部')
const selected = shallowRef<number | null>(null)
const { settings } = storeToRefs(useSettingsStore())

const sleepTypes = computed(() => ['全部', ...new Set(POKEDEX.map((p) => p.sleepType))])
const skills = computed(() => ['全部', ...new Set(POKEDEX.map((p) => p.mainSkill))])

const list = computed(() => POKEDEX.filter((p) => {
  if (!pokeHit(p, q.value)) return false
  if (!specialtyHit(p.specialty, spec.value)) return false
  if (sleep.value !== '全部' && p.sleepType !== sleep.value) return false
  if (berry.value !== '全部' && p.berry !== berry.value) return false
  if (skill.value !== '全部' && p.mainSkill !== skill.value) return false
  return true
}).sort(compareDex))

const detail = computed(() => POKEDEX.find((p) => p.id === selected.value) ?? null)
const board = computed(() => detail.value ? ingredientColumns(detail.value.ingredients) : [])
const medals = computed(() => friendTiers(detail.value?.medalGroup))
const stages = computed(() => detail.value ? evolutionStages(detail.value.id) : [])
const homes = computed(() => {
  const poke = detail.value
  if (!poke) return '资料未列'
  return homeText(poke.id)
})
const favored = (name: string) => settings.value.berries.includes(name)

function toggle(which: typeof panel.value) {
  panel.value = panel.value === which ? 'none' : which
}
</script>

<template>
  <div class="stack">
    <input v-model="q" class="picker-search" placeholder="搜索中文、英文或图鉴编号">
    <div class="picker-filters">
      <button v-for="s in ['全部', ...SPECIALTY_FILTERS]" :key="s" type="button" :class="{ on: spec === s }" @click="spec = s">{{ s }}</button>
      <button type="button" :class="{ on: panel === 'sleep' || sleep !== '全部' }" @click="toggle('sleep')">睡眠</button>
      <button type="button" :class="{ on: panel === 'berry' || berry !== '全部' }" @click="toggle('berry')">树果</button>
      <button type="button" :class="{ on: panel === 'skill' || skill !== '全部' }" @click="toggle('skill')">技能</button>
    </div>
    <div v-if="panel === 'sleep'" class="picker-opts">
      <button v-for="s in sleepTypes" :key="s" type="button" :class="{ on: sleep === s }" @click="sleep = s">{{ s }}</button>
    </div>
    <div v-else-if="panel === 'berry'" class="picker-opts">
      <button type="button" :class="{ on: berry === '全部' }" @click="berry = '全部'">全部</button>
      <button v-for="b in BERRIES" :key="b.name" type="button" :class="{ on: berry === b.name }" @click="berry = b.name"><BerryIcon :name="b.name" />{{ b.name }}</button>
    </div>
    <div v-else-if="panel === 'skill'" class="picker-opts">
      <button v-for="s in skills" :key="s" type="button" :class="{ on: skill === s }" @click="skill = s"><MainSkillIcon v-if="s !== '全部'" :name="s" />{{ s }}</button>
    </div>
    <p class="muted">{{ list.length }} 只</p>
    <div class="poke-wall">
      <button v-for="p in list" :key="p.id + p.name" type="button" class="poke-wall-cell" @click="selected = p.id">
        <PokeSprite :id="p.id" :name="p.name" />
        <span>{{ p.name }}</span>
      </button>
    </div>
    <DrawerSheet v-if="detail" :title="detail.name" @close="selected = null">
      <div class="row">
        <PokeSprite :id="detail.id" :name="detail.name" large />
        <div>
          <p class="muted">#{{ detail.id }} · {{ specialtyLabel(detail.specialty) }} · {{ detail.sleepType }}</p>
          <span v-if="favored(detail.berry)" class="chip"><BerryIcon :name="detail.berry" small />适正 {{ detail.berry }}</span>
          <span v-else class="chip"><BerryIcon :name="detail.berry" small />{{ detail.berry }}</span>
        </div>
      </div>
      <p>间隔 {{ detail.interval }}s · 持有 {{ detail.carry }} · 食材 {{ (detail.ingredientRate * 100).toFixed(1) }}% · 技能 {{ (detail.skillRate * 100).toFixed(1) }}%</p>
      <p class="muted"><MainSkillIcon :name="detail.mainSkill" /> {{ detail.mainSkill }}</p>
      <div class="berry-drop">
        <BerryIcon :name="detail.berry" large />
        <strong>{{ detail.berry }} × {{ berryCount(detail.specialty) }}</strong>
      </div>
      <div class="ing-board">
        <section v-for="(col, i) in board" :key="i" class="ing-col">
          <h3>LV {{ [1, 30, 60][i] }}</h3>
          <div class="ing-col-items">
            <div v-for="cell in col" :key="`${cell.letter}-${cell.id}`" class="ing-token" :title="cell.name">
              <span v-if="cell.letter" class="ing-letter">{{ cell.letter }}</span>
              <IngredientIcon :id="cell.id" :name="cell.name" />
              <span class="ing-qty">{{ cell.amount }}</span>
            </div>
          </div>
        </section>
      </div>
      <section class="evo-chain">
        <h3>进化</h3>
        <div v-if="stages.length > 1" class="evo-stages">
          <template v-for="(stage, i) in stages" :key="i">
            <span v-if="i" class="evo-arrow" aria-hidden="true">↓</span>
            <div class="evo-stage">
              <button
                v-for="node in stage"
                :key="node.id"
                type="button"
                class="evo-node"
                :class="{ on: node.id === detail.id }"
                @click="selected = node.id"
              >
                <PokeSprite :id="node.id" :name="node.name" />
                <span>{{ node.name }}</span>
                <em v-for="text in node.conditions" :key="text">{{ text }}</em>
              </button>
            </div>
          </template>
        </div>
        <p v-else class="muted">不会进化</p>
      </section>
      <div class="friend-block">
        <p>友好度 <span class="rose">♥ {{ detail.friendship }}</span></p>
        <div v-if="medals.length" class="friend-tiers">
          <span v-for="tier in medals" :key="tier.level" class="friend-tier" :class="tier.tone">
            <b>{{ tier.level }}</b>
            <em>{{ tier.label }}</em>
          </span>
        </div>
        <p v-else class="muted">没有友情徽章，捕捉不会锁定金色副技能。</p>
      </div>
      <p class="muted">出现：{{ homes }}</p>
      <p v-if="mythicalSeed(detail.id)">捕捉后获得 <span class="chip">{{ mythicalSeed(detail.id) }}</span></p>
    </DrawerSheet>
  </div>
</template>
