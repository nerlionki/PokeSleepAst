<script setup lang="ts">
import { computed, shallowRef, watch } from 'vue'
import { SUBSKILLS } from '../../calc/data'
import { subskillImageUrl } from '../../calc/raeImage'

const props = defineProps<{
  id: string
  locked?: boolean
}>()

const skill = computed(() => SUBSKILLS.find((item) => item.id === props.id))
const src = computed(() => subskillImageUrl(props.id))
const loadedMask = shallowRef('')
watch(src, () => { loadedMask.value = '' })
const mask = computed(() => {
  const url = `url("${loadedMask.value || src.value}")`
  return { maskImage: url, WebkitMaskImage: url }
})
</script>

<template>
  <span
    v-if="skill"
    class="sub-ico"
    :class="[`rarity-${skill.rarity}`, { locked }]"
    :style="mask"
    role="img"
    :aria-label="skill.name"
    :title="skill.name"
  >
    <img class="sub-mask-loader" :src="src" alt="" aria-hidden="true" @load="loadedMask = ($event.target as HTMLImageElement).src">
  </span>
</template>
<style scoped>
.sub-mask-loader { display: none; }
</style>
