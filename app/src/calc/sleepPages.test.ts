import { createSSRApp, computed, ref, type Ref } from 'vue'
import { renderToString } from '@vue/server-renderer'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import * as Vue from 'vue'
import * as Pinia from 'pinia'
import { readFileSync } from 'node:fs'
import { parse, compileScript } from '@vue/compiler-sfc'
import { transpileModule, ModuleKind } from 'typescript'
import * as rules from '../../../core/src/calc/sleepRules'
import * as sleep from './sleep'
import * as data from './data'
import * as baby from './babyEfficiency'
import * as candyPlan from './candyPlan'
import * as sleepCandy from './sleepCandy'
import { useSettingsStore } from '../stores/settings'
import { usePlanStore } from '../stores/plans'
import type { BabyEfficiencyOptions } from '../calc/babyEfficiency'
const captured = vi.hoisted(() => ({ options: null as Ref<BabyEfficiencyOptions> | null }))
function compilePage(name: string) {
  const source = readFileSync(new URL('../../../core/src/components/plan/' + name + '.vue', import.meta.url), 'utf8')
  const { descriptor } = parse(source)
  const script = compileScript(descriptor, { id: name, inlineTemplate: true })
  const code = transpileModule(script.content, { compilerOptions: { module: ModuleKind.CommonJS } }).outputText
  const modules: Record<string, unknown> = {
    vue: Vue, pinia: Pinia, '../../calc/sleepRules': rules, '../../calc/sleep': sleep, '../../calc/data': data,
    '../../calc/babyEfficiency': baby, '../../calc/candyPlan': candyPlan, '../../calc/sleepCandy': sleepCandy,
    '../../stores/settings': { useSettingsStore }, '../../stores/plans': { usePlanStore },
    '../../composables/useBabyEfficiency': { useBabyEfficiency: (options: Ref<BabyEfficiencyOptions>) => {
      captured.options = options
      return { busy: ref(false), error: ref(''), notice: ref(''), result: ref(null), progress: ref({ percent: 0, evaluatedStates: 0 }), dirty: computed(() => false), calculate: vi.fn(), cancel: vi.fn() }
    } },
    '../../composables/useSleepSimulation': { useSleepSimulation: () => ({ busy: ref(false), error: ref(''), notice: ref(''), result: ref([]), progress: ref({ total: 0, completed: 0 }), calculate: vi.fn(), cancel: vi.fn(), reset: vi.fn() }) },
  }
  const exports: { default?: Vue.Component } = {}
  new Function('require', 'exports', code)((id: string) => {
    if (id.endsWith('.vue')) return { __esModule: true, default: { render: () => null } }
    if (id in modules) return modules[id]
    throw Error(id)
  }, exports)
  return exports.default!
}
const SleepPane = compilePage('SleepPane'), BabyEfficiencyPane = compilePage('BabyEfficiencyPane')
const renderPage = (component: Vue.Component) => { const app = createSSRApp(component); app.directive('back', {}); return renderToString(app) }
beforeEach(() => { setActivePinia(createPinia()); captured.options = null })
describe('activity switches on calculation pages', () => {
  it('shows the sleep activity switch and hides calculation weights', async () => {
    const settings = useSettingsStore().settings
    settings.sleepEventMix = 'all'; settings.eventMult = 1.5
    const html = await renderPage(SleepPane)
    expect(html).toContain('活动期间遇到一些其他类型宝可梦')
    expect(html).toContain('优先遇到未发现睡姿')
    expect(html).not.toContain('权重')
    expect(html).not.toContain('中 UP ×6')
  })
  it('gates the live global amount with the page switch without losing plan parameters', async () => {
    const settings = useSettingsStore().settings, plan = usePlanStore().plan
    plan.babyEfficiency.eventMix = false
    plan.babyEfficiency.eventMult = 2
    settings.sleepEventMix = 'some'
    const html = await renderPage(BabyEfficiencyPane)
    expect(html).toContain('活动期间遇到一些其他类型宝可梦')
    expect(html).not.toContain('权重')
    expect(html).not.toContain('大 UP ×9')
    expect(captured.options!.value.eventMix).toBe('off')
    plan.babyEfficiency.eventMix = true
    expect(captured.options!.value.eventMix).toBe('some')
    settings.sleepEventMix = 'all'
    expect(captured.options!.value.eventMix).toBe('all')
    plan.babyEfficiency.eventMix = false; plan.babyEfficiency.pokeId = 173
    expect(captured.options!.value.eventMix).toBe('off')
    expect(captured.options!.value.pokeId).toBe(173)
    expect(captured.options!.value.eventMult).toBe(2)
  })
})
