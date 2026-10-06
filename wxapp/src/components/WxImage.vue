<script setup lang="ts">
import { shallowRef, watch } from 'vue'
import { resolveImagePath } from '../platform/images'
const props = defineProps<{ src?: string; alt?: string }>()
const emit = defineEmits<{ error: [] }>()
const loaded = shallowRef('')
watch(() => props.src, async (src, _previous, onCleanup) => {
  let active = true
  onCleanup(() => { active = false })
  loaded.value = ''
  if (!src) return
  try {
    const path = await resolveImagePath(src)
    if (active) loaded.value = path
  } catch { if (active) emit('error') }
}, { immediate: true })
</script>
<template><image v-if="loaded" :src="loaded" mode="aspectFit" @error="emit('error')" /></template>
