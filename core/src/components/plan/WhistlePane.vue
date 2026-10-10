<script setup lang="ts">
import { computed } from 'vue'
import { storeToRefs } from 'pinia'
import { boxLabel } from '../../calc/boxFilter'
import { ingredientByName, islandById } from '../../calc/data'
import { planWhistle } from '../../calc/whistle'
import { useBoxStore } from '../../stores/box'
import { usePlanStore } from '../../stores/plans'
import { useSettingsStore } from '../../stores/settings'
import IngredientIcon from '../shared/IngredientIcon.vue'
import PokeSprite from '../shared/PokeSprite.vue'

const box = useBoxStore()
const { plan } = storeToRefs(usePlanStore())
const { settings } = storeToRefs(useSettingsStore())
const calculation = computed(() => {
  try { return { result: planWhistle(settings.value, box.pokemon, plan.value.whistle), error: '' } }
  catch (error) { return { result: null, error: error instanceof Error ? error.message : '计算失败' } }
})
const result = computed(() => calculation.value.result)
const environment = computed(() => `${islandById(settings.value.island)?.name ?? settings.value.island} · 岛屿加成 ${Math.round(settings.value.areaBonus * 100)}%`)
const foods = computed(() => Object.entries(result.value?.ingredients ?? {}).filter(([, amount]) => amount > 0)
  .map(([name, amount]) => ({ name, amount, id: ingredientByName(name)?.id ?? 0, total: result.value?.totalIngredients[name] ?? 0 })))
const foodCount = computed(() => foods.value.reduce((sum, food) => sum + food.amount, 0))
const number = (value: number) => value.toLocaleString('zh-CN', { maximumFractionDigits: 2 })
const interval = (seconds: number) => `${Math.floor(seconds / 60)}分${seconds % 60}秒`
</script>

<template>
  <div class="stack">
    <article class="card stack">
      <h3>吹哨规划</h3>
      <p class="muted">从 Box 自动挑选树果收益最高的队伍。仅树果计入目标能量，食材单独列出；调整输入后自动更新。</p>
      <p>{{ environment }}</p>
      <p class="muted">喜好树果：{{ settings.berries.join('、') || '未设置' }}</p>
      <div class="row">
        <div class="field">
          <label for="whistle-current">当前卡比兽能量</label>
          <input id="whistle-current" v-model.number="plan.whistle.currentEnergy" type="number" min="0" step="1" inputmode="numeric">
        </div>
        <div class="field">
          <label for="whistle-target">目标卡比兽能量</label>
          <input id="whistle-target" v-model.number="plan.whistle.targetEnergy" type="number" min="0" step="1" inputmode="numeric">
        </div>
      </div>
      <p class="muted">每个哨子按满活力的 3 小时帮忙产量计算，计入队伍帮手奖励。露营券和活动的生产加成不生效，不触发主技能；EX 喜好树果的 2.4 倍能量加成仍生效。</p>
    </article>
    <p v-if="calculation.error" class="amber" role="alert">{{ calculation.error }}</p>
    <template v-if="result">
      <article class="card stack" aria-live="polite">
        <h3>需要 {{ result.whistles == null ? '—' : number(result.whistles) }} 个哨子</h3>
        <p v-if="result.gap === 0">当前能量已达到目标，无需吹哨。</p>
        <p v-else-if="result.whistles == null" class="amber">没有可产生树果能量的有效队伍，请先在 Box 添加并确认宝可梦资料。</p>
        <p v-else>还差 {{ number(result.gap) }} 能量 · 吹哨后预计达到 {{ number(result.finalEnergy!) }}</p>
        <p>每哨树果能量 <strong>{{ number(result.berryEnergy) }}</strong> · 食材 {{ number(foodCount) }} 个</p>
        <p class="muted">同一队伍的吹哨产物固定，按期望值四舍五入计算，无需随机模拟。结果使用 Box 当前等级、性格、副技能、食材配置和睡饱饱勋章。</p>
      </article>
      <article v-if="result.members.length" class="card stack">
        <h3>推荐队伍 · {{ result.members.length }} 只</h3>
        <p class="muted">帮手奖励 {{ result.helpingBonus }} 层（含全局额外设置）；已比较 {{ result.teamsCompared }} 种可行的帮手奖励人数配置。</p>
        <p v-if="result.members.length < 5" class="amber">有效 Box 个体不足 5 只，按现有 {{ result.members.length }} 只计算。</p>
        <div v-for="member in result.members" :key="member.pokemon.uid" class="whistle-member">
          <PokeSprite :id="member.pokemon.pokeId" :name="boxLabel(member.pokemon)" :shiny="member.pokemon.shiny" />
          <div class="stack whistle-description">
            <p><strong>{{ boxLabel(member.pokemon) }}</strong> · Lv.{{ member.pokemon.level }} <span v-if="member.helpingBonus" class="chip">帮手奖励</span></p>
            <p>{{ member.berry }} {{ member.berries }} 颗 · {{ number(member.berryEnergy) }} 能量／哨</p>
            <p class="muted">{{ member.pokemon.nature }} · 队伍帮忙间隔 {{ interval(member.interval) }} · 食材率 {{ number(member.ingredientRate * 100) }}%</p>
          </div>
        </div>
      </article>
      <article v-if="foods.length" class="card stack">
        <h3>附带食材</h3>
        <div v-for="food in foods" :key="food.name" class="row">
          <IngredientIcon :id="food.id" :name="food.name" small />
          <span>{{ food.name }} · 每哨 {{ food.amount }} 个<span v-if="result.whistles != null"> · 目标所需合计 {{ number(food.total) }} 个</span></span>
        </div>
        <p class="muted">食材不折算为卡比兽能量。请预留食材背包空间，并领完本次哨子的产物后再吹下一次。</p>
      </article>
      <article v-if="result.excluded.length" class="card stack">
        <h3>未参与计算 · {{ result.excluded.length }} 只</h3>
        <p v-for="(item, index) in result.excluded" :key="index" class="muted">{{ item.name }}：{{ item.reason }}</p>
      </article>
    </template>
    <p class="muted">计算规则参考：<a href="https://namakemono289.hatenablog.com/entry/2025/12/23/011054" target="_blank" rel="noopener noreferrer">吹哨产物实测</a>、<a href="https://wikiwiki.jp/poke_sleep/どうぐ/おてつだいホイッスル" target="_blank" rel="noopener noreferrer">哨子规则与 EX 加成</a>。食材发现率来自项目资料，接近取整边界时可能与实测相差少量产物。</p>
  </div>
</template>

<style scoped>
.whistle-member { display: flex; align-items: center; gap: 12px; padding: 10px 0; border-bottom: 1px solid var(--line, #ddd); }
.whistle-member:last-child { border-bottom: 0; }
.whistle-description { min-width: 0; gap: 4px; flex: 1; }
.whistle-description p { margin: 0; overflow-wrap: anywhere; }
</style>
