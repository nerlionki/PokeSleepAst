<script setup lang="ts">
import Dialog from '#platform/Dialog.vue'
import { gameText, t as translateUi } from '../../../../core/src/ui/i18n';
import ProgressDialog from '../../../../core/src/components/shared/ProgressDialog.vue';
import BoxOverview from '../../../../core/src/components/pokemon/BoxOverview.vue';
import { FILTER_CATALOG } from '../../../../core/src/calc/boxFilter';
import { toggleChoice } from '../../../../core/src/calc/multiChoice';
import { hasShiny } from '../../../../core/src/calc/raeImage';
import BerryIcon from '../../../../core/src/components/shared/BerryIcon.vue';
import IngredientIcon from '../../../../core/src/components/shared/IngredientIcon.vue';
import SpeciesSheet from '../../../../core/src/components/shared/SpeciesSheet.vue';
import PokemonPreview from '../../../../core/src/components/pokemon/PokemonPreview.vue';
import MainSkillIcon from '../../../../core/src/components/shared/MainSkillIcon.vue';
import SubskillIcon from '../../../../core/src/components/shared/SubskillIcon.vue';
import ShinyMark from '../../../../core/src/components/shared/ShinyMark.vue';
import MemberEditor from '../../../../core/src/components/team/MemberEditor.vue';
import OcrCompletionDialog from '../../../../core/src/components/pokemon/OcrCompletionDialog.vue';
import { useBoxPane } from '../../../../core/src/composables/useBoxPane'

const {
  ocrBusy,
  ocrProgress,
  overviewOpen,
  closeOverview,
  completeFromOverview,
  openOverview,
  picking,
  pickShots,
  query,
  clearFilters,
  TYPES,
  filterPanel,
  toggleFilter,
  advancedCount,
  sleepTypes,
  filtered,
  box,
  activeFilters,
  ocrMsg,
  pendingOcr,
  resumeCompletion,
  openEdit,
  removePokemon,
  pickSpecies,
  editing,
  confirmEditingField,
  save,
  completing,
  completionQueue,
  saveCompletion,
  pauseCompletion,
} = useBoxPane()
</script>

<template>
  <ProgressDialog
    :open="ocrBusy"
    :title="translateUi('正在导入 Box 截图')"
    :progress="ocrProgress.total ? ocrProgress.percent : null"
    :stage="ocrProgress.stage"
    :detail="
      ocrProgress.total
        ? translateUi('已处理 {done} / {total} 张', {
            done: ocrProgress.completed,
            total: ocrProgress.total
          })
        : ''
    "
    hint="导入完成后可切换页面，请保持当前页面。"
  />
  <BoxOverview
    v-if="overviewOpen"
    @back="closeOverview"
    @complete="completeFromOverview"
  />
  <div v-else class="stack" :inert="ocrBusy">
    <div class="row">
      <button class="btn" type="button" @click="openOverview">
        {{ translateUi('Box 概览') }}
      </button>
      <button class="btn" type="button" @click="picking = true">
        {{ translateUi('新增宝可梦') }}
      </button>
      <button class="btn" type="button" :disabled="ocrBusy" @click="pickShots">
        {{ translateUi('导入') }}
      </button>
    </div>
    <div class="row box-search">
      <input
        v-model="query.text"
        class="picker-search"
        :placeholder="translateUi('搜索昵称、中文、英文或图鉴编号')"
      />
      <button class="btn ghost" type="button" @click="clearFilters">
        {{ translateUi('重置') }}
      </button>
    </div>
    <div class="picker-filters">
      <button
        v-for="item in ['全部', ...TYPES]"
        :key="item"
        type="button"
        :class="{
          on:
            item === '全部'
              ? !query.specialty.length
              : query.specialty.includes(item)
        }"
        @click="toggleChoice(query.specialty, item, TYPES)"
      >
        {{ gameText(item) }}
      </button>
      <button
        type="button"
        :class="{ on: filterPanel === 'sleep' || query.sleepTypes.length > 0 }"
        :aria-expanded="filterPanel === 'sleep'"
        @click="toggleFilter('sleep')"
      >
        {{ translateUi('睡眠') }}
      </button>
      <button
        type="button"
        :class="{ on: filterPanel === 'berry' || query.berryType.length > 0 }"
        :aria-expanded="filterPanel === 'berry'"
        @click="toggleFilter('berry')"
      >
        {{ translateUi('树果') }}
      </button>
      <button
        type="button"
        :class="{ on: filterPanel === 'skill' || query.mainSkill.length > 0 }"
        :aria-expanded="filterPanel === 'skill'"
        @click="toggleFilter('skill')"
      >
        {{ translateUi('技能') }}
      </button>
      <button
        type="button"
        :class="{ on: filterPanel === 'advanced' || advancedCount > 0 }"
        aria-haspopup="dialog"
        @click="toggleFilter('advanced')"
      >
        {{ translateUi('更多筛选')
        }}{{ advancedCount ? ` ${advancedCount}` : '' }}
      </button>
    </div>
    <div v-if="filterPanel === 'sleep'" class="picker-opts">
      <button
        type="button"
        :class="{ on: !query.sleepTypes.length }"
        @click="query.sleepTypes = []"
      >
        {{ translateUi('全部') }}
      </button>
      <button
        v-for="item in sleepTypes"
        :key="item"
        type="button"
        :class="{ on: query.sleepTypes.includes(item) }"
        @click="toggleChoice(query.sleepTypes, item, sleepTypes)"
      >
        {{ gameText(item) }}
      </button>
    </div>
    <div v-else-if="filterPanel === 'berry'" class="picker-opts">
      <button
        type="button"
        :class="{ on: !query.berryType.length }"
        @click="query.berryType = []"
      >
        {{ translateUi('全部') }}
      </button>
      <button
        v-for="item in FILTER_CATALOG.berries"
        :key="item.name"
        type="button"
        :class="{ on: query.berryType.includes(String(item.id)) }"
        @click="
          toggleChoice(
            query.berryType,
            String(item.id),
            FILTER_CATALOG.berries.map(item => String(item.id))
          )
        "
      >
        <BerryIcon :name="item.name" />{{ gameText(item.name) }}
      </button>
    </div>
    <div v-else-if="filterPanel === 'skill'" class="picker-opts">
      <button
        type="button"
        :class="{ on: !query.mainSkill.length }"
        @click="query.mainSkill = []"
      >
        {{ translateUi('全部') }}
      </button>
      <button
        v-for="item in FILTER_CATALOG.skills"
        :key="item"
        type="button"
        :class="{ on: query.mainSkill.includes(item) }"
        @click="toggleChoice(query.mainSkill, item, FILTER_CATALOG.skills)"
      >
        <MainSkillIcon :name="item" decorative />{{ gameText(item) }}
      </button>
    </div>
    <Dialog
      v-if="filterPanel === 'advanced'"
      :title="translateUi('更多筛选')"
      @close="filterPanel = 'none'"
    >
      <h4>{{ translateUi('食材') }}</h4>
      <div class="row">
        <div class="seg">
          <button
            type="button"
            :class="{ on: query.ingredientLock === 'unlocked' }"
            @click="query.ingredientLock = 'unlocked'"
          >
            {{ translateUi('已解锁') }}
          </button>
          <button
            type="button"
            :class="{ on: query.ingredientLock === 'locked' }"
            @click="query.ingredientLock = 'locked'"
          >
            {{ translateUi('未解锁') }}
          </button>
        </div>
      </div>
      <div class="picker-opts">
        <button
          type="button"
          :class="{ on: !query.ingredients.length }"
          @click="query.ingredients = []"
        >
          {{ translateUi('全部') }}
        </button>
        <button
          v-for="item in FILTER_CATALOG.ingredients"
          :key="item.id"
          type="button"
          :class="{ on: query.ingredients.includes(String(item.id)) }"
          @click="
            toggleChoice(
              query.ingredients,
              String(item.id),
              FILTER_CATALOG.ingredients.map(item => String(item.id))
            )
          "
        >
          <IngredientIcon :id="item.id" :name="item.name" small />{{
            gameText(item.name)
          }}
        </button>
      </div>
      <h4>{{ translateUi('副技能') }}</h4>
      <div class="row">
        <div class="seg">
          <button
            type="button"
            :class="{ on: query.subskillCombine === 'and' }"
            @click="query.subskillCombine = 'and'"
          >
            {{ translateUi('并且') }}
          </button>
          <button
            type="button"
            :class="{ on: query.subskillCombine === 'or' }"
            @click="query.subskillCombine = 'or'"
          >
            {{ translateUi('或者') }}
          </button>
        </div>
        <div class="seg">
          <button
            type="button"
            :class="{ on: query.subskillLock === 'unlocked' }"
            @click="query.subskillLock = 'unlocked'"
          >
            {{ translateUi('已解锁') }}
          </button>
          <button
            type="button"
            :class="{ on: query.subskillLock === 'locked' }"
            @click="query.subskillLock = 'locked'"
          >
            {{ translateUi('未解锁') }}
          </button>
        </div>
      </div>
      <div class="picker-opts">
        <button
          type="button"
          :class="{ on: !query.subskills.length }"
          @click="query.subskills = []"
        >
          {{ translateUi('全部') }}
        </button>
        <button
          v-for="item in FILTER_CATALOG.subskills"
          :key="item.id"
          type="button"
          :class="{ on: query.subskills.includes(item.id) }"
          @click="
            toggleChoice(
              query.subskills,
              item.id,
              FILTER_CATALOG.subskills.map(item => item.id)
            )
          "
        >
          <SubskillIcon :id="item.id" decorative />{{ gameText(item.name) }}
        </button>
      </div>
    </Dialog>
    <p class="muted">
      {{ filtered.length }} / {{ box.pokemon.length }} {{ translateUi('只')
      }}{{
        activeFilters
          ? translateUi('· 已启用 {arg1} 项筛选', {
              arg1: String(activeFilters)
            })
          : ''
      }}
    </p>
    <p v-if="ocrMsg" class="amber">{{ translateUi(ocrMsg) }}</p>
    <div v-if="pendingOcr.length" class="card row">
      <span class="muted"
        >{{ pendingOcr.length }} {{ translateUi('只宝可梦有待补全字段') }}</span
      >
      <button class="btn ghost" type="button" @click="resumeCompletion()">
        {{ translateUi('继续补全') }}
      </button>
    </div>

    <div v-if="!box.pokemon.length" class="card muted">
      {{ translateUi('还没有盒子成员') }}
    </div>
    <div v-else-if="!filtered.length" class="card stack">
      <p class="muted">{{ translateUi('暂无满足条件的宝可梦') }}</p>
      <button class="btn ghost" type="button" @click="clearFilters">
        {{ translateUi('清除筛选') }}
      </button>
    </div>
    <div class="box-cards">
      <div v-for="pokemon in filtered" :key="pokemon.uid" class="card">
        <PokemonPreview :pokemon="pokemon" class="box-preview">
          <template #actions>
            <button
              v-if="pokemon.ocrMissing?.length"
              class="btn"
              type="button"
              @click="resumeCompletion(pokemon)"
            >
              {{ translateUi('补全') }}
            </button>
            <button class="btn ghost" type="button" @click="openEdit(pokemon)">
              {{ translateUi('编辑') }}
            </button>
            <button
              class="btn ghost"
              type="button"
              @click="removePokemon(pokemon.uid)"
            >
              {{ translateUi('删除') }}
            </button>
          </template>
        </PokemonPreview>
      </div>
    </div>
    <SpeciesSheet v-if="picking" @close="picking = false" @pick="pickSpecies" />
    <Dialog v-if="editing" :title="translateUi(editing.uid ? '编辑个体' : '新建个体')" @close="editing = null">
      <MemberEditor
        v-model="editing"
        :actions="false"
        :shiny="editing.shiny"
        @confirm="confirmEditingField"
      />
      <p v-if="editing.ocrMissing?.length" class="amber">
        {{ translateUi('还有') }} {{ editing.ocrMissing.length }}
        {{
          translateUi(
            '项待确认；请点选对应字段。未修改的识别占位值仍会保留待补全标记。'
          )
        }}
      </p>
      <div class="field">
        <label>{{ translateUi('名称') }}</label
        ><input
          v-model="editing.name"
          :placeholder="translateUi('留空则显示宝可梦名')"
        />
      </div>
      <label v-if="hasShiny(editing.pokeId)" class="row"
        ><input v-model="editing.shiny" type="checkbox" />
        {{ translateUi('闪光') }}<ShinyMark v-if="editing.shiny"
      /></label>
      <label class="row"
        ><input v-model="editing.napping" type="checkbox" />
        {{ translateUi('寄放午睡岛') }}</label
      >
      <template #footer>
        <button
          class="btn"
          type="button"
          :disabled="
            [151, 491].includes(editing.pokeId) &&
            editing.ingredientSlots[0] == null
          "
          @click="save"
        >
          {{ translateUi('保存') }}
        </button>
      </template>
    </Dialog>
    <OcrCompletionDialog
      v-if="completing && !editing"
      :key="completing.uid"
      :pokemon="completing"
      :remaining="completionQueue.length"
      @save="saveCompletion"
      @pause="pauseCompletion"
    />
  </div>
</template>

<style scoped>
  .box-search {
    flex-wrap: nowrap;
  }
  .box-search > .picker-search {
    flex: 1;
    min-width: 0;
    width: 0;
  }
  .box-search > button {
    flex-shrink: 0;
  }
</style>
