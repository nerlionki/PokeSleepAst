<script setup lang="ts">
import { computed } from 'vue'
import { NATURES } from '../../calc/data'
import { STAT_DOWN, STAT_LABEL, STAT_UP } from '../../calc/natureLabels'
import { textHit } from '../../calc/text'
import type { NatureStat } from '../../types'

const props = defineProps<{ q: string }>()
const list = computed(() => NATURES.filter((n) => textHit(n.name, props.q)))

function upText(stat: string | null) {
  if (!stat) return '无性格修正'
  const key = stat as NatureStat
  return `↑ ${STAT_LABEL[key]} ${STAT_UP[key]}`
}

function downText(stat: string | null) {
  if (!stat) return ''
  const key = stat as NatureStat
  return `↓ ${STAT_LABEL[key]} ${STAT_DOWN[key]}`
}
</script>

<template>
  <div>
    <div v-for="(n, i) in list" :key="n.name" class="data-row">
      <span class="data-row-lead muted">#{{ i + 1 }}</span>
      <span class="data-row-txt">
        <strong>{{ n.name }}</strong>
        <span v-if="!n.up" class="muted">无性格修正</span>
        <template v-else>
          <span class="sage">{{ upText(n.up) }}</span>
          <span v-if="n.down" class="rose">{{ downText(n.down) }}</span>
        </template>
      </span>
    </div>
  </div>
</template>
