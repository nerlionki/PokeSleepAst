<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{ values: number[], max?: number }>()

const d = computed(() => {
  const vals = props.values
  if (!vals.length) return ''
  const hi = props.max ?? Math.max(...vals, 1)
  return vals.map((v, i) => {
    const x = (i / Math.max(1, vals.length - 1)) * 120
    const y = 28 - (v / hi) * 26
    return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`
  }).join(' ')
})
</script>

<template>
  <svg class="spark" viewBox="0 0 120 30" aria-hidden="true">
    <path :d="d" fill="none" stroke="currentColor" stroke-width="1.6" />
  </svg>
</template>
