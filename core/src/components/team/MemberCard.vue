<script setup lang="ts">
import { ingredientEnergyValue } from '../../calc/activityIngredients'
import { INGREDIENT_CATALOG } from '../../calc/ingredientCatalog'
import clientDefaults from '../../data/client-defaults.resource'
import { cloneData } from '../../calc/dataClone'

import { resolveMemberSkill } from '../../calc/mew'
import { skillMaxFor } from '../../calc/mainSkills'
import { exEffects } from '../../calc/exEffects'
import { computed, shallowRef } from 'vue'
import { storeToRefs } from 'pinia'
import { ingredientByName, natureByName, pokeById } from '../../calc/data'
import { energyMultiplier, instantInterval } from '../../calc/helpSpeed'
import { effectiveSkillLevel, unlockedSubskills, SUBSKILL_GATES } from '../../calc/member'
import { effectiveNature, natureStatFactor } from '../../calc/natureLabels'
import { ribbonBonus, stagesLeft } from '../../calc/ribbon'
import { carryLimit } from '../../calc/timeline'
import { useSettingsStore } from '../../stores/settings'
import { activityBerrySettings, activityValues } from '../../calc/activities'
import { useActivities } from '../../composables/useActivities'
import type { CarryMode, ProduceResult, Settings } from '../../types'
import BerryIcon from '../shared/BerryIcon.vue'
import IngredientIcon from '../shared/IngredientIcon.vue'
import PokeSprite from '../shared/PokeSprite.vue'
import MainSkillIcon from '../shared/MainSkillIcon.vue'
import SubskillIcon from '../shared/SubskillIcon.vue'
const components_team_MemberCard_config_clientDefaults = clientDefaults.modules.components_team_MemberCard


const props = defineProps<{
  environment?: Settings
  pokeId: number
  level: number
  nature: string
  natureMinted?: boolean
  subskills: string[]
  ingredientSlots: [number | null, number | null, number | null]
  skillLevel: number
  mewSkill?: number
  result: ProduceResult
  carryMode?: CarryMode
  wakeEnergy?: number
  ribbonHours?: number
  helpingBonus?: number
  label?: string
}>()
const showIndividualInfo = shallowRef(false)

const { settings: rawSettings } = storeToRefs(useSettingsStore())
const sourceSettings = computed(() => props.environment ?? rawSettings.value)
const activity = useActivities(sourceSettings, () => sourceSettings.value.island, undefined, () => sourceSettings.value.period)
const settings = computed(() => activityBerrySettings(sourceSettings.value, activity.context.value))
const STAT: Record<string, string> = (cloneData(components_team_MemberCard_config_clientDefaults["STAT"]) as unknown as Record<string, string>)

const poke = computed(() => {
  const species = pokeById(props.pokeId)
  if (!species) return undefined
  const selected = resolveMemberSkill(species, props)
  return { ...species, mainSkill: selected.name, skillRate: selected.rate }
})
const nature = computed(() => natureByName(effectiveNature(props)))
const subs = computed(() => unlockedSubskills(props.level, props.subskills))
const lines = computed(() => {
  const list = poke.value?.ingredients ?? []
  return props.ingredientSlots.flatMap((index) => {
    if (index == null) return []
    const line = list[index]
    return line ? [line] : []
  })
})
const unknownFoodEnergy = computed(() => Object.entries(props.result.ingredients).some(([name, count]) => count > 0 && ingredientEnergyValue(name) == null))
const ingRows = computed(() => Object.entries(props.result.ingredients).map(([name, count]) => {
  const item = ingredientByName(name)
  return { name, id: item?.id ?? INGREDIENT_CATALOG.find(row => row.name === name)?.imageId ?? 0, count, energy: ingredientEnergyValue(name) == null ? null : count * ingredientEnergyValue(name)! }
}))
const ingEnergy = computed(() => ingRows.value.reduce((sum, row) => sum + (row.energy ?? 0), 0))
const skillFoodEnergy = computed(() => Object.entries(props.result.skillIngredients ?? {}).reduce((sum, [name, count]) => sum + count * (ingredientByName(name)?.energy ?? 0), 0))
const foodScore = computed(() => props.result.cooking?.energy ?? ingEnergy.value)
const totalEnergy = computed(() => props.result.berryEnergy + foodScore.value + props.result.skillEnergy)

function share(part: number) {
  return totalEnergy.value > 0 ? Math.round(part / totalEnergy.value * 100) : 0
}

const berryShare = computed(() => share(props.result.berryEnergy))
const ingShare = computed(() => share(foodScore.value))
const skillShare = computed(() => Math.max(0, 100 - berryShare.value - ingShare.value))

const seconds = computed(() => {
  const mon = poke.value
  if (!mon) return 0
  const ribbon = ribbonBonus(props.ribbonHours ?? 0, stagesLeft(mon.id))
  return instantInterval(
    mon.interval,
    props.level,
    effectiveNature(props),
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
  return carryLimit(mon.carry, subs.value, settings.value.goodCamp, props.carryMode, ribbon.carry, exEffects(settings.value, mon.berry).carryExtra + activityValues(activity.context.value, settings.value.island, mon).carryCapacityBonus, activityValues(activity.context.value, settings.value.island, mon).carryCapacityMultiplier)
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
  return base * natureStatFactor(effectiveNature(props), stat) * bonus
}

</script>

<template>
  <article v-if="poke" class="member-card">
    <header class="member-card-top">
      <span class="member-type"><BerryIcon :name="poke.berry" />{{ poke.berryType }}</span>
      <strong>{{ label || poke.name }} <em>#{{ poke.id }}</em></strong>
      <b>Lv {{ level }}</b>
      <button
        class="member-info-toggle"
        :class="{ on: showIndividualInfo }"
        type="button"
        :aria-expanded="showIndividualInfo"
        :aria-label="showIndividualInfo ? '收起个体信息' : '查看个体信息详情'"
        :title="showIndividualInfo ? '收起个体信息' : '查看个体信息详情'"
        @click="showIndividualInfo = !showIndividualInfo"
      >{{ showIndividualInfo ? '收起' : '详情' }}</button>
    </header>
    <PokeSprite :id="poke.id" :name="poke.name" large />
    <div v-if="!showIndividualInfo" class="member-summary">
      <p v-if="poke.specialty === '树果型' || poke.specialty === '全部'" class="member-line berry">
        <span><BerryIcon :name="poke.berry" small /> 树果产量</span>
        <b>{{ result.berries.toFixed(2) }} 颗</b>
      </p>
      <template v-if="poke.specialty === '食材型' || poke.specialty === '全部'">
        <p v-for="row in ingRows" :key="row.name" class="member-line ing">
          <span><IngredientIcon :id="row.id" :name="row.name" small /> {{ row.name }}</span>
          <b>{{ row.count.toFixed(2) }} 个</b>
        </p>
        <p v-if="!ingRows.length" class="member-line ing"><span>食材产量</span><b>0.00 个</b></p>
      </template>
      <p v-if="poke.specialty === '技能型' || poke.specialty === '全部'" class="member-line quiet">
        <span>技能触发</span><b>{{ result.skillProcs.toFixed(2) }} 次</b>
      </p>
    </div>
    <template v-else>
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
      {{ props.nature }} <span v-if="natureMinted">净白薄荷 · 无加减成</span>
      <span v-if="nature.up">{{ STAT[nature.up] }}↑</span>
      <span v-if="nature.down">{{ STAT[nature.down] }}↓</span>
    </p>
    <p class="member-total">{{ unknownFoodEnergy ? '还未公布' : Math.round(totalEnergy).toLocaleString('zh-CN') }}</p>
    <div v-if="!unknownFoodEnergy" class="mix-bar" :title="`树果 ${berryShare}% · ${result.cooking ? '料理' : '食材'} ${ingShare}% · 技能 ${skillShare}%`">
      <i class="berry" :style="{ width: `${berryShare}%` }" />
      <i class="ing" :style="{ width: `${ingShare}%` }" />
      <i class="skill" :style="{ width: `${skillShare}%` }" />
    </div>
    <p v-if="!unknownFoodEnergy" class="mix-legend">
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
      <b>{{ unknownFoodEnergy ? '还未公布' : Math.round(ingEnergy).toLocaleString('zh-CN') }}</b>
    </p>
    <p v-if="result.cooking" class="member-line ing"><span>实际料理期望</span><b>{{ Math.round(result.cooking.energy).toLocaleString('zh-CN') }}</b></p>
    <p v-for="row in ingRows" :key="row.name" class="member-line quiet">
      <span><IngredientIcon :id="row.id" :name="row.name" small /> {{ row.count.toFixed(2) }}</span>
      <b>{{ row.energy == null ? '还未公布' : Math.round(row.energy).toLocaleString('zh-CN') }}</b>
    </p>
    <p class="member-line skill">
      <span><MainSkillIcon :name="poke.mainSkill" /> 技能 LV{{ skillLv }} {{ poke.mainSkill }} {{ (Math.min(1, rate(poke.skillRate, 'skill', 'skillS', 'skillM') * exEffects(settings, poke.berry).skillMultiplier) * 100).toFixed(1) }}%</span>
    </p>
    <p v-if="pokeId === 151" class="member-line quiet"><span>十项全能 Lv{{ skillLevel }} · 所选效果 Lv{{ skillLv }}</span></p>
    <p class="member-line quiet">
      <span>{{ result.skillProcs.toFixed(2) }} 次</span>
      <b>{{ Math.round(result.skillEnergy).toLocaleString('zh-CN') }}</b>
    </p>
    <p class="member-line quiet">
      <span>持有 {{ carry }}</span>
      <b>满包 {{ result.sneaky }}</b>
    </p>
    <p v-if="result.rewards" class="member-line quiet">
      <span>期望奖励：糖果 {{ result.rewards.candies.toFixed(2) }} · 梦之碎片 {{ result.rewards.dreamShards.toFixed(2) }} · 树果汁 {{ result.rewards.berryJuice.toFixed(2) }}</span>
    </p>
    <p v-if="result.cooking" class="member-line quiet"><span>剩余食材：{{ Object.entries(result.cooking.remain).filter(([, count]) => count > 0).map(([name, count]) => `${name} ×${count.toFixed(2)}`).join('、') || '无' }}</span></p>
    <template v-if="result.cooking && result.skillIngredients">
      <p class="member-line ing"><span>技能食材原始能量（不计总分）</span><b>{{ Math.round(skillFoodEnergy).toLocaleString('zh-CN') }}</b></p>
      <p v-for="(count, name) in result.skillIngredients" :key="name" class="member-line quiet"><span>{{ name }}</span><b>{{ count.toFixed(2) }}</b></p>
    </template>
    </template>
  </article>
</template>

<style scoped>
.member-info-toggle { display: inline-flex; align-items: center; justify-content: center; flex: 0 0 auto; min-width: 44px; height: 44px; margin: 0; padding: 0 10px; border: 1px solid var(--line); border-radius: 8px; background: transparent; color: var(--text); font: inherit; font-size: var(--font-12); line-height: 1; white-space: nowrap; }
.member-info-toggle.on { border-color: var(--amber); color: var(--amber); }
.member-info-toggle:focus-visible { outline: 2px solid var(--sage); outline-offset: 2px; }
.member-summary { display: flex; flex-direction: column; gap: 6px; width: 100%; min-width: 0; }
</style>
