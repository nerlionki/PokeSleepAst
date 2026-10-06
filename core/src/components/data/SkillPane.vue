<script setup lang="ts">
import { computed, shallowRef } from 'vue'
import { POKEDEX, SUBSKILLS } from '../../calc/data'
import { MAIN_SKILLS, SKILL_GROUPS, type MainSkill } from '../../calc/mainSkills'
import { RARITY_LABEL, SUBSKILL_NOTES } from '../../calc/skills'
import { foldText, textHit } from '../../calc/text'
import DataRow from '../shared/DataRow.vue'
import DrawerSheet from '../shared/DrawerSheet.vue'
import PokeSprite from '../shared/PokeSprite.vue'
import MainSkillIcon from '../shared/MainSkillIcon.vue'
import SubskillIcon from '../shared/SubskillIcon.vue'
import SkillLevels from './SkillLevels.vue'

const props = defineProps<{ q: string }>()
const part = shallowRef<'main' | 'sub'>('main')
const open = shallowRef(0)
const detailId = shallowRef<number | null>(null)

function matches(skill: MainSkill) {
  return textHit([skill.name, skill.group, skill.summary, skill.detail, ...skill.aliases].join(' '), props.q)
}

const groups = computed(() => SKILL_GROUPS.map((name) => ({
  name,
  skills: MAIN_SKILLS.filter((skill) => skill.group === name && matches(skill)),
})).filter((group) => group.skills.length))

const shown = computed(() => groups.value.reduce((sum, group) => sum + group.skills.length, 0))
const subs = computed(() => SUBSKILLS.filter((item) => textHit(`${item.name} ${SUBSKILL_NOTES[item.id] ?? ''}`, props.q)))
const detail = computed(() => MAIN_SKILLS.find((skill) => skill.id === detailId.value) ?? null)
const holders = computed(() => {
  if (!detail.value) return []
  const aliases = new Set(detail.value.aliases.map((alias) => foldText(alias)))
  return POKEDEX.filter((poke) => aliases.has(foldText(poke.mainSkill)))
})

function toggle(id: number) {
  open.value = open.value === id ? 0 : id
}
</script>

<template>
  <div class="stack">
    <div class="seg">
      <button type="button" :class="{ on: part === 'main' }" @click="part = 'main'">主技能</button>
      <button type="button" :class="{ on: part === 'sub' }" @click="part = 'sub'">副技能</button>
    </div>

    <template v-if="part === 'main'">
      <p class="muted">{{ shown }} 个主技能</p>
      <section v-for="group in groups" :key="group.name" class="stack">
        <h3 class="skill-group">{{ group.name }}</h3>
        <article v-for="skill in group.skills" :key="skill.id" class="acc">
          <DataRow :title="skill.name" :subtitle="`最高 Lv.${skill.maxLevel}`" @click="toggle(skill.id)">
            <template #lead>
              <MainSkillIcon :id="skill.id" :name="skill.name" />
            </template>
            <template #trail>
              <span class="data-row-chev">{{ open === skill.id ? '⌃' : '›' }}</span>
            </template>
          </DataRow>
          <div v-if="open === skill.id" class="acc-body plain">
            <p>{{ skill.summary }}</p>
            <SkillLevels v-if="skill.levels.length" :columns="skill.columns" :levels="skill.levels" />
            <p v-else class="muted">这个技能没有逐级数值。</p>
            <button class="btn ghost" type="button" @click="detailId = skill.id">查看说明</button>
          </div>
        </article>
      </section>
    </template>

    <div v-else class="sub-list">
      <article v-for="item in subs" :key="item.id" class="sub-line">
        <header>
          <strong><SubskillIcon :id="item.id" />{{ item.name }}</strong>
          <span class="chip" :class="`rarity-${item.rarity}`">{{ RARITY_LABEL[item.rarity as keyof typeof RARITY_LABEL] }}</span>
        </header>
        <p>{{ SUBSKILL_NOTES[item.id] ?? '' }}</p>
      </article>
      <p v-if="!subs.length" class="muted">没有匹配的副技能。</p>
    </div>

    <DrawerSheet v-if="detail" :title="detail.name" @close="detailId = null">
      <p>{{ detail.detail }}</p>
      <SkillLevels v-if="detail.levels.length" :columns="detail.columns" :levels="detail.levels" />
      <template v-for="table in detail.extra ?? []" :key="table.title">
        <h3>{{ table.title }}</h3>
        <SkillLevels :columns="table.columns" :levels="table.levels" />
      </template>
      <h3>会这个技能的宝可梦</h3>
      <p v-if="!holders.length" class="muted">图鉴里没有对应名字。</p>
      <div v-else class="poke-wall">
        <div v-for="poke in holders" :key="poke.id" class="poke-wall-cell">
          <PokeSprite :id="poke.id" :name="poke.name" />
          <span>{{ poke.name }}</span>
        </div>
      </div>
    </DrawerSheet>
  </div>
</template>
