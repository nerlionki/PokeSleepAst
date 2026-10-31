<script setup lang="ts">
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
    <h3>活动礼包</h3>
    <p v-if="catalog.error" class="amber" role="alert">{{ catalog.error }}</p>
    <p v-else-if="!catalog.data" class="muted">当前资料包尚未提供活动礼包，请更新网络资料后查看。</p>
    <p v-else-if="!rows.length" class="muted">{{ q ? '没有匹配的活动礼包。' : '当前没有已公布且在展示期内的活动礼包。' }}</p>
    <article v-for="bundle in rows" :key="bundle.id" class="card stack">
      <h3>{{ bundle.name }}</h3>
      <p>{{ bundle.price.amount.toLocaleString('zh-CN') }} {{ bundle.price.unit }} · 限购 {{ bundle.purchaseLimit }} 次</p>
      <p class="muted">{{ bundle.eventName }}</p>
      <p class="muted">销售：{{ time(bundle.saleStartsAt) }} ～ {{ time(bundle.saleEndsAt) }}（当地时间）</p>
      <p v-for="item in bundle.items" :key="item.name">{{ item.name }} ×{{ item.quantity }}</p>
    </article>
  </div>
</template>
