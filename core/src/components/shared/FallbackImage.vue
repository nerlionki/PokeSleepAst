<script setup lang="ts">
import { shallowRef, watch } from 'vue'
defineOptions({ inheritAttrs: false })
const props = defineProps<{ src?: string, alt: string, resetKey?: string | number }>()
const emit = defineEmits<{ error: [] }>()
const failed = shallowRef(false)
watch(() => [props.src, props.resetKey], () => { failed.value = false })
function onError() {
  failed.value = true
  emit('error')
}
</script>

<template>
  <img v-if="src && !failed" v-bind="$attrs" :src="src" :alt="alt" @error="onError">
  <slot v-else name="fallback" />
</template>
