<script setup lang="ts">
import { computed, shallowRef, watch } from 'vue'
import { SUBSKILLS } from '../../calc/data'
import { subskillImageUrl } from '../../calc/raeImage'

const props = defineProps<{
  id: string
  locked?: boolean
  decorative?: boolean
}>()

const skill = computed(() => SUBSKILLS.find((item) => item.id === props.id))
const src = computed(() => subskillImageUrl(props.id))
const failed = shallowRef(false)
const loadedMask = shallowRef('')
watch(src, () => { loadedMask.value = ''; failed.value = false })
const mask = computed(() => {
  const url = `url("${loadedMask.value || src.value}")`
  return { maskImage: url, WebkitMaskImage: url }
})
</script>

<template>
  <span
    v-if="skill && src && !failed"
    class="sub-ico"
    :class="[`rarity-${skill.rarity}`, { locked }]"
    :style="mask"
    role="img"
    :aria-hidden="decorative || undefined"
    :aria-label="decorative ? undefined : skill.name"
    :title="skill.name"
  >
    <img class="sub-mask-loader" :src="src" alt="" aria-hidden="true" @error="failed = true" @load="loadedMask = ($event.target as HTMLImageElement).src">
  </span>
  <span v-else-if="skill && !decorative">{{ skill.name }}</span>
</template>
<style scoped>
.sub-mask-loader { display: none; }
</style>
