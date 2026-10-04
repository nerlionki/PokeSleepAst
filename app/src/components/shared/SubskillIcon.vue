<script setup lang="ts">
import { computed } from 'vue'
import { SUBSKILLS } from '../../calc/data'
import { subskillImageUrl } from '../../calc/raeImage'

const props = defineProps<{
  id: string
  locked?: boolean
}>()

const skill = computed(() => SUBSKILLS.find((item) => item.id === props.id))
const mask = computed(() => {
  const url = `url("${subskillImageUrl(props.id)}")`
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
  />
</template>
