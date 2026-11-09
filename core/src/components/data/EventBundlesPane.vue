<script setup lang="ts">
import { gameText, t as translateUi } from '../../ui/i18n'


import { computed, onMounted, onActivated, onDeactivated, onUnmounted, shallowRef, watch } from 'vue'
import { eventBundleCatalog, visibleEventBundles } from '../../calc/eventBundles'
import { activityNow, retainActivityClock } from '../../composables/activityClock'
const props = defineProps<{ q: string }>()
const now = shallowRef(new Date())
let timer: ReturnType<typeof setTimeout> | undefined
let release: (() => void) | undefined
function stop() { clearTimeout(timer); timer = undefined; release?.(); release = undefined }
function refresh() {
  clearTimeout(timer)
  now.value = new Date()
  const midnight = new Date(now.value)
  midnight.setHours(24, 0, 0, 0)
  timer = setTimeout(refresh, Math.max(1, midnight.getTime() - now.value.getTime()))
}
function start() { if (!release) release = retainActivityClock(); refresh() }
onMounted(start); onActivated(start); onDeactivated(stop); onUnmounted(stop)
watch(activityNow, () => { if (release) refresh() })
const catalog = computed(() => {
  try { return { data: eventBundleCatalog(), error: '' } }
  catch (error) { return { data: null, error: error instanceof Error ? error.message : '礼包资料无法读取' } }
})
const rows = computed(() => catalog.value.data ? visibleEventBundles(catalog.value.data, now.value, props.q) : [])
const time = (value: string) => value.replace('T', ' ').slice(0, 16)
</script>
<template>
  <div class="stack">
    <h3>{{ translateUi("活动礼包") }}</h3>
    <p class="muted bundle-formula">{{ translateUi("性价比 = 单买钻石总价 ÷ 礼包钻石价；无单买价的道具不计入。") }}</p>
    <p v-if="catalog.error" class="amber" role="alert">{{ translateUi(catalog.error) }}</p>
    <p v-else-if="!catalog.data" class="muted">{{ translateUi("当前资料包尚未提供活动礼包，请更新网络资料后查看。") }}</p>
    <p v-else-if="!rows.length" class="muted">{{ q ? translateUi("没有匹配的活动礼包。") : translateUi("当前没有已公布且在展示期内的活动礼包。") }}</p>
    <article v-for="bundle in rows" :key="bundle.id" class="card stack">
      <div class="bundle-heading">
        <div class="bundle-copy stack">
          <h3>{{ bundle.name }}</h3>
          <p>{{ bundle.price.amount.toLocaleString('zh-CN') }} {{ bundle.price.unit }} {{ translateUi("· 限购") }} {{ bundle.purchaseLimit }} {{ translateUi("次") }}</p>
        </div>
        <div class="bundle-value" :aria-label="translateUi('礼包性价比')">
          <p><span class="muted">{{ translateUi("纯球") }} </span><strong>{{ bundle.valuation?.biscuits == null ? '—' : `${bundle.valuation.biscuits}×` }}</strong></p>
          <p><span class="muted">{{ translateUi("含道具") }} </span><strong>{{ bundle.valuation?.total == null ? '—' : `${bundle.valuation.total}×` }}</strong></p>
        </div>
      </div>
      <p v-if="!bundle.valuation" class="muted">{{ translateUi("当前资料包未提供性价比，请更新网络资料后查看。") }}</p>
      <p class="muted">{{ bundle.eventName }}</p>
      <p class="muted">{{ translateUi("销售：") }}{{ time(bundle.saleStartsAt) }} ～ {{ time(bundle.saleEndsAt) }}{{ translateUi("（当地时间）") }}</p>
      <p v-for="item in bundle.items" :key="item.name">{{ gameText(item.name) }} ×{{ item.quantity }}<span v-if="bundle.valuation?.excluded.includes(item.name)" class="muted bundle-excluded">{{ translateUi("（无单买价，未计入）") }}</span></p>
    </article>
  </div>
</template>

<style scoped>
.bundle-heading { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; }
.bundle-copy { flex: 1; min-width: 0; }
.bundle-copy h3 { overflow-wrap: anywhere; }
.bundle-value { flex-shrink: 0; text-align: right; white-space: nowrap; font-size: 12px; line-height: 1.6; }
.bundle-value strong { font-size: 14px; font-variant-numeric: tabular-nums; }
.bundle-formula, .bundle-excluded { font-size: 12px; }
</style>
