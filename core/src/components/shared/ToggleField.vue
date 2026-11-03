<script setup lang="ts">
withDefaults(defineProps<{ label: string, disabled?: boolean }>(), { disabled: false })
const model = defineModel<boolean>({ required: true })
</script>

<template>
  <label class="row"><input v-model="model" type="checkbox" :disabled="disabled"><span>{{ label }}</span></label>
</template>
