<script setup lang="ts">
import { computed, shallowRef, watch } from 'vue'

const props = defineProps<{ selection?: readonly string[] }>()
const selectionKey = computed(() => props.selection?.join('|'))
const restoreLeft = shallowRef(0)
let currentLeft = 0

function trackScroll(event: { detail: { scrollLeft: number } }) {
  const left = event.detail.scrollLeft
  if (Number.isFinite(left)) currentLeft = Math.max(0, left)
}

// Give the refreshed native contents their previous offset in the same update.
watch(selectionKey, () => { restoreLeft.value = currentLeft })
</script>

<template>
  <scroll-view
    :key="selectionKey"
    :scroll-x="true"
    :scroll-left="restoreLeft"
    class="horizontal-strip"
    style="width: 100%"
    @scroll="trackScroll"
    @touchstart.stop
    @touchend.stop
    @touchcancel.stop
  >
    <custom-wrapper><slot /></custom-wrapper>
  </scroll-view>
</template>
