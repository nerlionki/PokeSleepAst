<script setup lang="ts">
import { onBeforeUnmount, onMounted, shallowRef, useId, watch } from 'vue'
import { resolveBundledImagePath, resolveImagePath } from '../platform/images'
import { whenImageVisible } from '../platform/imageVisibility'
const props = defineProps<{ src?: string; alt?: string }>()
const emit = defineEmits<{ error: [] }>()
const loaded = shallowRef('')
const visible = shallowRef(false)
const imageId = 'resource-image-' + useId().replace(/[^a-zA-Z0-9_-]/g, '')
let stopObserving: (() => void) | undefined
onMounted(() => { stopObserving = whenImageVisible(imageId, () => { visible.value = true }) })
onBeforeUnmount(() => stopObserving?.())
let localFailed = false
async function onError() {
  const source = props.src
  if (localFailed || !source) { emit('error'); return }
  localFailed = true
  try {
    const path = await resolveBundledImagePath(source)
    if (source !== props.src) return
    if (path === loaded.value) emit('error')
    else loaded.value = path
  } catch { if (source === props.src) emit('error') }
}

watch([() => props.src, visible], async ([src, isVisible], _previous, onCleanup) => {
  let active = true
  onCleanup(() => { active = false })
  loaded.value = ''
  localFailed = false
  if (!src || !isVisible) return
  try {
    const path = await resolveImagePath(src)
    if (active) loaded.value = path
  } catch {
    if (active) emit('error')
  }

}, { immediate: true })
</script>
<template><image :id="imageId" :data-resource-id="imageId" :class="{ 'resource-awaiting-image': !visible }" :src="loaded || undefined" mode="aspectFit" :lazy-load="true" @error="onError" /></template>
