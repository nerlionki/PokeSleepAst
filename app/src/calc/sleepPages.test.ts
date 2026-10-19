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
import * as completion from '../../../core/src/calc/completionEfficiency'
import * as candyPlan from './candyPlan'
import * as sleepCandy from './sleepCandy'
import * as sleepRewards from '../../../core/src/calc/sleepRewards'
import * as train from './train'
import { useBoxStore } from '../stores/box'
import { useRosterStore } from '../../../core/src/stores/roster'
import { useSettingsStore } from '../stores/settings'
import { usePlanStore } from '../stores/plans'
import type { BabyEfficiencyOptions } from '../calc/babyEfficiency'
const captured = vi.hoisted(() => ({ options: null as Ref<BabyEfficiencyOptions> | null }))
// FormField owns the label and forwards the control slot after extraction.
// Render it instead of replacing it with the generic domain-component stub.
const fieldSource = readFileSync(new URL('../../../core/src/components/shared/FormField.vue', import.meta.url), 'utf8')
const fieldScript = compileScript(parse(fieldSource).descriptor, { id: 'FormField', inlineTemplate: true })
const fieldCode = transpileModule(fieldScript.content, { compilerOptions: { module: ModuleKind.CommonJS } }).outputText
const fieldExports: { default?: Vue.Component } = {}
new Function('require', 'exports', fieldCode)((id: string) => {
  if (id === 'vue') return Vue
  throw Error(id)
}, fieldExports)

function compilePage(name: string) {
  const source = readFileSync(new URL('../../../core/src/components/plan/' + name + '.vue', import.meta.url), 'utf8')
  const { descriptor } = parse(source)
  const script = compileScript(descriptor, { id: name, inlineTemplate: true })
  const code = transpileModule(script.content, { compilerOptions: { module: ModuleKind.CommonJS } }).outputText
  const modules: Record<string, unknown> = {
    'vue-router': { useRouter: () => ({ push: vi.fn() }) },
    '../../calc/completionEfficiency': completion,
    vue: Vue, pinia: Pinia, '../../calc/sleepRules': rules, '../../calc/sleep': sleep, '../../calc/data': data,
    '../../calc/babyEfficiency': baby, '../../calc/candyPlan': candyPlan, '../../calc/sleepCandy': sleepCandy,
    '../../calc/sleepRewards': sleepRewards, '../../calc/train': train,
    '../../stores/box': { useBoxStore }, '../../stores/roster': { useRosterStore },
    '../../stores/settings': { useSettingsStore }, '../../stores/plans': { usePlanStore },
    '../../composables/useBabyEfficiency': { useBabyEfficiency: (options: Ref<BabyEfficiencyOptions>) => {
      captured.options = options
      return { busy: ref(false), error: ref(''), notice: ref(''), result: ref(null), progress: ref({ percent: 0, evaluatedStates: 0 }), dirty: computed(() => false), calculate: vi.fn(), cancel: vi.fn() }
    } },
    '../../composables/useSleepSimulation': { useSleepSimulation: () => ({ busy: ref(false), error: ref(''), notice: ref(''), result: ref([]), progress: ref({ total: 0, completed: 0 }), calculate: vi.fn(), cancel: vi.fn(), reset: vi.fn() }) },
  }
  const exports: { default?: Vue.Component } = {}
  new Function('require', 'exports', code)((id: string) => {
    if (id.endsWith('/FormField.vue')) return { __esModule: true, default: fieldExports.default }
    if (id.endsWith('.vue')) return { __esModule: true, default: { render: () => null } }
    if (id in modules) return modules[id]
    throw Error(id)
  }, exports)
  return exports.default!
}
const SleepPane = compilePage('SleepPane'), BabyEfficiencyPane = compilePage('BabyEfficiencyPane'), TrainPane = compilePage('TrainPane')
const CompletionEfficiencyPane = compilePage('CompletionEfficiencyPane')
const renderPage = (component: Vue.Component) => { const app = createSSRApp(component); app.directive('back', {}); return renderToString(app) }
beforeEach(() => { setActivePinia(createPinia()); captured.options = null })
describe('completion target selection', () => {
  it('shows the dex empty state when all styles are collected', async () => {
    const html = await renderPage(CompletionEfficiencyPane)
    expect(html).toContain('暂无可补齐的普通睡姿')
    expect(html).toContain('前往睡姿图鉴')
    expect(html).not.toContain('计算补齐效率')
  })
  it('selects an evolved missing face and uses independent baby defaults', async () => {
    const plan = usePlanStore().plan
    plan.sleepdexExcluded = ['160-4']
    plan.babyEfficiency.eventMult = 2
    const html = await renderPage(CompletionEfficiencyPane)
    expect(html).toContain('计算补齐效率')
    expect(captured.options!.value).toMatchObject({ pokeId: 160, completionTarget: '160-4', eventMult: 1, iterations: 4000, precision: 'medium' })
    expect(html).not.toContain('优先遇到未发现睡姿')
  })
})
describe('activity switches on calculation pages', () => {
  it('renders training and the functional research incense controls without audit notes', async () => {
    expect(await renderPage(TrainPane)).toContain('经验性格')
    const html = await renderPage(SleepPane)
    expect(html).toContain('专注薰香（研究 EXP ×2）')
    expect(html).toContain('幸运薰香（研究梦碎 ×2）')
    expect(html).not.toContain('核对')
  })
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
