<script setup lang="ts">
import { computed, shallowRef, watch } from 'vue'
import { berryIconUrl } from '../../calc/berry'
import { berryByName } from '../../calc/data'

const props = defineProps<{
  name: string
  large?: boolean
  small?: boolean
}>()

const failed = shallowRef(false)
const berry = computed(() => berryByName(props.name))
const hue = computed(() => {
  const map: Record<string, number> = {
    一般: 40, 火: 12, 水: 210, 电: 50, 草: 130, 冰: 190,
    格斗: 20, 毒: 280, 地面: 35, 飞行: 220, 超能: 300, 虫: 80,
    岩石: 30, 幽灵: 260, 龙: 240, 恶: 250, 钢: 200, 妖精: 330,
  }
  return map[berry.value?.type ?? ''] ?? 40
})

watch(() => props.name, () => { failed.value = false })
</script>

<template>
  <img
    v-if="!failed"
    class="berry-icon"
    :class="{ lg: large, sm: small }"
    :src="berryIconUrl(name)"
    :alt="name"
    @error="failed = true"
  >
  <span
    v-else
    class="berry-fallback"
    :class="{ lg: large, sm: small }"
    :style="{ background: `hsl(${hue} 55% 42%)` }"
    :title="name"
  >{{ name.slice(0, 1) }}</span>
</template>
