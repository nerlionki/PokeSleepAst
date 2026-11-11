<script setup lang="ts">
  import { computed, shallowRef } from 'vue';
  import { offsetActivityDate, type Activity } from '../../calc/activities';
  import { ANNOUNCED } from '../../calc/announcedContent';
  import {
    BERRIES,
    ISLANDS,
    ingredientById,
    pokeById
  } from '../../calc/data';
  import { MAIN_SKILLS } from '../../calc/mainSkills';
  import { gameText, t } from '../../ui/i18n';
  import SegmentedControl from '../shared/SegmentedControl.vue';
  import BerryIcon from '../shared/BerryIcon.vue';
  import IngredientIcon from '../shared/IngredientIcon.vue';
  import EventBundlesPane from './EventBundlesPane.vue';
  import ActivityPokemonIcons from './ActivityPokemonIcons.vue';
  import { activeSnapshot } from '../../resources/runtime';
  import type {
    ActivityArchive,
    ActivityBonusGroup,
    ActivityBonusItem,
    ActivityBonusPart,
    ActivityBonusRef
  } from '../../resources/activityArchive';

  const props = defineProps<{ event: Activity; announcedOn?: string | null }>();
  const meta = activeSnapshot()?.data['meta.json'] as
    | { activityArchive?: ActivityArchive }
    | undefined;
  const record = computed(() =>
    meta?.activityArchive?.events.find(
      event => event.id === props.event.id || event.source === props.event.source
    )
  );
  const areas = computed(() => record.value?.bonusGroups ?? []);
  const usesStructuredBonuses = computed(
    () => record.value?.bonusGroups !== undefined
  );
  const legacySections = computed(() =>
    usesStructuredBonuses.value ? [] : (record.value?.bonusSections ?? [])
  );
  const berries = computed(() => record.value?.berryGroup?.items ?? []);
  const notes = computed(() => record.value?.notes ?? []);
  const encounterUps = computed(() => {
    const ups = meta?.activityArchive?.encounterUps;
    if (!ups) return [];
    return ups[record.value?.id ?? ''] ?? ups[props.event.id] ?? [];
  });
  const tierNames = {
    large: '大 UP',
    medium: '中 UP',
    small: '小 UP',
    special: '特别 UP'
  };
  const tabs = [
    { id: 'bonuses', label: '活动加成' },
    { id: 'bundles', label: '活动礼包' }
  ] as const;
  const tab = shallowRef<'bonuses' | 'bundles'>('bonuses');
  const groupOrder = [
    'energy',
    'candy',
    'research',
    'sleep',
    'ingredient',
    'helper'
  ];
  const groupTitles: Record<ActivityBonusGroup['id'], string> = {
    energy: '能量倍率',
    candy: '糖果增强',
    research: '睡眠研究奖励',
    sleep: '睡眠类型与异色',
    ingredient: '食材额外掉落',
    helper: '帮手加成'
  };
  const fieldLabels: Record<string, string> = {
    drowsyPowerMultiplier: '睡意之力',
    cookingEnergyMultiplier: '料理',
    berryEnergyMultiplier: '树果能量',
    potSizeMultiplier: '锅容量',
    potCapacityBonus: '锅容量',
    researchExpMultiplier: '研究EXP',
    dreamShardsMultiplier: '梦之碎片',
    skillDreamShardsMultiplier: '梦之碎片',
    researchCandyMultiplier: '糖果',
    sleepExpMultiplier: '睡眠EXP',
    ingredientCountBonus: '食材',
    skillIngredientMultiplier: '食材',
    berryCountBonus: '树果',
    skillBerryMultiplier: '树果',
    skillRateMultiplier: '主技能发动率',
    skillLevelBonus: '主技能等级',
    carryCapacityBonus: '持有上限',
    carryCapacityMultiplier: '持有上限',
    mealRecoveryBonus: '活力',
    mealRecoveryMultiplier: '活力',
    skillHealingMultiplier: '活力',
    helpIntervalMultiplier: '帮忙间隔',
    skillStrengthMultiplier: '主技能',
    eventMix: '睡眠类型'
  };
  const categoryNames: Record<string, string> = {
    curry: '咖喱／浓汤',
    salad: '沙拉',
    dessert: '点心／饮料'
  };
  const list = (names: string[]) => names.map(gameText).join('、');
  const island = (id: string) => ISLANDS.find(row => row.id === id)?.name ?? id;
  const dateRange = (phase: Pick<Activity, 'startsOn' | 'endsOn'>) =>
    `${phase.startsOn} – ${offsetActivityDate(phase.endsOn, -1)}`;
  const orderedAreas = computed(() =>
    [...areas.value].sort(
      (a, b) => Number(!a.area.length) - Number(!b.area.length)
    )
  );

  function orderedGroups(groups: ActivityBonusGroup[]) {
    return [...groups].sort(
      (a, b) => groupOrder.indexOf(a.id) - groupOrder.indexOf(b.id)
    );
  }

  function berryName(id: number) {
    return BERRIES.find(row => row.id === id)?.name ?? '';
  }

  function ingredientVisual(ref: ActivityBonusRef) {
    if (ref.kind !== 'ingredient') return null;
    if (typeof ref.id === 'number') {
      const row = ingredientById(ref.id);
      return row ? { id: row.id, name: row.name, imageFile: undefined } : null;
    }
    const row = ANNOUNCED.ingredients.find(item => item.key === ref.id);
    return row
      ? {
          id: row.imageId ?? row.runtimeId ?? 0,
          name: row.name,
          imageFile: row.imageFile
        }
      : null;
  }

  function refText(ref: ActivityBonusRef): string {
    if (ref.kind === 'field') return t(fieldLabels[ref.id] ?? ref.id);
    if (ref.kind === 'text') return t(ref.value);
    if (
      ref.kind === 'type' ||
      ref.kind === 'specialty' ||
      ref.kind === 'skillFamily'
    )
      return gameText(ref.id);
    if (ref.kind === 'skill')
      return gameText(
        MAIN_SKILLS.find(skill => skill.id === ref.id)?.name ?? String(ref.id)
      );
    if (ref.kind === 'pokemon')
      return gameText(pokeById(ref.id)?.name ?? String(ref.id));
    if (ref.kind === 'ingredient')
      return gameText(ingredientVisual(ref)?.name ?? String(ref.id));
    return `${t('队伍包含')} ${ref.ids.map(id => gameText(pokeById(id)?.name ?? String(id))).join('、')}`;
  }

  function numberText(value: number) {
    return String(Number(value.toFixed(4)));
  }

  function partText(part: ActivityBonusPart) {
    if (
      part.kind === 'multiply' ||
      part.kind === 'add' ||
      part.kind === 'limit'
    ) {
      const value = numberText(typeof part.value === 'number' ? part.value : 0);
      const label = part.text ? t(part.text) : '';
      if (part.kind === 'multiply') return label ? `${value}x ${label}` : `${value}x`;
      if (part.kind === 'add') return label ? `+${value} ${label}` : `+${value}`;
      return label ? `${label}MAX ${value}` : `MAX ${value}`;
    }
    if (part.kind === 'text') return t(String(part.value ?? ''));
    if (part.kind === 'mix') return t(part.value === 'all' ? '全部' : '部分');
    if (part.kind === 'category')
      return t(categoryNames[String(part.value)] ?? String(part.value));
    return '';
  }

  function partsText(parts: ActivityBonusPart[]) {
    return parts.map(partText).filter(Boolean).join(' / ');
  }

  function itemDetail(item: ActivityBonusItem) {
    const scope = item.scope?.map(refText).join('、') ?? '';
    const end = item.endsOn ? offsetActivityDate(item.endsOn, -1) : '';
    const dates =
      item.startsOn && end
        ? item.startsOn === end
          ? item.startsOn
          : `${item.startsOn} – ${end}`
        : '';
    return [scope, dates].filter(Boolean).join(' · ');
  }

  const hasBonuses = computed(
    () =>
      areas.value.some(area => area.groups.length) ||
      berries.value.length > 0 ||
      notes.value.length > 0 ||
      legacySections.value.length > 0 ||
      encounterUps.value.length > 0
  );
</script>

<template>
  <div class="stack activity-detail">
    <p class="muted">{{ dateRange(event) }}</p>
    <SegmentedControl v-model="tab" :options="tabs" />
    <div v-if="tab === 'bonuses'" class="stack">
      <section v-if="announcedOn !== undefined" class="card stack">
        <h3>{{ t('活动公告来源') }}</h3>
        <p v-if="announcedOn" class="muted">
          {{ t('公告日期') }} {{ announcedOn }}
        </p>
        <p class="announcement-source">{{ event.source }}</p>
      </section>
      <section
        v-for="(section, index) in legacySections"
        :key="'announcement-' + index"
        class="card stack"
      >
        <h3>{{ section.title }}</h3>
        <div class="bonus-tags">
          <span v-for="line in section.lines" :key="line" class="chip">{{
            line
          }}</span>
        </div>
      </section>
      <section
        v-for="(area, areaIndex) in orderedAreas"
        :key="'area-' + areaIndex"
        class="card stack"
      >
        <h3>{{ t('活动范围') }}</h3>
        <p class="muted">
          {{ area.area.length ? list(area.area.map(island)) : t('全部营地') }}
        </p>
        <div
          v-for="group in orderedGroups(area.groups)"
          :key="group.id"
          class="bonus-group"
        >
          <h4>{{ t(groupTitles[group.id]) }}</h4>
          <div
            v-for="(item, itemIndex) in group.items"
            :key="itemIndex"
            class="bonus-rule"
          >
            <p v-if="itemDetail(item)" class="muted bonus-scope">
              {{ itemDetail(item) }}
            </p>
            <div class="bonus-row">
              <span class="bonus-lead">
                <IngredientIcon
                  v-if="ingredientVisual(item.ref)"
                  :id="ingredientVisual(item.ref)!.id"
                  :name="ingredientVisual(item.ref)!.name"
                  :image-file="ingredientVisual(item.ref)!.imageFile"
                  small
                />
                <span>{{ refText(item.ref) }}</span>
              </span>
              <strong>{{ partsText(item.parts) }}</strong>
            </div>
          </div>
        </div>
      </section>
      <section v-if="berries.length" class="card stack">
        <h3>{{ t('喜好树果') }}</h3>
        <div
          v-for="(item, index) in berries"
          :key="index"
          class="bonus-rule"
        >
          <div class="bonus-row">
            <span>{{ gameText(island(item.island)) }}</span>
            <span class="bonus-berries">
              <BerryIcon
                v-for="id in item.berries"
                :key="id"
                :name="berryName(id)"
              />
              <span v-if="item.scope?.length" class="muted">{{
                item.scope.map(refText).join('、')
              }}</span>
            </span>
          </div>
        </div>
      </section>
      <section v-if="notes.length" class="card stack">
        <p v-for="note in notes" :key="note">{{ t(note) }}</p>
      </section>
      <section v-if="encounterUps.length" class="card stack">
        <h3>{{ t('出没提升') }}</h3>
        <div
          v-for="(group, index) in encounterUps"
          :key="index"
          class="bonus-rule"
        >
          <div v-if="group.tier || group.label" class="bonus-row">
            <strong v-if="group.tier">{{ t(tierNames[group.tier]) }}</strong
            ><span v-if="group.label" class="muted">{{
              gameText(group.label)
            }}</span>
          </div>
          <p v-if="group.islands?.length" class="muted bonus-scope">
            {{ list(group.islands.map(island)) }}
          </p>
          <ActivityPokemonIcons :ids="group.pokemonIds" />
        </div>
      </section>
      <p v-if="!hasBonuses" class="muted">
        {{ t('该活动暂无已收录的加成。') }}
      </p>
    </div>
    <EventBundlesPane v-else :event="event" />
  </div>
</template>

<style scoped>
  .activity-detail {
    align-self: start;
    min-width: 0;
    grid-template-columns: minmax(0, 1fr);
  }
  .announcement-source {
    overflow-wrap: anywhere;
  }
  .bonus-tags {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    min-width: 0;
  }
  .bonus-tags .chip {
    max-width: 100%;
    height: auto;
    white-space: normal;
    overflow-wrap: anywhere;
    line-height: 1.45;
  }
  .bonus-group h4 {
    margin: 10px 0 2px;
    font-size: 13px;
  }
  .bonus-rule + .bonus-rule {
    border-top: 1px solid var(--line);
    padding-top: 8px;
  }
  .bonus-scope {
    font-size: 12px;
    line-height: 1.55;
    margin-bottom: 4px;
  }
  .bonus-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 12px;
    line-height: 1.5;
  }
  .bonus-lead,
  .bonus-berries {
    display: flex;
    align-items: center;
    gap: 6px;
    min-width: 0;
  }
  .bonus-berries {
    justify-content: flex-end;
    flex-wrap: wrap;
  }
  .bonus-row strong {
    min-width: 0;
    text-align: right;
    overflow-wrap: anywhere;
  }
</style>
