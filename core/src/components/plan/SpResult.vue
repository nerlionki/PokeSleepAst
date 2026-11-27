<script setup lang="ts">
import { computed } from 'vue'
import { t as translateUi } from '../../ui/i18n'
import type { SpResult } from '../../calc/sp'
const props = defineProps<{ result: SpResult }>()

const components = computed(() => {
  const { berry, ingredient, skill } = props.result
  const sum = berry + ingredient + skill
  return [
    { label: '树果 SP ·', value: berry, color: 'var(--sage)' },
    { label: '食材 SP ·', value: ingredient, color: 'var(--amber)' },
    { label: '技能 SP ·', value: skill, color: 'var(--rose)' },
  ].map(item => ({ ...item, percent: sum > 0 ? item.value / sum * 100 : 0 }))
})
</script>
<template>
  <section class="card stack" aria-live="polite">
    <h3>SP {{ result.total.toLocaleString('zh-CN') }}</h3>
    <p v-if="result.estimated" class="amber">{{ translateUi("超过当前游戏等级上限，结果为规划推算。") }}</p>
    <div class="sp-share-bar" aria-hidden="true">
      <div v-for="item in components" :key="item.label"
        :style="{ width: item.percent + '%', backgroundColor: item.color }" />
    </div>
    <p v-for="item in components" :key="item.label" class="sp-share-row">
      <span>{{ translateUi(item.label) }} {{ item.value.toFixed(1) }}</span>
      <strong>{{ item.percent.toFixed(1) }}%</strong>
    </p>
    <p class="muted">{{ translateUi("帮忙间隔") }} {{ result.frequency.toFixed(2) }} {{ translateUi("秒 · 5 小时帮忙") }} {{ result.helps.toFixed(2) }} {{ translateUi("次") }}</p>
    <p class="muted">{{ translateUi("食材概率") }} {{ (result.ingredientRate * 100).toFixed(2) }}{{ translateUi("% · 技能概率") }} {{ (result.skillRate * 100).toFixed(2) }}{{ translateUi("% · SP 补正 ×") }}{{ result.bonus.toFixed(2) }}</p>
    <p class="muted">{{ translateUi("SP 为社区模型估算。分项显示经过截断，与整数总分可能有舍入差异。") }}</p>
  </section>
</template>

<style>
.sp-share-bar {
  display: flex;
  height: 8px;
  overflow: hidden;
  border-radius: 4px;
  background: var(--line);
}

.sp-share-row {
  display: flex;
  justify-content: space-between;
  gap: 8px;
}
</style>
