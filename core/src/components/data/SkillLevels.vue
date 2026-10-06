<script setup lang="ts">
defineProps<{
  columns: string[]
  levels: string[][]
}>()
</script>

<template>
  <div class="skill-levels">
    <article v-for="(line, index) in levels" :key="index" class="skill-level">
      <b>Lv.{{ index + 1 }}</b>
      <div class="skill-level-cells">
        <p v-for="(cell, cellIndex) in line" :key="cellIndex">
          <span>{{ columns[cellIndex] }}</span>
          <b>{{ cell }}</b>
        </p>
      </div>
    </article>
  </div>
</template>
