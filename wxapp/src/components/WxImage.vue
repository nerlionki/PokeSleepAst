<script setup lang="ts">
import { shallowRef, watch } from 'vue'
import { loadAssetPackage } from '../platform/subpackage'
const props = defineProps<{ src?: string; alt?: string }>()
const emit = defineEmits<{ error: [] }>()
const loaded = shallowRef('')
watch(() => props.src, async src => {
  loaded.value = ''
  if (!src) return
  const pack = src.match(/^\/(asset-pack\d+)\//)?.[1]
  try {
    if (pack) await loadAssetPackage(pack)
    if (props.src === src) loaded.value = src
  } catch { emit('error') }
}, { immediate: true })
</script>
<template><image v-if="loaded" :src="loaded" mode="aspectFit" @error="emit('error')" /></template>
