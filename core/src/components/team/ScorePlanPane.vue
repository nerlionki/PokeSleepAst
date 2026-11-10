<script setup lang="ts">
import TimeField from '../shared/TimeField.vue'
import { gameText, t as translateUi } from '../../ui/i18n'


import { INPUT_RANGES } from '../../calc/inputRanges'
const INPUT_LIMITS = INPUT_RANGES.ScorePlanPane

import clientDefaults from '../../data/client-defaults.resource'

import ProgressDialog from '../shared/ProgressDialog.vue'
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import { useScorePlan } from '#platform/scorePlan'
import { showValidationError } from '#platform/confirm'
import { loadJson, saveJson } from '../../storage'
import { useBoxStore } from '../../stores/box'
import { useSettingsStore } from '../../stores/settings'
import { INGREDIENTS, islandById } from '../../calc/data'
import { ingredientLabel, ingredientRow, recipeById } from '../../calc/catalogIds'
import { boxLabel } from '../../calc/boxFilter'
import { defaultScoreOptions, normalizeScoreOptions, scoreBounds, scoreCandidates, scoreTime, validateScoreOptions, type ScoreOptions } from '../../calc/scorePlan'
import PokeSprite from '../shared/PokeSprite.vue'
import IngredientIcon from '../shared/IngredientIcon.vue'
const components_team_ScorePlanPane_config_clientDefaults = clientDefaults.modules.components_team_ScorePlanPane


const box = useBoxStore(), settings = useSettingsStore()
const options = ref(defaultScoreOptions(settings.settings))
const ready = ref(components_team_ScorePlanPane_config_clientDefaults["readyInitial"]), advanced = ref(components_team_ScorePlanPane_config_clientDefaults["advancedInitial"]), inventory = ref(components_team_ScorePlanPane_config_clientDefaults["inventoryInitial"]), selected = ref(components_team_ScorePlanPane_config_clientDefaults["selectedInitial"]), showActions = ref(components_team_ScorePlanPane_config_clientDefaults["showActionsInitial"]), actionDay = ref(components_team_ScorePlanPane_config_clientDefaults["actionDayInitial"])
const loadError = ref('')
const optionsStorageKey = 'score-options-v2'
const request = () => ({ settings: { ...settings.settings, mealCategory: options.value.category }, box: box.pokemon, options: options.value })
const { busy, error, notice, result, progress, dirty, calculate, cancel, restore } = useScorePlan(request)
const inputError = computed(() => loadError.value || validateScoreOptions(options.value, settings.settings))
const foodCount = computed(() => Object.values(options.value.bag).reduce((sum, n) => sum + (Number(n) || 0), 0))
const unresolvedFoods = computed(() => Object.entries(options.value.unresolvedBag ?? {}))
const unknownFoods = computed(() => Object.keys(options.value.bag).filter(key => !ingredientRow(key)))
function removeUnresolvedFood(key: string) { if (options.value.unresolvedBag) delete options.value.unresolvedBag[key] }
const environment = computed(() => [
  translateUi('{island} · 岛屿加成 {bonus}%', {
    island: gameText(islandById(settings.settings.island)?.name ?? ''),
    bonus: Math.round(settings.settings.areaBonus * 100),
  }),
  translateUi(settings.settings.goodCamp ? '已开露营券' : '未开露营券'),
].join(' · '))
const solution = computed(() => result.value?.solutions[selected.value])
const percent = computed(() => Math.min(100, Math.floor(progress.value.completed / Math.max(1, progress.value.total) * 100)))
const displayTime = (minute: number) => scoreTime(minute, translateUi)
const boundLabel = computed(() => { const b = scoreBounds(options.value); return `${displayTime(b.start)} — ${b.end === 10320 ? translateUi('下周一 03:59') : displayTime(b.end)}` })
const name = (uid: string) => { const p = box.pokemon.find(p => p.uid === uid); return p ? boxLabel(p) : uid }
const pokemon = (uid: string) => box.pokemon.find(p => p.uid === uid)
const number = (value: number) => Math.round(value).toLocaleString('zh-CN')
const foods = (bag: Record<string, number>) => Object.entries(bag).filter(([, count]) => count > 0).map(([key, count]) => `${gameText(ingredientLabel(key))} ×${count}`).join('、') || translateUi('无')
const actions = computed(() => solution.value?.trace.actions.filter(a => Math.floor((a.minute - 240) / 1440) === actionDay.value) ?? [])
const daySegments = computed(() => solution.value?.trace.segments.filter(s => s.start < (actionDay.value + 1) * 1440 + 240 && s.end > actionDay.value * 1440 + 240) ?? [])
const sensitive = computed(() => solution.value?.sensitivity.some(s => Math.abs(s.mean - solution.value!.mean) > solution.value!.mean * 0.05))
const advancedChanged = computed(() => {
  const defaults = defaultScoreOptions(settings.settings)
  return ['startDay', 'startTime', 'days', 'collectMinutes', 'precision', 'splitSleep', 'device', 'initialPot', 'initialCrit', 'initialZone', 'initialJuice', 'useJuice', 'sleeps', 'meals', 'dayStart', 'dayEnd', 'initialDisguise']
    .some(key => JSON.stringify(options.value[key as keyof ScoreOptions]) !== JSON.stringify(defaults[key as keyof ScoreOptions]))
})
onMounted(async () => {
  try {
    const current = await loadJson<Partial<ScoreOptions> | null>(optionsStorageKey, null)
    const legacy = current ? null : await loadJson<Partial<ScoreOptions> | null>('score-options-v1', null)
    options.value = normalizeScoreOptions(current ?? legacy ?? undefined, settings.settings)
    if (legacy || current && JSON.stringify([current.bag, current.unresolvedBag]) !== JSON.stringify([options.value.bag, options.value.unresolvedBag])) {
      await saveJson(optionsStorageKey, options.value)
    }
    // 先完成配置恢复引起的 watcher，避免它误取消刚恢复的微信任务。
    await nextTick()
    restore()
  } catch (cause) {
    loadError.value = cause instanceof Error ? cause.message : '无法读取冲分规划设置'
  } finally {
    ready.value = true
  }
})
watch(options, value => { if (ready.value && !loadError.value) void saveJson(optionsStorageKey, value); if (busy.value) cancel() }, { deep: true })
watch(() => JSON.stringify({ settings: settings.settings, box: box.pokemon }), () => { if (busy.value) cancel() })
watch(result, () => { selected.value = 0; actionDay.value = options.value.startDay })
function reset() {
  loadError.value = ''
  options.value = { ...defaultScoreOptions(settings.settings), bag: { ...options.value.bag }, unresolvedBag: { ...options.value.unresolvedBag }, initialStrength: options.value.initialStrength }
}
function updateFood(id: number, event: Event) {
  const input = event.target as HTMLInputElement
  const value = input.value
  if (input.validity?.badInput) options.value.bag[id] = Number.NaN
  else if (value === '') delete options.value.bag[id]
  else options.value.bag[id] = Number(value)
}
function start() {
  if (busy.value || !ready.value) return
  const reason = inputError.value || (!box.pokemon.length ? '请先在 Box 添加宝可梦，再开始规划。' : '')
  if (reason) { showValidationError(translateUi(reason)); return }
  const { candidates, excluded } = scoreCandidates(box.pokemon)
  if (!candidates.length) {
    const reasons = [...new Set(excluded.map(item => translateUi(item.reason)))]
    showValidationError([translateUi('Box 中没有可参与规划的个体，请先添加并确认生产资料'), ...reasons].join('\n'))
    return
  }
  void calculate()
}
const mealSlots = [0, 1, 2] as const
const mealLabels = ['早餐', '午餐', '晚餐'] as const
</script>

<template>
  <div class="stack score-plan">
    <article class="card stack">
      <h3>{{ translateUi("冲分规划") }}</h3>
      <p>{{ translateUi("安排本周的队伍轮换、睡眠和料理，比较平均总能量。") }}</p>
      <p class="muted">{{ environment }} · Box {{ box.pokemon.length }} {{ translateUi("只") }}</p>
      <p>{{ boundLabel }}</p>
      <div class="row score-basics">
        <div class="field"><label for="score-category">{{ translateUi("本周料理类型") }}</label><select id="score-category" v-model="options.category"><option value="curry">{{ translateUi("咖喱、浓汤") }}</option><option value="salad">{{ translateUi("沙拉") }}</option><option value="dessert">{{ translateUi("点心、饮料") }}</option></select></div>
        <div class="field"><label for="score-initial">{{ translateUi("卡比兽初始能量") }}</label><input id="score-initial" v-model.number="options.initialStrength" type="number" :min="INPUT_LIMITS.score_initial.min" :step="INPUT_LIMITS.score_initial.step" inputmode="numeric"></div>
      </div>
      <button class="btn ghost" type="button" :aria-expanded="inventory" @click="inventory = !inventory">{{ translateUi("初始食材 ·") }} {{ foodCount }}/{{ INPUT_LIMITS.options_bag_ingredient_name.max }} {{ translateUi("个") }}</button>
      <div v-if="inventory" class="stack">
        <p class="muted">{{ translateUi("填写规划开始时已经持有的数量。未填写按 0 处理，规划不会扣除保存的库存。") }}</p>
        <div class="score-foods">
          <div v-for="ingredient in INGREDIENTS" :key="ingredient.id" class="field">
            <label :for="`score-food-${ingredient.id}`"><IngredientIcon :id="ingredient.id" :name="ingredient.name" small /> {{ gameText(ingredient.name) }}</label>
            <input :id="`score-food-${ingredient.id}`" :value="options.bag[ingredient.id]" type="number" :min="INPUT_LIMITS.options_bag_ingredient_name.min" :max="INPUT_LIMITS.options_bag_ingredient_name.max" :step="INPUT_LIMITS.options_bag_ingredient_name.step" inputmode="numeric" @input="updateFood(ingredient.id, $event)">
          </div>
        </div>
        <div v-for="[key, amount] in unresolvedFoods" :key="key" class="row">
          <span class="amber">{{ key }} ×{{ amount }} · {{ translateUi('旧库存未匹配或冲突') }}</span>
          <button class="btn ghost" type="button" @click="removeUnresolvedFood(key)">{{ translateUi('删除') }}</button>
        </div>
        <div v-for="name in unknownFoods" :key="name" class="row">
          <span class="amber">{{ name }} · {{ translateUi("当前资料未收录") }}</span>
          <button class="btn ghost" type="button" @click="delete options.bag[name]">{{ translateUi("删除") }}</button>
        </div>
      </div>
      <p v-if="!foodCount" class="muted">{{ translateUi("尚无初始食材，早餐只能使用开始后实际收取的产物。") }}</p>
      <button class="btn ghost" type="button" :aria-expanded="advanced" @click="advanced = !advanced">{{ translateUi("详细设置") }}{{ advancedChanged ? " " + translateUi("· 已调整") : '' }}</button>
      <div v-if="advanced" class="stack score-details">
        <h4>{{ translateUi("规划周期与操作") }}</h4>
        <div class="row">
          <div class="field"><label for="score-day">{{ translateUi("开始星期") }}</label><select id="score-day" v-model.number="options.startDay" @change="options.days = Math.min(options.days, INPUT_LIMITS.score_days.max - options.startDay)"><option v-for="(day, i) in ['周一','周二','周三','周四','周五','周六','周日']" :key="day" :value="i">{{ translateUi(day) }}</option></select></div>
          <div class="field"><label for="score-time">{{ translateUi("开始时刻") }}</label><TimeField id="score-time" v-model="options.startTime" /></div>
          <div class="field"><label for="score-days">{{ translateUi("覆盖天数") }}</label><input id="score-days" v-model.number="options.days" type="number" :min="INPUT_LIMITS.score_days.min" :max="7 - options.startDay"></div>
        </div>
        <div class="row">
          <div class="field"><label for="score-interval">{{ translateUi("白天收菜间隔（分钟）") }}</label><input id="score-interval" v-model.number="options.collectMinutes" type="number" :min="INPUT_LIMITS.score_interval.min" :max="INPUT_LIMITS.score_interval.max"></div>
          <div class="field"><label for="score-precision">{{ translateUi("搜索精度") }}</label><select id="score-precision" v-model="options.precision"><option value="medium">{{ translateUi("中 · 耗时目标 30 秒") }}</option><option value="high">{{ translateUi("高 · 耗时目标 60 秒") }}</option></select></div>
        </div>
        <div class="row"><div v-for="i in mealSlots" :key="i" class="field"><label :for="`score-meal-${i}`">{{ translateUi(mealLabels[i]) }}</label><TimeField :id="`score-meal-${i}`" v-model="options.meals[i]" /></div></div>
        <h4>{{ translateUi("睡眠与外设") }}</h4>
        <div class="row"><label class="score-check"><input v-model="options.splitSleep" type="checkbox"><span class="score-check-label">{{ translateUi("拆成两段睡眠") }}</span></label><label class="score-check"><input v-model="options.device" type="checkbox"><span class="score-check-label">{{ translateUi("使用外设") }}</span></label></div>
        <div v-if="options.device" class="row"><div class="field"><label for="score-day-start">{{ translateUi("白天分类开始") }}</label><TimeField id="score-day-start" v-model="options.dayStart" /></div><div class="field"><label for="score-day-end">{{ translateUi("白天分类结束") }}</label><TimeField id="score-day-end" v-model="options.dayEnd" /></div></div>
        <div v-for="(sleep, i) in options.sleeps.slice(0, options.splitSleep ? 2 : 1)" :key="i" class="stack score-sleep">
          <p><strong>{{ options.splitSleep ? translateUi("第 {arg1} 段睡眠", { arg1: String(i + 1) }) : translateUi("整觉") }}</strong></p>
          <div class="row"><div class="field"><label :for="`score-sleep-start-${i}`">{{ translateUi("入睡") }}</label><TimeField :id="`score-sleep-start-${i}`" v-model="sleep.start" /></div><div class="field"><label :for="`score-sleep-end-${i}`">{{ translateUi("醒来") }}</label><TimeField :id="`score-sleep-end-${i}`" v-model="sleep.end" /></div></div>
          <template v-if="options.device">
            <div class="row">
              <div class="field"><label :for="`score-class-${i}`">{{ translateUi("睡眠分类") }}</label><select :id="`score-class-${i}`" v-model="sleep.classification"><option value="auto">{{ translateUi("按入睡时间自动判断") }}</option><option value="day">{{ translateUi("白天") }}</option><option value="night">{{ translateUi("夜间") }}</option></select></div>
              <div class="field"><label :for="`score-extreme-${i}`">{{ translateUi("睡眠期间操作") }}</label><select :id="`score-extreme-${i}`" v-model="sleep.extreme"><option value="auto">{{ translateUi("默认：白天允许，夜间关闭") }}</option><option value="on">{{ translateUi("开启极限模式") }}</option><option value="off">{{ translateUi("不收菜") }}</option></select></div>
            </div>
            <div class="row"><div class="field"><label :for="`score-sleep-collect-${i}`">{{ translateUi("睡眠收菜间隔（0 为不收菜）") }}</label><input :id="`score-sleep-collect-${i}`" v-model.number="sleep.collectMinutes" type="number" :min="INPUT_LIMITS.sleep_collectMinutes.min" :max="INPUT_LIMITS.sleep_collectMinutes.max"></div><div class="field"><label :for="`score-settle-${i}`">{{ translateUi("醒来后多久结算（分钟）") }}</label><input :id="`score-settle-${i}`" v-model.number="sleep.settleDelay" type="number" :min="INPUT_LIMITS.sleep_settleDelay.min" :max="INPUT_LIMITS.sleep_settleDelay.max"></div></div>
          </template>
        </div>
        <h4>{{ translateUi("已有技能加成与道具") }}</h4>
        <div class="row">
          <div class="field"><label for="score-crit">{{ translateUi("技能暴击加成（%）") }}</label><input id="score-crit" v-model.number="options.initialCrit" type="number" :min="INPUT_LIMITS.score_crit.min" :max="INPUT_LIMITS.score_crit.max"></div>
          <div class="field"><label for="score-pot">{{ translateUi("技能额外锅容量") }}</label><input id="score-pot" v-model.number="options.initialPot" type="number" :min="INPUT_LIMITS.score_pot.min" :max="INPUT_LIMITS.score_pot.max"></div>
          <div class="field"><label for="score-zone">{{ translateUi("已有树果领域（%）") }}</label><input id="score-zone" v-model.number="options.initialZone" type="number" :min="INPUT_LIMITS.score_zone.min" :max="INPUT_LIMITS.score_zone.max" :step="INPUT_LIMITS.score_zone.step"></div>
        </div>
        <div class="row"><div class="field"><label for="score-juice">{{ translateUi("已有树果汁（个）") }}</label><input id="score-juice" v-model.number="options.initialJuice" type="number" :min="INPUT_LIMITS.score_juice.min" :max="INPUT_LIMITS.score_juice.max"></div><label class="score-check"><input v-model="options.useJuice" type="checkbox"><span class="score-check-label">{{ translateUi("允许规划使用树果汁") }}</span></label></div>
        <template v-if="box.pokemon.some(p => !p.napping && p.pokeId === 778)">
          <h4>{{ translateUi("画皮初始状态") }}</h4>
          <label v-for="p in box.pokemon.filter(p => !p.napping && p.pokeId === 778)" :key="p.uid" class="score-check"><input :model-value="options.initialDisguise[p.uid] ?? true" :checked="options.initialDisguise[p.uid] ?? true" type="checkbox" @change="options.initialDisguise[p.uid] = ($event.target as HTMLInputElement).checked"><span class="score-check-label">{{ boxLabel(p) }} {{ translateUi("· 画皮仍可大成功") }}</span></label>
        </template>
        <button class="btn ghost" type="button" @click="reset">{{ translateUi("恢复默认设置，保留初始能量与食材") }}</button>
      </div>
      <p v-if="inputError" class="amber" role="alert">{{ inputError }}</p>
      <p v-if="!box.pokemon.length" class="muted">{{ translateUi("请先在 Box 添加宝可梦，再开始规划。") }}</p>
      <div class="row"><button class="btn" type="button" :disabled="busy || !ready" @click="start">{{ busy ? translateUi("正在规划 {arg1}%", { arg1: String(percent) }) : translateUi("开始规划") }}</button></div>
      <ProgressDialog :open="busy" :title="translateUi('正在计算冲分规划')" :progress="percent" stage="比较队伍与料理策略" :notice="notice"
        :detail="translateUi('已比较 {done} / {total}', { done: progress.completed, total: progress.total })" cancellable cancel-text="取消规划" @cancel="cancel" />
      <p v-if="notice" role="status" class="muted">{{ translateUi(notice) }}</p><p v-if="error" role="alert" class="amber">{{ translateUi(error) }}</p>
    </article>
    <template v-if="result && solution">
      <p v-if="dirty" class="amber" role="status">{{ translateUi("输入已变化，以下是上次规划结果，请重新规划。") }}</p>
      <article class="card stack" aria-live="polite">
        <h3>{{ translateUi("预计期末能量") }} {{ number(result.options.initialStrength + solution.mean) }}</h3>
        <p>{{ translateUi("初始") }} {{ number(result.options.initialStrength) }} {{ translateUi("＋ 平均新增") }} {{ number(solution.mean) }}</p>
        <p class="muted">{{ translateUi("树果") }} {{ number(solution.berry) }} {{ translateUi("· 领域加成") }} {{ number(solution.zone) }} {{ translateUi("· 直接技能") }} {{ number(solution.skill) }} {{ translateUi("· 料理") }} {{ number(solution.cooking) }}</p>
        <p class="muted">{{ solution.simulations }} {{ translateUi("次模拟的新增能量范围") }} {{ number(solution.min) }}–{{ number(solution.max) }}{{ translateUi("，标准差") }} {{ number(solution.deviation) }}{{ translateUi("。范围是本次样本的最小／最大值。") }}</p>
        <p class="muted">{{ translateUi("比较") }} {{ result.compared }} {{ translateUi("个方案，共") }} {{ result.simulations }} {{ translateUi("次模拟，用时") }} {{ (result.elapsedMs / 1000).toFixed(1) }} {{ translateUi("秒。") }}</p>
        <div class="field"><label for="score-solution">{{ translateUi("比较其他方案") }}</label><select id="score-solution" v-model.number="selected"><option v-for="(s, i) in result.solutions" :key="i" :value="i">{{ translateUi("方案") }} {{ i + 1 }} {{ translateUi("· 平均新增") }} {{ number(s.mean) }}</option></select></div>
        <p v-if="sensitive" class="amber">{{ translateUi("该方案对换队保底回退假设敏感，请对照复核收益。") }}</p>
        <p class="muted">{{ translateUi("回退复核：") }}{{ solution.sensitivity.map(s => translateUi('{count} 次：{mean}', { count: s.rollback, mean: number(s.mean) })).join('；') }}</p>
      </article>
      <article class="card stack">
        <h3>{{ translateUi("推荐队伍与料理策略") }}</h3>
        <p>{{ translateUi("优先") }} {{ gameText(recipeById(solution.policy.recipeId)?.name ?? '当前可用料理') }}{{ translateUi("；预留") }} {{ solution.policy.reserveMeals }} {{ translateUi("餐食材，白天至少间隔") }} {{ solution.policy.rotateMinutes }} {{ translateUi("分钟考虑轮换。") }}</p>
        <div v-for="(uids, i) in [...solution.policy.day, ...solution.policy.sleep.slice(0, result.options.splitSleep ? 2 : 1), ...(result.options.device ? solution.policy.settle.slice(0, result.options.splitSleep ? 2 : 1) : [])]" :key="i" class="stack score-team">
          <p><strong>{{ i < 2 ? i === 0 ? translateUi("白天树果／技能阶段") : translateUi("白天食材阶段") : i < 2 + (result.options.splitSleep ? 2 : 1) ? translateUi("睡眠生产队 {arg1}", { arg1: String(i - 1) }) : translateUi("外设结算队 {arg1}", { arg1: String(i - 1 - (result.options.splitSleep ? 2 : 1)) }) }}</strong></p>
          <div class="score-roster"><div v-for="uid in uids" :key="uid" class="score-pokemon"><PokeSprite :id="pokemon(uid)?.pokeId ?? 0" :name="name(uid)" :shiny="pokemon(uid)?.shiny" :ribbon-hours="pokemon(uid)?.tune?.ribbonHours" /><span>{{ name(uid) }}</span></div></div>
        </div>
      </article>
      <article class="card stack">
        <h3>{{ translateUi("执行示例与期末状态") }}</h3>
        <p class="muted">{{ translateUi("下方是一条固定种子的执行轨迹；料理暴击、技能和轮换会因实际产物变化，不能把示例总收益当作统计均值。") }}</p>
        <p>{{ translateUi("示例新增能量") }} {{ number(solution.trace.total) }} {{ translateUi("· 期末食材") }} {{ foods(solution.trace.bag) }}</p>
        <p class="muted">{{ translateUi("卖出") }} {{ foods(solution.trace.sold) }}{{ translateUi("；树果汁：初始") }} {{ solution.trace.juice.initial }}{{ translateUi("、入库") }} {{ solution.trace.juice.received }}{{ translateUi("、使用") }} {{ solution.trace.juice.used }}{{ translateUi("、未入库") }} {{ solution.trace.juice.lost }}{{ translateUi("、剩余") }} {{ solution.trace.juice.remain }}。</p>
        <div v-for="m in solution.trace.members" :key="m.uid" class="score-state">
          <p><strong>{{ name(m.uid) }}</strong> {{ translateUi("· 上场") }} {{ m.hours.toFixed(1) }} {{ translateUi("小时 · 睡眠 EXP") }} {{ number(m.exp) }} {{ translateUi("· 期末活力") }} {{ m.energy.toFixed(1) }}</p>
          <p class="muted">{{ translateUi("每日上场") }} {{ m.dailyHours.map(h => h.toFixed(1)).join(' / ') }} {{ translateUi("小时；未领树果") }} {{ m.heldBerries }} {{ translateUi("颗、食材") }} {{ foods(m.heldFood) }}{{ translateUi("、存储技能") }} {{ m.stock }} {{ translateUi("次。") }}</p>
        </div>
        <button class="btn ghost" type="button" :aria-expanded="showActions" @click="showActions = !showActions">{{ showActions ? translateUi("收起操作时间表") : translateUi("查看操作时间表") }}</button>
        <div v-if="showActions" class="stack">
          <div class="field"><label for="score-action-day">{{ translateUi("查看日期") }}</label><select id="score-action-day" v-model.number="actionDay"><option v-for="(day, i) in ['周一','周二','周三','周四','周五','周六','周日','下周一结算']" :key="day" :value="i">{{ day }}</option></select></div>
          <div v-for="(segment, i) in daySegments" :key="`segment-${i}`" class="score-action"><p><strong>{{ displayTime(Math.max(segment.start, actionDay * 1440 + 240)) }} — {{ displayTime(Math.min(segment.end, (actionDay + 1) * 1440 + 240)) }}</strong> · {{ translateUi(segment.purpose) }}</p><p class="muted">{{ segment.members.map(name).join('、') }}</p></div>
          <div v-for="(action, i) in actions" :key="i" class="score-action"><p><strong>{{ displayTime(action.minute) }}</strong> · {{ translateUi(action.text) }}<span v-if="action.energy != null"> · {{ number(action.energy) }} {{ translateUi("能量") }}</span></p><p v-if="action.members" class="muted">{{ action.members.map(name).join('、') }}</p><p v-if="action.foods && Object.values(action.foods).some(n => n > 0)" class="muted">{{ foods(action.foods) }}</p></div>
          <p v-if="!actions.length" class="muted">{{ translateUi("这一天没有安排操作。") }}</p>
        </div>
      </article>
      <article class="card stack"><h3>{{ translateUi("适用范围") }}</h3><p v-for="warning in result.warnings" :key="warning" class="muted">{{ translateUi(warning) }}</p><p v-for="(p, i) in result.excluded" :key="i" class="muted">{{ translateUi("未参与：") }}{{ p.name }} · {{ translateUi(p.reason) }}</p></article>
    </template>
  </div>
</template>

<style scoped>
.score-plan { min-width: 0; }
.score-basics { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); }
.score-foods { display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 12px; }
.score-foods label { display: flex; gap: 6px; align-items: center; }
.score-details { padding-top: 12px; border-top: 1px solid var(--line); }
.score-details h4 { margin: 14px 0 0; }
.score-sleep, .score-team, .score-state, .score-action { padding: 12px 0; border-bottom: 1px solid var(--line); }
.score-roster { display: flex; flex-wrap: wrap; gap: 16px; }
.score-pokemon { display: flex; flex-direction: column; align-items: center; max-width: 120px; text-align: center; gap: 4px; }
.score-plan p { margin: 0; overflow-wrap: anywhere; }
.score-check { display: flex; align-items: center; gap: 12px; min-height: 44px; min-width: 0; }
.score-check-label { min-width: 0; overflow-wrap: anywhere; }
</style>
