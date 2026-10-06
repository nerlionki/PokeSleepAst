<script setup lang="ts" generic="T extends string">
defineProps<{
  options: { id: T, label: string }[]
}>()

const model = defineModel<T>({ required: true })
</script>

<template>
  <div class="seg" :style="{ gridTemplateColumns: `repeat(${Math.max(1, Math.min(options.length, 4))}, minmax(0, 1fr))` }">
    <button
      v-for="opt in options"
      :key="opt.id"
      type="button"
      :class="{ on: model === opt.id }"
      @click="model = opt.id"
    >
      {{ opt.label }}
    </button>
  </div>
</template>
