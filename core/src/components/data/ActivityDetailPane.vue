<script setup lang="ts">
import { computed, shallowRef } from 'vue'
import { ACTIVITY_FIELDS, activityFeatureDescription, offsetActivityDate, type Activity, type ActivityOverrides, type ActivityRule, type NumericActivityField } from '../../calc/activities'
import { ISLANDS, POKEDEX } from '../../calc/data'
import { MAIN_SKILLS } from '../../calc/mainSkills'
import { gameText, t } from '../../ui/i18n'
import SegmentedControl from '../shared/SegmentedControl.vue'
import EventBundlesPane from './EventBundlesPane.vue'
import ActivityPokemonIcons from './ActivityPokemonIcons.vue'
import { activeSnapshot } from '../../resources/runtime'
import type { ActivityArchive } from '../../resources/activityArchive'

const props = defineProps<{ event: Activity; announcedOn?: string | null }>()
const meta = activeSnapshot()?.data['meta.json'] as { activityArchive?: ActivityArchive } | undefined
const bonusSections = computed(() => meta?.activityArchive?.events.find(event => event.id === props.event.id)?.bonusSections ?? [])
const encounterUps = computed(() => meta?.activityArchive?.encounterUps?.[props.event.id] ?? [])
const tierNames = { large: '大 UP', medium: '中 UP', small: '小 UP', special: '特别 UP' }
const features = computed(() => props.event.features?.filter(feature => feature.id !== 'announced-encounter-tier') ?? [])
const tabs = [{ id: 'bonuses', label: '活动加成' }, { id: 'bundles', label: '活动礼包' }] as const
const tab = shallowRef<'bonuses' | 'bundles'>('bonuses')
const dayNames = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六']
const categoryNames: Record<string, string> = { curry: '咖喱／浓汤', salad: '沙拉', dessert: '点心／饮料' }
const mixNames = { off: '关闭', some: '部分其他睡眠类型', all: '所有睡眠类型' }
const list = (names: string[]) => names.map(gameText).join('、')
const weekText = (days?: number[]) => days?.map(day => t(dayNames[day])).join('、')
const island = (id: string) => ISLANDS.find(row => row.id === id)?.name ?? id
const dateRange = (phase: Pick<Activity, 'startsOn' | 'endsOn'>) => `${phase.startsOn} – ${offsetActivityDate(phase.endsOn, -1)}`

function ruleScope(rule: ActivityRule) {
  const { target, conditions } = rule
  return [
    target?.islands && list(target.islands.map(island)),
    target?.types && list(target.types),
    target?.specialties && list(target.specialties),
    target?.skillIds && list(target.skillIds.map(id => MAIN_SKILLS.find(skill => skill.id === id)?.name ?? `#${id}`)),
    target?.skillFamilies && list(target.skillFamilies),
    weekText(conditions?.weekdays),
    rule.firstResearchOnly && t('仅每日首次睡眠研究'),
  ].filter(Boolean).join(' · ')
}

function effectRows(effects: ActivityOverrides) {
  const rows = (Object.entries(effects) as [NumericActivityField, unknown][]).flatMap(([key, value]) => {
    if (key === 'encounterWeightMultiplier' || typeof value !== 'number' || !Object.hasOwn(ACTIVITY_FIELDS, key)) return []
    const field = ACTIVITY_FIELDS[key]
    const display = key === 'cookingCritBonus' ? `+${Number((value * 100).toFixed(4))}%`
      : field.kind === 'multiply' ? `×${value}` : `+${value}`
    return [{ label: t(field.label), value: display }]
  })
  if (effects.eventMix !== undefined) rows.push({ label: t('混合睡眠类型'), value: t(mixNames[effects.eventMix]) })
  if (effects.shinyUp !== undefined) rows.push({ label: t('异色出现概率提升'), value: effects.shinyUp ? t('开启') : t('关闭') })
  if (effects.allRecipeCategories !== undefined) rows.push({ label: t('料理类型'), value: effects.allRecipeCategories ? t('全部开放') : t('维持原设定') })
  if (effects.availableRecipeCategories) rows.push({ label: t('可制作的料理类型'), value: list(effects.availableRecipeCategories.map(key => categoryNames[key])) })
  if (effects.favoredBerries) rows.push({ label: t('喜好树果'), value: list(effects.favoredBerries) })
  for (const [name, amount] of Object.entries(effects.fixedIngredientDrops ?? {})) {
    rows.push({ label: t('固定追加食材'), value: `${gameText(name)} +${amount}` })
  }
  for (const [name, multiplier] of Object.entries(effects.extraIngredientEnergyMultipliers ?? {})) {
    rows.push({ label: t('追加食材能量'), value: `${gameText(name)} ×${multiplier}` })
  }
  for (const modifier of effects.recipeEnergyModifiers ?? []) {
    const names = [
      ...(modifier.ingredientNames ?? []),
      ...(modifier.recipeNames ?? []),
      ...(modifier.categories ?? []).map(key => categoryNames[key]),
    ]
    rows.push({ label: t('特定料理能量'), value: `${list(names)} ×${modifier.multiplier}` })
  }
  return rows
}

const sections = computed(() => [props.event, ...(props.event.phases ?? [])].flatMap((phase, index) => {
  const rules = phase.rules.map(rule => ({
    scope: ruleScope(rule), rows: effectRows(rule.effects),
    pokemonIds: [...(rule.target?.pokemonIds ?? []), ...POKEDEX.filter(poke => rule.target?.pokemonNames?.includes(poke.name)).map(poke => poke.id)],
    teamPokemonIds: rule.conditions?.teamPokemonIdsAny ?? [],
  }))
    .filter(rule => rule.rows.length)
  return rules.length ? [{ title: index === 0 ? t('活动期间') : dateRange(phase), weekdays: weekText(phase.weekdays), rules }] : []
}))
</script>

<template>
  <div class="stack activity-detail">
    <p class="muted">{{ dateRange(event) }}</p>
    <SegmentedControl v-model="tab" :options="tabs" />
    <div v-if="tab === 'bonuses'" class="stack">
      <section v-if="announcedOn !== undefined" class="card stack">
        <h3>{{ t('活动公告来源') }}</h3>
        <p v-if="announcedOn" class="muted">{{ t('公告日期') }} {{ announcedOn }}</p>
        <p class="announcement-source">{{ event.source }}</p>
      </section>
      <section v-for="(section, index) in bonusSections" :key="'announcement-' + index" class="card stack">
        <h3>{{ gameText(section.title) }}</h3>
        <p v-for="line in section.lines" :key="line">{{ gameText(line) }}</p>
      </section>
      <section v-for="(section, index) in bonusSections.length ? [] : sections" :key="index" class="card stack">
        <h3>{{ section.title }}</h3>
        <p v-if="section.weekdays" class="muted">{{ section.weekdays }}</p>
        <div v-for="(rule, ruleIndex) in section.rules" :key="ruleIndex" class="bonus-rule">
          <p v-if="rule.scope" class="muted bonus-scope">{{ rule.scope }}</p>
          <ActivityPokemonIcons v-if="rule.pokemonIds.length" :ids="rule.pokemonIds" />
          <p v-if="rule.teamPokemonIds.length" class="muted">{{ t('队伍包含其中任意一只') }}</p>
          <ActivityPokemonIcons v-if="rule.teamPokemonIds.length" :ids="rule.teamPokemonIds" />
          <div v-for="(row, rowIndex) in rule.rows" :key="rowIndex" class="bonus-row">
            <span>{{ row.label }}</span><strong>{{ row.value }}</strong>
          </div>
        </div>
      </section>
      <section v-if="encounterUps.length" class="card stack">
        <h3>{{ t('出没提升') }}</h3>
        <div v-for="(group, index) in encounterUps" :key="index" class="bonus-rule">
          <div v-if="group.tier || group.label" class="bonus-row">
            <strong v-if="group.tier">{{ t(tierNames[group.tier]) }}</strong><span v-if="group.label" class="muted">{{ gameText(group.label) }}</span>
          </div>
          <p v-if="group.islands?.length" class="muted bonus-scope">{{ list(group.islands.map(island)) }}</p>
          <ActivityPokemonIcons :ids="group.pokemonIds" />
        </div>
      </section>
      <section v-if="!bonusSections.length && event.miniCandyBoost" class="card stack">
        <h3>{{ t('迷你糖果增强') }}</h3>
        <div class="bonus-row"><span>{{ t('糖果经验') }}</span><strong>×{{ event.miniCandyBoost.exp }}</strong></div>
        <div class="bonus-row"><span>{{ t('梦之碎片消耗') }}</span><strong>×{{ event.miniCandyBoost.shards }}</strong></div>
        <div class="bonus-row"><span>{{ t('每日糖果额度') }}</span><strong>{{ event.miniCandyBoost.dailyLimit }}</strong></div>
      </section>
      <section v-if="!bonusSections.length && event.favoriteBerries && Object.keys(event.favoriteBerries).length" class="card stack">
        <h3>{{ t('喜好树果') }}</h3>
        <div v-for="(berry, id) in event.favoriteBerries" :key="id" class="bonus-row">
          <span>{{ gameText(island(id)) }}</span><strong>{{ gameText(berry) }}</strong>
        </div>
      </section>
      <section v-for="feature in bonusSections.length ? [] : features" :key="feature.id" class="card stack">
        <h3>{{ gameText(feature.name) }}</h3>
        <p v-if="feature.islands" class="muted">{{ list(feature.islands.map(island)) }}</p>
        <p>{{ gameText(activityFeatureDescription(feature)) }}</p>
      </section>
      <p v-if="!bonusSections.length && !sections.length && !encounterUps.length && !event.miniCandyBoost && !Object.keys(event.favoriteBerries ?? {}).length && !features.length" class="muted">
        {{ t('该活动暂无已收录的加成。') }}
      </p>
    </div>
    <EventBundlesPane v-else :event="event" />
  </div>
</template>

<style scoped>
.activity-detail { align-self: start; grid-template-columns: minmax(0, 1fr); }
.announcement-source { overflow-wrap: anywhere; }
.bonus-rule + .bonus-rule { border-top: 1px solid var(--line); padding-top: 8px; }
.bonus-scope { font-size: 12px; line-height: 1.55; margin-bottom: 4px; }
.bonus-row { display: flex; justify-content: space-between; gap: 12px; line-height: 1.5; }
.bonus-row strong { min-width: 0; text-align: right; overflow-wrap: anywhere; }
</style>
