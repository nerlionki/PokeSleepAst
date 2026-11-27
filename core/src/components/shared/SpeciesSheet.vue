<script setup lang="ts">
import PokePicker from '#platform/PokePicker.vue'

const emit = defineEmits<{ pick: [id: number]; close: [] }>()
</script>

<template>
  <PokePicker :model-value="0" title="添加宝可梦" dialog-only
    @pick="emit('pick', $event)" @close="emit('close')" />
</template>
