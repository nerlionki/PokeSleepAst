<script setup lang="ts">
import { catalogText, gameText, t as translateUi } from '../../ui/i18n'
import { localImage, publicImage } from '#platform/images'
import { pokemonIconUrl } from '../../calc/raeImage'
import { pokeById } from '../../calc/data'
import FallbackImage from '../shared/FallbackImage.vue'


import { computed, onMounted, onActivated, onDeactivated, onUnmounted, shallowRef, watch } from 'vue'
import type { Activity } from '../../calc/activities'
import { bundleItem, bundlesForActivity, eventBundleCatalog, visibleEventBundles } from '../../calc/eventBundles'
import { activityNow, retainActivityClock } from '../../composables/activityClock'
const props = defineProps<{ q?: string; event?: Activity }>()
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
function start() {
  if (props.event) return
  if (!release) release = retainActivityClock()
  refresh()
}
onMounted(start); onActivated(start); onDeactivated(stop); onUnmounted(stop)
watch(activityNow, () => { if (release) refresh() })
const catalog = computed(() => {
  try { return { data: eventBundleCatalog(!!props.event), error: '' } }
  catch (error) { return { data: null, error: error instanceof Error ? error.message : '礼包资料无法读取' } }
})
const rows = computed(() => {
  const data = catalog.value.data
  if (!data) return []
  return props.event ? bundlesForActivity(data, props.event) : visibleEventBundles(data, now.value, props.q)
})
const displayRows = computed(() => rows.value.map(bundle => ({
  ...bundle,
  contents: bundle.items.map(entry => {
    const item = bundleItem(entry)
    const incense = item?.pokemonItem?.kind === 'incense' ? item.pokemonItem : entry.pokemonIncense
    const seedPokemon = entry.pokemonSeedId === undefined ? undefined : pokeById(entry.pokemonSeedId)
    const pokemonId = incense?.pokemonId ?? seedPokemon?.id
    const icon = (seedPokemon ? publicImage('items/32.webp') : item ? publicImage(item.imageFile) : '')
      || (incense ? localImage(`incense/pokemon/${incense.typeId}.webp`) : '')
    return {
      entry, item,
      avatar: pokemonId ? pokemonIconUrl(pokemonId) : '',
      icon,
      seedPokemon,
    }
  }),
})))
const time = (value: string) => value.replace('T', ' ').slice(0, 16)
</script>
<template>
  <div class="stack">
    <h3 v-if="!event">{{ translateUi("活动礼包") }}</h3>
    <p v-if="!event || rows.length" class="muted bundle-formula">{{ translateUi("性价比 = 单买钻石总价 ÷ 礼包钻石价；无单买价的道具不计入。") }}</p>
    <p v-if="catalog.error" class="amber" role="alert">{{ translateUi(catalog.error) }}</p>
    <p v-else-if="!catalog.data" class="muted">{{ translateUi("当前资料包尚未提供活动礼包，请更新网络资料后查看。") }}</p>
    <p v-else-if="!rows.length" class="muted">{{ event ? translateUi("该活动暂无已收录礼包。") : q ? translateUi("没有匹配的活动礼包。") : translateUi("当前没有已公布且在展示期内的活动礼包。") }}</p>
    <article v-for="bundle in displayRows" :key="bundle.id" class="card stack">
      <div class="bundle-heading">
        <div class="bundle-copy stack">
          <h3>{{ catalogText('活动礼包', bundle.id, bundle.name) }}</h3>
          <p>{{ bundle.price.amount.toLocaleString('zh-CN') }} {{ translateUi(bundle.price.unit) }} {{ translateUi("· 限购") }} {{ bundle.purchaseLimit }} {{ translateUi("次") }}</p>
        </div>
        <div class="bundle-value" :aria-label="translateUi('礼包性价比')">
          <p><span class="muted">{{ translateUi("纯球") }} </span><strong>{{ bundle.valuation?.biscuits == null ? '—' : `${bundle.valuation.biscuits}×` }}</strong></p>
          <p><span class="muted">{{ translateUi("含道具") }} </span><strong>{{ bundle.valuation?.total == null ? '—' : `${bundle.valuation.total}×` }}</strong></p>
        </div>
      </div>
      <p v-if="!bundle.valuation" class="muted">{{ translateUi("当前资料包未提供性价比，请更新网络资料后查看。") }}</p>
      <p class="muted">{{ catalogText('活动标题', event?.id ?? bundle.eventId, bundle.eventName) }}</p>
      <p class="muted">
        {{ translateUi(bundle.saleStartsAt.length > 10 ? '销售：' : '销售日期：') }}{{ time(bundle.saleStartsAt) }} ～ {{ time(bundle.saleEndsAt) }}
        <span v-if="bundle.saleStartsAt.length > 10">{{ translateUi('（当地时间）') }}</span>
      </p>
      <div v-for="({ entry, item, avatar, icon, seedPokemon }, index) in bundle.contents" :key="index" class="bundle-item">
        <FallbackImage v-if="avatar" class="bundle-avatar" :src="avatar" alt=""><template #fallback><span /></template></FallbackImage>
        <FallbackImage v-if="icon" class="bundle-item-icon" :src="icon" alt=""><template #fallback><span /></template></FallbackImage>
        <p>
          {{ seedPokemon ? translateUi('主技能种子（{pokemon}）', { pokemon: gameText(seedPokemon.name) }) : gameText(item?.name ?? entry.name) }} ×{{ entry.quantity }}
          <span v-if="!item && !entry.pokemonIncense && !seedPokemon" class="muted bundle-excluded">{{ translateUi('（道具目录未匹配）') }}</span>
          <span v-else-if="bundle.valuation?.excluded.includes(entry.name)" class="muted bundle-excluded">{{ translateUi('（无单买价，未计入）') }}</span>
        </p>
      </div>
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
.bundle-item { display: flex; align-items: center; gap: 6px; min-height: 26px; }
.bundle-avatar, .bundle-item-icon { flex: none; width: 24px; height: 24px; object-fit: contain; }
.bundle-avatar + .bundle-item-icon { width: 19px; height: 19px; }
</style>
