<script setup lang="ts">
import { computed, nextTick, onMounted, shallowRef, useTemplateRef, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import GuideScroll from '#platform/GuideScroll.vue'
import { useGuideDialog } from '#platform/guideDialog'
import { measureGuide, useGuideAnchorChanges } from '#platform/guideAnchor'
import { taskNavigationLocked } from '../../composables/taskNavigationLock'
import { useGuideStore } from '../../stores/guide'
import { useFeaturesStore } from '../../stores/features'
import { OVERVIEW_STEPS, PAGE_GUIDES, type GuidePage } from '../../ui/guide'
import { guideLayout, type GuideRect } from '../../ui/guideLayout'

const props = defineProps<{ hostPage?: string }>()
const guide = useGuideStore()
const features = useFeaturesStore()
const route = useRoute()
const router = useRouter()
const activeHost = computed(() => !props.hostPage || route.name === props.hostPage)
const overview = computed(() => guide.mode === 'overview')
const current = computed(() => OVERVIEW_STEPS[guide.step] ?? OVERVIEW_STEPS[0])
const page = computed<GuidePage>(() => overview.value ? current.value.page : guide.page)
const content = computed(() => PAGE_GUIDES[page.value])
const open = computed(() => activeHost.value && guide.mode !== null && !guide.navigating && !taskNavigationLocked.value && route.name === page.value)
const actions = computed(() => content.value.actions.filter(action => features.enabled(page.value, action.tab)))
const anchors: Record<GuidePage, readonly string[]> = {
  pokemon: ['#guide-pokemon-tabs-box', '#guide-pokemon-tabs'],
  plan: ['#guide-plan-tabs'],
  team: ['#guide-team-tabs-score', '#guide-team-tabs'],
  data: ['#guide-data-tabs'],
}
const initialTabs: Record<GuidePage, string> = { pokemon: 'box', plan: 'encounter', team: 'score', data: 'recipe' }
const layout = shallowRef(guideLayout({ width: 390, height: 720 }))
const positioned = shallowRef(false)
const visible = computed(() => open.value && positioned.value)
const panel = useTemplateRef<HTMLElement>('panel')
const { trapFocus } = useGuideDialog(visible, () => panel.value)
const close = () => { void guide.dismiss() }
let generation = 0

// Each page can have a different viewport. Never expose the previous/default
// geometry while the native page and its content are still being measured.
watch([() => guide.mode, () => guide.step, () => guide.page, () => guide.navigating, () => route.name], () => {
  generation++
  positioned.value = false
}, { flush: 'sync' })

function boxStyle(rect: GuideRect) {
  return { left: `${rect.left}px`, top: `${rect.top}px`, width: `${rect.width}px`, height: `${rect.height}px` }
}
const panelStyle = computed(() => boxStyle(layout.value.panel))
const masks = computed(() => {
  const { target: t, viewport: v } = layout.value
  if (!t) return [{ left: 0, top: 0, width: v.width, height: v.height }]
  return [
    { left: 0, top: 0, width: v.width, height: t.top },
    { left: 0, top: t.top + t.height, width: v.width, height: Math.max(0, v.height - t.top - t.height) },
    { left: 0, top: t.top, width: t.left, height: t.height },
    { left: t.left + t.width, top: t.top, width: Math.max(0, v.width - t.left - t.width), height: t.height },
  ]
})

async function refresh(reveal = false) {
  const token = ++generation
  if (!open.value) return
  await nextTick()
  const measured = await measureGuide(anchors[page.value], reveal)
  if (token !== generation || !open.value) return
  layout.value = guideLayout(measured)
  if (!positioned.value) {
    // Re-measure at the final constrained width before revealing the popover,
    // so line wrapping cannot cause a visible expansion on the next frame.
    await nextTick()
    const settled = await measureGuide(anchors[page.value])
    if (token !== generation || !open.value) return
    layout.value = guideLayout(settled)
    await nextTick()
    if (token === generation && open.value) positioned.value = true
  }
}
async function synchronize() {
  if (!activeHost.value || !guide.mode || guide.navigating || taskNavigationLocked.value) return
  const tab = initialTabs[page.value]
  const selectedTab = features.enabled(page.value, tab) ? tab : undefined
  if (overview.value && (route.name !== page.value || (selectedTab && route.query.tab !== selectedTab))) {
    guide.navigating = true
    try { await router.push({ name: page.value, query: selectedTab ? { tab: selectedTab } : {} }) }
    catch { close(); guide.error = '引导页面无法打开，请稍后重新查看。' }
    finally { guide.navigating = false }
    return
  }
  await refresh(true)
}
watch([activeHost, () => guide.mode, () => guide.step, () => guide.page, () => guide.navigating, () => features.hidden, taskNavigationLocked], () => { void synchronize() }, { flush: 'post' })
// A native tab change is an intentional exit; tour-driven page changes keep the tour alive.
watch(() => route.name, (value, previous) => {
  if (activeHost.value && previous && value !== previous && guide.mode && !guide.navigating) close()
}, { flush: 'sync' })
useGuideAnchorChanges(() => { void refresh() })
onMounted(async () => {
  await features.hydrate().catch(() => {})
  await guide.initialize()
  void synchronize()
})
function next() {
  if (guide.step < OVERVIEW_STEPS.length - 1) guide.step++
  else close()
}
function navigate(tab: string) {
  if (!features.enabled(page.value, tab) || taskNavigationLocked.value) return
  const destination = page.value
  close()
  void router.push({ name: destination, query: { tab } })
}
</script>

<template>
  <Teleport to="body">
    <div v-if="open" v-back="close" class="guide-tour" :style="{ visibility: positioned ? 'visible' : 'hidden' }" @touchstart.stop @touchend.stop @touchcancel.stop @keydown.esc.prevent="close">
      <div class="guide-blocker" @click="close" @touchmove.prevent />
      <div v-for="(mask, index) in masks" :key="index" class="guide-mask" :style="boxStyle(mask)" aria-hidden="true" />
      <div v-if="layout.target" class="guide-highlight" :style="boxStyle(layout.target)" aria-hidden="true" />
      <div v-if="layout.side !== 'none'" class="guide-arrow" :style="{ left: `${layout.panel.left + layout.arrowLeft - 7}px`, top: `${layout.side === 'bottom' ? layout.panel.top - 7 : layout.panel.top + layout.panel.height - 7}px` }" aria-hidden="true" />
      <section ref="panel" class="guide-popover" :style="panelStyle" role="dialog" aria-modal="true" aria-label="使用引导" tabindex="-1" @keydown.tab="trapFocus">
        <header class="guide-header">
          <span v-if="overview" class="guide-progress" aria-live="polite">{{ guide.step + 1 }} / {{ OVERVIEW_STEPS.length }} · {{ current.label }}</span>
          <button v-else class="guide-link" type="button" @click="guide.openOverview()">功能总览</button>
          <button class="guide-skip" type="button" aria-label="跳过引导" @click="close">跳过</button>
        </header>
        <div class="guide-viewport">
          <GuideScroll :key="overview ? guide.step : page">
            <div id="guide-tour-content" class="guide-content">
              <template v-if="overview">
                <h2>{{ current.title }}</h2>
                <p v-for="paragraph in current.paragraphs" :key="paragraph">{{ paragraph }}</p>
                <p v-if="'note' in current" class="guide-return-note">{{ current.note }}</p>
              </template>
              <template v-else>
                <h2>{{ content.title }}</h2>
                <p v-if="content.intro">{{ content.intro }}</p>
                <ol v-if="content.steps" class="guide-steps"><li v-for="text in content.steps" :key="text">{{ text }}</li></ol>
                <section v-for="section in content.sections" :key="section.title" class="guide-section"><h3>{{ section.title }}</h3><p>{{ section.text }}</p></section>
                <p v-if="content.note" class="guide-note">{{ content.note }}</p>
                <div v-if="actions.length" class="guide-actions"><button v-for="action in actions" :key="action.tab" type="button" class="guide-button" @click="navigate(action.tab)">{{ action.label }}</button></div>
              </template>
            </div>
          </GuideScroll>
        </div>
        <footer class="guide-footer">
          <template v-if="overview">
            <button v-if="guide.step > 0" class="guide-button" type="button" @click="guide.step--">上一步</button>
            <button class="guide-button guide-primary" type="button" @click="next">{{ guide.step === OVERVIEW_STEPS.length - 1 ? '开始使用' : '下一步' }}</button>
          </template>
          <button v-else class="guide-button guide-primary" type="button" @click="close">知道了</button>
        </footer>
      </section>
    </div>
  </Teleport>
</template>

<style scoped>
.guide-tour { position: fixed; inset: 0; z-index: 100; color: var(--text); }
.guide-blocker { position: absolute; inset: 0; }
.guide-mask { position: absolute; pointer-events: none; background: var(--overlay); }
.guide-highlight { position: absolute; pointer-events: none; border: 2px solid var(--sage); box-sizing: border-box; border-radius: 8px; }
.guide-arrow { position: absolute; pointer-events: none; width: 14px; height: 14px; background: var(--card); transform: rotate(45deg); }
.guide-popover { position: absolute; display: flex; flex-direction: column; min-width: 0; max-width: calc(100vw - 32px); max-height: calc(100vh - 32px); background: var(--card); color: var(--text); border-radius: 8px; box-shadow: var(--shadow); box-sizing: border-box; text-align: left; overflow: hidden; font-size: var(--font-14, 14px); }
.guide-popover:focus { outline: none; }
.guide-header { flex-shrink: 0; display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 8px 12px 4px 16px; min-height: 44px; box-sizing: border-box; }
.guide-progress { color: var(--muted); font-size: var(--font-12, 12px); }
.guide-link, .guide-skip { border: 0; background: transparent; color: var(--muted); font: inherit; padding: 8px 4px; min-height: 44px; }
.guide-skip { padding-left: 12px; padding-right: 8px; }
.guide-viewport { flex: 1; height: 0; min-height: 0; min-width: 0; }
.guide-content { padding: 4px 16px 16px; line-height: 1.7; overflow-wrap: anywhere; }
.guide-content h2 { margin: 0 0 12px; font-size: var(--font-18, 18px); line-height: 1.4; color: var(--text); }
.guide-content p { margin: 0 0 12px; }
.guide-content p:last-child { margin-bottom: 0; }
.guide-return-note { padding: 10px 12px; background: var(--ink-2); border-radius: 6px; color: var(--text); }
.guide-steps { margin: 0 0 16px; padding-left: 22px; }
.guide-steps > li { margin-bottom: 10px; }
.guide-section { margin-bottom: 16px; }
.guide-section h3 { margin: 0 0 4px; font-size: inherit; font-weight: 700; }
.guide-note { color: var(--muted); }
.guide-actions { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 16px; }
.guide-footer { flex-shrink: 0; display: flex; align-items: center; justify-content: flex-end; gap: 8px; padding: 10px 16px; border-top: 1px solid var(--line); }
.guide-button { margin: 0; min-height: 40px; padding: 8px 12px; border: 1px solid var(--line); border-radius: 5px; background: var(--ink-2); color: var(--text); font: inherit; line-height: 1.4; }
.guide-primary { border-color: var(--sage); background: var(--sage); color: var(--on-sage); font-weight: 600; }
.guide-button:disabled { opacity: 0.4; }
.guide-popover button:focus-visible { outline: 2px solid var(--sage); outline-offset: 2px; }
</style>
