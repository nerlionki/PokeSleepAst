<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { calculateExchangePlan, emptyExchangePlan, exchangeBundleOpensAt, exchangeBundles, exchangePlanTime, exchangeQuantity, exchangeResearchDays, exchangeRewards, isExchangeOpen, type ExchangePlan, type ExchangeShop } from '../../calc/eventExchange'
import type { EventBundleCatalog } from '../../calc/eventBundles'
import { itemById } from '../../calc/itemCatalog'
import { useExchangePlans } from '../../stores/exchangePlans'
import { catalogText, gameText, t } from '../../ui/i18n'
import EventExchangeOffers from '../data/EventExchangeOffers.vue'
import { confirmRemoval } from '#platform/confirm'

const props = defineProps<{ shops: ExchangeShop[]; now: number; catalog: EventBundleCatalog | null }>()
const store = useExchangePlans()
const route = useRoute()
const selected = ref('')
watch(() => props.shops.find(row => row.event.id === route.query.exchangeEvent)?.key, key => {
  if (key) selected.value = key
}, { immediate: true })
const shop = computed(() => props.shops.find(row => row.key === selected.value) ?? props.shops[0])
const shopKey = computed({ get: () => shop.value?.key ?? '', set: key => { selected.value = key } })
const plan = computed(() => shop.value && store.plans[shop.value.key] || emptyExchangePlan())
const preview = computed(() => !!shop.value && !isExchangeOpen(shop.value, props.now))
const planTime = computed(() => shop.value ? exchangePlanTime(shop.value, props.now) : props.now)
const bundles = computed(() => shop.value ? exchangeBundles(shop.value, props.catalog, planTime.value) : [])
const rewards = computed(() => shop.value ? exchangeRewards(shop.value, planTime.value) : [])
const days = computed(() => shop.value ? exchangeResearchDays(shop.value, planTime.value) : 0)
const totals = computed(() => shop.value ? calculateExchangePlan(shop.value, plan.value, props.catalog, planTime.value) : undefined)
onMounted(() => { void store.hydrate() })

function currency(row: ExchangeShop) {
  return gameText(itemById(row.exchange.currencyItemId)?.name ?? String(row.exchange.currencyItemId))
}
function activityName(row: ExchangeShop) {
  return catalogText('活动标题', row.event.id, row.event.name)
}
function timestamp(value: string | undefined) {
  return value?.slice(0, 16).replace('T', ' ') ?? ''
}
function edit(change: (next: ExchangePlan) => void) {
  if (shop.value && store.ready) store.update(shop.value.key, change)
}
function field(name: 'owned' | 'researchDays' | 'researchPerDay' | 'other', event: Event, limit?: number) {
  const input = event.target as HTMLInputElement
  const value = exchangeQuantity(input.value, limit)
  edit(next => { next[name] = value })
}
function quantity(kind: 'offers' | 'bundles', id: string, value: number) {
  edit(next => { next[kind][id] = value })
}
function setBundle(id: string, limit: number, event: Event) {
  const input = event.target as HTMLInputElement
  const value = exchangeQuantity(input.value, limit)
  quantity('bundles', id, value)
}
function maxOffers() {
  const offers = shop.value?.exchange.offers ?? []
  edit(next => {
    for (const offer of offers) if (offer.id) next.offers[offer.id] = offer.limit
  })
}
function maxBundles() {
  edit(next => {
    for (const { bundle } of bundles.value) next.bundles[bundle.id] = bundle.purchaseLimit
  })
}
function toggleReward(id: string) {
  edit(next => { next.rewards[id] = !next.rewards[id] })
}
function setRewards(ids: string[], checked: boolean) {
  edit(next => {
    for (const id of ids) next.rewards[id] = checked
  })
}
async function reset() {
  const key = shop.value?.key
  if (key && await confirmRemoval('确认重置此活动兑换计划？')) store.reset(key)
}
</script>

<template>
  <section v-if="shop && totals" class="stack form-pane exchange-plan">
    <label v-if="shops.length > 1" class="field">
      <span>{{ t('选择兑换活动') }}</span>
      <select v-model="shopKey">
        <option v-for="row in shops" :key="row.key" :value="row.key">{{ activityName(row) }} · {{ currency(row) }}</option>
      </select>
    </label>
    <h3>{{ activityName(shop) }} · {{ currency(shop) }}</h3>
    <p v-if="preview" class="muted">{{ t('兑换预览按活动首日计算。') }}</p>
    <p v-if="shop.exchange.closesAt" class="muted">{{ t('兑换截止 {time}', { time: timestamp(shop.exchange.closesAt) }) }}</p>
    <p v-if="store.storageError" role="status">{{ t('兑换计划未能读取或保存') }}</p>
    <div v-if="store.ready" class="stack">
      <div class="card exchange-columns" aria-live="polite">
        <div>{{ t('预计收入') }} <strong>{{ totals.income }}</strong></div>
        <div>{{ t('兑换花费') }} <strong>{{ totals.spent }}</strong></div>
        <div>{{ t('预计剩余') }} <strong :class="{ amber: totals.remaining < 0 }">{{ totals.remaining }}</strong></div>
      </div>

      <section class="card stack">
        <h3>{{ t('收入设置') }}</h3>
        <p class="muted">{{ t('已领取的奖励请计入当前持有，其他项目只填写尚未获得的收入。') }}</p>
        <div class="exchange-columns">
          <label class="field"><span>{{ t('当前持有') }}</span><input :value="plan.owned" type="number" min="0" step="1" @input="field('owned', $event)"></label>
          <label class="field"><span>{{ t('其他预计收入') }}</span><input :value="plan.other" type="number" min="0" step="1" @input="field('other', $event)"></label>
        </div>
        <template v-if="days">
          <div class="row"><strong>{{ t('睡眠研究收入') }}</strong> <span>+{{ totals.research }}</span></div>
          <div class="exchange-columns">
            <label class="field"><span>{{ t('计划研究天数') }}</span><input :value="exchangeQuantity(plan.researchDays, days)" type="number" min="0" :max="days" step="1" @input="field('researchDays', $event, days)"></label>
            <label class="field"><span>{{ t('预计每日获得') }}</span><input :value="plan.researchPerDay" type="number" min="0" step="1" @input="field('researchPerDay', $event)"></label>
          </div>
        </template>
      </section>

      <EventExchangeOffers :shop="shop" :quantities="plan.offers" :now="planTime" @set="(id, value) => quantity('offers', id, value)" @max="maxOffers" />

      <section v-if="bundles.length" class="card stack">
        <div class="exchange-toolbar">
          <h3>{{ t('活动礼包') }}</h3>
          <button type="button" class="btn ghost" @click="maxBundles">{{ t('全部 MAX') }}</button>
        </div>
        <p>{{ currency(shop) }} +{{ totals.bundleIncome }} · {{ t('钻石花费') }} {{ totals.diamonds }}</p>
        <div v-for="{ bundle, quantity: amount } in bundles" :key="bundle.id" class="exchange-toolbar exchange-entry">
          <div class="stack">
            <strong>{{ catalogText('活动礼包', bundle.id, bundle.name) }}</strong>
            <span class="muted">{{ t(bundle.price.unit) }} × {{ bundle.price.amount }} · {{ currency(shop) }} +{{ amount }} · {{ t('限购 {count} 次', { count: bundle.purchaseLimit }) }}</span>
            <span v-if="bundle.saleStartsAt && planTime < exchangeBundleOpensAt(bundle)" class="muted">{{ t('{time} 开放', { time: timestamp(bundle.saleStartsAt) }) }}</span>
          </div>
          <div class="row">
            <input class="exchange-count" type="number" min="0" :max="bundle.purchaseLimit" step="1"
              :aria-label="t('{item}的计划购买数量', { item: catalogText('活动礼包', bundle.id, bundle.name) })"
              :value="exchangeQuantity(plan.bundles[bundle.id], bundle.purchaseLimit)" @input="setBundle(bundle.id, bundle.purchaseLimit, $event)">
            <button class="btn ghost" type="button" @click="quantity('bundles', bundle.id, bundle.purchaseLimit)">MAX</button>
          </div>
        </div>
      </section>

      <section v-if="rewards.length" class="card stack">
        <h3>{{ t('任务与赠礼') }} · +{{ totals.rewardIncome }}</h3>
        <div v-for="group in rewards" :key="group.id" class="stack exchange-entry">
          <div class="exchange-toolbar">
            <strong>{{ t(group.kind === 'mission' ? '第 {week} 周任务' : '第 {week} 周赠礼', { week: group.week }) }}</strong>
            <div class="row">
              <button type="button" class="btn ghost" @click="setRewards(group.rewards.map(reward => reward.id), true)">{{ t('全选') }}</button>
              <button type="button" class="btn ghost" @click="setRewards(group.rewards.map(reward => reward.id), false)">{{ t('取消全选') }}</button>
            </div>
          </div>
          <span v-if="planTime < Date.parse(group.opensAt)" class="muted">{{ t('{time} 开放', { time: timestamp(group.opensAt) }) }}</span>
          <label v-for="reward in group.rewards" :key="reward.id" class="row">
            <input type="checkbox" :checked="!!plan.rewards[reward.id]" @change="toggleReward(reward.id)">
            <span>{{ t(reward.label) }} · +{{ reward.quantity }}</span>
          </label>
        </div>
      </section>
      <button type="button" class="btn ghost" @click="reset">{{ t('重置兑换计划') }}</button>
    </div>
  </section>
  <p v-else class="card muted">{{ t('暂无兑换活动资料。') }}</p>
</template>

<style scoped>
.exchange-columns { display: grid; grid-template-columns: repeat(auto-fit, minmax(8rem, 1fr)); gap: .65rem; }
.exchange-columns strong { display: block; }
.exchange-toolbar { display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: .5rem; }
.exchange-entry { padding-top: .65rem; border-top: 1px solid var(--line); }
.exchange-entry .stack { gap: .2rem; }
.exchange-count { width: 5rem; }
</style>
