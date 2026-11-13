<script setup lang="ts">
  import { gameText, t as translateUi } from '../../ui/i18n';

  import { ANNOUNCED } from '../../calc/announcedContent';
  import clientDefaults from '../../data/client-defaults.resource';

  import { computed, ref, shallowRef } from 'vue';
  import { useRouter } from 'vue-router';
  import { skillByPokedexName } from '../../calc/mainSkills';
  import { storeToRefs } from 'pinia';
  import { BERRIES, ISLANDS, POKEDEX } from '../../calc/data';
  import {
    selectionList,
    toggleChoice,
    matchesChoice
  } from '../../calc/multiChoice';
  import { pokeHit } from '../../calc/pokeSearch';
  import { compareDex } from '../../calc/pokedexOrder';
  import { evolutionStages } from '../../calc/evolution';
  import { homeText } from '../../calc/islandMeta';
  import { useActivities } from '../../composables/useActivities';
  import {
    INGREDIENT_GATES,
    berryCount,
    friendTiers,
    ingredientColumns
  } from '../../calc/ingredients';
  import {
    mythicalSeed,
    SPECIALTY_FILTERS,
    specialtyHit,
    specialtyLabel
  } from '../../calc/specialty';
  import { useSettingsStore } from '../../stores/settings';
  import BerryIcon from '../shared/BerryIcon.vue';
  import MainSkillIcon from '../shared/MainSkillIcon.vue';
  import VirtualPokedex from './VirtualPokedex.vue';
  import DrawerSheet from '../shared/DrawerSheet.vue';
  import IngredientIcon from '../shared/IngredientIcon.vue';
  import { DISPLAY_ITEMS } from '../../calc/items';
  import FallbackImage from '../shared/FallbackImage.vue';
  import PokeSprite from '../shared/PokeSprite.vue';
  const components_pokemon_PokedexPane_config_clientDefaults =
    clientDefaults.modules.components_pokemon_PokedexPane;

  const router = useRouter();
  function showSkill(name: string) {
    const skill = skillByPokedexName(name);
    if (skill)
      void router.push({
        path: '/data',
        query: { tab: 'skill', skill: String(skill.id) }
      });
  }
  const q = shallowRef(
    components_pokemon_PokedexPane_config_clientDefaults['qInitial']
  );
  const spec = ref(
    selectionList(
      components_pokemon_PokedexPane_config_clientDefaults['specInitial']
    )
  );
  const panel = shallowRef<'none' | 'sleep' | 'berry' | 'skill'>(
    components_pokemon_PokedexPane_config_clientDefaults[
      'panelInitial'
    ] as unknown as 'none' | 'sleep' | 'berry' | 'skill'
  );
  const sleep = ref(
    selectionList(
      components_pokemon_PokedexPane_config_clientDefaults['sleepInitial']
    )
  );
  const berry = ref(
    selectionList(
      components_pokemon_PokedexPane_config_clientDefaults['berryInitial']
    )
  );
  const skill = ref(
    selectionList(
      components_pokemon_PokedexPane_config_clientDefaults['skillInitial']
    )
  );
  const selected = shallowRef<number | null>(
    components_pokemon_PokedexPane_config_clientDefaults[
      'selectedInitial'
    ] as unknown as number | null
  );
  const { settings } = storeToRefs(useSettingsStore());
  const activity = useActivities(settings, () => settings.value.island);

  const sleepTypes = computed(() => [
    '全部',
    ...new Set(POKEDEX.map(p => p.sleepType))
  ]);
  const skills = computed(() => [
    '全部',
    ...new Set(POKEDEX.map(p => p.mainSkill).filter(Boolean))
  ]);

  const knownList = computed(() =>
    POKEDEX.filter(p => {
      if (!pokeHit(p, q.value)) return false;
      if (
        spec.value.length &&
        !spec.value.some(value => specialtyHit(p.specialty, value))
      )
        return false;
      if (!matchesChoice(sleep.value, p.sleepType)) return false;
      if (!matchesChoice(berry.value, p.berry)) return false;
      if (!matchesChoice(skill.value, p.mainSkill)) return false;
      return true;
    }).map(p => ({ ...p, unknownPlaceholder: !p.mainSkill || !p.ingredients?.length })).sort(compareDex)
  );

  const announced = computed(() =>
    ANNOUNCED.pokemon
      .flatMap(p =>
        (p.nationalDex ?? p.imageId) != null
          ? [{ ...p, id: (p.nationalDex ?? p.imageId)!, unknownPlaceholder: true }]
          : []
      )
      .filter(
        p =>
          !POKEDEX.some(known => known.name === p.name || known.id === p.id) &&
          pokeHit(p, q.value) &&
          !spec.value.length &&
          matchesChoice(sleep.value, p.sleepType) &&
          !berry.value.length &&
          !skill.value.length
      )
  );
  // Display-only rows stay out of POKEDEX and all production/member selectors.
  const list = computed(() =>
    [...knownList.value, ...announced.value].sort(compareDex)
  );
  const scrollResetKey = computed(() =>
    JSON.stringify([q.value, spec.value, sleep.value, berry.value, skill.value])
  );
  const announcedDetail = computed(
    () =>
      ANNOUNCED.pokemon.find(
        p =>
          (p.nationalDex ?? p.imageId) === selected.value
      ) ?? null
  );
  const detail = computed(
    () => POKEDEX.find(p => p.id === selected.value) ?? null
  );
  const detailImageId = computed(() => detail.value?.id ?? announcedDetail.value?.imageId);
  const incomplete = computed(() => !detail.value?.mainSkill || !detail.value?.ingredients?.length);
  const detailBerry = computed(() => detail.value?.berry ?? announcedDetail.value?.berry);
  const announcedIngredient = computed(() => ANNOUNCED.ingredients.find(
    row => row.key === announcedDetail.value?.canGatherIngredientKey
  ));
  const board = computed(() => ingredientColumns(detail.value?.ingredients ?? []));
  const rate = (value?: number) => typeof value === 'number' && Number.isFinite(value) ? `${(value * 100).toFixed(1)}%` : '？';
  const speciesItems = computed(() => DISPLAY_ITEMS.filter(item =>
    selected.value !== null && item.compatiblePokemonIds?.includes(selected.value)
  ));
  const medals = computed(() => friendTiers(detail.value?.medalGroup ?? announcedDetail.value?.medalGroup));
  const stages = computed(() =>
    detail.value ? evolutionStages(detail.value.id) : []
  );
  const homes = computed(() => {
    const poke = detail.value;
    if (incomplete.value && announcedDetail.value?.islands?.length) {
      return announcedDetail.value.islands.map(id => gameText(ISLANDS.find(row => row.id === id)?.name ?? id)).join('、');
    }
    if (incomplete.value) return '？';
    if (!poke) return translateUi('资料未列');
    return homeText(poke.id, activity.context.value);
  });
  const favored = (name: string) => settings.value.berries.includes(name);

  function toggle(which: typeof panel.value) {
    panel.value = panel.value === which ? 'none' : which;
  }
  function resetFilters() {
    q.value = '';
    spec.value = [];
    sleep.value = [];
    berry.value = [];
    skill.value = [];
    panel.value = 'none';
  }
</script>

<template>
  <div class="stack dex-pane">
    <div class="row dex-fixed pokemon-search">
      <input
        v-model="q"
        class="picker-search"
        :placeholder="translateUi('搜索中文、英文或图鉴编号')"
      /><button class="btn ghost" type="button" @click="resetFilters">
        {{ translateUi('重置') }}
      </button>
    </div>
    <div class="picker-filters dex-fixed">
      <button
        v-for="s in ['全部', ...SPECIALTY_FILTERS]"
        :key="s"
        type="button"
        :class="{ on: s === '全部' ? !spec.length : spec.includes(s) }"
        @click="toggleChoice(spec, s, SPECIALTY_FILTERS)"
      >
        {{ gameText(s) }}
      </button>
      <button
        type="button"
        :class="{ on: panel === 'sleep' || sleep.length > 0 }"
        @click="toggle('sleep')"
      >
        {{ translateUi('睡眠') }}
      </button>
      <button
        type="button"
        :class="{ on: panel === 'berry' || berry.length > 0 }"
        @click="toggle('berry')"
      >
        {{ translateUi('树果') }}
      </button>
      <button
        type="button"
        :class="{ on: panel === 'skill' || skill.length > 0 }"
        @click="toggle('skill')"
      >
        {{ translateUi('主技能') }}
      </button>
    </div>
    <div v-if="panel === 'sleep'" class="picker-opts dex-fixed">
      <button
        v-for="s in sleepTypes"
        :key="s"
        type="button"
        :class="{ on: s === '全部' ? !sleep.length : sleep.includes(s) }"
        @click="toggleChoice(sleep, s, sleepTypes)"
      >
        {{ gameText(s) }}
      </button>
    </div>
    <div v-else-if="panel === 'berry'" class="picker-opts dex-fixed">
      <button type="button" :class="{ on: !berry.length }" @click="berry = []">
        {{ translateUi('全部') }}
      </button>
      <button
        v-for="b in BERRIES"
        :key="b.name"
        type="button"
        :class="{
          on: b.name === '全部' ? !berry.length : berry.includes(b.name)
        }"
        @click="
          toggleChoice(
            berry,
            b.name,
            BERRIES.map(item => item.name)
          )
        "
      >
        <BerryIcon :name="b.name" />{{ gameText(b.name) }}
      </button>
    </div>
    <div v-else-if="panel === 'skill'" class="picker-opts dex-fixed">
      <button
        v-for="s in skills"
        :key="s"
        type="button"
        :class="{ on: s === '全部' ? !skill.length : skill.includes(s) }"
        @click="toggleChoice(skill, s, skills)"
      >
        <MainSkillIcon v-if="s !== '全部'" :name="s" decorative />{{
          gameText(s)
        }}
      </button>
    </div>
    <p class="muted dex-fixed">{{ list.length }} {{ translateUi('只') }}</p>
    <VirtualPokedex :items="list" :scroll-reset-key="scrollResetKey" @pick="selected = $event" />
    <DrawerSheet
      v-if="detail || announcedDetail"
      :title="gameText(detail?.name ?? announcedDetail?.name)"
      @close="selected = null"
    >
      <div class="row">
        <PokeSprite
          v-if="detailImageId !== undefined"
          :id="detailImageId"
          :name="detail?.name ?? announcedDetail?.name"
          :unknown-placeholder="incomplete"
          large
        />
        <span v-else class="big">？</span>
        <div>
          <p class="muted">
            #{{ selected }} · {{ detail?.specialty ? gameText(specialtyLabel(detail.specialty)) : '？' }} ·
            {{ gameText(detail?.sleepType ?? announcedDetail?.sleepType) || '？' }}
          </p>
          <span v-if="detailBerry && favored(detailBerry)" class="chip"
            ><BerryIcon :name="detailBerry" small />{{ translateUi('适正') }}
            {{ gameText(detailBerry) }}</span
          >
          <span v-else-if="detailBerry" class="chip"
            ><BerryIcon :name="detailBerry" small />{{
              gameText(detailBerry)
            }}</span
          >
        </div>
      </div>
      <p>
        {{ translateUi('间隔') }} {{ detail?.interval ?? '？'
        }}{{ translateUi('s · 持有') }} {{ detail?.carry ?? announcedDetail?.carry ?? '？' }}
        {{ translateUi('· 食材') }} {{ rate(detail?.ingredientRate)
        }}{{ translateUi('% · 技能').replace(/^%/, '') }}
        {{ rate(detail?.skillRate) }}
      </p>
      <button
        type="button"
        class="btn ghost dex-skill-button"
        v-if="detail?.mainSkill"
        @click="showSkill(detail.mainSkill)"
      >
        <MainSkillIcon :name="detail.mainSkill" decorative />
        <span>{{ gameText(detail.mainSkill) }} ›</span>
      </button>
      <p v-else>{{ translateUi('主技能') }} ？</p>
      <div v-if="detailBerry" class="berry-drop">
        <BerryIcon :name="detailBerry" large />
        <strong
          >{{ gameText(detailBerry) }} ×
          {{ detail?.specialty ? berryCount(detail.specialty) : '？' }}</strong
        >
      </div>
      <p v-else>{{ translateUi('树果') }} ？</p>
      <p v-if="incomplete && announcedIngredient" class="row">
        <span>{{ translateUi('已知可收集的食材') }}</span>
        <IngredientIcon v-if="announcedIngredient.imageId" :id="announcedIngredient.imageId" :name="announcedIngredient.name" :image-file="announcedIngredient.imageFile" />
        {{ gameText(announcedIngredient.name) }}
      </p>
      <div class="ing-board">
        <section v-for="(col, i) in board" :key="i" class="ing-col">
          <h3>LV {{ INGREDIENT_GATES[i] }}</h3>
          <div class="ing-col-items">
            <span v-if="!col.length && !detail?.ingredients?.length" class="ing-token">？</span>
            <div
              v-for="cell in col"
              :key="`${cell.letter}-${cell.id}`"
              class="ing-token"
              :title="cell.name"
            >
              <span v-if="cell.letter" class="ing-letter">{{
                cell.letter
              }}</span>
              <IngredientIcon :id="cell.id" :name="cell.name" />
              <span class="ing-qty">{{ cell.amount }}</span>
            </div>
          </div>
        </section>
      </div>
      <div v-if="speciesItems.length" class="stack">
        <div v-for="item in speciesItems" :key="item.id" class="row">
          <FallbackImage v-if="item.icon" :src="item.icon" :alt="gameText(item.name)" style="width: 2rem; height: 2rem" />
          <span>{{ gameText(item.name) }}</span>
        </div>
      </div>
      <section class="evo-chain">
        <h3>{{ translateUi('进化') }}</h3>
        <div v-if="stages.length > 1" class="evo-stages">
          <template v-for="(stage, i) in stages" :key="i">
            <span v-if="i" class="evo-arrow" aria-hidden="true">↓</span>
            <div class="evo-stage">
              <button
                v-for="node in stage"
                :key="node.id"
                type="button"
                class="evo-node"
                :class="{ on: node.id === selected }"
                @click="selected = node.id"
              >
                <PokeSprite :id="node.id" :name="node.name" />
                <span>{{ gameText(node.name) }}</span>
                <em v-for="text in node.conditions" :key="text">{{
                  gameText(text)
                }}</em>
              </button>
            </div>
          </template>
        </div>
        <p v-else class="muted">{{ !incomplete ? translateUi('不会进化') : '？' }}</p>
      </section>
      <div class="friend-block">
        <p>
          {{ translateUi('友好度') }}
          <span class="rose">♥ {{ detail?.friendship ?? announcedDetail?.friendship ?? '？' }}</span>
        </p>
        <div v-if="medals.length" class="friend-tiers">
          <span
            v-for="tier in medals"
            :key="tier.level"
            class="friend-tier"
            :class="tier.tone"
          >
            <b>{{ tier.level }}</b>
            <em>{{ translateUi(tier.label) }}</em>
          </span>
        </div>
        <p v-else-if="detail?.medalGroup === null" class="muted">
          {{ translateUi('没有友情徽章，捕捉不会锁定金色副技能。') }}
        </p>
      </div>
      <p class="muted">{{ translateUi('出现：') }}{{ homes }}</p>
      <p v-if="detail && mythicalSeed(detail.id)">
        {{ translateUi('捕捉后获得') }}
        <span class="chip">{{ mythicalSeed(detail.id) }}</span>
      </p>
    </DrawerSheet>
  </div>
</template>

<style scoped>
  .dex-skill-button {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    width: 100%;
    min-height: 44px;
    padding: 8px 12px;
    line-height: 1.35;
    white-space: normal;
  }
  .dex-skill-button > span {
    min-width: 0;
    overflow-wrap: anywhere;
  }
  .dex-pane {
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }
  .dex-fixed {
    flex-shrink: 0;
  }
  .dex-pane > .picker-opts {
    max-height: 25vh;
    overflow-y: auto;
  }
  .pokemon-search {
    flex-wrap: nowrap;
  }
  .pokemon-search > .picker-search {
    flex: 1;
    min-width: 0;
    width: 0;
  }
  .pokemon-search > button {
    flex-shrink: 0;
  }
</style>
