<script setup lang="ts">
import ProgressDialog from '../shared/ProgressDialog.vue'
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import { useScorePlan } from '#platform/scorePlan'
import { loadJson, saveJson } from '../../storage'
import { useBoxStore } from '../../stores/box'
import { useSettingsStore } from '../../stores/settings'
import { INGREDIENTS, islandById } from '../../calc/data'
import { boxLabel } from '../../calc/boxFilter'
import { defaultScoreOptions, normalizeScoreOptions, scoreBounds, scoreTime, validateScoreOptions, type ScoreOptions } from '../../calc/scorePlan'
import PokeSprite from '../shared/PokeSprite.vue'
import IngredientIcon from '../shared/IngredientIcon.vue'

const box = useBoxStore(), settings = useSettingsStore()
const options = ref(defaultScoreOptions(settings.settings))
const ready = ref(false), advanced = ref(false), inventory = ref(false), selected = ref(0), showActions = ref(false), actionDay = ref(0)
const request = () => ({ settings: { ...settings.settings, mealCategory: options.value.category }, box: box.pokemon, options: options.value })
const { busy, error, notice, result, progress, dirty, calculate, cancel, restore } = useScorePlan(request)
const inputError = computed(() => validateScoreOptions(options.value, settings.settings))
const foodCount = computed(() => Object.values(options.value.bag).reduce((sum, n) => sum + (Number(n) || 0), 0))
const environment = computed(() => `${islandById(settings.settings.island)?.name ?? ''} · 岛屿加成 ${Math.round(settings.settings.areaBonus * 100)}% · ${settings.settings.goodCamp ? '已开露营券' : '未开露营券'}`)
const solution = computed(() => result.value?.solutions[selected.value])
const percent = computed(() => Math.min(100, Math.floor(progress.value.completed / Math.max(1, progress.value.total) * 100)))
const boundLabel = computed(() => { const b = scoreBounds(options.value); return `${scoreTime(b.start)} — ${b.end === 10320 ? '下周一 03:59' : scoreTime(b.end)}` })
const name = (uid: string) => { const p = box.pokemon.find(p => p.uid === uid); return p ? boxLabel(p) : uid }
const pokemon = (uid: string) => box.pokemon.find(p => p.uid === uid)
const number = (value: number) => Math.round(value).toLocaleString('zh-CN')
const foods = (bag: Record<string, number>) => Object.entries(bag).filter(([, count]) => count > 0).map(([name, count]) => `${name} ×${count}`).join('、') || '无'
const actions = computed(() => solution.value?.trace.actions.filter(a => Math.floor((a.minute - 240) / 1440) === actionDay.value) ?? [])
const daySegments = computed(() => solution.value?.trace.segments.filter(s => s.start < (actionDay.value + 1) * 1440 + 240 && s.end > actionDay.value * 1440 + 240) ?? [])
const sensitive = computed(() => solution.value?.sensitivity.some(s => Math.abs(s.mean - solution.value!.mean) > solution.value!.mean * 0.05))
const advancedChanged = computed(() => {
  const defaults = defaultScoreOptions(settings.settings)
  return ['startDay', 'startTime', 'days', 'collectMinutes', 'precision', 'splitSleep', 'device', 'initialPot', 'initialCrit', 'initialZone', 'initialJuice', 'useJuice', 'sleeps', 'meals', 'dayStart', 'dayEnd', 'initialDisguise']
    .some(key => JSON.stringify(options.value[key as keyof ScoreOptions]) !== JSON.stringify(defaults[key as keyof ScoreOptions]))
})
onMounted(async () => {
  options.value = normalizeScoreOptions(await loadJson<Partial<ScoreOptions>>('score-options-v1', {}), settings.settings)
  // 先完成配置恢复引起的 watcher，避免它误取消刚恢复的微信任务。
  await nextTick(); ready.value = true; restore()
})
watch(options, value => { if (ready.value) void saveJson('score-options-v1', value); if (busy.value) cancel() }, { deep: true })
watch(() => JSON.stringify({ settings: settings.settings, box: box.pokemon }), () => { if (busy.value) cancel() })
watch(result, () => { selected.value = 0; actionDay.value = options.value.startDay })
function reset() { options.value = { ...defaultScoreOptions(settings.settings), bag: { ...options.value.bag }, initialStrength: options.value.initialStrength } }
function start() { if (!inputError.value && ready.value) void calculate() }
</script>

<template>
  <div class="stack score-plan">
    <article class="card stack">
      <h3>冲分规划</h3>
      <p>安排本周的队伍轮换、睡眠和料理，比较平均总能量。</p>
      <p class="muted">{{ environment }} · Box {{ box.pokemon.length }} 只</p>
      <p>{{ boundLabel }}</p>
      <div class="row score-basics">
        <div class="field"><label for="score-category">本周料理类型</label><select id="score-category" v-model="options.category"><option value="curry">咖哩／浓汤</option><option value="salad">沙拉</option><option value="dessert">点心／饮料</option></select></div>
        <div class="field"><label for="score-initial">卡比兽初始能量</label><input id="score-initial" v-model.number="options.initialStrength" type="number" min="0" step="1" inputmode="numeric"></div>
      </div>
      <button class="btn ghost" type="button" :aria-expanded="inventory" @click="inventory = !inventory">初始食材 · {{ foodCount }}/800 个</button>
      <div v-if="inventory" class="stack">
        <p class="muted">填写规划开始时已经持有的数量。未填写按 0 处理，规划不会扣除保存的库存。</p>
        <div class="score-foods">
          <div v-for="ingredient in INGREDIENTS" :key="ingredient.id" class="field">
            <label :for="`score-food-${ingredient.id}`"><IngredientIcon :id="ingredient.id" :name="ingredient.name" small /> {{ ingredient.name }}</label>
            <input :id="`score-food-${ingredient.id}`" v-model.number="options.bag[ingredient.name]" type="number" min="0" max="800" step="1" inputmode="numeric">
          </div>
        </div>
      </div>
      <p v-if="!foodCount" class="muted">尚无初始食材，早餐只能使用开始后实际收取的产物。</p>
      <button class="btn ghost" type="button" :aria-expanded="advanced" @click="advanced = !advanced">详细设置{{ advancedChanged ? ' · 已调整' : '' }}</button>
      <div v-if="advanced" class="stack score-details">
        <h4>规划周期与操作</h4>
        <div class="row">
          <div class="field"><label for="score-day">开始星期</label><select id="score-day" v-model.number="options.startDay" @change="options.days = Math.min(options.days, 7 - options.startDay)"><option v-for="(day, i) in ['周一','周二','周三','周四','周五','周六','周日']" :key="day" :value="i">{{ day }}</option></select></div>
          <div class="field"><label for="score-time">开始时刻</label><input id="score-time" v-model="options.startTime" type="time"></div>
          <div class="field"><label for="score-days">覆盖天数</label><input id="score-days" v-model.number="options.days" type="number" min="1" :max="7 - options.startDay"></div>
        </div>
        <div class="row">
          <div class="field"><label for="score-interval">白天收菜间隔（分钟）</label><input id="score-interval" v-model.number="options.collectMinutes" type="number" min="5" max="240"></div>
          <div class="field"><label for="score-precision">搜索精度</label><select id="score-precision" v-model="options.precision"><option value="medium">中 · 耗时目标 30 秒</option><option value="high">高 · 耗时目标 60 秒</option></select></div>
        </div>
        <div class="row"><div v-for="(label, i) in ['早餐','午餐','晚餐']" :key="label" class="field"><label :for="`score-meal-${i}`">{{ label }}</label><input :id="`score-meal-${i}`" v-model="options.meals[i]" type="time"></div></div>
        <h4>睡眠与外设</h4>
        <div class="row"><label class="score-check"><input v-model="options.splitSleep" type="checkbox"><span class="score-check-label">拆成两段睡眠</span></label><label class="score-check"><input v-model="options.device" type="checkbox"><span class="score-check-label">使用外设</span></label></div>
        <div v-if="options.device" class="row"><div class="field"><label for="score-day-start">白天分类开始</label><input id="score-day-start" v-model="options.dayStart" type="time"></div><div class="field"><label for="score-day-end">白天分类结束</label><input id="score-day-end" v-model="options.dayEnd" type="time"></div></div>
        <div v-for="(sleep, i) in options.sleeps.slice(0, options.splitSleep ? 2 : 1)" :key="i" class="stack score-sleep">
          <p><strong>{{ options.splitSleep ? `第 ${i + 1} 段睡眠` : '整觉' }}</strong></p>
          <div class="row"><div class="field"><label :for="`score-sleep-start-${i}`">入睡</label><input :id="`score-sleep-start-${i}`" v-model="sleep.start" type="time"></div><div class="field"><label :for="`score-sleep-end-${i}`">醒来</label><input :id="`score-sleep-end-${i}`" v-model="sleep.end" type="time"></div></div>
          <template v-if="options.device">
            <div class="row">
              <div class="field"><label :for="`score-class-${i}`">睡眠分类</label><select :id="`score-class-${i}`" v-model="sleep.classification"><option value="auto">按入睡时间自动判断</option><option value="day">白天</option><option value="night">夜间</option></select></div>
              <div class="field"><label :for="`score-extreme-${i}`">睡眠期间操作</label><select :id="`score-extreme-${i}`" v-model="sleep.extreme"><option value="auto">默认：白天允许，夜间关闭</option><option value="on">开启极限模式</option><option value="off">不收菜</option></select></div>
            </div>
            <div class="row"><div class="field"><label :for="`score-sleep-collect-${i}`">睡眠收菜间隔（0 为不收菜）</label><input :id="`score-sleep-collect-${i}`" v-model.number="sleep.collectMinutes" type="number" min="0" max="240"></div><div class="field"><label :for="`score-settle-${i}`">醒来后多久结算（分钟）</label><input :id="`score-settle-${i}`" v-model.number="sleep.settleDelay" type="number" min="0" max="1440"></div></div>
          </template>
        </div>
        <h4>已有技能加成与道具</h4>
        <div class="row">
          <div class="field"><label for="score-crit">技能暴击加成（%）</label><input id="score-crit" v-model.number="options.initialCrit" type="number" min="0" max="70"></div>
          <div class="field"><label for="score-pot">技能额外锅容量</label><input id="score-pot" v-model.number="options.initialPot" type="number" min="0" max="200"></div>
          <div class="field"><label for="score-zone">已有树果领域（%）</label><input id="score-zone" v-model.number="options.initialZone" type="number" min="0" max="24" step="0.1"></div>
        </div>
        <div class="row"><div class="field"><label for="score-juice">已有树果汁（个）</label><input id="score-juice" v-model.number="options.initialJuice" type="number" min="0" max="5"></div><label class="score-check"><input v-model="options.useJuice" type="checkbox"><span class="score-check-label">允许规划使用树果汁</span></label></div>
        <template v-if="box.pokemon.some(p => !p.napping && p.pokeId === 778)">
          <h4>画皮初始状态</h4>
          <label v-for="p in box.pokemon.filter(p => !p.napping && p.pokeId === 778)" :key="p.uid" class="score-check"><input :model-value="options.initialDisguise[p.uid] ?? true" :checked="options.initialDisguise[p.uid] ?? true" type="checkbox" @change="options.initialDisguise[p.uid] = ($event.target as HTMLInputElement).checked"><span class="score-check-label">{{ boxLabel(p) }} · 画皮仍可大成功</span></label>
        </template>
        <button class="btn ghost" type="button" @click="reset">恢复默认设置，保留初始能量与食材</button>
      </div>
      <p v-if="inputError" class="amber" role="alert">{{ inputError }}</p>
      <p v-if="!box.pokemon.length" class="muted">请先在 Box 添加宝可梦，再开始规划。</p>
      <div class="row"><button class="btn" type="button" :disabled="busy || !ready || !!inputError || !box.pokemon.length" @click="start">{{ busy ? `正在规划 ${percent}%` : '开始规划' }}</button></div>
      <ProgressDialog :open="busy" title="正在计算冲分规划" :progress="percent" stage="比较队伍与料理策略" :notice="notice"
        :detail="'已比较 ' + progress.completed + ' / ' + progress.total" cancellable cancel-text="取消规划" @cancel="cancel" />
      <p v-if="notice" role="status" class="muted">{{ notice }}</p><p v-if="error" role="alert" class="amber">{{ error }}</p>
    </article>
    <template v-if="result && solution">
      <p v-if="dirty" class="amber" role="status">输入已变化，以下是上次规划结果，请重新规划。</p>
      <article class="card stack" aria-live="polite">
        <h3>预计期末能量 {{ number(result.options.initialStrength + solution.mean) }}</h3>
        <p>初始 {{ number(result.options.initialStrength) }} ＋ 平均新增 {{ number(solution.mean) }}</p>
        <p class="muted">树果 {{ number(solution.berry) }} · 领域加成 {{ number(solution.zone) }} · 直接技能 {{ number(solution.skill) }} · 料理 {{ number(solution.cooking) }}</p>
        <p class="muted">{{ solution.simulations }} 次模拟的新增能量范围 {{ number(solution.min) }}–{{ number(solution.max) }}，标准差 {{ number(solution.deviation) }}。范围是本次样本的最小／最大值。</p>
        <p class="muted">比较 {{ result.compared }} 个方案，共 {{ result.simulations }} 次模拟，用时 {{ (result.elapsedMs / 1000).toFixed(1) }} 秒。</p>
        <div class="field"><label for="score-solution">比较其他方案</label><select id="score-solution" v-model.number="selected"><option v-for="(s, i) in result.solutions" :key="i" :value="i">方案 {{ i + 1 }} · 平均新增 {{ number(s.mean) }}</option></select></div>
        <p v-if="sensitive" class="amber">该方案对换队保底回退假设敏感，请对照复核收益。</p>
        <p class="muted">回退复核：{{ solution.sensitivity.map(s => `${s.rollback} 次：${number(s.mean)}`).join('；') }}</p>
      </article>
      <article class="card stack">
        <h3>推荐队伍与料理策略</h3>
        <p>优先 {{ solution.policy.recipe || '当前可用料理' }}；预留 {{ solution.policy.reserveMeals }} 餐食材，白天至少间隔 {{ solution.policy.rotateMinutes }} 分钟考虑轮换。</p>
        <div v-for="(uids, i) in [...solution.policy.day, ...solution.policy.sleep.slice(0, result.options.splitSleep ? 2 : 1), ...(result.options.device ? solution.policy.settle.slice(0, result.options.splitSleep ? 2 : 1) : [])]" :key="i" class="stack score-team">
          <p><strong>{{ i < 2 ? i === 0 ? '白天树果／技能阶段' : '白天食材阶段' : i < 2 + (result.options.splitSleep ? 2 : 1) ? `睡眠生产队 ${i - 1}` : `外设结算队 ${i - 1 - (result.options.splitSleep ? 2 : 1)}` }}</strong></p>
          <div class="score-roster"><div v-for="uid in uids" :key="uid" class="score-pokemon"><PokeSprite :id="pokemon(uid)?.pokeId ?? 0" :name="name(uid)" :shiny="pokemon(uid)?.shiny" /><span>{{ name(uid) }}</span></div></div>
        </div>
      </article>
      <article class="card stack">
        <h3>执行示例与期末状态</h3>
        <p class="muted">下方是一条固定种子的执行轨迹；料理暴击、技能和轮换会因实际产物变化，不能把示例总收益当作统计均值。</p>
        <p>示例新增能量 {{ number(solution.trace.total) }} · 期末食材 {{ foods(solution.trace.bag) }}</p>
        <p class="muted">卖出 {{ foods(solution.trace.sold) }}；树果汁：初始 {{ solution.trace.juice.initial }}、入库 {{ solution.trace.juice.received }}、使用 {{ solution.trace.juice.used }}、未入库 {{ solution.trace.juice.lost }}、剩余 {{ solution.trace.juice.remain }}。</p>
        <div v-for="m in solution.trace.members" :key="m.uid" class="score-state">
          <p><strong>{{ name(m.uid) }}</strong> · 上场 {{ m.hours.toFixed(1) }} 小时 · 睡眠 EXP {{ number(m.exp) }} · 期末活力 {{ m.energy.toFixed(1) }}</p>
          <p class="muted">每日上场 {{ m.dailyHours.map(h => h.toFixed(1)).join(' / ') }} 小时；未领树果 {{ m.heldBerries }} 颗、食材 {{ foods(m.heldFood) }}、存储技能 {{ m.stock }} 次。</p>
        </div>
        <button class="btn ghost" type="button" :aria-expanded="showActions" @click="showActions = !showActions">{{ showActions ? '收起操作时间表' : '查看操作时间表' }}</button>
        <div v-if="showActions" class="stack">
          <div class="field"><label for="score-action-day">查看日期</label><select id="score-action-day" v-model.number="actionDay"><option v-for="(day, i) in ['周一','周二','周三','周四','周五','周六','周日','下周一结算']" :key="day" :value="i">{{ day }}</option></select></div>
          <div v-for="(segment, i) in daySegments" :key="`segment-${i}`" class="score-action"><p><strong>{{ scoreTime(Math.max(segment.start, actionDay * 1440 + 240)) }} — {{ scoreTime(Math.min(segment.end, (actionDay + 1) * 1440 + 240)) }}</strong> · {{ segment.purpose }}</p><p class="muted">{{ segment.members.map(name).join('、') }}</p></div>
          <div v-for="(action, i) in actions" :key="i" class="score-action"><p><strong>{{ scoreTime(action.minute) }}</strong> · {{ action.text }}<span v-if="action.energy != null"> · {{ number(action.energy) }} 能量</span></p><p v-if="action.members" class="muted">{{ action.members.map(name).join('、') }}</p><p v-if="action.foods && Object.values(action.foods).some(n => n > 0)" class="muted">{{ foods(action.foods) }}</p></div>
          <p v-if="!actions.length" class="muted">这一天没有安排操作。</p>
        </div>
      </article>
      <article class="card stack"><h3>适用范围</h3><p v-for="warning in result.warnings" :key="warning" class="muted">{{ warning }}</p><p v-for="(p, i) in result.excluded" :key="i" class="muted">未参与：{{ p.name }} · {{ p.reason }}</p></article>
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
