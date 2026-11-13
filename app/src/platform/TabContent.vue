<script setup lang="ts">
import { ref, watch } from 'vue'

const props = defineProps<{ resetOn?: string }>()
const content = ref<HTMLElement>()
watch(() => props.resetOn, () => {
  if (content.value) content.value.scrollTop = 0
})
</script>

<template><div ref="content" class="tab-content"><slot /></div></template>
