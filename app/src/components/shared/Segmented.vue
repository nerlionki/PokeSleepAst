<script setup lang="ts" generic="T extends string">
defineProps<{
  options: { id: T, label: string }[]
}>()

const model = defineModel<T>({ required: true })
</script>

<template>
  <div class="seg">
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
