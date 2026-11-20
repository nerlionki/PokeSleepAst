<script setup lang="ts">
import { computed, onUnmounted, ref } from 'vue'
import { t as translateUi, gameText } from '../../ui/i18n'
import { importBagScreenshotSelection } from '#platform/screenshots'
import { activeSnapshot } from '../../resources/runtime'
import { readCatalog, translate } from '../../ui/i18nLookup'
import type { BagImportResult } from '../../calc/ocrIngredientBag'
import { bundledImage, localImage } from '#platform/images'
import { INGREDIENTS } from '../../calc/data'
import { ingredientLabel, ingredientRow } from '../../calc/catalogIds'
import { INPUT_RANGES } from '../../calc/inputRanges'
import IngredientIcon from '../shared/IngredientIcon.vue'
import ProgressDialog from '../shared/ProgressDialog.vue'

const props = defineProps<{ disabled?: boolean; initiallyOpen?: boolean }>()
const bag = defineModel<Record<string, number>>('bag', { required: true })
const unresolved = defineModel<Record<string, number> | undefined>('unresolved')
const inventory = ref(props.initiallyOpen ?? false)
const limits = INPUT_RANGES.ScorePlanPane.options_bag_ingredient_name

const foodCount = computed(() => Object.values(bag.value).reduce((sum, n) => sum + (Number(n) || 0), 0))
const unresolvedFoods = computed(() => Object.entries(unresolved.value ?? {}))
const unknownFoods = computed(() => Object.keys(bag.value).filter(key => !ingredientRow(key)))
const bagImporting = ref(false)
const bagProgress = ref<number | null>(null)
const bagConflict = ref<BagImportResult | null>(null)
const bagChoices = ref<Record<number, number>>({})
const bagUnreadable = ref<number[]>([])
const bagSkipped = ref(0)
const bagError = ref(false)
let mounted = true
onUnmounted(() => { mounted = false })

const maxFood = limits.max
const validFoodCount = (value: unknown) => typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= maxFood
const bagChoicesReady = computed(() => bagConflict.value?.conflicts.every(({ id }) => validFoodCount(bagChoices.value[id])) ?? false)

function fillBag(result: BagImportResult, choices: Record<number, number> = {}) {
  const counts = { ...result.counts, ...choices }
  const unreadable = new Set(result.unreadable)
  // A bag import replaces the starting inventory. Unreadable amounts stay blank for manual entry.
  bag.value = Object.fromEntries(INGREDIENTS.filter(({ id }) => !unreadable.has(id)).map(({ id }) => [id, counts[id] ?? 0]))
  unresolved.value = {}
  bagUnreadable.value = result.unreadable
  bagSkipped.value = result.skipped
  bagConflict.value = null
}

function confirmBagImport() {
  if (bagConflict.value && bagChoicesReady.value) fillBag(bagConflict.value, bagChoices.value)
}

async function importBag() {
  if (props.disabled || bagImporting.value || bagConflict.value) return
  bagImporting.value = true
  bagError.value = false
  try {
    const catalog = readCatalog(activeSnapshot()?.data['meta.json'])
    const ingredients = INGREDIENTS.map(({ id, name }) => {
      const url = localImage(`ingredient/${id}.webp`)
      return { id, names: [name, translate(catalog, 'zh-TW', name)], imageUrl: bundledImage(url) || url }
    })
    const result = await importBagScreenshotSelection({ ingredients, maxCount: maxFood }, progress => {
      if (mounted) bagProgress.value = progress.percent
    })
    if (!mounted || !result) return
    bagSkipped.value = 0
    if (!Object.keys(result.counts).length && !result.conflicts.length && !result.unreadable.length) {
      bagError.value = true
      return
    }
    if (result.conflicts.length) {
      bagChoices.value = {}
      bagConflict.value = result
      bagSkipped.value = result.skipped
    } else fillBag(result)
  } catch {
    if (mounted) { bagSkipped.value = 0; bagError.value = true }
  } finally {
    bagImporting.value = false
    bagProgress.value = null
  }
}

function removeUnresolvedFood(key: string) { if (unresolved.value) delete unresolved.value[key] }
function updateFood(id: number, event: Event) {
  const input = event.target as HTMLInputElement
  const value = input.value
  if (input.validity?.badInput) bag.value[id] = Number.NaN
  else if (value === '') delete bag.value[id]
  else {
    bag.value[id] = Number(value)
    if (validFoodCount(Number(value))) bagUnreadable.value = bagUnreadable.value.filter(item => item !== id)
  }
}
</script>

<template>
  <div class="stack">
    <button class="btn ghost" type="button" :aria-expanded="inventory" @click="inventory = !inventory">{{ translateUi("初始食材 ·") }} {{ foodCount }}/{{ limits.max }} {{ translateUi("个") }}</button>
    <div v-if="inventory" class="stack">
      <p class="muted">{{ translateUi("填写规划开始时已经持有的数量。未填写按 0 处理，规划不会扣除保存的库存。") }}</p>
      <button class="btn ghost" type="button" :disabled="disabled || bagImporting || !!bagConflict" @click="importBag">{{ translateUi('导入背包食材') }}</button>
      <p v-if="bagError" class="amber" role="alert">{{ translateUi('未能识别背包食材，请选择简体或繁体中文的游戏背包食材截图。') }}</p>
      <p v-if="bagSkipped" class="muted" role="status">{{ translateUi('已跳过 {count} 张无法识别的截图。', { count: bagSkipped }) }}</p>
      <div v-if="bagConflict" class="stack">
        <p class="amber">{{ translateUi('以下食材在截图中的数量不同。请选择或填写正确的数量。') }}</p>
        <div v-for="{ id, counts } in bagConflict.conflicts" :key="id" class="field">
          <label :for="`bag-conflict-${id}`">{{ gameText(ingredientLabel(String(id))) }} · {{ translateUi('确认数量') }}</label>
          <div class="row score-bag-choices">
            <button v-for="count in counts" :key="count" class="btn" :class="{ ghost: bagChoices[id] !== count }" type="button"
              :aria-pressed="bagChoices[id] === count" @click="bagChoices[id] = count">{{ count }}</button>
            <input :id="`bag-conflict-${id}`" v-model.number="bagChoices[id]" type="number" min="0" :max="maxFood" step="1" inputmode="numeric">
          </div>
        </div>
        <div class="row">
          <button class="btn" type="button" :disabled="!bagChoicesReady" @click="confirmBagImport">{{ translateUi('确认导入') }}</button>
          <button class="btn ghost" type="button" @click="bagConflict = null; bagSkipped = 0">{{ translateUi('取消') }}</button>
        </div>
      </div>
      <div class="score-foods">
        <div v-for="ingredient in INGREDIENTS" :key="ingredient.id" class="field">
          <label :for="`score-food-${ingredient.id}`"><IngredientIcon :id="ingredient.id" :name="ingredient.name" small /> {{ gameText(ingredient.name) }}</label>
          <input :id="`score-food-${ingredient.id}`" :value="bag[ingredient.id]" type="number" :min="limits.min" :max="maxFood" :step="limits.step" inputmode="numeric" :disabled="disabled"
            :aria-describedby="bagUnreadable.includes(ingredient.id) ? `score-food-pending-${ingredient.id}` : undefined" @input="updateFood(ingredient.id, $event)">
          <small v-if="bagUnreadable.includes(ingredient.id)" :id="`score-food-pending-${ingredient.id}`" class="amber">{{ translateUi('数量待填写') }}</small>
        </div>
      </div>
      <div v-for="[key, amount] in unresolvedFoods" :key="key" class="row">
        <span class="amber">{{ key }} ×{{ amount }} · {{ translateUi('旧库存未匹配或冲突') }}</span>
        <button class="btn ghost" type="button" @click="removeUnresolvedFood(key)">{{ translateUi('删除') }}</button>
      </div>
      <div v-for="name in unknownFoods" :key="name" class="row">
        <span class="amber">{{ name }} · {{ translateUi("当前资料未收录") }}</span>
        <button class="btn ghost" type="button" @click="delete bag[name]">{{ translateUi("删除") }}</button>
      </div>
    </div>
    <ProgressDialog :open="bagProgress != null" title="正在识别背包食材" :progress="bagProgress" />
  </div>
</template>

<style scoped>
.score-foods { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 140px), 1fr)); gap: 12px; }
.score-foods label { display: flex; gap: 6px; align-items: center; }
.score-bag-choices { flex-wrap: wrap; }
.score-bag-choices input { width: 7rem; max-width: 100%; }
</style>
