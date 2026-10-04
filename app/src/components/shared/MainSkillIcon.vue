<script setup lang="ts">
import { computed } from 'vue'
import { MAIN_SKILLS, skillByPokedexName } from '../../calc/mainSkills'
import { mainSkillImageUrl } from '../../calc/raeImage'

const props = defineProps<{
  id?: number
  name?: string
}>()

const skillId = computed(() => {
  if (props.id) return props.id
  const name = props.name ?? ''
  const skill = MAIN_SKILLS.find((item) => item.name === name || item.aliases.includes(name)) ?? skillByPokedexName(name)
  return skill?.id
})

const src = computed(() => (skillId.value ? mainSkillImageUrl(skillId.value) : ''))
</script>

<template>
  <img v-if="src" class="skill-icon" :src="src" :alt="name || ''">
</template>
