<script setup lang="ts">
import clientDefaults from '../../data/client-defaults.json'

import { shallowRef, watch } from 'vue'
const components_shared_FallbackImage_config_clientDefaults = clientDefaults.modules.components_shared_FallbackImage

defineOptions({ inheritAttrs: false })
const props = defineProps<{ src?: string, alt: string, resetKey?: string | number }>()
const emit = defineEmits<{ error: [] }>()
const failed = shallowRef(components_shared_FallbackImage_config_clientDefaults["failedInitial"])
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
