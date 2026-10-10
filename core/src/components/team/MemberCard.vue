<script setup lang="ts">
import { skillMaxFor } from '../../calc/mainSkills'
import { exEffects } from '../../calc/exEffects'
import { computed } from 'vue'
import { storeToRefs } from 'pinia'
import { ingredientByName, natureByName, pokeById } from '../../calc/data'
import { energyMultiplier, instantInterval } from '../../calc/helpSpeed'
import { effectiveSkillLevel, unlockedSubskills, SUBSKILL_GATES } from '../../calc/member'
import { natureStatFactor } from '../../calc/natureLabels'
import { ribbonBonus, stagesLeft } from '../../calc/ribbon'
import { carryLimit } from '../../calc/timeline'
import { useSettingsStore } from '../../stores/settings'
import type { CarryMode, ProduceResult } from '../../types'
import BerryIcon from '../shared/BerryIcon.vue'
import IngredientIcon from '../shared/IngredientIcon.vue'
import PokeSprite from '../shared/PokeSprite.vue'
import MainSkillIcon from '../shared/MainSkillIcon.vue'
import SubskillIcon from '../shared/SubskillIcon.vue'

const props = defineProps<{
  pokeId: number
  level: number
  nature: string
  subskills: string[]
  ingredientSlots: [number | null, number | null, number | null]
  skillLevel: number
  result: ProduceResult
  carryMode?: CarryMode
  wakeEnergy?: number
  ribbonHours?: number
  helpingBonus?: number
  label?: string
}>()

const { settings } = storeToRefs(useSettingsStore())
const STAT: Record<string, string> = { help: '帮忙', energy: '活力', ingredient: '食材', skill: '技能', exp: '经验' }

const poke = computed(() => pokeById(props.pokeId))
const nature = computed(() => natureByName(props.nature))
const subs = computed(() => unlockedSubskills(props.level, props.subskills))
const lines = computed(() => {
  const list = poke.value?.ingredients ?? []
  return props.ingredientSlots.flatMap((index) => {
    if (index == null) return []
    const line = list[index]
    return line ? [line] : []
  })
})
const ingRows = computed(() => Object.entries(props.result.ingredients).map(([name, count]) => {
  const item = ingredientByName(name)
  return { name, id: item?.id ?? 0, count, energy: count * (item?.energy ?? 0) }
}))
const ingEnergy = computed(() => ingRows.value.reduce((sum, row) => sum + row.energy, 0))
const totalEnergy = computed(() => props.result.berryEnergy + ingEnergy.value + props.result.skillEnergy)

function share(part: number) {
  return totalEnergy.value > 0 ? Math.round(part / totalEnergy.value * 100) : 0
}

const berryShare = computed(() => share(props.result.berryEnergy))
const ingShare = computed(() => share(ingEnergy.value))
const skillShare = computed(() => Math.max(0, 100 - berryShare.value - ingShare.value))

const seconds = computed(() => {
  const mon = poke.value
  if (!mon) return 0
  const ribbon = ribbonBonus(props.ribbonHours ?? 0, stagesLeft(mon.id))
  return instantInterval(
    mon.interval,
    props.level,
    props.nature,
    subs.value,
    props.helpingBonus ?? settings.value.helpingBonus,
    props.wakeEnergy ?? settings.value.sleepScore,
    settings.value.goodCamp,
    settings.value.island,
    settings.value.berries.includes(mon.berry),
    ribbon.speedCut,
    exEffects(settings.value, mon.berry).speed,
  )
})

const carry = computed(() => {
  const mon = poke.value
  if (!mon) return 0
  const ribbon = ribbonBonus(props.ribbonHours ?? 0, stagesLeft(mon.id))
  return carryLimit(mon.carry, subs.value, settings.value.goodCamp, props.carryMode, ribbon.carry)
})

const skillLv = computed(() => Math.min(skillMaxFor(poke.value?.mainSkill ?? ''), effectiveSkillLevel(props.level, props.skillLevel, props.subskills, poke.value?.mainSkill ?? '') + exEffects(settings.value, poke.value?.berry ?? '').skillLevels))

function bandFactor(asleep: boolean) {
  const points = props.result.curve.filter((point) => point.asleep === asleep)
  const factor = points.length
    ? points.reduce((sum, point) => sum + point.multiplier, 0) / points.length
    : energyMultiplier(props.wakeEnergy ?? settings.value.sleepScore)
  return (factor > 0 ? 1 / factor : 1).toFixed(4)
}

function helpClock(value: number) {
  const whole = Math.max(0, Math.round(value))
  const hour = Math.floor(whole / 3600)
  const minute = Math.floor((whole % 3600) / 60)
  const second = whole % 60
  return `${hour}:${String(minute).padStart(2, '0')}:${String(second).padStart(2, '0')}`
}

function rate(base: number, stat: 'ingredient' | 'skill', small: string, medium: string) {
  const bonus = 1 + (subs.value.includes(small) ? 0.18 : 0) + (subs.value.includes(medium) ? 0.36 : 0)
  return base * natureStatFactor(props.nature, stat) * bonus
}

</script>

<template>
  <article v-if="poke" class="member-card">
    <header class="member-card-top">
      <span class="member-type"><BerryIcon :name="poke.berry" />{{ poke.berryType }}</span>
      <strong>{{ label || poke.name }} <em>#{{ poke.id }}</em></strong>
      <b>Lv {{ level }}</b>
    </header>
    <PokeSprite :id="poke.id" :name="poke.name" large />
    <div class="member-ings">
      <template v-for="(line, index) in lines" :key="index">
        <span v-if="index" class="member-plus">+</span>
        <IngredientIcon :id="line.id" :name="line.name" />
      </template>
    </div>
    <div class="member-subs">
      <SubskillIcon
        v-for="(id, index) in subskills.filter(Boolean)"
        :key="`${id}-${index}`"
        :id="id"
        :locked="level < (SUBSKILL_GATES[subskills.indexOf(id)] ?? 1)"
      />
    </div>
    <p class="member-nature">
      {{ nature.name }}
      <span v-if="nature.up">{{ STAT[nature.up] }}↑</span>
      <span v-if="nature.down">{{ STAT[nature.down] }}↓</span>
    </p>
    <p class="member-total">{{ Math.round(totalEnergy).toLocaleString('zh-CN') }}</p>
    <div class="mix-bar" :title="`树果 ${berryShare}% · 食材 ${ingShare}% · 技能 ${skillShare}%`">
      <i class="berry" :style="{ width: `${berryShare}%` }" />
      <i class="ing" :style="{ width: `${ingShare}%` }" />
      <i class="skill" :style="{ width: `${skillShare}%` }" />
    </div>
    <p class="mix-legend">
      <span>{{ berryShare }}%</span>
      <span>{{ ingShare }}%</span>
      <span>{{ skillShare }}%</span>
    </p>
    <p class="member-freq">
      <span>{{ helpClock(seconds) }}</span>
      <b>{{ seconds ? (86400 / seconds).toFixed(2) : '0.00' }}</b>
    </p>
    <p class="member-speed"><span>白天</span><b>{{ bandFactor(false) }}x</b></p>
    <p class="member-speed"><span>睡眠</span><b>{{ bandFactor(true) }}x</b></p>
    <p class="member-line berry">
      <span><BerryIcon :name="poke.berry" small /> 树果 {{ result.berries.toFixed(2) }}</span>
      <b>{{ Math.round(result.berryEnergy).toLocaleString('zh-CN') }}</b>
    </p>
    <p class="member-line ing">
      <span>食材 {{ (rate(poke.ingredientRate, 'ingredient', 'ingS', 'ingM') * 100).toFixed(1) }}%</span>
      <b>{{ Math.round(ingEnergy).toLocaleString('zh-CN') }}</b>
    </p>
    <p v-for="row in ingRows" :key="row.name" class="member-line quiet">
      <span><IngredientIcon :id="row.id" :name="row.name" small /> {{ row.count.toFixed(2) }}</span>
      <b>{{ Math.round(row.energy).toLocaleString('zh-CN') }}</b>
    </p>
    <p class="member-line skill">
      <span><MainSkillIcon :name="poke.mainSkill" /> 技能 LV{{ skillLv }} {{ poke.mainSkill }} {{ (Math.min(1, rate(poke.skillRate, 'skill', 'skillS', 'skillM') * exEffects(settings, poke.berry).skillMultiplier) * 100).toFixed(1) }}%</span>
    </p>
    <p class="member-line quiet">
      <span>{{ result.skillProcs.toFixed(2) }} 次</span>
      <b>{{ Math.round(result.skillEnergy).toLocaleString('zh-CN') }}</b>
    </p>
    <p class="member-line quiet">
      <span>持有 {{ carry }}</span>
      <b>满包 {{ result.sneaky }}</b>
    </p>
  </article>
</template>
