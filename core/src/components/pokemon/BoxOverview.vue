<script setup lang="ts">
import { computed, reactive, shallowRef, onMounted, watch } from 'vue'
import { calculateBoxOverview, defaultOverviewBonuses, type OverviewBonuses } from '../../calc/boxOverview'
import { loadJson, saveJson } from '../../storage'
import { normalizeEx2Berries, canPickBerries } from '../../calc/defaults'
import type { Settings } from '../../types'
import EnvironmentFields from '../shared/EnvironmentFields.vue'
import { BERRIES, ISLANDS } from '../../calc/data'
import { useBoxStore } from '../../stores/box'
import BerryIcon from '../shared/BerryIcon.vue'
import IngredientIcon from '../shared/IngredientIcon.vue'
import Segmented from '../shared/Segmented.vue'
import OverviewRankRow from './OverviewRankRow.vue'
const emit = defineEmits<{ back: []; complete: [uids: string[]] }>()
const box = useBoxStore()
const tab = shallowRef<'berries' | 'ingredients'>('berries')
const bonuses = reactive(defaultOverviewBonuses())
const loaded = shallowRef(false)
onMounted(async () => {
  const saved = await loadJson<Partial<OverviewBonuses>>('boxOverviewBonuses', {})
  Object.assign(bonuses, defaultOverviewBonuses(), saved)
  if (!ISLANDS.some(island => island.id === bonuses.island)) bonuses.island = 'greengrass'
  bonuses.helpingBonus = Math.min(5, Math.max(0, Math.floor(Number(bonuses.helpingBonus) || 0)))
  bonuses.areaBonus = Math.min(0.85, Math.max(0, Number(bonuses.areaBonus) || 0))
  bonuses.favoredBerries = [...new Set(Array.isArray(bonuses.favoredBerries) ? bonuses.favoredBerries.filter(name => BERRIES.some(berry => berry.name === name)) : [])].slice(0, 3)
  if (bonuses.island === 'cyanex') bonuses.favoredBerries = normalizeEx2Berries(bonuses.favoredBerries)
  loaded.value = true
})
watch(bonuses, value => { if (loaded.value) void saveJson('boxOverviewBonuses', value) }, { deep: true })
const environment = computed(() => ({ island: bonuses.island ?? 'greengrass', berries: bonuses.favoredBerries, helpingBonus: bonuses.helpingBonus, exBuff: bonuses.exBuff, exDebuff: bonuses.exDebuff, exWeeklyBonus: bonuses.exWeeklyBonus }))
function setEnvironment(patch: Partial<Pick<Settings, 'island' | 'berries' | 'helpingBonus' | 'exBuff' | 'exDebuff' | 'exWeeklyBonus'>>) {
  if (patch.island) {
    bonuses.island = patch.island
    if (!canPickBerries(patch.island)) bonuses.favoredBerries = [...(ISLANDS.find(island => island.id === patch.island)?.berries ?? [])]
    if (patch.island === 'cyanex') bonuses.favoredBerries = normalizeEx2Berries(bonuses.favoredBerries)
    if (patch.island === 'greenex' && !bonuses.favoredBerries.length) bonuses.favoredBerries = [BERRIES[0]!.name]
  }
  if (patch.berries) bonuses.favoredBerries = patch.berries
  if (patch.helpingBonus != null) bonuses.helpingBonus = patch.helpingBonus
  if (patch.exBuff != null) bonuses.exBuff = patch.exBuff
  if (patch.exDebuff != null) bonuses.exDebuff = patch.exDebuff
  if (patch.exWeeklyBonus != null) bonuses.exWeeklyBonus = patch.exWeeklyBonus
}
const adjusting = shallowRef(false)
const ingredientId = shallowRef<number | null>(null)
const visibleRanks = shallowRef(20)
const overview = computed(() => calculateBoxOverview(box.pokemon, bonuses))
const excluded = computed(() => tab.value === 'berries' ? overview.value.excludedBerries : overview.value.excludedIngredients)
const selected = computed(() => overview.value.ingredients.find((ingredient) => ingredient.id === ingredientId.value))
const rankedBerries = computed(() => overview.value.berries.filter((berry) => berry.rows.length))
const emptyBerryCount = computed(() => overview.value.berries.length - rankedBerries.value.length)
const customized = computed(() => bonuses.island !== 'greengrass' || bonuses.areaBonus > 0 || bonuses.goodCamp || bonuses.helpingBonus > 0 || bonuses.favoredBerries.length > 0)
function openIngredient(id: number) { ingredientId.value = id; visibleRanks.value = 20 }
function resetBonuses() { Object.assign(bonuses, defaultOverviewBonuses()) }
</script>
<template>
  <div class="stack box-overview">
    <div class="overview-heading">
      <button class="btn ghost" type="button" @click="emit('back')">返回 Box</button>
      <h2>Box 概览</h2>
      <button class="btn ghost" type="button" :class="{ on: customized }" :disabled="!loaded" :aria-expanded="adjusting" @click="adjusting = !adjusting">调整加成</button>
    </div>
    <p class="muted">当前培养状态 · 全天满活 · {{ box.pokemon.length }} 只宝可梦</p>
    <section v-if="adjusting" class="card stack" aria-label="概览计算加成">
      <div class="bonus-fields">
        <div class="field"><label for="overview-area">营地加成（%）</label><input id="overview-area" v-model.number="bonuses.areaBonus" type="range" min="0" max="0.85" step="0.01"><span class="muted">{{ Math.round(bonuses.areaBonus * 100) }}%</span></div>
      </div>
      <label class="row"><input v-model="bonuses.goodCamp" type="checkbox">优质露营券</label>
      <p class="muted">保留个体自身的帮手奖励和缎带；帮手奖励最多叠加 5 层。加成仅用于本页。</p>
      <EnvironmentFields :value="environment" @change="setEnvironment" />
      <button class="btn ghost" type="button" @click="resetBonuses">恢复基础口径</button>
    </section>
    <p v-if="customized" class="muted">营地加成 {{ Math.round(Math.min(0.85, Math.max(0, bonuses.areaBonus)) * 100) }}% · 其他队员帮手奖励 {{ Math.min(5, Math.max(0, Math.floor(Number(bonuses.helpingBonus) || 0))) }} 层{{ bonuses.goodCamp ? ' · 优质露营券' : '' }}{{ bonuses.favoredBerries.length ? ' · 已设置喜好树果' : '' }}</p>
    <Segmented v-model="tab" :options="[{ id: 'berries', label: '树果产量' }, { id: 'ingredients', label: '食材产量' }]" />
    <div v-if="excluded.length" class="overview-warning">
      <p>{{ excluded.length }} 只个体缺少本项计算所需字段，暂未参与排名。</p>
      <button class="btn ghost" type="button" @click="emit('complete', excluded.map((pokemon) => pokemon.uid))">去补全</button>
    </div>
    <p v-if="!box.pokemon.length" class="card muted">Box 还没有宝可梦，返回 Box 后新增或导入即可查看产量。</p>
    <template v-else-if="tab === 'berries'">
      <p class="muted">24 小时全时满包 · 每种树果按能量取前 3 名 · 不计主技能能量</p>
      <div v-if="rankedBerries.length" class="berry-rank-grid">
        <section v-for="berry in rankedBerries" :key="berry.name" class="card berry-group">
          <div class="berry-heading"><BerryIcon :name="berry.name" /><h3>{{ berry.name }}</h3><span class="muted">{{ berry.type }}</span></div>
          <OverviewRankRow v-for="(row, index) in berry.rows" :key="row.pokemon.uid" :row="row" :rank="index + 1" unit="能量" />
        </section>
      </div>
      <p v-else class="card muted">暂无可计算树果能量的个体，请先补全关键字段。</p>
      <p v-if="emptyBerryCount" class="muted">其余 {{ emptyBerryCount }} 种树果暂无可参与排名的个体。</p>
    </template>
    <template v-else>
      <p class="muted">24 小时无持有上限 · 仅普通帮忙食材 · 点击查看全部个体排名</p>
      <div class="ingredient-grid">
        <button v-for="ingredient in overview.ingredients" :key="ingredient.id" class="ingredient-tile" type="button" :disabled="!ingredient.rows.length" :aria-label="ingredient.name + (ingredient.rows.length ? '产量排名' : '暂无产出')" @click="openIngredient(ingredient.id)">
          <IngredientIcon :id="ingredient.id" :name="ingredient.name" />
          <span>{{ ingredient.name }}</span>
          <strong>{{ ingredient.rows[0]?.amount.toLocaleString('zh-CN', { maximumFractionDigits: 1 }) ?? '—' }}<small v-if="ingredient.rows.length"> /日</small></strong>
          <span class="muted">{{ ingredient.rows.length ? '最高单只 · ' + ingredient.rows.length + ' 只产出' : '暂无产出' }}</span>
        </button>
      </div>
    </template>
    <div v-if="selected" v-back="() => { ingredientId = null }" class="overlay" role="dialog" aria-modal="true" aria-labelledby="ingredient-ranking-title" @click.self="ingredientId = null" @keydown.esc="ingredientId = null">
      <section class="sheet stack ingredient-ranking">
        <div class="row"><IngredientIcon :id="selected.id" :name="selected.name" /><h3 id="ingredient-ranking-title">{{ selected.name }}产量排名</h3><button class="btn ghost" type="button" @click="ingredientId = null">关闭</button></div>
        <p class="muted">当前等级 · 全天满活 · 无持有上限 · {{ selected.rows.length }} 只个体</p>
        <OverviewRankRow v-for="(row, index) in selected.rows.slice(0, visibleRanks)" :key="row.pokemon.uid" :row="row" :rank="index + 1" unit="个" ingredients />
        <button v-if="selected.rows.length > visibleRanks" class="btn ghost" type="button" @click="visibleRanks += 20">加载更多（还有 {{ selected.rows.length - visibleRanks }} 只）</button>
      </section>
    </div>
  </div>
</template>
<style scoped>
.overview-heading { display: flex; align-items: center; justify-content: space-between; gap: 10px; }
.overview-heading .btn { flex-shrink: 0; width: auto; margin: 0; white-space: nowrap; }
.overview-heading h2 { margin: 0; font-size: 22px; }
.bonus-fields { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 18px; }
.favored-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; }
.favored-choice { display: flex; align-items: center; gap: 6px; border: 1px solid var(--line); background: transparent; padding: 8px; color: var(--text); border-radius: 8px; }
.favored-choice.on { background: var(--sage); color: var(--ink); }
.overview-warning { display: flex; align-items: center; justify-content: space-between; gap: 12px; color: var(--amber); }
.overview-warning .btn { flex-shrink: 0; white-space: nowrap; }
.berry-rank-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 18px; }
.berry-heading { display: flex; align-items: center; gap: 10px; margin-bottom: 8px; }
.berry-heading h3 { margin: 0; }
.berry-heading > span { margin-left: auto; }
.ingredient-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px; }
.ingredient-tile { display: flex; flex-direction: column; align-items: center; gap: 10px; padding: 20px 10px; background: var(--card); border: 1px solid var(--line); color: var(--text); border-radius: 12px; text-align: center; }
.ingredient-tile strong { font-size: 24px; font-variant-numeric: tabular-nums; color: var(--sage); }
.ingredient-tile small { font-size: 12px; font-weight: 400; color: var(--muted); }
.ingredient-tile > .muted { font-size: 12px; }
.ingredient-tile:disabled { opacity: 0.6; }
.ingredient-ranking .row h3 { flex: 1; min-width: 0; margin: 0; }
@media (max-width: 760px) { .berry-rank-grid { grid-template-columns: 1fr; } .ingredient-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
@media (max-width: 400px) { .overview-heading { flex-wrap: wrap; } .overview-heading h2 { font-size: 19px; } .bonus-fields { grid-template-columns: 1fr; } .favored-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
</style>
