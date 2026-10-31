<script setup lang="ts">
import type { SpResult } from '../../calc/sp'
defineProps<{ result: SpResult }>()
</script>
<template>
  <section class="card stack" aria-live="polite">
    <h3>SP {{ result.total.toLocaleString('zh-CN') }}</h3>
    <p v-if="result.estimated" class="amber">超过当前游戏等级上限，结果为规划推算。</p>
    <p>树果 SP · {{ result.berry.toFixed(1) }}</p>
    <p>食材 SP · {{ result.ingredient.toFixed(1) }}</p>
    <p>技能 SP · {{ result.skill.toFixed(1) }}</p>
    <p class="muted">帮忙间隔 {{ result.frequency.toFixed(2) }} 秒 · 5 小时帮忙 {{ result.helps.toFixed(2) }} 次</p>
    <p class="muted">食材概率 {{ (result.ingredientRate * 100).toFixed(2) }}% · 技能概率 {{ (result.skillRate * 100).toFixed(2) }}% · SP 补正 ×{{ result.bonus.toFixed(2) }}</p>
    <p class="muted">SP 为社区模型估算。分项显示经过截断，与整数总分可能有舍入差异。</p>
  </section>
</template>
