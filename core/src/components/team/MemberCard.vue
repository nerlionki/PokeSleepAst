<script setup lang="ts">
  import { gameText, individualName, t as translateUi } from '../../ui/i18n';

  import { ingredientImageId, ingredientLabel } from '../../calc/catalogIds';
  import { ingredientEnergyValue } from '../../calc/activityIngredients';
  import { breakdownProduceIngredients } from '../../calc/produceDisplay';
  import clientDefaults from '../../data/client-defaults.resource';
  import { cloneData } from '../../calc/dataClone';

  import { resolveMemberSkill } from '../../calc/mew';
  import { itemById, ITEM_ROLES } from '../../calc/itemCatalog';
  import { ownedSelectionSkill } from '../../calc/skillModel';
  import { skillMaxFor } from '../../calc/mainSkills';
  import { exEffects } from '../../calc/exEffects';
  import { computed, shallowRef } from 'vue';
  import { storeToRefs } from 'pinia';
  import { natureByName, pokeById } from '../../calc/data';
  import { energyMultiplier, instantInterval } from '../../calc/helpSpeed';
  import {
    effectiveSkillLevel,
    unlockedSubskills,
    SUBSKILL_GATES
  } from '../../calc/member';
  import { effectiveNature, natureStatFactor } from '../../calc/natureLabels';
  import { ribbonBonus, stagesLeft } from '../../calc/ribbon';
  import { carryLimit } from '../../calc/timeline';
  import { useSettingsStore } from '../../stores/settings';
  import { activityBerrySettings, activityValues } from '../../calc/activities';
  import { useActivities } from '../../composables/useActivities';
  import type { CarryMode, ProduceResult, Settings } from '../../types';
  import BerryIcon from '../shared/BerryIcon.vue';
  import IngredientIcon from '../shared/IngredientIcon.vue';
  import PokeSprite from '../shared/PokeSprite.vue';
  import MainSkillIcon from '../shared/MainSkillIcon.vue';
  import SubskillIcon from '../shared/SubskillIcon.vue';
  const components_team_MemberCard_config_clientDefaults =
    clientDefaults.modules.components_team_MemberCard;

  const props = defineProps<{
    environment?: Settings;
    pokeId: number;
    level: number;
    nature: string;
    natureMinted?: boolean;
    subskills: string[];
    ingredientSlots: [number | null, number | null, number | null];
    skillLevel: number;
    mewSkill?: number;
    result: ProduceResult;
    carryMode?: CarryMode;
    wakeEnergy?: number;
    ribbonHours?: number;
    helpingBonus?: number;
    label?: string;
  }>();
  const showIndividualInfo = shallowRef(false);

  const { settings: rawSettings } = storeToRefs(useSettingsStore());
  const sourceSettings = computed(() => props.environment ?? rawSettings.value);
  const activity = useActivities(
    sourceSettings,
    () => sourceSettings.value.island,
    undefined,
    () => sourceSettings.value.period
  );
  const settings = computed(() =>
    activityBerrySettings(sourceSettings.value, activity.context.value)
  );
  const STAT: Record<string, string> = cloneData(
    components_team_MemberCard_config_clientDefaults['STAT']
  ) as unknown as Record<string, string>;

  const poke = computed(() => {
    const species = pokeById(props.pokeId);
    if (!species) return undefined;
    const selected = resolveMemberSkill(species, props);
    return { ...species, mainSkill: selected.name, skillRate: selected.rate };
  });
  const nature = computed(() => natureByName(effectiveNature(props)));
  const subs = computed(() => unlockedSubskills(props.level, props.subskills));
  const lines = computed(() => {
    const list = poke.value?.ingredients ?? [];
    return props.ingredientSlots.flatMap(index => {
      if (index == null) return [];
      const line = list[index];
      return line ? [line] : [];
    });
  });
  const unknownFoodEnergy = computed(() =>
    Object.entries(props.result.ingredients).some(
      ([name, count]) => count > 0 && ingredientEnergyValue(name) == null
    )
  );
  const breakdown = computed(() => breakdownProduceIngredients(props.result));
  function foodRows(foods: Record<string, number>) {
    const order = new Map(
      [...new Set(lines.value.map(line => String(line.id)))].map(
        (key, index) => [key, index]
      )
    );
    return Object.entries(foods)
      .filter(([, count]) => count > 0)
      .sort(
        ([a], [b]) =>
          (order.get(a) ?? Infinity) - (order.get(b) ?? Infinity) ||
          a.localeCompare(b, 'zh-CN')
      )
      .map(([key, count]) => {
        const unit = ingredientEnergyValue(key);
        return {
          name: ingredientLabel(key),
          id: ingredientImageId(key),
          count,
          energy: unit == null ? null : count * unit
        };
      });
  }
  const naturalRows = computed(() =>
    foodRows(breakdown.value?.natural ?? props.result.ingredients)
  );
  const skillRows = computed(() => foodRows(breakdown.value?.skill ?? {}));
  const skillFoodCount = computed(() =>
    skillRows.value.reduce((sum, row) => sum + row.count, 0)
  );
  const foodTotalCount = computed(() =>
    Object.values(props.result.ingredients).reduce(
      (sum, count) => sum + count,
      0
    )
  );
  const ingEnergy = computed(() =>
    Object.entries(props.result.ingredients).reduce(
      (sum, [name, count]) => sum + count * (ingredientEnergyValue(name) ?? 0),
      0
    )
  );
  const foodScore = computed(
    () => props.result.cooking?.energy ?? ingEnergy.value
  );
  const totalEnergy = computed(
    () => props.result.berryEnergy + foodScore.value + props.result.skillEnergy
  );

  function share(part: number) {
    return totalEnergy.value > 0
      ? Math.round((part / totalEnergy.value) * 100)
      : 0;
  }

  const berryShare = computed(() => share(props.result.berryEnergy));
  const ingShare = computed(() => share(foodScore.value));
  const skillShare = computed(() =>
    Math.max(0, 100 - berryShare.value - ingShare.value)
  );

  const seconds = computed(() => {
    const mon = poke.value;
    if (!mon) return 0;
    const ribbon = ribbonBonus(props.ribbonHours ?? 0, stagesLeft(mon.id));
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
      exEffects(settings.value, mon.berry).speed
    );
  });

  const carry = computed(() => {
    const mon = poke.value;
    if (!mon) return 0;
    const ribbon = ribbonBonus(props.ribbonHours ?? 0, stagesLeft(mon.id));
    return carryLimit(
      mon.carry,
      subs.value,
      settings.value.goodCamp,
      props.carryMode,
      ribbon.carry,
      exEffects(settings.value, mon.berry).carryExtra +
        activityValues(activity.context.value, settings.value.island, mon)
          .carryCapacityBonus,
      activityValues(activity.context.value, settings.value.island, mon)
        .carryCapacityMultiplier
    );
  });

  const skillLv = computed(() =>
    Math.min(
      skillMaxFor(poke.value?.mainSkill ?? ''),
      effectiveSkillLevel(
        props.level,
        props.skillLevel,
        props.subskills,
        poke.value?.mainSkill ?? ''
      ) + exEffects(settings.value, poke.value?.berry ?? '').skillLevels
    )
  );

  function bandFactor(asleep: boolean) {
    const points = props.result.curve.filter(point => point.asleep === asleep);
    const factor = points.length
      ? points.reduce((sum, point) => sum + point.multiplier, 0) / points.length
      : energyMultiplier(props.wakeEnergy ?? settings.value.sleepScore);
    return (factor > 0 ? 1 / factor : 1).toFixed(4);
  }

  function helpClock(value: number) {
    const whole = Math.max(0, Math.round(value));
    const hour = Math.floor(whole / 3600);
    const minute = Math.floor((whole % 3600) / 60);
    const second = whole % 60;
    return `${hour}:${String(minute).padStart(2, '0')}:${String(second).padStart(2, '0')}`;
  }

  function rate(
    base: number,
    stat: 'ingredient' | 'skill',
    small: string,
    medium: string
  ) {
    const bonus =
      1 +
      (subs.value.includes(small) ? 0.18 : 0) +
      (subs.value.includes(medium) ? 0.36 : 0);
    return base * natureStatFactor(effectiveNature(props), stat) * bonus;
  }
</script>

<template>
  <article v-if="poke" class="member-card">
    <header class="member-card-top">
      <span class="member-type"
        ><BerryIcon :name="poke.berry" />{{ gameText(poke.berryType) }}</span
      >
      <strong
        >{{ individualName(label, poke.name) }} <em>#{{ poke.id }}</em></strong
      >
      <b>Lv {{ level }}</b>
      <button
        class="member-info-toggle"
        :class="{ on: showIndividualInfo }"
        type="button"
        :aria-expanded="showIndividualInfo"
        :aria-label="
          showIndividualInfo
            ? translateUi('收起个体信息')
            : translateUi('查看个体信息详情')
        "
        :title="
          showIndividualInfo
            ? translateUi('收起个体信息')
            : translateUi('查看个体信息详情')
        "
        @click="showIndividualInfo = !showIndividualInfo"
      >
        {{ showIndividualInfo ? translateUi('收起') : translateUi('详情') }}
      </button>
    </header>
    <PokeSprite
      :id="poke.id"
      :name="poke.name"
      :ribbon-hours="props.ribbonHours"
      large
    />
    <div v-if="!showIndividualInfo" class="member-summary">
      <p
        v-if="poke.specialty === '树果型' || poke.specialty === '全部'"
        class="member-line berry"
      >
        <span
          ><BerryIcon :name="poke.berry" small />
          {{ translateUi('树果产量') }}</span
        >
        <b>{{ result.berries.toFixed(2) }} {{ translateUi('颗') }}</b>
      </p>
      <template
        v-if="
          naturalRows.length ||
          poke.specialty === '食材型' ||
          poke.specialty === '全部'
        "
      >
        <p class="member-line ing">
          <span>{{
            breakdown ? translateUi('帮忙食材') : translateUi('食材合计')
          }}</span
          ><b v-if="!naturalRows.length">{{ translateUi('0.00 个') }}</b>
        </p>
        <p v-for="row in naturalRows" :key="row.name" class="member-line ing">
          <span
            ><IngredientIcon :id="row.id" :name="row.name" small />
            {{ gameText(row.name) }}</span
          >
          <b>{{ row.count.toFixed(2) }} {{ translateUi('个') }}</b>
        </p>
      </template>
      <p v-if="skillRows.length" class="member-line quiet">
        <span>{{
          translateUi('技能食材 · 共 {count} 个 · {kinds} 种', {
            count: skillFoodCount.toFixed(2),
            kinds: skillRows.length
          })
        }}</span>
      </p>
      <p v-if="!breakdown" class="muted">
        {{ translateUi('食材来源暂无法拆分') }}
      </p>
      <p
        v-if="poke.specialty === '技能型' || poke.specialty === '全部'"
        class="member-line quiet"
      >
        <span>{{ translateUi('技能触发') }}</span
        ><b>{{ result.skillProcs.toFixed(2) }} {{ translateUi('次') }}</b>
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
        {{ gameText(props.nature) }}
        <span v-if="natureMinted">{{
          translateUi('净白薄荷 · 无加减成')
        }}</span>
        <span v-if="nature.up">{{ translateUi(STAT[nature.up] ?? '') }}↑</span>
        <span v-if="nature.down"
          >{{ translateUi(STAT[nature.down] ?? '') }}↓</span
        >
      </p>
      <p class="member-total">
        {{
          unknownFoodEnergy
            ? translateUi('还未公布')
            : Math.round(totalEnergy).toLocaleString('zh-CN')
        }}
      </p>
      <div
        v-if="!unknownFoodEnergy"
        class="mix-bar"
        :title="
          translateUi('树果 {arg1}% · {arg2} {arg3}% · 技能 {arg4}%', {
            arg1: String(berryShare),
            arg2: String(result.cooking ? '料理' : '食材'),
            arg3: String(ingShare),
            arg4: String(skillShare)
          })
        "
      >
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
      <p class="member-speed">
        <span>{{ translateUi('白天') }}</span
        ><b>{{ bandFactor(false) }}x</b>
      </p>
      <p class="member-speed">
        <span>{{ translateUi('睡眠') }}</span
        ><b>{{ bandFactor(true) }}x</b>
      </p>
      <p class="member-line berry">
        <span
          ><BerryIcon :name="poke.berry" small /> {{ translateUi('树果') }}
          {{ result.berries.toFixed(2) }}</span
        >
        <b>{{ Math.round(result.berryEnergy).toLocaleString('zh-CN') }}</b>
      </p>
      <p class="member-line ing">
        <span
          >{{ translateUi('食材') }}
          {{
            (
              rate(poke.ingredientRate, 'ingredient', 'ingS', 'ingM') * 100
            ).toFixed(1)
          }}%</span
        >
        <b>{{
          unknownFoodEnergy
            ? translateUi('还未公布')
            : Math.round(ingEnergy).toLocaleString('zh-CN')
        }}</b>
      </p>
      <p v-if="result.cooking" class="member-line ing">
        <span>{{ translateUi('实际料理期望') }}</span
        ><b>{{ Math.round(result.cooking.energy).toLocaleString('zh-CN') }}</b>
      </p>
      <p v-if="naturalRows.length || skillRows.length" class="member-line ing">
        <span>{{
          breakdown ? translateUi('帮忙食材') : translateUi('食材合计')
        }}</span
        ><b v-if="!naturalRows.length">{{ translateUi('0.00 个') }}</b>
      </p>
      <p v-for="row in naturalRows" :key="row.name" class="member-line quiet">
        <span
          ><IngredientIcon :id="row.id" :name="row.name" small />
          {{ gameText(row.name) }} · {{ row.count.toFixed(2) }}</span
        >
        <b>{{
          row.energy == null
            ? translateUi('还未公布')
            : Math.round(row.energy).toLocaleString('zh-CN')
        }}</b>
      </p>
      <template v-if="skillRows.length">
        <p class="member-line ing">
          <span>{{ translateUi('技能食材') }}</span
          ><span>{{ translateUi('已计入上方食材能量') }}</span>
        </p>
        <p v-for="row in skillRows" :key="row.name" class="member-line quiet">
          <span
            ><IngredientIcon :id="row.id" :name="row.name" small />
            {{ gameText(row.name) }} · {{ row.count.toFixed(2) }}</span
          >
          <b>{{
            row.energy == null
              ? translateUi('还未公布')
              : Math.round(row.energy).toLocaleString('zh-CN')
          }}</b>
        </p>
        <p class="member-line quiet">
          <span>{{ translateUi('食材合计') }}</span
          ><b>{{ foodTotalCount.toFixed(2) }} {{ translateUi('个') }}</b>
        </p>
      </template>
      <p v-if="!breakdown" class="muted">
        {{ translateUi('食材来源暂无法拆分') }}
      </p>
      <p class="member-line skill">
        <span
          ><MainSkillIcon :name="poke.mainSkill" decorative />
          {{ translateUi('技能 LV') }}{{ skillLv }}
          {{ gameText(poke.mainSkill) }}
          {{
            (
              Math.min(
                1,
                rate(poke.skillRate, 'skill', 'skillS', 'skillM') *
                  exEffects(settings, poke.berry).skillMultiplier
              ) * 100
            ).toFixed(1)
          }}%</span
        >
      </p>
      <p v-if="ownedSelectionSkill(pokeId)" class="member-line quiet">
        <span
          >{{ gameText(ownedSelectionSkill(pokeId)?.name) }} Lv{{ skillLevel }}
          {{ translateUi('· 所选效果 Lv') }}{{ skillLv }}</span
        >
      </p>
      <p class="member-line quiet">
        <span>{{ result.skillProcs.toFixed(2) }} {{ translateUi('次') }}</span>
        <b>{{ Math.round(result.skillEnergy).toLocaleString('zh-CN') }}</b>
      </p>
      <p class="member-line quiet">
        <span>{{ translateUi('持有') }} {{ carry }}</span>
        <b>{{ translateUi('满包') }} {{ result.sneaky }}</b>
      </p>
      <p v-if="result.rewards" class="member-line quiet">
        <span
          >{{ translateUi('期望奖励：糖果') }}
          {{ result.rewards.candies.toFixed(2) }}
          {{ translateUi('· 梦之碎片') }}
          {{ result.rewards.dreamShards.toFixed(2)
          }}<template
            v-for="(count, id) in result.rewards.items ?? {
              [ITEM_ROLES.berryJuice]: result.rewards.berryJuice
            }"
            :key="id"
          >
            ·
            {{
              itemById(Number(id))?.name ??
              translateUi('道具 {arg1}', { arg1: String(id) })
            }}
            {{ count.toFixed(2) }}</template
          ></span
        >
      </p>
      <p v-if="result.cooking" class="member-line quiet">
        <span
          >{{ translateUi('剩余食材：')
          }}{{
            Object.entries(result.cooking.remain)
              .filter(([, count]) => count > 0)
              .map(
                ([key, count]) =>
                  `${gameText(ingredientLabel(key))} ×${count.toFixed(2)}`
              )
              .join('、') || translateUi('无')
          }}</span
        >
      </p>
    </template>
  </article>
</template>

<style scoped>
  .member-info-toggle {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    flex: 0 0 auto;
    min-width: 44px;
    height: 44px;
    margin: 0;
    padding: 0 10px;
    border: 1px solid var(--line);
    border-radius: 8px;
    background: transparent;
    color: var(--text);
    font: inherit;
    font-size: var(--font-12);
    line-height: 1;
    white-space: nowrap;
  }
  .member-info-toggle.on {
    border-color: var(--amber);
    color: var(--amber);
  }
  .member-info-toggle:focus-visible {
    outline: 2px solid var(--sage);
    outline-offset: 2px;
  }
  .member-summary {
    display: flex;
    flex-direction: column;
    gap: 6px;
    width: 100%;
    min-width: 0;
  }
</style>
