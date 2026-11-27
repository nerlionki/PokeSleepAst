<script setup lang="ts">
import Dialog from './Dialog.vue'
import { usePokemonPicker, type PokemonPickerProps } from '../../../core/src/composables/usePokemonPicker'
import { toggleChoice } from '../../../core/src/calc/multiChoice'
import HorizontalStrip from './HorizontalStrip.vue'
import WxInput from '../components/WxInput.vue'
import { t as translateUi, gameText } from './i18nFacade'

import { computed, useSlots } from 'vue'
import { INGREDIENTS, berryByType } from '../../../core/src/calc/data'
import BerryIcon from '../generated/components/shared/BerryIcon.vue'
import IngredientIcon from '../generated/components/shared/IngredientIcon.vue'
import PokeSprite from '../generated/components/shared/PokeSprite.vue'


const model = defineModel<number>({ required: true })
const props = defineProps<PokemonPickerProps>()
const emit = defineEmits<{ close: []; pick: [id: number] }>()
const slots = useSlots()
function select(id: number) {
  model.value = id
  emit('pick', id)
}

const {
  open, editing, current, q, panel, spec, type, sleep, ing, specs, types, sleeps,
  list, resultsRevision, filterOn, pick, closePicker, goBack, toggle, clearFilters
} = usePokemonPicker(props, model, select, () => Boolean(slots.editor), () => emit('close'))
const scrollTarget = computed(() => {
  if (resultsRevision.value === 0) return undefined
  return resultsRevision.value % 2 ? 'picker-results-top' : 'picker-results-start'
})
</script>

<template>
  <div>
    <button v-if="!dialogOnly" class="poke-pick" type="button" @click="open = true">
      <PokeSprite :id="current.id" :name="current.name" />
      <div class="poke-pick-txt">
        <strong>{{ props.nameOverrides?.[current.id] ?? gameText(current.name) }}</strong>
        <view class="wx-inline muted berry-name">#{{ current.id }} · <BerryIcon :name="current.berry" small />{{ gameText(current.berryType) }}</view>
      </div>
    </button>
    <Dialog v-if="open" variant="picker"
      :title="translateUi(editing ? (props.editorTitle ?? '编辑个体') : (props.title ?? '选择宝可梦'))"
      :back-label="editing ? translateUi(props.title ?? '选择宝可梦') : undefined"
      @close="closePicker" @back="goBack">
          <view v-if="editing" class="picker-scroll-viewport">
            <scroll-view :scroll-y="true" class="picker-scroll">
              <custom-wrapper><slot name="editor" :close="closePicker" /></custom-wrapper>
            </scroll-view>
          </view>
          <div v-else class="picker-body">
            <view class="stack wx-picker-controls">
            <WxInput v-model="q" class="picker-search" :placeholder="translateUi('搜索中文、英文、属性或编号')" />
            <div class="picker-filters">
              <button type="button" :class="{ on: panel === 'spec' || spec.length > 0 }" @click="toggle('spec')">{{ translateUi("定位") }}</button>
              <button type="button" :class="{ on: panel === 'type' || type.length > 0 }" @click="toggle('type')">{{ translateUi("属性") }}</button>
              <button type="button" :class="{ on: panel === 'sleep' || sleep.length > 0 }" @click="toggle('sleep')">{{ translateUi("睡眠类型") }}</button>
              <button type="button" :class="{ on: panel === 'ing' || ing.length > 0 }" @click="toggle('ing')">{{ translateUi("食材") }}</button>
              <button type="button" class="ghost" @click="clearFilters">{{ translateUi("清空筛选") }}</button>
            </div>
            <HorizontalStrip v-if="panel === 'spec'" :selection="spec"><div class="picker-opts">
              <button v-for="s in specs" :key="s" type="button" :class="{ on: s === '全部' ? !spec.length : spec.includes(s) }" @click="toggleChoice(spec, s, specs)">{{ s }}</button>
            </div></HorizontalStrip>
            <HorizontalStrip v-else-if="panel === 'type'" :selection="type"><div class="picker-opts">
              <button type="button" :class="{ on: !type.length }" @click="type = []">{{ translateUi("全部") }}</button>
              <button v-for="t in types" :key="t" type="button" :class="{ on: type.includes(t) }" @click="toggleChoice(type, t, types)">
                <BerryIcon :name="berryByType(t)?.name ?? ''" small />{{ gameText(t) }}
              </button>
            </div></HorizontalStrip>
            <HorizontalStrip v-else-if="panel === 'sleep'" :selection="sleep"><div class="picker-opts">
              <button type="button" :class="{ on: !sleep.length }" @click="sleep = []">{{ translateUi("全部") }}</button>
              <button v-for="s in sleeps" :key="s" type="button" :class="{ on: sleep.includes(s) }" @click="toggleChoice(sleep, s, sleeps)">{{ gameText(s) }}</button>
            </div></HorizontalStrip>
            <HorizontalStrip v-else-if="panel === 'ing'" :selection="ing"><div class="picker-opts">
              <button type="button" :class="{ on: !ing.length }" @click="ing = []">{{ translateUi("全部") }}</button>
              <button v-for="i in INGREDIENTS" :key="i.id" type="button" :class="{ on: ing.includes(String(i.id)) }" @click="toggleChoice(ing, String(i.id), INGREDIENTS.map(item => String(item.id)))">
                <IngredientIcon :id="i.id" :name="i.name" small />{{ gameText(i.name) }}
              </button>
            </div></HorizontalStrip>
            <p class="muted">{{ list.length }} {{ translateUi("只宝可梦") }}{{ filterOn ? " " + translateUi("· 已筛选") : " " + translateUi("· 食材按可携带种类筛选") }}</p>
            </view>
            <view class="picker-scroll-viewport">
              <scroll-view :scroll-y="true" :scroll-into-view="scrollTarget" class="picker-scroll">
                <view id="picker-results-top" />
                <view id="picker-results-start" />
                <!-- Replace the native wrapper on filters. Image updates stay inside the mounted wrapper. -->
                <custom-wrapper :key="resultsRevision">
                  <div class="picker-results wx-picker-results">
                    <div class="poke-grid">
                      <button v-for="p in list" :key="p.id + p.name" type="button" class="poke-cell" :class="{ on: p.id === model }" @click="pick(p.id)">
                        <PokeSprite :id="p.id" :name="p.name" />
                        <div class="poke-cell-details">
                          <span class="poke-cell-name">{{ props.nameOverrides?.[p.id] ?? gameText(p.name) }}</span>
                          <div class="berry-name poke-cell-berry"><BerryIcon :name="p.berry" small />{{ gameText(p.berryType) }}</div>
                        </div>
                      </button>
                    </div>
                    <p class="muted">{{ translateUi("超梦等部分种类若缺定位/食材，对应筛选不会命中。") }}</p>
                  </div>
                </custom-wrapper>
              </scroll-view>
            </view>
          </div>
      <template v-if="editing && slots.editorFooter" #footer>
        <slot name="editorFooter" :close="closePicker" />
      </template>
    </Dialog>
  </div>
</template>

<style>
.picker-scroll-viewport {
  flex: 1;
  height: 0;
  min-height: 0;
  min-width: 0;
  position: relative;
  overflow: hidden;
}

.picker-scroll {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
}

.picker-results.wx-picker-results {
  flex: none;
  min-height: 0;
  overflow: visible;
}

.wx-picker-controls {
  flex: none;
  min-width: 0;
}
</style>
