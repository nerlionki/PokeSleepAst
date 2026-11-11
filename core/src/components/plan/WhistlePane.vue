<script setup lang="ts">
  import {
    gameText,
    individualName,
    language,
    t as translateUi
  } from '../../ui/i18n';

  import { INPUT_RANGES } from '../../calc/inputRanges';
  const INPUT_LIMITS = INPUT_RANGES.WhistlePane;

  import { computed } from 'vue';
  import { storeToRefs } from 'pinia';
  import { islandById, pokeById } from '../../calc/data';
  import { ingredientImageId, ingredientLabel } from '../../calc/catalogIds';
  import { planWhistle } from '../../calc/whistle';
  import { useBoxStore } from '../../stores/box';
  import { usePlanStore } from '../../stores/plans';
  import { useSettingsStore } from '../../stores/settings';
  import { activityBerrySettings } from '../../calc/activities';
  import { useActivities } from '../../composables/useActivities';
  import IngredientIcon from '../shared/IngredientIcon.vue';
  import PokeSprite from '../shared/PokeSprite.vue';

  const box = useBoxStore();
  const { plan } = storeToRefs(usePlanStore());
  const { settings: rawSettings } = storeToRefs(useSettingsStore());
  const activity = useActivities(rawSettings, () => rawSettings.value.island);
  const settings = computed(() =>
    activityBerrySettings(rawSettings.value, activity.context.value)
  );
  const calculation = computed(() => {
    try {
      return {
        result: planWhistle(settings.value, box.pokemon, plan.value.whistle),
        error: ''
      };
    } catch (error) {
      return {
        result: null,
        error: error instanceof Error ? error.message : '计算失败'
      };
    }
  });
  const result = computed(() => calculation.value.result);
  const environment = computed(() =>
    translateUi('{island} · 岛屿加成 {bonus}%', {
      island: gameText(
        islandById(settings.value.island)?.name ?? settings.value.island
      ),
      bonus: Math.round(settings.value.areaBonus * 100)
    })
  );
  const foods = computed(() =>
    Object.entries(result.value?.ingredients ?? {})
      .filter(([, amount]) => amount > 0)
      .map(([key, amount]) => ({
        key,
        name: ingredientLabel(key),
        amount,
        id: ingredientImageId(key),
        total: result.value?.totalIngredients[key] ?? 0
      }))
  );
  const foodCount = computed(() =>
    foods.value.reduce((sum, food) => sum + food.amount, 0)
  );
  const number = (value: number) =>
    value.toLocaleString('zh-CN', { maximumFractionDigits: 2 });
  const interval = (seconds: number) =>
    translateUi('{minutes}分{seconds}秒', {
      minutes: Math.floor(seconds / 60),
      seconds: seconds % 60
    });
</script>

<template>
  <div class="stack">
    <article class="card stack">
      <h3>{{ translateUi('吹哨规划') }}</h3>
      <p class="muted">
        {{
          translateUi(
            '从 Box 自动挑选树果收益最高的队伍。仅树果计入目标能量，食材单独列出；调整输入后自动更新。'
          )
        }}
      </p>
      <p>{{ environment }}</p>
      <p class="muted">
        {{ translateUi('喜好树果：')
        }}{{
          settings.berries.length
            ? settings.berries
                .map(name => gameText(name))
                .join(language === 'en' ? ', ' : '、')
            : translateUi('未设置')
        }}
      </p>
      <div class="row">
        <div class="field">
          <label for="whistle-current">{{
            translateUi('当前卡比兽能量')
          }}</label>
          <input
            id="whistle-current"
            v-model.number="plan.whistle.currentEnergy"
            type="number"
            :min="INPUT_LIMITS.whistle_current.min"
            :step="INPUT_LIMITS.whistle_current.step"
            inputmode="numeric"
          />
        </div>
        <div class="field">
          <label for="whistle-target">{{
            translateUi('目标卡比兽能量')
          }}</label>
          <input
            id="whistle-target"
            v-model.number="plan.whistle.targetEnergy"
            type="number"
            :min="INPUT_LIMITS.whistle_target.min"
            :step="INPUT_LIMITS.whistle_target.step"
            inputmode="numeric"
          />
        </div>
      </div>
      <p class="muted">
        {{
          translateUi(
            '每个哨子按满活力的 3 小时帮忙产量计算，计入队伍帮手奖励。露营券和活动的生产加成不生效，不触发主技能；EX 喜好树果的 2.4 倍能量加成仍生效。'
          )
        }}
      </p>
    </article>
    <p v-if="calculation.error" class="amber" role="alert">
      {{ translateUi(calculation.error) }}
    </p>
    <template v-if="result">
      <article class="card stack" aria-live="polite">
        <h3>
          {{ translateUi('需要') }}
          {{ result.whistles == null ? '—' : number(result.whistles) }}
          {{ translateUi('个哨子') }}
        </h3>
        <p v-if="result.gap === 0">
          {{ translateUi('当前能量已达到目标，无需吹哨。') }}
        </p>
        <p v-else-if="result.whistles == null" class="amber">
          {{
            translateUi(
              '没有可产生树果能量的有效队伍，请先在 Box 添加并确认宝可梦资料。'
            )
          }}
        </p>
        <p v-else>
          {{ translateUi('还差') }} {{ number(result.gap) }}
          {{ translateUi('能量 · 吹哨后预计达到') }}
          {{ number(result.finalEnergy!) }}
        </p>
        <p>
          {{ translateUi('每哨树果能量') }}
          <strong>{{ number(result.berryEnergy) }}</strong>
          {{ translateUi('· 食材') }} {{ number(foodCount) }}
          {{ translateUi('个') }}
        </p>
        <p class="muted">
          {{
            translateUi(
              '同一队伍的吹哨产物固定，按期望值四舍五入计算，无需随机模拟。结果使用 Box 当前等级、性格、副技能、食材配置和睡饱饱勋章。'
            )
          }}
        </p>
      </article>
      <article v-if="result.members.length" class="card stack">
        <h3>
          {{ translateUi('推荐队伍 ·') }} {{ result.members.length }}
          {{ translateUi('只') }}
        </h3>
        <p class="muted">
          {{ translateUi('帮手奖励') }} {{ result.helpingBonus }}
          {{ translateUi('层（含全局额外设置）；已比较') }}
          {{ result.teamsCompared }}
          {{ translateUi('种可行的帮手奖励人数配置。') }}
        </p>
        <p v-if="result.members.length < 5" class="amber">
          {{ translateUi('考虑有效个体与同队限制，按收益最高的合法') }}
          {{ result.members.length }} {{ translateUi('只队伍计算。') }}
        </p>
        <div
          v-for="member in result.members"
          :key="member.pokemon.uid"
          class="whistle-member"
        >
          <PokeSprite
            :id="member.pokemon.pokeId"
            :name="
              individualName(
                member.pokemon.name,
                pokeById(member.pokemon.pokeId)?.name
              )
            "
            :shiny="member.pokemon.shiny"
            :ribbon-hours="member.pokemon.tune?.ribbonHours"
          />
          <div class="stack whistle-description">
            <p>
              <strong>{{
                individualName(
                  member.pokemon.name,
                  pokeById(member.pokemon.pokeId)?.name
                )
              }}</strong>
              · Lv.{{ member.pokemon.level }}
              <span v-if="member.helpingBonus" class="chip">{{
                translateUi('帮手奖励')
              }}</span>
            </p>
            <p>
              {{ gameText(member.berry) }} {{ member.berries }}
              {{ translateUi('颗 ·') }} {{ number(member.berryEnergy) }}
              {{ translateUi('能量／哨') }}
            </p>
            <p class="muted">
              {{ gameText(member.pokemon.nature) }}
              {{ translateUi('· 队伍帮忙间隔') }}
              {{ interval(member.interval) }} {{ translateUi('· 食材率') }}
              {{ number(member.ingredientRate * 100) }}%
            </p>
          </div>
        </div>
      </article>
      <article v-if="foods.length" class="card stack">
        <h3>{{ translateUi('附带食材') }}</h3>
        <div v-for="food in foods" :key="food.key" class="row">
          <IngredientIcon :id="food.id" :name="food.name" small />
          <span
            >{{ gameText(food.name) }} {{ translateUi('· 每哨') }}
            {{ food.amount }} {{ translateUi('个')
            }}<span v-if="result.whistles != null">
              {{ translateUi('· 目标所需合计') }} {{ number(food.total) }}
              {{ translateUi('个') }}</span
            ></span
          >
        </div>
        <p class="muted">
          {{
            translateUi(
              '食材不折算为卡比兽能量。请预留食材背包空间，并领完本次哨子的产物后再吹下一次。'
            )
          }}
        </p>
      </article>
      <article v-if="result.excluded.length" class="card stack">
        <h3>
          {{ translateUi('未参与计算 ·') }} {{ result.excluded.length }}
          {{ translateUi('只') }}
        </h3>
        <p v-for="(item, index) in result.excluded" :key="index" class="muted">
          {{ gameText(item.name) }}：{{ translateUi(item.reason) }}
        </p>
      </article>
    </template>
  </div>
</template>

<style scoped>
  .whistle-member {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 10px 0;
    border-bottom: 1px solid var(--line, var(--muted));
  }
  .whistle-member:last-child {
    border-bottom: 0;
  }
  .whistle-description {
    min-width: 0;
    gap: 4px;
    flex: 1;
  }
  .whistle-description p {
    margin: 0;
    overflow-wrap: anywhere;
  }
</style>
