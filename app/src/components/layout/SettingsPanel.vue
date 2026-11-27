<script setup lang="ts">
import UiIconButton from '../../../../core/src/components/shared/UiIconButton.vue'
import RangeSlider from '#platform/RangeSlider.vue';
import TimeField from '../../../../core/src/components/shared/TimeField.vue';
import { t as translateUi } from '../../../../core/src/ui/i18n';
import { AREA_BONUS_MAX, AREA_BONUS_MAX_PERCENT } from '../../../../core/src/calc/areaBonus';
import ActivitySettings from '../../../../core/src/components/shared/ActivitySettings.vue';
import { EVENT_BONUSES } from '../../../../core/src/calc/sleep';
import FormField from '../../../../core/src/components/shared/FormField.vue';
import { MIX_OPTIONS, eventMixLabel } from '../../../../core/src/calc/sleepRules';
import { normalizeRecipeLevel, RECIPE_LEVEL_MAX } from '../../../../core/src/calc/cook';
import EnvironmentFields from '../../../../core/src/components/shared/EnvironmentFields.vue';
import { INPUT_RANGES } from '../../../../core/src/calc/inputRanges'
import { useSettingsPanel } from '../../../../core/src/composables/useSettingsPanel'

const props = defineProps<{ embedded?: boolean }>();
const emit = defineEmits<{ close: []; recipes: [] }>();
const INPUT_LIMITS = INPUT_RANGES.SettingsPanel
const {
  summary,
  store,
  settings,
  shinyUp,
  minPotSize,
  maxPotSize,
  eventMult,
  mixMode,
} = useSettingsPanel()
</script>

<template>
  <div
    v-back="props.embedded ? undefined : () => emit('close')"
    :class="props.embedded ? 'stack' : 'overlay'"
    @click.self="!props.embedded && emit('close')"
  >
    <section :class="props.embedded ? 'card stack' : 'sheet stack'">
      <div v-if="!props.embedded" class="row">
        <h2>{{ translateUi('全局设置') }}</h2>
        <UiIconButton icon="close" :label="translateUi('关闭')" @click="emit('close')" />
      </div>
      <p class="muted">{{ summary }}</p>
      <div class="row">
        <button
          class="btn ghost"
          type="button"
          @click="store.applyPreset('default')"
        >
          {{ translateUi('默认作息') }}
        </button>
        <button
          class="btn ghost"
          type="button"
          @click="store.applyPreset('ideal')"
        >
          {{ translateUi('理想满睡') }}
        </button>
      </div>
      <div class="row">
        <button
          class="btn ghost"
          type="button"
          @click="store.applyPreset('work18')"
        >
          {{ translateUi('18h 工作') }}
        </button>
        <button
          class="btn ghost"
          type="button"
          @click="store.applyPreset('helpMax')"
        >
          {{ translateUi('帮手 MAX') }}
        </button>
      </div>
      <EnvironmentFields :value="settings" @change="store.setEnvironment" />
      <FormField
        v-slot="{ id }"
        data-swipe-ignore
        @touchstart.stop
        @touchend.stop
        @touchcancel.stop
        :label="
          translateUi('营地加成 {arg1}%（上限 {arg2}%）', {
            arg1: String(Math.round(settings.areaBonus * 100)),
            arg2: String(AREA_BONUS_MAX_PERCENT)
          })
        "
        ><RangeSlider
          :id="id"
          v-model="settings.areaBonus"
          :min="INPUT_LIMITS.settings_areaBonus.min"
          :max="AREA_BONUS_MAX"
          :step="INPUT_LIMITS.settings_areaBonus.step"
      /></FormField>
      <div class="row">
        <FormField v-slot="{ id }" :label="translateUi('就寝')"
          ><TimeField :id="id" v-model="settings.sleepStart"
        /></FormField>
        <FormField v-slot="{ id }" :label="translateUi('起床')"
          ><TimeField :id="id" v-model="settings.sleepEnd"
        /></FormField>
      </div>
      <FormField v-slot="{ id }" :label="translateUi('睡眠分数')"
        ><input
          :id="id"
          v-model.number="settings.sleepScore"
          type="number"
          :min="INPUT_LIMITS.settings_sleepScore.min"
          :max="INPUT_LIMITS.settings_sleepScore.max"
      /></FormField>
      <label class="row"
        ><input v-model="settings.incense" type="checkbox" />
        {{ translateUi('回复薰香（恢复 ×2）') }}</label
      >
      <label class="row"
        ><input v-model="settings.goodCamp" type="checkbox" />
        {{ translateUi('露营券') }}</label
      >
      <label class="row"
        ><input v-model="shinyUp" type="checkbox" />
        {{ translateUi('全局闪光 UP') }}</label
      >
      <FormField
        v-slot="{ id }"
        :label="translateUi('日均技能回活力（近似，时序仍会仿真发动）')"
        ><input
          :id="id"
          v-model.number="settings.dailySkillHeal"
          type="number"
          :min="INPUT_LIMITS.settings_dailySkillHeal.min"
      /></FormField>
      <FormField v-slot="{ id }" :label="translateUi('哨子额外帮忙')"
        ><input
          :id="id"
          v-model.number="settings.whistleHelps"
          type="number"
          :min="INPUT_LIMITS.settings_whistleHelps.min"
          :max="INPUT_LIMITS.settings_whistleHelps.max"
      /></FormField>
      <FormField v-slot="{ id }" :label="translateUi('本周喜好料理')"
        ><select :id="id" v-model="settings.mealCategory">
          <option value="all">{{ translateUi('全部料理') }}</option>
          <option value="curry">{{ translateUi('咖喱、浓汤') }}</option>
          <option value="salad">{{ translateUi('沙拉') }}</option>
          <option value="dessert">{{ translateUi('点心、饮料') }}</option>
        </select></FormField
      >
      <FormField v-slot="{ id }" :label="translateUi('全局食谱等级')">
        <input
          :id="id"
          :value="normalizeRecipeLevel(settings.defaultRecipeLevel ?? 1)"
          type="number"
          :min="INPUT_LIMITS.recipeLevelOf_settings_r_name.min"
          :max="RECIPE_LEVEL_MAX"
          @change="store.setDefaultRecipeLevel(Number(($event.target as HTMLInputElement).value))"
        />
      </FormField>
      <button type="button" class="btn ghost recipe-level-entry" @click="emit('recipes')">
        <span>{{ translateUi('单独设置食谱等级') }}</span>
        <span aria-hidden="true">›</span>
      </button>
      <FormField v-slot="{ id }" :label="translateUi('锅容量')"
        ><input
          :id="id"
          v-model.number="settings.potSize"
          type="number"
          :min="minPotSize"
          :max="maxPotSize"
      /></FormField>
      <FormField v-slot="{ id }" :label="translateUi('活动倍率')"
        ><select :id="id" v-model.number="eventMult">
          <option
            v-if="!EVENT_BONUSES.some(b => b.mult === eventMult)"
            :value="eventMult"
          >
            {{ eventMult }}{{ translateUi('倍（活动）') }}
          </option>
          <option
            v-for="bonus in EVENT_BONUSES"
            :key="bonus.mult"
            :value="bonus.mult"
          >
            {{ translateUi(bonus.label) }}
          </option>
        </select></FormField
      >
      <div class="field">
        <label for="sleep-event-mix">{{
          translateUi('活动跨类型出现数量（睡姿模拟／宝宝效率）')
        }}</label>
        <select id="sleep-event-mix" v-model="mixMode">
          <option
            v-for="option in MIX_OPTIONS"
            :key="option.value"
            :value="option.value"
          >
            {{ translateUi(eventMixLabel(option.value)) }}
          </option>
        </select>
      </div>
      <p class="muted">
        {{ translateUi('活动按日期提供默认值；也可在各面板手动调整。') }}
      </p>
      <ActivitySettings />
      <FormField v-slot="{ id }" :label="translateUi('分析周期')"
        ><select :id="id" v-model="settings.period">
          <option value="day">{{ translateUi('日产') }}</option>
          <option value="week">{{ translateUi('周产') }}</option>
        </select></FormField
      >
      <button class="btn ghost" type="button" @click="store.reset()">
        {{ translateUi('恢复默认') }}
      </button>
    </section>
  </div>
</template>

<style scoped>
.recipe-level-entry {
  display: flex;
  flex-wrap: nowrap;
  align-items: center;
  justify-content: center;
  gap: 6px;
  white-space: nowrap;
}
</style>
