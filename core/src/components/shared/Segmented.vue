<script setup lang="ts" generic="T extends string">
import { taskNavigationLocked } from '../../composables/taskNavigationLock'
import SegmentedControl from './SegmentedControl.vue'
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { useFeaturesStore } from '../../stores/features'
const props = withDefaults(defineProps<{
  options: readonly { id: T, label: string, disabled?: boolean }[]
  disabled?: boolean
}>(), { disabled: false })
const model = defineModel<T>({ required: true })
const route = useRoute()
const features = useFeaturesStore()
const visibleOptions = computed(() => props.options.filter(option => features.enabled(route.path.replace(/^\//, ''), option.id)))
</script>

<template>
  <SegmentedControl v-if="visibleOptions.length" v-model="model" :options="visibleOptions" :disabled="disabled || taskNavigationLocked" />
  <p v-else class="muted">本页功能已隐藏，可在“我的 → 功能开关”重新开启。</p>
</template>
