<script setup lang="ts">
  import PlanCampTicket from './PlanCampTicket.vue';
  import { usePlanCampTicket } from '../../composables/usePlanCampTicket';
  import { gameText, sleepStyleText, t as translateUi } from '../../ui/i18n';

  import { INPUT_RANGES } from '../../calc/inputRanges';
  const INPUT_LIMITS = INPUT_RANGES.SplitSleepPane;

  import { confirmRemoval } from '#platform/confirm';
  import clientDefaults from '../../data/client-defaults.resource';

  import { useActivities } from '../../composables/useActivities';
  import { researchActivity, researchSleepStyles } from '../../calc/activities';
  import type { CompletionSelectionMode } from '../../calc/completionEfficiency';
  import { computed, ref, watch } from 'vue';
  import { storeToRefs } from 'pinia';
  import { usePlanStore } from '../../stores/plans';
  import { useSettingsStore } from '../../stores/settings';
  import {
    BABY_POKEMON_IDS,
    babyEfficiencyTargetIds,
    EFFICIENCY_SLEEP_TYPES
  } from '../../calc/babyEfficiency';
  import { ISLANDS, SLEEP_STYLES } from '../../calc/data';
  import { familyOf } from '../../calc/candyPlan';
  import {
    EVENT_BONUSES,
    resolvedSleepdex,
    raeSleepStyleId
  } from '../../calc/sleep';
  import { eventMixLabel, normalizeEventMix } from '../../calc/sleepRules';
  import {
    newSplitTarget,
    splitTargetKey,
    splitTargetStatus,
    type SplitOptions,
    type SplitTarget
  } from '../../calc/splitSleep';
  import { useSplitSleep } from '../../composables/useSplitSleep';
  import PlanningTargetDialog from './PlanningTargetDialog.vue';
  import PlanningTargetFields from './PlanningTargetFields.vue';
  import Dialog from '#platform/Dialog.vue';
  import ProgressDialog from '../shared/ProgressDialog.vue';
  import SplitRecommendation from './SplitRecommendation.vue';
  import PlanningResultCurve from './PlanningResultCurve.vue';
  const components_plan_SplitSleepPane_config_clientDefaults =
    clientDefaults.modules.components_plan_SplitSleepPane;

  const { plan } = storeToRefs(usePlanStore());
  const settingsStore = useSettingsStore();
  const { settings } = storeToRefs(settingsStore);
  const { mode: campTicketMode, enabled: campTicket } = usePlanCampTicket('split');
  const config = computed(() => plan.value.splitSleep);
  const island = computed({
    get: () => settings.value.island,
    set: value => settingsStore.applyIsland(value)
  });
  const activity = useActivities(
    config,
    () => island.value,
    () => settings.value.activity
  );
  const eventMult = activity.field(
    'drowsyPowerMultiplier',
    () => config.value.eventMult
  );
  const mixMode = activity.field('eventMix', () =>
    normalizeEventMix(config.value.eventMix) !== 'off'
      ? settings.value.sleepEventMix
      : 'off'
  );
  const otherTypes = computed({
    get: () => mixMode.value !== 'off',
    set: value => {
      mixMode.value = value ? settings.value.sleepEventMix : 'off';
    }
  });
  const options = computed<SplitOptions>(() => ({
    ...config.value,
    island: island.value,
    strength: plan.value.snorlaxStrength,
    campTicket: campTicket.value,
    activity: activity.context.value,
    eventMult: eventMult.value,
    eventMix: mixMode.value
  }));
  function displayStatus(target: SplitTarget, options: SplitOptions) {
    const status = splitTargetStatus(
      target,
      options.island,
      options.strength,
      options.activity
    );
    const style = status.namedStyle;
    const label =
      target.kind === 'style' && style
        ? `${gameText(style.name)} ${style.stars}★ ${sleepStyleText(style)}`
        : status.label;
    return { ...status, label };
  }
  const statuses = computed(() =>
    options.value.targets.map(target => displayStatus(target, options.value))
  );
  const initialKind = components_plan_SplitSleepPane_config_clientDefaults.kindInitial as SplitTarget['kind'];
  const addingTarget = ref(false);
  let runAfterAdd = false;
  const kind = ref<SplitTarget['kind']>(initialKind === 'baby' ? 'catch' : initialKind),
    statistic = ref<NonNullable<SplitTarget['statistic']>>('first-hit'),
    selectionMode = ref<CompletionSelectionMode>('free'),
    pokeId = ref(
      components_plan_SplitSleepPane_config_clientDefaults['pokeIdInitial']
    ),
    face = ref<SplitTarget['style']>(
      components_plan_SplitSleepPane_config_clientDefaults['faceInitial']
    ),
    advanced = ref(
      components_plan_SplitSleepPane_config_clientDefaults['advancedInitial']
    ),
    formError = ref(
      components_plan_SplitSleepPane_config_clientDefaults['formErrorInitial']
    );
  const currentStyles = computed(() =>
    researchSleepStyles(SLEEP_STYLES, researchActivity(activity.context.value))
      .filter(row => !row.limited && row.island === island.value)
  );
  const selectableStyles = computed(() => {
    const found = new Set(selectionMode.value === 'sleepdex' ? resolvedSleepdex(plan.value) : []);
    return currentStyles.value.filter(row => {
      const id = raeSleepStyleId(row);
      return id != null && !found.has(id);
    });
  });
  const allowedIds = computed(() => {
    if (kind.value === 'style') return [...new Set(selectableStyles.value.map(row => row.pokeId))];
    const species = new Set(currentStyles.value.map(row => row.pokeId));
    if (kind.value === 'candy') {
      const families = new Set([...species].map(familyOf));
      return BABY_POKEMON_IDS.filter(id => families.has(familyOf(id)));
    }
    return BABY_POKEMON_IDS.filter(id => babyEfficiencyTargetIds(id).some(target => species.has(target)));
  });
  const faces = computed(() =>
    selectableStyles.value.filter(row => row.pokeId === pokeId.value)
  );
  watch(
    allowedIds,
    ids => {
      if (!ids.includes(pokeId.value)) pokeId.value = ids[0] ?? 0;
    },
    { immediate: true }
  );
  watch(
    faces,
    rows => {
      if (
        !rows.some(
          row => raeSleepStyleId(row) === face.value
        )
      ) {
        const first = rows[0];
        face.value = first
          ? raeSleepStyleId(first) ?? ''
          : '';
      }
    },
    { immediate: true }
  );
  const { busy, error, notice, progress, result, dirty, calculate, cancel } =
    useSplitSleep(options);
  watch(() => campTicket.value, () => { if (busy.value) cancel(); });
  const percent = computed(() =>
    progress.value.total
      ? Math.min(
          100,
          Math.floor((progress.value.completed / progress.value.total) * 100)
        )
      : 0
  );
  function addTarget() {
    const target = newSplitTarget(
      kind.value,
      pokeId.value,
      kind.value === 'style' ? face.value : ''
    );
    if (!pokeId.value || (kind.value === 'style' && !face.value)) {
      formError.value = '请选择可参与普通研究的目标';
      return false;
    }
    if (kind.value === 'style') target.statistic = statistic.value;
    if (
      config.value.targets.some(
        row => splitTargetKey(row) === splitTargetKey(target)
      )
    ) {
      formError.value = '该目标已添加';
      return false;
    }
    config.value.targets.push(target);
    formError.value = '';
    addingTarget.value = false;
    if (runAfterAdd) void calculate();
    runAfterAdd = false;
    return true;
  }
  function openTarget(runOnSave = false) {
    formError.value = '';
    runAfterAdd = runOnSave;
    addingTarget.value = true;
  }
  function run() {
    formError.value = '';
    if (!config.value.targets.length) { openTarget(true); return; }
    void calculate();
  }
  const resultGroups = computed(() =>
    (['count', 'candy', 'probability'] as const)
      .map(metricKind => ({
        kind: metricKind,
        title:
          metricKind === 'count'
            ? '遇见只数最多'
            : metricKind === 'candy'
              ? '糖果最多'
              : '睡姿概率最大',
        metrics:
          result.value?.metrics.flatMap((metric, index) =>
            metric.kind === metricKind ? [{ ...metric, index }] : []
          ) ?? []
      }))
      .filter(group => group.metrics.length)
  );
  const resultStatuses = computed(() => {
    const resultOptions = result.value?.options;
    return (
      resultOptions?.targets.map(target =>
        displayStatus(target, resultOptions)
      ) ?? []
    );
  });
  const resultNotices = computed(() =>
    resultStatuses.value.filter(status => status.reason)
  );
  function metricLabel(metric: {
    kind: string;
    targetIndex: number;
    label: string;
  }) {
    return metric.kind === 'probability'
      ? (resultStatuses.value[metric.targetIndex]?.label ?? metric.label)
      : metric.label;
  }
  const metricLabels = computed(
    () => result.value?.metrics.map(metricLabel) ?? []
  );
  const curveSeries = computed(() => {
    const current = result.value;
    if (current?.options.precision !== 'medium' && current?.options.precision !== 'high') return [];
    return current.metrics.map((metric, index) => {
      const scores = new Map<number, number>();
      for (const candidate of current.candidates) {
        const score = candidate.sleeps[0]!.score;
        scores.set(score, Math.max(scores.get(score) ?? 0, candidate.values[index]!));
      }
      const unit: '%' | '只' | '颗' = metric.kind === 'probability' ? '%' : metric.kind === 'candy' ? '颗' : '只';
      return {
        label: gameText(metricLabels.value[index]),
        points: [...scores].map(([x, value]) => ({ x, value })).sort((a, b) => a.x - b.x),
        unit
      };
    });
  });
  const zeroMetrics = computed(
    () =>
      result.value?.metrics.filter(
        (_, index) => result.value!.maxima[index] === 0
      ) ?? []
  );
  const resultIsland = computed(
    () =>
      ISLANDS.find(row => row.id === result.value?.options.island)?.name ?? ''
  );
  async function removeTarget(index: number) {
    const target = config.value.targets[index];
    if (!(await confirmRemoval('确认移除此拆觉目标？'))) return;
    const current = config.value.targets.indexOf(target!);
    if (current >= 0) config.value.targets.splice(current, 1);
  }
</script>

<template>
  <div class="stack form-pane" :aria-busy="busy">
    <button
      class="btn ghost"
      type="button"
      :disabled="busy"
      @click="activity.reset()"
    >
      {{ translateUi('恢复本面板自动活动设置') }}
    </button>
    <p class="muted">
      {{
        translateUi(
          '固定岛屿与能量，比较两觉合计 100 分和整觉 100 分，寻找多目标的综合方案与各目标最优方案。'
        )
      }}
    </p>
    <article class="card stack">
      <div class="split-fields">
        <div class="field">
          <label for="split-island">{{ translateUi('岛屿') }}</label
          ><select id="split-island" v-model="island" :disabled="busy">
            <option v-for="row in ISLANDS" :key="row.id" :value="row.id">
              {{ gameText(row.name) }}
            </option>
          </select>
        </div>
        <div class="field">
          <label for="split-strength">{{ translateUi('卡比兽能量') }}</label
          ><input
            id="split-strength"
            v-model.number="plan.snorlaxStrength"
            type="number"
            :min="INPUT_LIMITS.split_strength.min"
            :step="INPUT_LIMITS.split_strength.step"
            inputmode="numeric"
            :disabled="busy"
          />
        </div>
      </div>
      <PlanCampTicket v-model="campTicketMode" :disabled="busy" />
      <h3>{{ translateUi('目标') }}</h3>
      <div
        v-for="(target, index) in config.targets"
        :key="splitTargetKey(target)"
        class="target-row"
      >
        <div class="target-info">
          <strong>{{ statuses[index]?.label }}</strong
          ><span class="muted">{{
            target.kind === 'style'
              ? translateUi(target.statistic === 'expectation' ? '遇见只数最多' : '指定睡姿 · 每日至少一次概率')
              : translateUi(target.kind === 'candy' ? '家族刷糖效率' : '宝宝捕捉效率')
          }}</span
          ><span v-if="statuses[index]?.reason" class="amber">{{
            translateUi(statuses[index]?.reason)
          }}</span>
        </div>
        <button
          class="btn ghost"
          type="button"
          :disabled="busy"
          :aria-label="
            translateUi('移除目标 {arg1}', {
              arg1: String(statuses[index]?.label)
            })
          "
          @click="removeTarget(index)"
        >
          {{ translateUi('移除') }}
        </button>
      </div>
      <button class="btn ghost" type="button" aria-haspopup="dialog" :disabled="busy"
        @click="openTarget()">
        {{ translateUi('添加目标') }}
      </button>
      <PlanningTargetDialog v-if="addingTarget" :title="translateUi('添加目标')"
        :ready="allowedIds.includes(pokeId) && (kind !== 'style' || Boolean(face))"
        @close="formError = ''; addingTarget = false" @save="addTarget">
        <div class="field">
          <label for="split-target-kind">{{
            translateUi('添加目标类型')
          }}</label
          ><select id="split-target-kind" v-model="kind">
            <option value="catch">{{ translateUi('捕捉') }}</option>
            <option value="style">{{ translateUi('指定睡姿') }}</option>
            <option value="candy">{{ translateUi('刷糖') }}</option>
          </select>
        </div>
        <PlanningTargetFields v-model:selection-mode="selectionMode" v-model:poke-id="pokeId"
          :style-id="face" :style-target="kind === 'style'" :allowed-ids="allowedIds" :faces="faces"
          show-style @update:style-id="face = $event ?? ''" />
        <div v-if="kind === 'style'" class="field">
          <label for="split-style-statistic">{{ translateUi('目标') }}</label>
          <select id="split-style-statistic" v-model="statistic">
            <option value="first-hit">{{ translateUi('每日补齐概率最高') }}</option>
            <option value="expectation">{{ translateUi('遇见只数最多') }}</option>
          </select>
        </div>
        <p v-if="formError" class="amber" role="alert">{{ translateUi(formError) }}</p>
      </PlanningTargetDialog>
      <button
        class="btn ghost"
        type="button"
        aria-haspopup="dialog"
        @click="advanced = true"
      >
        {{ translateUi('高级设置 · 类型、活动与权重') }}
      </button>
      <Dialog v-if="advanced" :title="translateUi('高级设置 · 类型、活动与权重')" @close="advanced = false">
        <div class="split-fields">
          <div class="field">
            <label for="split-type">{{ translateUi('睡眠类型') }}</label
            ><select
              id="split-type"
              v-model="config.sleepType"
              :disabled="busy"
            >
              <option value="all">{{ translateUi('每觉自动择优') }}</option>
              <option
                v-for="type in EFFICIENCY_SLEEP_TYPES"
                :key="type"
                :value="type"
              >
                {{ gameText(type) }}
              </option>
            </select>
          </div>
          <div class="field">
            <label for="split-event">{{
              translateUi('活动睡意之力倍率')
            }}</label
            ><select
              id="split-event"
              v-model.number="eventMult"
              :disabled="busy"
            >
              <option
                v-if="!EVENT_BONUSES.some(b => b.mult === eventMult)"
                :value="eventMult"
              >
                {{ eventMult }}{{ translateUi('倍（活动）') }}
              </option>
              <option
                v-for="bonus in EVENT_BONUSES"
                :key="bonus.mult"
                :value="bonus.mult"
              >
                {{ translateUi(bonus.label) }}
              </option>
            </select>
          </div>
        </div>
        <label class="row"
          ><input
            v-model="otherTypes"
            type="checkbox"
            role="switch"
            :disabled="busy"
          />{{ translateUi('活动期间遇到其他睡眠类型宝可梦') }}</label
        >
        <div v-if="(config.precision ?? 'low') === 'low'" class="field">
          <label for="split-iterations">{{
            translateUi('每个研究状态的模拟次数')
          }}</label
          ><input
            id="split-iterations"
            v-model.number="config.iterations"
            type="number"
            :min="INPUT_LIMITS.split_iterations.min"
            :max="INPUT_LIMITS.split_iterations.max"
            :step="INPUT_LIMITS.split_iterations.step"
            :disabled="busy"
          />
        </div>
        <p class="muted">
          {{
            translateUi(
              '按各指标相对单独最优值的比例加权，得到综合评分；默认权重都为 1。权重 0 只退出综合评分，仍计算单目标最优。宝宝糖果统计同家族普通研究收益。'
            )
          }}
        </p>
        <div
          v-for="(target, index) in config.targets"
          :key="splitTargetKey(target)"
          class="stack weight-row"
        >
          <strong>{{ statuses[index]?.label }}</strong>
          <div v-if="target.kind !== 'style'" class="split-fields">
            <div v-if="target.kind !== 'candy'" class="field">
              <label :for="`split-count-${index}`">{{
                translateUi('只数权重')
              }}</label
              ><input
                :id="`split-count-${index}`"
                v-model.number="target.countWeight"
                type="number"
                :min="INPUT_LIMITS.target_countWeight.min"
                :step="INPUT_LIMITS.target_countWeight.step"
                :disabled="busy"
              />
            </div>
            <div v-if="target.kind !== 'catch'" class="field">
              <label :for="`split-candy-${index}`">{{
                translateUi('糖果权重')
              }}</label
              ><input
                :id="`split-candy-${index}`"
                v-model.number="target.candyWeight"
                type="number"
                :min="INPUT_LIMITS.target_candyWeight.min"
                :step="INPUT_LIMITS.target_candyWeight.step"
                :disabled="busy"
              />
            </div>
          </div>
          <template v-else>
            <div class="field">
              <label :for="`split-probability-${index}`">{{
                translateUi(target.statistic === 'expectation' ? '只数权重' : '睡姿概率权重')
              }}</label
              ><input
                :id="`split-probability-${index}`"
                v-model.number="target.probabilityWeight"
                type="number"
                :min="INPUT_LIMITS.target_probabilityWeight.min"
                :step="INPUT_LIMITS.target_probabilityWeight.step"
                :disabled="busy"
              />
            </div>
            <p v-if="!statuses[index]?.unlocked" class="amber">
              {{ translateUi(statuses[index]?.reason)
              }}{{ translateUi('。设置值保留，解锁后恢复生效。') }}
            </p>
          </template>
        </div>
      </Dialog>
      <div class="field">
        <label for="split-precision">{{ translateUi('计算精度') }}</label>
        <select id="split-precision" v-model="config.precision" :disabled="busy">
          <option value="low">{{ translateUi('低 · 快速搜索') }}</option>
          <option value="medium">{{ translateUi('中 · 细化搜索') }}</option>
          <option value="high">{{ translateUi('高 · 密集搜索') }}</option>
        </select>
      </div>
      <p v-if="formError && !addingTarget" class="amber" role="alert">{{ translateUi(formError) }}</p>
      <button
        class="btn sage"
        type="button"
        :disabled="busy"
        @click="run"
      >
        {{ translateUi('计算最佳方案') }}
      </button>
    </article>
    <p v-if="error" class="amber" role="alert">{{ translateUi(error) }}</p>
    <p v-if="notice" class="muted" role="status">{{ translateUi(notice) }}</p>
    <template v-if="result">
      <p v-if="dirty" class="amber">
        {{ translateUi('参数已修改，以下为上次计算结果，请重新计算。') }}
      </p>
      <p class="muted">
        {{ resultIsland }} {{ translateUi('· 能量') }}
        {{ result.options.strength.toLocaleString('zh-CN') }} ·
        {{ result.options.iterations.toLocaleString('zh-CN') }}
        {{ translateUi('次模拟／状态 · 倍率 ×') }}{{ result.options.eventMult }}
        {{ translateUi('· 露营券：')
        }}{{
          result.options.campTicket ? translateUi('开启') : translateUi('关闭')
        }}
        {{ translateUi('· 跨类型：')
        }}{{ translateUi(eventMixLabel(result.options.eventMix))
        }}{{ translateUi('。结果为本次候选搜索的模拟估计。') }}
      </p>
      <p v-for="status in resultNotices" :key="status.label" class="amber">
        {{ status.label }}：{{ translateUi(status.reason) }}
      </p>
      <p
        v-for="metric in zeroMetrics"
        :key="`zero-${metric.targetIndex}-${metric.kind}`"
        class="muted"
      >
        {{ metricLabel(metric)
        }}{{ translateUi('：未解锁或本次模拟收益为 0，不参与综合评分。') }}
      </p>
      <p v-if="(result.options.precision ?? 'low') === 'low'" class="muted">
        {{
          translateUi(
            '只数、糖果是该方案所有睡眠合计的期望值（模拟平均）。例如两觉合计期望 1.084 只，表示长期重复相同条件时，平均每天约 1.084 只，不代表大概率至少遇到 1 只；单日可能为 0 只、1 只或更多。'
          )
        }}
      </p>
      <p class="muted">
        {{
          translateUi(
            '“相对最优”是该指标收益占本次候选方案中最优值的比例，综合评分是这些比例的加权平均，均不是遇见概率。标注“概率”的目标睡姿指标才表示该方案至少遇见一次目标的模拟概率。'
          )
        }}
      </p>
      <SplitRecommendation
        :key="`${JSON.stringify(result.options)}-combined`"
        :title="translateUi('综合推荐')"
        :result="result"
        :metric-labels="metricLabels"
        :optimum="result.combined"
      />
      <SplitRecommendation
        :key="`${JSON.stringify(result.options)}-whole`"
        :title="translateUi('整觉对照 · 综合最优')"
        :result="result"
        :metric-labels="metricLabels"
        :optimum="result.whole"
      />
      <PlanningResultCurve
        v-if="curveSeries.length"
        :key="JSON.stringify(result.options)"
        axis="score"
        :fixed-energy="result.options.strength"
        :series="curveSeries"
      />
      <section v-for="group in resultGroups" :key="group.kind" class="stack">
        <h3>{{ translateUi(group.title) }}</h3>
        <template
          v-for="metric in group.metrics"
          :key="`${JSON.stringify(result.options)}-${metric.index}`"
        >
          <SplitRecommendation
            v-if="
              result.options.targets[metric.targetIndex]?.kind !== 'style' ||
              resultStatuses[metric.targetIndex]?.unlocked
            "
            :title="metricLabel(metric)"
            :result="result"
            :metric-labels="metricLabels"
            :metric-index="metric.index"
            :optimum="result.individual[metric.index]!"
          />
        </template>
      </section>
    </template>
    <ProgressDialog
      :open="busy"
      :title="translateUi('正在计算目标拆觉')"
      :progress="percent"
      stage="比较分数、睡眠类型与目标收益"
      :detail="
        translateUi('已完成 {done} / {total} 个研究状态', {
          done: progress.completed,
          total: progress.total
        })
      "
      :notice="notice"
      cancellable
      cancel-text="取消计算"
      @cancel="cancel"
    />
  </div>
</template>

<style scoped>
  .split-fields {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 14px;
  }
  .target-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 12px 0;
    border-bottom: 1px solid var(--line);
  }
  .target-info {
    display: flex;
    flex-direction: column;
    gap: 4px;
    min-width: 0;
    overflow-wrap: anywhere;
  }
  .target-info span {
    font-size: var(--font-13);
  }
  .weight-row {
    border-top: 1px solid var(--line);
    padding-top: 14px;
  }
  @media (max-width: 400px) {
    .split-fields {
      grid-template-columns: 1fr;
    }
  }
</style>
