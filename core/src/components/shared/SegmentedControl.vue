<script setup lang="ts" generic="T extends string">
withDefaults(defineProps<{
  options: readonly { id: T, label: string, disabled?: boolean }[]
  disabled?: boolean
  guideId?: string
}>(), { disabled: false })
const model = defineModel<T>({ required: true })
</script>

<template>
  <div :id="guideId" class="seg" role="group" :style="{ gridTemplateColumns: `repeat(${Math.max(1, Math.min(options.length, 4))}, minmax(0, 1fr))` }">
    <button v-for="opt in options" :key="opt.id" :id="guideId ? `${guideId}-${opt.id}` : undefined" type="button" :disabled="disabled || opt.disabled" :aria-pressed="model === opt.id" :class="{ on: model === opt.id }" @click="model = opt.id">
      {{ opt.label }}
    </button>
  </div>
</template>
