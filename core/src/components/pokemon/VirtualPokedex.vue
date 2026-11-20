<script setup lang="ts">
import { gameText, t as translateUi } from '../../ui/i18n'


import { computed, nextTick, onMounted, onBeforeUnmount, shallowRef, useTemplateRef, watch } from 'vue'
import PokeSprite from '../shared/PokeSprite.vue'
import { useListScroll } from '../../composables/useListScroll'
import { measureVirtualGrid, observeVirtualGrid, scrollVirtualGrid } from '#platform/virtualGrid'
import { useViewport } from '#platform/viewport'
import { pokedexColumns } from '../../ui/responsive'
import { useAppearanceStore } from '../../stores/appearance'
const props = defineProps<{
  items: readonly { id: number; name: string; unknownPlaceholder?: boolean }[]
  scrollResetKey: string
}>()
const emit = defineEmits<{ pick: [id: number] }>()
const { restoreTop, trackListScroll, resetListScroll } = useListScroll('pokedex')
const scrollTop = shallowRef(restoreTop.value)
const revision = shallowRef(0)
const viewport = useViewport()
const appearance = useAppearanceStore()
const scrollArea = useTemplateRef<HTMLElement>('scrollArea')
const columns = shallowRef(pokedexColumns(Math.min(1120, viewport.value.width) - 32))
const ROW_HEIGHT = shallowRef(112)
const viewportHeight = shallowRef(viewport.value.visibleHeight)
let stopObserver: (() => void) | undefined
let generation = 0
let disposed = false

async function setScrollTop(top: number, current: number) {
  // Native scroll-top only reacts to a changed prop. Rebind the actual offset
  // first when a second resize happens to request the previous target again.
  if (restoreTop.value === top && scrollTop.value !== top) {
    restoreTop.value = scrollTop.value
    await nextTick()
  }
  if (disposed || current !== generation) return
  scrollTop.value = trackListScroll({ detail: { scrollTop: top } })
  restoreTop.value = top
  scrollVirtualGrid(scrollArea.value, top)
}

async function refresh() {
  const current = ++generation
  await nextTick()
  const size = await measureVirtualGrid(scrollArea.value)
  if (disposed || current !== generation || !size || size.width <= 0 || size.height <= 0 || !(size.rowHeight > 0)) return
  const nextColumns = pokedexColumns(size.width)
  const anchor = Math.floor(scrollTop.value / ROW_HEIGHT.value) * columns.value
  const geometryChanged = nextColumns !== columns.value || Math.abs(size.rowHeight - ROW_HEIGHT.value) > 0.5
  columns.value = nextColumns
  ROW_HEIGHT.value = size.rowHeight
  viewportHeight.value = size.height
  const anchorTop = geometryChanged ? Math.floor(anchor / nextColumns) * size.rowHeight : scrollTop.value
  const maximum = Math.max(0, Math.ceil(props.items.length / nextColumns) * size.rowHeight - size.height)
  const top = Math.min(anchorTop, maximum)
  if (geometryChanged || top !== scrollTop.value) {
    await nextTick()
    if (!disposed && current === generation) await setScrollTop(top, current)
  }
}

onMounted(() => { stopObserver = observeVirtualGrid(scrollArea.value, refresh); void refresh() })
watch([viewport, () => appearance.variables, () => props.items.length], refresh, { flush: 'post' })
onBeforeUnmount(() => { disposed = true; generation++; stopObserver?.() })
const start = computed(() => Math.max(0, Math.floor(scrollTop.value / ROW_HEIGHT.value) - 2))
const end = computed(() => Math.min(Math.ceil(props.items.length / columns.value), start.value + Math.ceil(viewportHeight.value / ROW_HEIGHT.value) + 4))
const visible = computed(() => props.items.slice(start.value * columns.value, end.value * columns.value))
const bottom = computed(() => Math.max(0, Math.ceil(props.items.length / columns.value) - end.value) * ROW_HEIGHT.value)
function scroll(event: Event | { detail: { scrollTop: number } }) {
  scrollTop.value = trackListScroll(event)
}
watch(() => props.scrollResetKey, async () => {
  generation++
  resetListScroll()
  scrollTop.value = 0
  revision.value++
  await nextTick()
  stopObserver?.()
  stopObserver = observeVirtualGrid(scrollArea.value, refresh)
  void refresh()
})
</script>
<template>
  <div ref="scrollArea" :key="revision" class="virtual-dex" tabindex="0" :aria-label="translateUi('宝可梦图鉴，滚动查看更多')" @scroll="scroll">
    <div :style="{ height: `${start * ROW_HEIGHT}px` }" aria-hidden="true"></div>
    <div class="poke-wall virtual-dex-grid" :style="{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }">
      <button v-for="p in visible" :key="p.id + p.name" type="button" class="poke-wall-cell" @click="emit('pick', p.id)">
        <PokeSprite :id="p.id" :name="p.name" :unknown-placeholder="p.unknownPlaceholder" />
        <span>{{ gameText(p.name) }}</span>
      </button>
    </div>
    <div :style="{ height: `${bottom}px` }" aria-hidden="true"></div>
  </div>
</template>
<style scoped>
.virtual-dex { flex: 1 0 120px; min-height: 120px; height: 100%; overflow-y: auto; overscroll-behavior: contain; }
.virtual-dex-grid { grid-auto-rows: calc(72px + var(--font-11) * 3.6); row-gap: 8px; padding-bottom: 8px; }
.virtual-dex-grid .poke-wall-cell span { display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 3; overflow: hidden; }
</style>
