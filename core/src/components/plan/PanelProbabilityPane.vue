<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { NATURES, POKEDEX, SUBSKILLS, pokeById } from '../../calc/data'
import { boxLabel } from '../../calc/boxFilter'
import { friendTiers } from '../../calc/ingredients'
import { SUBSKILL_GATES } from '../../calc/member'
import { cloneData } from '../../calc/dataClone'
import { calculatePanelProbability, firstRandomPanelFriendship, panelFriendshipTier, panelGoldMask, panelGoldSlotsEditable, panelIngredientSpreads, panelProbabilitySteps } from '../../calc/panelProbability'
import { useBoxStore } from '../../stores/box'
import { usePanelPlans } from '../../stores/panelPlans'
import { gameText, t } from '../../ui/i18n'
import PokePicker from '#platform/PokePicker.vue'
import Dialog from '#platform/Dialog.vue'
import PanelSkillGroupFields from './PanelSkillGroupFields.vue'
import type { PanelSkillGroup } from '../../calc/panelProbability'
import ToggleField from '../shared/ToggleField.vue'
import ProgressDialog from '../shared/ProgressDialog.vue'

const pokemonIds = POKEDEX.filter(row => friendTiers(row.medalGroup).length && row.ingredients.length >= 2 && row.ingredients.length <= 3).map(row => row.id)
const available = new Set(pokemonIds)
const store = usePanelPlans()
const box = useBoxStore()
const selection = ref('')
const result = ref<ReturnType<typeof calculatePanelProbability> | null>(null)
const busy = ref(false)
const progress = ref(0)
const failed = ref(false)
const natureOpen = ref(false)
const draftGroup = ref<PanelSkillGroup | null>(null)
let calculation = 0
const pokemon = computed(() => pokeById(store.selected))
const plan = computed(() => store.plans[store.selected])
const spreads = computed(() => pokemon.value ? panelIngredientSpreads(pokemon.value) : [])
const boxMembers = computed(() => box.pokemon.filter(member => available.has(member.pokeId)))
const tiers = computed(() => friendTiers(pokemon.value?.medalGroup))
const currentTier = computed(() => panelFriendshipTier(tiers.value, plan.value?.friendship ?? 0))
const availableGoldSlots = computed(() => panelGoldMask(currentTier.value, []))
const activeGoldSlots = computed(() => panelGoldMask(currentTier.value, plan.value?.goldSlots ?? []))
const canEditGoldSlots = computed(() => panelGoldSlotsEditable(currentTier.value))
const firstRandomFriendship = computed(() => firstRandomPanelFriendship(store.selected))
const invalid = computed(() => !plan.value ||
  !Number.isSafeInteger(plan.value.friendship) || plan.value.friendship < firstRandomFriendship.value ||
  !Number.isSafeInteger(plan.value.catches) || plan.value.catches < 1)

onMounted(async () => {
  await store.hydrate()
  const id = available.has(store.selected) ? store.selected : pokemonIds[0]
  if (id !== undefined) store.choose(id)
})
watch(plan, () => { result.value = null; failed.value = false; cancel() }, { deep: true, flush: 'sync' })
onBeforeUnmount(cancel)

function choose(id: number) {
  selection.value = ''
  natureOpen.value = false
  store.choose(id)
}

function importMember() {
  const member = boxMembers.value.find(row => row.uid === selection.value)
  if (!member) return
  store.choose(member.pokeId)
  const next = store.plans[member.pokeId]!
  const missing = new Set(member.ocrMissing ?? [])
  next.natures = member.natureMinted || missing.has('nature') || !NATURES.some(row => row.name === member.nature)
    ? null : [member.nature]
  const ingredientOptions = spreads.value.filter(spread => spread.slots.every((slot, index) => {
    const selected = member.ingredientSlots?.[index]
    return selected == null || missing.has(index === 0 ? 'ingredient0' : index === 1 ? 'ingredient1' : 'ingredient2') || slot.index === selected
  }))
  next.ingredients = ingredientOptions.length === spreads.value.length ? [] : ingredientOptions.map(spread => spread.key)
  next.groups = (member.subskills ?? []).slice(0, SUBSKILL_GATES.length).flatMap((id, slot) =>
    SUBSKILLS.some(skill => skill.id === id) ? [{ skills: [id], fromSlot: slot, throughSlot: slot, mode: 'all' as const, minimum: 1 }] : [])
  next.allowUpgrade = false
}

function toggle(list: string[], value: string) {
  const index = list.indexOf(value)
  if (index === -1) list.push(value)
  else list.splice(index, 1)
}

function addGroup() {
  draftGroup.value = { skills: [], fromSlot: 0, throughSlot: 2, mode: 'all', minimum: 1 }
}

function saveGroup() {
  if (!draftGroup.value || !plan.value) return
  plan.value.groups.push(draftGroup.value)
  draftGroup.value = null
}

async function calculate() {
  if (invalid.value || busy.value || !plan.value || !pokemon.value) return
  const run = ++calculation
  const task = panelProbabilitySteps(pokemon.value, cloneData(plan.value))
  const pause = () => new Promise<void>(resolve => setTimeout(resolve, 0))
  busy.value = true
  progress.value = 0
  failed.value = false
  try {
    await nextTick()
    await pause()
    while (run === calculation) {
      const deadline = Date.now() + 12
      do {
        const step = task.next()
        if (step.done) {
          result.value = step.value
          return
        }
        progress.value = step.value * 100
      } while (Date.now() < deadline)
      await pause()
    }
  } catch {
    if (run === calculation) failed.value = true
  } finally {
    if (run === calculation) busy.value = false
  }
}

function cancel() {
  calculation++
  busy.value = false
}

function percent(value: number) {
  const pct = value * 100
  return (pct > 0 && pct < 0.0001 ? pct.toExponential(2) : Number(pct.toPrecision(5))) + '%'
}

function count(value: number) {
  return Number.isFinite(value) ? Number(value.toFixed(1)).toLocaleString() : t('不可达')
}

function lockedLevels(mask: number) {
  return SUBSKILL_GATES.filter((_, slot) => mask & (1 << slot)).map(level => 'Lv.' + level).join(' · ') || t('无')
}
</script>

<template>
  <div v-if="store.ready && plan" class="stack form-pane panel-probability">
    <div class="field">
      <label>{{ t('选择宝可梦') }}</label>
      <PokePicker :model-value="store.selected" :allowed-ids="pokemonIds" editor-title="面板概率" @update:model-value="choose">
        <template #editor>
          <div class="stack panel-target-editor">
            <section class="stack">
              <strong>{{ t('食材组合') }}</strong>
              <button type="button" class="btn" :class="{ ghost: plan.ingredients.length > 0 }"
                :aria-pressed="!plan.ingredients.length" @click="plan.ingredients = []">{{ t('不限制') }}</button>
              <div class="ingredient-choices">
                <button v-for="spread in spreads" :key="spread.key" type="button" class="btn" :class="{ ghost: !plan.ingredients.includes(spread.key) }"
                  :aria-pressed="plan.ingredients.includes(spread.key)" @click="toggle(plan.ingredients, spread.key)">
                  {{ spread.key }} · {{ spread.slots.map(slot => gameText(slot.name)).join(' / ') }}
                </button>
              </div>
            </section>
            <section class="stack">
              <strong>{{ t('副技能条件') }}</strong>
              <ToggleField v-model="plan.allowUpgrade" label="计入副技能种子升级" />
              <div v-for="(group, index) in plan.groups" :key="index" class="panel-group stack">
                <PanelSkillGroupFields :group="group" />
                <button type="button" class="btn ghost" @click="plan.groups.splice(index, 1)">{{ t('移除条件组') }}</button>
              </div>
              <button type="button" class="btn ghost" aria-haspopup="dialog" @click="addGroup">{{ t('添加条件组') }}</button>
              <Dialog v-if="draftGroup" :title="t('添加条件组')" @close="draftGroup = null">
                <PanelSkillGroupFields :group="draftGroup" />
                <template #footer>
                  <button type="button" class="btn sage" :disabled="!draftGroup.skills.length" @click="saveGroup">{{ t('完成') }}</button>
                </template>
              </Dialog>
            </section>
            <button type="button" class="btn ghost" :aria-expanded="natureOpen" @click="natureOpen = !natureOpen">
              {{ t('性格') }} · {{ plan.natures === null ? t('不限制') : plan.natures.length === 1 ? gameText(plan.natures[0]) : t('高级条件') }}
            </button>
            <section v-if="natureOpen" class="stack">
              <label class="row"><input :checked="plan.natures === null" type="checkbox" @change="plan.natures = plan.natures === null ? [] : null">{{ t('不限制') }}</label>
              <div v-if="plan.natures !== null" class="row panel-choices">
                <button v-for="nature in NATURES" :key="nature.name" type="button" class="btn" :class="{ ghost: !plan.natures.includes(nature.name) }"
                  :aria-pressed="plan.natures.includes(nature.name)" @click="toggle(plan.natures, nature.name)">{{ gameText(nature.name) }}</button>
              </div>
            </section>
          </div>
        </template>
        <template #editorFooter="{ close }">
          <button type="button" class="btn" @click="close">{{ t('完成') }}</button>
        </template>
      </PokePicker>
    </div>
    <label v-if="boxMembers.length" class="field">
      <span>{{ t('从 Box 载入副本') }}</span>
      <select v-model="selection" @change="importMember">
        <option value="">{{ t('手动设置') }}</option>
        <option v-for="member in boxMembers" :key="member.uid" :value="member.uid">{{ boxLabel(member) }} · Lv.{{ member.level }}</option>
      </select>
    </label>
    <div class="panel-grid">
      <label class="field"><span>{{ t('当前友情等级') }}</span><input v-model.number="plan.friendship" type="number" :min="firstRandomFriendship" step="1"></label>
      <label class="field"><span>{{ t('计划捕捉数量') }}</span><input v-model.number="plan.catches" type="number" min="1" step="1"></label>
    </div>
    <p v-if="firstRandomFriendship > 1" class="muted">{{ t('首只特殊宝可梦的性格和副技能固定，从第二只开始计算。') }}</p>
    <section class="stack">
      <strong>{{ t('锁金') }}</strong>
      <div v-if="canEditGoldSlots && availableGoldSlots" class="row panel-choices">
        <template v-for="(level, slot) in SUBSKILL_GATES" :key="level">
          <ToggleField v-if="availableGoldSlots & (1 << slot)" :label="'Lv.' + level"
            :model-value="Boolean(activeGoldSlots & (1 << slot))" @update:model-value="plan.goldSlots[slot] = $event" />
        </template>
      </div>
      <span v-else class="muted">{{ lockedLevels(activeGoldSlots) }}</span>
    </section>

    <button type="button" class="btn" :disabled="invalid || busy" @click="calculate">{{ t('计算面板概率') }}</button>
    <p v-if="failed" class="amber" role="alert">{{ t('计算失败') }}</p>
    <p v-if="store.storageError" role="status">{{ t('面板概率设置未能读取或保存') }}</p>
    <section v-if="result" class="panel-group stack" aria-live="polite">
      <div class="panel-result-target stack">
        <span>{{ t('计划捕捉数量') }} · {{ plan.catches.toLocaleString() }}</span>
        <div>{{ t('至少获得一只的概率') }} <strong>{{ percent(result.cumulativeProbability) }}</strong></div>
      </div>
      <div class="panel-grid">
        <div>{{ t('单次符合概率') }} <strong>{{ percent(result.segments[0]!.probability) }}</strong></div>
        <div>{{ t('平均捕捉数量') }} <strong>{{ count(result.expectedCatches) }}</strong></div>
      </div>
      <div class="panel-grid">
        <div>{{ t('性格') }} <strong>{{ percent(result.natureProbability) }}</strong></div>
        <div>{{ t('食材组合') }} <strong>{{ percent(result.ingredientProbability) }}</strong></div>
        <div>{{ t('副技能') }} <strong>{{ percent(result.segments[0]!.skills) }}</strong></div>
      </div>
      <strong>{{ t('达到目标概率所需捕捉数量') }}</strong>
      <div class="row panel-choices">
        <span v-for="item in result.milestones" :key="item.target">{{ percent(item.target) }} · <strong>{{ count(item.catches) }}</strong></span>
      </div>
      <strong>{{ t('友情等级与金色保底') }}</strong>
      <div v-for="segment in result.segments" :key="segment.start" class="panel-grid">
        <span>{{ t('友情等级 {level} 起', { level: segment.start }) }}</span><span>{{ lockedLevels(segment.goldMask) }}</span><strong>{{ percent(segment.probability) }}</strong>
      </div>
    </section>
    <ProgressDialog :open="busy" title="正在计算面板概率" :progress="progress" cancellable @cancel="cancel" />
  </div>
</template>

<style scoped>
.panel-probability { min-width: 0; }
.panel-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(8rem, 1fr)); gap: .5rem; align-items: end; }
.panel-target-editor { min-width: 0; padding: 2px 2px 12px; overflow-wrap: anywhere; }
.ingredient-choices { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: .5rem; }
.ingredient-choices button { white-space: normal; min-width: 0; }
.panel-result-target { padding: .75rem; border-radius: .75rem; background: var(--ink-2); }
.panel-result-target strong { font-size: var(--font-22); color: var(--sage); }
.panel-choices { flex-wrap: wrap; gap: .4rem; }
.panel-group { padding: .75rem; border: 1px solid var(--line); border-radius: .75rem; }
</style>
