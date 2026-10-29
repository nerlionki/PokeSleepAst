<script setup lang="ts">
import { computed, onMounted, onBeforeUnmount, shallowRef, watch } from 'vue'
import PokeSprite from '../shared/PokeSprite.vue'
import { virtualRowHeight, virtualViewportHeight, watchVirtualViewport } from '#platform/virtualGrid'
const props = defineProps<{ items: readonly { id: number; name: string }[] }>()
const emit = defineEmits<{ pick: [id: number] }>()
const scrollTop = shallowRef(0)
const revision = shallowRef(0)
const ROW_HEIGHT = shallowRef(virtualRowHeight(110))
const windowHeight = shallowRef(virtualViewportHeight())
let stopResize: (() => void) | undefined
onMounted(() => { stopResize = watchVirtualViewport(() => { ROW_HEIGHT.value = virtualRowHeight(110); windowHeight.value = virtualViewportHeight() }) })
onBeforeUnmount(() => stopResize?.())
const start = computed(() => Math.max(0, Math.floor(scrollTop.value / ROW_HEIGHT.value) - 2))
const end = computed(() => Math.min(Math.ceil(props.items.length / 3), start.value + Math.ceil(windowHeight.value / ROW_HEIGHT.value) + 4))
const visible = computed(() => props.items.slice(start.value * 3, end.value * 3))
const bottom = computed(() => Math.max(0, Math.ceil(props.items.length / 3) - end.value) * ROW_HEIGHT.value)
function scroll(event: Event | { detail: { scrollTop: number } }) {
  const detail = (event as { detail?: { scrollTop?: number } }).detail
  scrollTop.value = typeof detail?.scrollTop === 'number' ? detail.scrollTop : ((event as Event).target as HTMLElement).scrollTop
}
watch(() => props.items, () => { scrollTop.value = 0; revision.value++ })
</script>
<template>
  <div :key="revision" class="virtual-dex" tabindex="0" aria-label="宝可梦图鉴，滚动查看更多" @scroll="scroll">
    <div :style="{ height: `${start * ROW_HEIGHT}px` }" aria-hidden="true"></div>
    <div class="poke-wall virtual-dex-grid">
      <button v-for="p in visible" :key="p.id + p.name" type="button" class="poke-wall-cell" @click="emit('pick', p.id)">
        <PokeSprite :id="p.id" :name="p.name" />
        <span>{{ p.name }}</span>
      </button>
    </div>
    <div :style="{ height: `${bottom}px` }" aria-hidden="true"></div>
  </div>
</template>
<style scoped>
.virtual-dex { flex: 1; min-height: 0; height: 100%; overflow-y: auto; overscroll-behavior: contain; }
.virtual-dex-grid { grid-auto-rows: 110px; row-gap: 0; }
</style>
