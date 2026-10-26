<script setup lang="ts">
import { computed, ref, useId, watch } from 'vue'
import { useColorPickerDrag } from '#platform/colorPicker'
import { colorToHsv, hsvToColor } from '../../ui/color'
import type { ColorPlaneKind, ColorPlanePosition } from '../../ui/color'
import { normalizeColor } from '../../ui/appearance'
const props = defineProps<{ modelValue: string; label: string; id?: string; open: boolean }>()
const emit = defineEmits<{ 'update:modelValue': [color: string]; 'update:open': [value: boolean] }>()
const areaId = 'color-plane-' + useId().replace(/[^\w-]/g, '-')
const hsv = ref(colorToHsv(props.modelValue))
const color = computed(() => normalizeColor(props.modelValue) ?? '#000000')
const pureHue = computed(() => hsvToColor({ hue: hsv.value.hue, saturation: 100, value: 100 }))
watch(() => props.modelValue, value => { if (normalizeColor(value) !== hsvToColor(hsv.value)) hsv.value = colorToHsv(value) })
function update() { emit('update:modelValue', hsvToColor(hsv.value)) }
function select(kind: ColorPlaneKind, position: ColorPlanePosition) {
  if (kind === 'sv') { hsv.value.saturation = position.x * 100; hsv.value.value = (1 - position.y) * 100 }
  else hsv.value.hue = position.y * 360
  update()
}
const drag = useColorPickerDrag(select)
watch(() => props.open, open => { if (!open) drag.cancel() })
function keyboard(kind: ColorPlaneKind, event: KeyboardEvent) {
  if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) return
  event.preventDefault()
  const step = event.shiftKey ? 10 : 1
  if (kind === 'hue') hsv.value.hue = Math.max(0, Math.min(360, hsv.value.hue + (event.key === 'ArrowUp' || event.key === 'ArrowLeft' ? -step : step)))
  else if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') hsv.value.saturation = Math.max(0, Math.min(100, hsv.value.saturation + (event.key === 'ArrowLeft' ? -step : step)))
  else hsv.value.value = Math.max(0, Math.min(100, hsv.value.value + (event.key === 'ArrowDown' ? -step : step)))
  update()
}
</script>
<template>
  <div class="color-picker">
    <button :id="id" type="button" class="btn ghost color-picker-trigger" :aria-label="`选择${label}颜色`" :aria-expanded="open" @click="emit('update:open', !open)">
      <span class="color-picker-swatch" :style="{ backgroundColor: color }" aria-hidden="true"></span><span>{{ color }}</span>
    </button>
    <div v-if="open" class="color-picker-panel stack" role="group" :aria-label="`${label}调色板`">
      <div class="color-picker-controls">
        <div :id="areaId + '-sv'" class="color-picker-sv" :style="{ backgroundColor: pureHue }" role="slider" tabindex="0" :aria-label="`${label}饱和度与明度`" :aria-valuenow="Math.round(hsv.saturation)" :aria-valuetext="`饱和度 ${Math.round(hsv.saturation)}%，明度 ${Math.round(hsv.value)}%`" aria-valuemin="0" aria-valuemax="100"
          @pointerdown.stop.prevent="drag.pointerDown('sv', '#' + areaId + '-sv', $event)" @pointermove="drag.pointerMove" @pointerup="drag.pointerEnd" @pointercancel="drag.cancel"
          @touchstart.stop.prevent="drag.touchStart('sv', '#' + areaId + '-sv', $event)" @touchmove.stop.prevent="drag.touchMove" @touchend="drag.touchEnd" @touchcancel="drag.cancel" @keydown="keyboard('sv', $event)">
          <span class="color-picker-cursor" :style="{ left: hsv.saturation + '%', top: (100 - hsv.value) + '%' }" aria-hidden="true"></span>
        </div>
        <div :id="areaId + '-hue'" class="color-picker-hue" role="slider" tabindex="0" :aria-label="`${label}色相`" aria-orientation="vertical" :aria-valuenow="Math.round(hsv.hue)" aria-valuemin="0" aria-valuemax="360"
          @pointerdown.stop.prevent="drag.pointerDown('hue', '#' + areaId + '-hue', $event)" @pointermove="drag.pointerMove" @pointerup="drag.pointerEnd" @pointercancel="drag.cancel"
          @touchstart.stop.prevent="drag.touchStart('hue', '#' + areaId + '-hue', $event)" @touchmove.stop.prevent="drag.touchMove" @touchend="drag.touchEnd" @touchcancel="drag.cancel" @keydown="keyboard('hue', $event)">
          <span class="color-picker-hue-cursor" :style="{ top: hsv.hue / 360 * 100 + '%' }" aria-hidden="true"></span>
        </div>
      </div>
      <div class="color-picker-footer"><span class="color-picker-value" aria-live="polite">{{ color }}</span><button type="button" class="btn ghost" @click="emit('update:open', false)">完成选色</button></div>
    </div>
  </div>
</template>
<style scoped>
.color-picker { min-width: 0; }
.color-picker-trigger { display: flex; align-items: center; gap: 8px; width: 100%; font-size: var(--font-13); font-variant-numeric: tabular-nums; }
.color-picker-swatch { width: 24px; height: 24px; border: 1px solid var(--line); border-radius: 6px; flex: none; }
.color-picker-panel { width: 100%; max-width: 360px; margin-top: 8px; padding: 12px; background: var(--ink-2); border: 1px solid var(--line); border-radius: var(--radius-control); }
.color-picker-controls { display: grid; grid-template-columns: minmax(0, 1fr) 24px; gap: 12px; }
.color-picker-sv, .color-picker-hue { height: 180px; position: relative; touch-action: none; user-select: none; -webkit-user-select: none; cursor: crosshair; }
/* Fixed white/black primaries represent the HSV gamut, independent of the app theme. */
.color-picker-sv { background-image: linear-gradient(to top, #000000, transparent), linear-gradient(to right, #ffffff, transparent); }
.color-picker-hue { background: linear-gradient(to bottom, #ff0000 0%, #ffff00 16.667%, #00ff00 33.333%, #00ffff 50%, #0000ff 66.667%, #ff00ff 83.333%, #ff0000 100%); }
.color-picker-cursor { position: absolute; width: 10px; height: 10px; border: 2px solid #ffffff; border-radius: 50%; box-shadow: 0 1px 3px #000000; transform: translate(-50%, -50%); pointer-events: none; }
.color-picker-hue-cursor { position: absolute; left: -2px; right: -2px; height: 5px; border: 1px solid #ffffff; box-shadow: 0 1px 3px #000000; transform: translateY(-50%); pointer-events: none; }
.color-picker-sv:focus-visible, .color-picker-hue:focus-visible { outline: 2px solid var(--sage); outline-offset: 3px; }
.color-picker-footer { display: flex; align-items: center; justify-content: space-between; gap: 8px; flex-wrap: wrap; }
.color-picker-value { font-size: var(--font-13); font-variant-numeric: tabular-nums; }
</style>
