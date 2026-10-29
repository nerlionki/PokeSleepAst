<script setup lang="ts">
import { FEATURE_GROUPS, useFeaturesStore } from '../../stores/features'
const features = useFeaturesStore()
</script>
<template>
  <div class="stack">
    <p class="muted">关闭后隐藏对应功能 tab，已保存的数据仍会保留。</p>
    <p v-if="features.error" class="amber" role="alert">{{ features.error }}</p>
    <section v-for="group in FEATURE_GROUPS" :key="group.page" class="card stack">
      <h3>{{ group.label }}</h3>
      <label v-for="[id, label] in group.tabs" :key="id" class="row">
        <input type="checkbox" :checked="features.enabled(group.page, id)" @change="features.toggle(group.page, id)">
        {{ label }}
      </label>
    </section>
  </div>
</template>
