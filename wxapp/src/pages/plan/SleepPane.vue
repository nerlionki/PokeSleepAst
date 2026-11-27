<script setup lang="ts">
import { computed } from 'vue'
import { formatSleepLength, gameText, t as translateUi } from '../../../../core/src/ui/i18n'
import { INPUT_RANGES } from '../../../../core/src/calc/inputRanges'
import { EFFICIENCY_SLEEP_TYPES } from '../../../../core/src/calc/babyEfficiency'
import { ISLANDS } from '../../../../core/src/calc/data'
import { energyLost, EVENT_BONUSES, RANK_ORDER, rankStrength, sleepMinutes } from '../../../../core/src/calc/sleep'
import { useSleepPlanner } from '../../../../core/src/composables/useSleepPlanner'
import PlanCampTicket from '../../generated/components/plan/PlanCampTicket.vue'
import ProgressDialog from '../../generated/components/shared/ProgressDialog.vue'
import PokeSprite from '../../generated/components/shared/PokeSprite.vue'
import ShinyMark from '../../generated/components/shared/ShinyMark.vue'
import RangeSlider from '#platform/RangeSlider.vue'
import WxInput from '../../components/WxInput.vue'
import WxSelect from '../../components/WxSelect.vue'

const INPUT_LIMITS = INPUT_RANGES.SleepPane
const {
  busy,
  sameMult,
  eventMult,
  overviewWhole,
  manualWhole,
  overviewScore,
  shown,
  dp,
  overviewSplitHelps,
  overview,
  nextCatch,
  island,
  plan,
  pickedRank,
  researchSession,
  researchedBefore,
  specialEncountered,
  whole,
  firstResearchExtras,
  campTicketMode,
  focusIncense,
  luckIncense,
  incenseSession,
  otherTypes,
  rank,
  nextRank,
  calculate,
  sampled,
  shinyRate,
  seenTotal,
  seenShiny,
  expectedCount,
  simulationError,
  notice,
  BATCH,
  average,
  perSleep,
  resultTab,
  candies,
  campTicket,
  board,
  percent,
  progress,
  cancel,
} = useSleepPlanner()

const islandOptions = computed(() => ISLANDS.map(({ id, name }) => ({ value: id, label: gameText(name) })))
const rankOptions = computed(() => RANK_ORDER.map(value => ({ value, label: value + ' · ' + rankStrength(island.value, value).toLocaleString('zh-CN') })))
const sleepTypeOptions = computed(() => EFFICIENCY_SLEEP_TYPES.map(value => ({ value, label: gameText(value) })))
const researchOptions = computed(() => [
  { value: 0, label: translateUi('第一次（拆觉时包括第二次）') },
  { value: 1, label: translateUi('仅第二次') },
])
const incenseOptions = computed(() => [
  { value: 0, label: translateUi('第一觉') },
  { value: 1, label: translateUi('第二觉') },
])
const precisionOptions = computed(() => [
  { value: 'low', label: translateUi('低 · 快速搜索') },
  { value: 'medium', label: translateUi('中 · 细化搜索') },
  { value: 'high', label: translateUi('高 · 密集搜索') },
])
</script>

<template>
  <view class="stack form-pane" :aria-busy="busy">
    <p class="muted">{{ translateUi('特殊加成') }}</p>
    <div class="lv-row">
      <button
        v-for="bonus in EVENT_BONUSES"
        :key="bonus.mult"
        type="button"
        :disabled="busy"
        :class="{ on: sameMult(bonus.mult) }"
        @click="eventMult = bonus.mult"
      >
        {{ translateUi(bonus.label) }}
      </button>
    </div>
    <article class="card stack">
      <p class="sleep-brief">
        <button
          type="button"
          :disabled="busy"
          :class="{ on: overviewWhole }"
          @click="manualWhole = !overviewWhole"
        >
          {{ overviewWhole ? translateUi('不拆分') : translateUi('拆分') }}
        </button>
        <span>
          {{ translateUi('每日满睡眠') }}
          {{ formatSleepLength(sleepMinutes(overviewScore))
          }}{{ translateUi('，可捕捉') }} {{ shown }}{{ translateUi('只，') }}
          {{ overviewScore }}{{ translateUi('分，获得') }}
          {{ Math.round(dp).toLocaleString('zh-CN')
          }}{{ translateUi('睡意之力，掉') }} {{ energyLost(overviewScore)
          }}{{ translateUi('点活力') }}
        </span>
      </p>
      <p v-if="!overviewWhole && overviewSplitHelps" class="muted">
        {{ translateUi('第一觉') }}
        {{ formatSleepLength(sleepMinutes(overview.best.a)) }}（{{
          overview.best.a
        }}
        {{ translateUi('分）') }}{{ overview.best.first }}
        {{ translateUi('只， 第二觉') }}
        {{ formatSleepLength(sleepMinutes(overview.best.b)) }}（{{
          overview.best.b
        }}
        {{ translateUi('分）') }}{{ overview.best.second }}
        {{ translateUi('只') }}
      </p>
      <p v-else-if="!overviewWhole" class="muted">
        {{ translateUi('这个岛屿每日 100 分下拆分不会多抓，按一觉睡满计算。') }}
      </p>
      <p v-else-if="overviewSplitHelps" class="muted">
        {{ translateUi('拆成两觉可以多抓') }}
        {{ overview.best.total - overview.single }}
        {{ translateUi('只，点「不拆分」切换为拆分查看拆法。') }}
      </p>
      <p class="muted">
        {{ translateUi('顶部按每日 100 分推荐；下方模拟使用所选睡眠分数。') }}
      </p>
      <p v-if="nextCatch">
        {{ translateUi('距离抓') }}{{ nextCatch.count
        }}{{ translateUi('只还需') }}
        {{ nextCatch.need.toLocaleString('zh-CN') }} {{ translateUi('能量') }}
      </p>
      <p v-else class="muted">{{ translateUi('这个睡意之力已经到 8 只。') }}</p>
    </article>
    <div class="field">
      <label>{{ translateUi('岛屿') }}</label>
      <WxSelect :disabled="busy" v-model="island" :options="islandOptions" />
    </div>
    <div
      class="field"
      data-swipe-ignore
      @touchstart.stop
      @touchend.stop
      @touchcancel.stop
    >
      <label
        >{{ translateUi('睡眠分数') }} {{ plan.sleepScore }} ·
        {{ formatSleepLength(sleepMinutes(plan.sleepScore)) }}</label
      >
      <RangeSlider
        :disabled="busy"
        v-model="plan.sleepScore"
        :min="INPUT_LIMITS.plan_sleepScore.min"
        :max="INPUT_LIMITS.plan_sleepScore.max"
      />
    </div>
    <div class="field">
      <label>{{ translateUi('评级（选择后填入该岛这一档的最低能量）') }}</label>
      <WxSelect :disabled="busy" v-model="pickedRank" :options="rankOptions" />
    </div>
    <div class="field">
      <label>{{ translateUi('入睡卡比兽能量') }}</label>
      <WxInput
        :disabled="busy"
        v-model.number="plan.snorlaxStrength"
        type="number"
        :min="INPUT_LIMITS.plan_snorlaxStrength.min"
      />
    </div>
    <div class="field">
      <label>{{ translateUi('本日研究次数') }}</label
      ><WxSelect :disabled="busy" v-model.number="researchSession" :options="researchOptions" />
    </div>
    <div class="field">
      <label>{{ translateUi('本日此前已研究只数') }}</label
      ><WxInput
        :disabled="busy"
        v-model.number="researchedBefore"
        type="number"
        :min="INPUT_LIMITS.researchedBefore.min"
        :max="INPUT_LIMITS.researchedBefore.max"
      />
    </div>
    <label class="row"
      ><WxInput :disabled="busy" v-model="specialEncountered" type="checkbox" />{{
        translateUi('本日实际遇到特殊UP宝可梦')
      }}</label
    >
    <div v-if="!whole" class="field">
      <label>{{
        translateUi('第一觉薰香额外遭遇只数（不含露营券、特殊UP）')
      }}</label
      ><WxInput
        :disabled="busy"
        v-model.number="firstResearchExtras"
        type="number"
        :min="INPUT_LIMITS.firstResearchExtras.min"
        :max="INPUT_LIMITS.firstResearchExtras.max"
      />
    </div>
    <p class="muted">
      {{
        translateUi(
          '每日第11只起糖果为1，研究EXP与梦之碎片减半；实际遇到特殊UP时从第12只起减额。按抽选顺序结算，不减少捕捉数量。额外遭遇只计入累计只数，不模拟其奖励。'
        )
      }}
    </p>
    <div class="field">
      <label>{{ translateUi('睡眠类型') }}</label>
      <WxSelect :disabled="busy" v-model="plan.sleepType" :options="sleepTypeOptions" />
    </div>
    <PlanCampTicket v-model="campTicketMode" :disabled="busy" />
    <label class="row"
      ><WxInput :disabled="busy" v-model="focusIncense" type="checkbox" />
      {{ translateUi('专注薰香（研究 EXP ×2）') }}</label
    >
    <label class="row"
      ><WxInput :disabled="busy" v-model="luckIncense" type="checkbox" />
      {{ translateUi('幸运薰香（研究梦碎 ×2）') }}</label
    >
    <label v-if="!whole && (focusIncense || luckIncense)" class="field">
      <span>{{ translateUi('薰香使用时段') }}</span>
      <WxSelect v-model.number="incenseSession" :disabled="busy" :options="incenseOptions" />
    </label>
    <label class="row"
      ><WxInput :disabled="busy" v-model="otherTypes" type="checkbox" />
      {{ translateUi('活动期间遇到一些其他类型宝可梦') }}</label
    >
    <p class="muted">
      {{ gameText(ISLANDS.find(i => i.id === island)?.name)
      }}{{ translateUi('评级') }} {{ rank
      }}<template v-if="nextRank"
        >{{ translateUi('，再') }} {{ nextRank.need.toLocaleString('zh-CN') }}
        {{ translateUi('能量升到') }} {{ nextRank.rank }}</template
      >{{
        translateUi(
          '。 露营券加 1 只。分数按满睡眠 8 小时 30 分 = 100 分换算。'
        )
      }}
    </p>
    <article class="expect-board">
      <div class="field">
        <label for="sleep-precision">{{ translateUi('计算精度') }}</label>
        <WxSelect id="sleep-precision" v-model="plan.sleepPrecision" :disabled="busy" :options="precisionOptions" />
      </div>
      <div class="row">
        <button
          class="btn sage"
          type="button"
          :disabled="busy"
          @click="calculate"
        >
          {{ busy ? translateUi('正在模拟…') : translateUi(sampled ? '计算 4000 次' : '计算睡姿') }}
        </button>
      </div>
      <p class="muted">
        {{ translateUi('每只独立抽选闪光 · 全体适用模拟概率') }}
        {{ (shinyRate * 100).toFixed(2) }}%<template v-if="seenTotal">
          · {{ translateUi(sampled ? '抽到闪光' : '闪光') }}
          {{ sampled ? seenShiny.toLocaleString('zh-CN') : expectedCount(seenShiny) }}
          {{ translateUi('只') }}</template
        >
      </p>
      <p v-if="simulationError" class="amber" role="alert">
        {{ simulationError }}
      </p>
      <p v-if="notice" class="muted" role="status">{{ translateUi(notice) }}</p>
      <p v-if="sampled && seenTotal" class="muted">
        {{ translateUi('本次模拟') }} {{ BATCH.toLocaleString('zh-CN') }}
        {{ translateUi('次')
        }}{{ whole ? translateUi('整觉') : translateUi('拆分方案')
        }}{{ translateUi('，共遇到') }} {{ seenTotal.toLocaleString('zh-CN') }}
        {{
          translateUi(
            '只。预期只数 = 这只遇到的数量 / 全部遇到的数量。再点一次会重新算，不会累加。'
          )
        }}
      </p>
      <p v-else-if="sampled && !busy" class="muted">
        {{
          translateUi(
            '点一次单独模拟 4000 次当前方案。再点会换一批结果，不会和上一次加在一起。'
          )
        }}
      </p>
      <div v-if="seenTotal" class="sleep-reward-summary">
        <p>
          <span>{{ translateUi('每次方案平均研究 EXP') }}</span
          ><strong>{{ average(perSleep.researchExp) }}</strong>
        </p>
        <p>
          <span>{{ translateUi('每次方案平均梦之碎片') }}</span
          ><strong>{{ average(perSleep.shards) }}</strong>
        </p>
      </div>
      <div
        v-if="seenTotal"
        class="seg"
        role="tablist"
        :aria-label="translateUi('模拟结果')"
      >
        <button
          type="button"
          role="tab"
          :aria-selected="resultTab === 'encounters'"
          :class="{ on: resultTab === 'encounters' }"
          @click="resultTab = 'encounters'"
        >
          {{ translateUi('遭遇') }}
        </button>
        <button
          type="button"
          role="tab"
          :aria-selected="resultTab === 'candies'"
          :class="{ on: resultTab === 'candies' }"
          @click="resultTab = 'candies'"
        >
          {{ translateUi('糖果') }}
        </button>
      </div>
      <div
        v-if="resultTab === 'candies' && candies.length"
        class="sleep-candy-summary"
      >
        <p class="muted">
          {{ translateUi('每次方案平均糖果（同一进化链合并）') }}
        </p>
        <div
          v-for="candy in candies"
          :key="candy.pokeId"
          class="sleep-candy-line"
        >
          <PokeSprite :id="candy.pokeId" :name="candy.name" />
          <span>{{ gameText(candy.name) }}</span
          ><strong>{{ average(candy.average) }}</strong>
        </div>
      </div>
      <p
        v-if="seenTotal && campTicket && researchSession === 0"
        class="muted"
      >
        {{ translateUi('已计入露营券额外抽选及奖励。') }}
      </p>
      <div
        v-if="resultTab === 'encounters' && board.length"
        class="expect-list"
      >
        <div
          v-for="item in board"
          :key="`${item.pokeId}-${item.shiny}`"
          class="expect-line"
        >
          <PokeSprite :id="item.pokeId" :name="item.name" :shiny="item.shiny" />
          <strong
            >{{ gameText(item.name) }}<ShinyMark v-if="item.shiny"
          /></strong>
          <span class="muted"
            >{{ translateUi(sampled ? '遇到' : '期望') }}
            {{ sampled ? item.count.toLocaleString('zh-CN') : expectedCount(item.count) }}</span
          >
          <b>{{ item.percent.toFixed(2) }}%</b>
        </div>
      </div>
    </article>
    <ProgressDialog
      :open="busy"
      :title="translateUi('正在模拟睡姿')"
      :progress="percent"
      :notice="notice"
      hint="模拟期间参数已锁定"
      :detail="
        sampled ? translateUi('已模拟 {done} / {total} 次', {
          done: progress.completed.toLocaleString('zh-CN'),
          total: progress.total.toLocaleString('zh-CN')
        }) : ''
      "
      cancellable
      cancel-text="取消模拟"
      @cancel="cancel"
    />
  </view>
</template>
