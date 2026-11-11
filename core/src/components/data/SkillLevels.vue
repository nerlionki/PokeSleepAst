<script setup lang="ts">
  import { gameText } from '../../ui/i18n';

  defineProps<{
    columns: string[];
    levels: string[][];
  }>();
</script>

<template>
  <div class="skill-levels">
    <article v-for="(line, index) in levels" :key="index" class="skill-level">
      <b>Lv.{{ index + 1 }}</b>
      <div class="skill-level-cells">
        <p v-for="(cell, cellIndex) in line" :key="cellIndex">
          <span>{{ gameText(columns[cellIndex] ?? '') }}</span>
          <b>{{ gameText(cell) }}</b>
        </p>
      </div>
    </article>
  </div>
</template>
