<script setup lang="ts">
import FallbackImage from './FallbackImage.vue'
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
  <FallbackImage loading="lazy" decoding="async" class="skill-icon" :src="src" :alt="name || MAIN_SKILLS.find(skill => skill.id === skillId)?.name || '主技能'" />
</template>
