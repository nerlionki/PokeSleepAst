<script setup lang="ts">
import clientDefaults from '../../data/client-defaults.json'

import { ref, watch } from 'vue'
import { useAppearanceStore } from '../../stores/appearance'
import { colorFields, fontSizes, themes } from '../../ui/appearance'
import type { Appearance, ColorKey, Palette } from '../../ui/appearance'
import FormField from '../shared/FormField.vue'
import ColorPicker from '../shared/ColorPicker.vue'
const components_profile_AppearancePane_config_clientDefaults = clientDefaults.modules.components_profile_AppearancePane

const appearance = useAppearanceStore()
const draft = ref<Palette>({ ...appearance.palette })
const message = ref(components_profile_AppearancePane_config_clientDefaults["messageInitial"])
const activeColor = ref<ColorKey | null>((components_profile_AppearancePane_config_clientDefaults["activeColorInitial"] as unknown as ColorKey | null))
watch(() => appearance.palette, palette => { draft.value = { ...palette } }, { deep: true })
function theme(id: Appearance['theme']) {
  message.value = ''
  void appearance.update({ ...appearance.settings, theme: id, colors: {} })
}
function fontSize(id: Appearance['fontSize']) { void appearance.update({ ...appearance.settings, fontSize: id }) }
function applyColors() {
  void appearance.update({ ...appearance.settings, colors: { ...draft.value } })
  message.value = '自定义颜色已应用。'
}
function reset() { void appearance.reset(); message.value = '已恢复默认外观。' }
</script>
<template>
  <div class="stack appearance-settings">
    <section class="card stack">
      <h3>主题</h3>
      <p class="muted appearance-hint">即时应用并保存在本机。切换主题会重置自定义颜色。</p>
      <div class="appearance-choices appearance-themes" role="group" aria-label="主题">
        <button v-for="item in themes" :key="item.id" class="btn ghost appearance-choice" :class="{ selected: appearance.settings.theme === item.id }" :aria-pressed="appearance.settings.theme === item.id" @click="theme(item.id)">
          <span class="appearance-swatches" aria-hidden="true"><span v-for="color in [item.colors.ink, item.colors.amber, item.colors.sage]" :key="color" :style="{ backgroundColor: color }"></span></span>
          {{ item.name }}
        </button>
      </div>
    </section>
    <section class="card stack">
      <h3>字号</h3>
      <div class="appearance-choices" role="group" aria-label="字号"><button v-for="item in fontSizes" :key="item.id" class="btn ghost" :class="{ selected: appearance.settings.fontSize === item.id }" :aria-pressed="appearance.settings.fontSize === item.id" @click="fontSize(item.id)">{{ item.name }}</button></div>
      <p class="muted appearance-hint">页面标题、正文、表单和按钮会按同一档位调整。</p>
    </section>
    <section class="card stack">
      <h3>自定义颜色</h3>
      <p class="muted appearance-hint">点击色块打开调色板，选好后应用。请保持文字与背景清晰可辨。</p>
      <div class="appearance-colors"><FormField v-for="field in colorFields" :key="field.key" v-slot="{ id }" :label="field.label" :class="{ 'appearance-color-expanded': activeColor === field.key }"><ColorPicker :id="id" v-model="draft[field.key]" :label="field.label" :open="activeColor === field.key" @update:open="activeColor = $event ? field.key : null" /></FormField></div>
      <button class="btn" @click="applyColors">应用自定义颜色</button>
    </section>
    <p v-if="message" role="status">{{ message }}</p>
    <p v-if="appearance.error" class="rose" role="alert">{{ appearance.error }}</p>
    <button class="btn ghost" @click="reset">恢复默认外观</button>
  </div>
</template>
<style scoped>
.appearance-hint { margin: 0; font-size: var(--font-13); line-height: 1.6; }
.appearance-choices { display: flex; flex-wrap: wrap; gap: 8px; }
.appearance-themes { display: grid; grid-template-columns: repeat(auto-fit, minmax(120px, 1fr)); }
.appearance-choices .selected { border-color: var(--amber); color: var(--amber); box-shadow: inset 0 0 0 1px var(--amber); }
.appearance-choice { display: grid; gap: 8px; min-width: 0; text-align: left; }
.appearance-swatches { display: flex; gap: 5px; }
.appearance-swatches > span { width: 22px; height: 22px; border: 1px solid var(--line); border-radius: 6px; flex: none; }
.appearance-colors { display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 12px; }
.appearance-color-expanded { grid-column: 1 / -1; }
</style>
