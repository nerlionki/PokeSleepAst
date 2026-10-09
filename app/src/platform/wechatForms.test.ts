import * as Vue from 'vue'
import { createRenderer, defineComponent, h, nextTick, ref, type VNode } from 'vue'
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { parse, compileScript } from '@vue/compiler-sfc'
import { transpileModule, ModuleKind } from 'typescript'

function compile(name: string, modules: Record<string, unknown> = {}) {
  const file = new URL(`../../../wxapp/src/components/${name}.vue`, import.meta.url)
  const { descriptor } = parse(readFileSync(file, 'utf8'))
  const script = compileScript(descriptor, { id: name, inlineTemplate: true })
  const code = transpileModule(script.content, { compilerOptions: { module: ModuleKind.CommonJS } }).outputText
  const exports: { default?: ReturnType<typeof defineComponent> } = {}
  new Function('require', 'exports', code)((id: string) => { if (id === 'vue') return Vue; if (id in modules) return modules[id]; throw Error(id) }, exports)
  return exports.default!
}
const WxInput = compile('WxInput'), WxSelect = compile('WxSelect')

interface Element { type: string; children: Element[]; props: Record<string, unknown> }
function mount(component: ReturnType<typeof defineComponent>) {
  const root: Element = { type: 'root', children: [], props: {} }
  const parents = new WeakMap<Element, Element>()
  function remove(node: Element) {
    const parent = parents.get(node)
    if (parent) { const index = parent.children.indexOf(node); if (index >= 0) parent.children.splice(index, 1) }
    parents.delete(node)
  }
  const renderer = createRenderer<Element, Element>({
    createElement: type => ({ type, children: [], props: {} }),
    createText: text => ({ type: text, children: [], props: {} }),
    createComment: () => ({ type: 'comment', children: [], props: {} }),
    setText: (node, text) => { node.type = text }, setElementText: (node, text) => { node.type += ':' + text },
    parentNode: node => parents.get(node) ?? null,
    nextSibling: node => { const parent = parents.get(node); return parent?.children[parent.children.indexOf(node) + 1] ?? null }, remove,
    insert: (node, parent, anchor) => { remove(node); const index = anchor ? parent.children.indexOf(anchor) : -1; parent.children.splice(index < 0 ? parent.children.length : index, 0, node); parents.set(node, parent) }, patchProp: (node, key, _old, value) => { node.props[key] = value },
  })
  const app = renderer.createApp(component); app.mount(root)
  return { root, app, find(type: string) { const walk = (e: Element): Element | undefined => e.type === type ? e : e.children.map(walk).find(Boolean); return walk(root)! } }
}

describe('WeChat form value contracts', () => {
  it('preserves numeric option values and expands dynamic option groups', async () => {
    const selected = ref<unknown>(1)
    const options = ref([1, 2])
    const instance = mount(defineComponent({ setup: () => () => h(WxSelect, { modelValue: selected.value, 'onUpdate:modelValue': (value: unknown) => { selected.value = value } }, { default: () => options.value.map(value => h('option', { value }, String(value))) as VNode[] }) }))
    const picker = instance.find('picker')
    expect(picker.props.range).toEqual([{label:'1',value:1},{label:'2',value:2}])
    ;(picker.props.onChange as (e: unknown) => void)({ detail: { value: '1' } })
    expect(selected.value).toBe(2)
    options.value = [2, 3, 4]; await nextTick()
    expect((picker.props.range as unknown[]).length).toBe(3)
    instance.app.unmount()
  })

  it('turns number input into numbers and switches into booleans', () => {
    const events: unknown[] = []
    const input = mount(defineComponent({ setup: () => () => h(WxInput, { type: 'number', modelValue: 3, modelModifiers: { number: true }, 'onUpdate:modelValue': (value: unknown) => events.push(value) }) }))
    ;(input.find('input').props.onInput as (e: unknown) => void)({ detail: { value: '12.5' } })
    expect(events).toEqual([12.5]); input.app.unmount()
    const toggle = mount(defineComponent({ setup: () => () => h(WxInput, { type: 'checkbox', modelValue: false, 'onUpdate:modelValue': (value: unknown) => events.push(value) }) }))
    ;(toggle.find('switch').props.onChange as (e: unknown) => void)({ detail: { value: true } })
    expect(events[1]).toBe(true); toggle.app.unmount()
  })

  it('locks native sliders and time pickers while busy, then restores editing', async () => {
    for (const [type, tag] of [['range', 'slider'], ['time', 'picker']]) {
      const disabled = ref(true), events: unknown[] = []
      const instance = mount(defineComponent({ setup: () => () => h(WxInput, { type, disabled: disabled.value, modelValue: 20, 'onUpdate:modelValue': (value: unknown) => events.push(value) }) }))
      const control = instance.find(tag!)
      expect(control.props.disabled).toBe(true)
      ;(control.props.onChange as (e: unknown) => void)({ detail: { value: 30 } })
      expect(events).toEqual([])
      disabled.value = false; await nextTick()
      expect(control.props.disabled).toBe(false)
      ;(control.props.onChange as (e: unknown) => void)({ detail: { value: 30 } })
      expect(events).toEqual([30])
      instance.app.unmount()
    }
  })

  it('scales fractional area bonuses to the native integer slider', () => {
    const events: unknown[] = []
    const instance = mount(defineComponent({ setup: () => () => h(WxInput, { type: 'range', modelValue: 0.2, min: 0, max: 0.85, step: 0.01, 'onUpdate:modelValue': (value: unknown) => events.push(value) }) }))
    const slider = instance.find('slider')
    expect(slider.props.value).toBe(20); expect(slider.props.max).toBe(85); expect(slider.props.step).toBe(1)
    ;(slider.props.onChange as (e: unknown) => void)({ detail: { value: 35 } })
    expect(events).toEqual([0.35]); instance.app.unmount()
  })
})

describe('WeChat image request lifecycle', () => {
  it('uses cached native paths and ignores errors from a previous source', async () => {
    const source = ref('old'), errors: unknown[] = []
    let rejectOld: (cause: unknown) => void = () => {}
    const old = new Promise<string>((_resolve, reject) => { rejectOld = reject })
    const WxImage = compile('WxImage', { '../platform/images': { resolveImagePath: (src: string) => src === 'old' ? old : Promise.resolve('/user/new.png') } })
    const instance = mount(defineComponent({ setup: () => () => h(WxImage, { src:source.value, class:'sprite lg', onError:() => errors.push('error') }) }))
    source.value = 'new'; await nextTick(); await Promise.resolve(); await nextTick()
    expect(instance.find('image').props.src).toBe('/user/new.png')
    expect(instance.find('image').props.class).toBe('sprite lg')
    rejectOld(Error('late failure')); await Promise.resolve(); await nextTick()
    expect(errors).toEqual([])
    instance.app.unmount()
  })
  it('reports current loading failure to the existing image fallback', async () => {
    const errors: unknown[] = []
    const WxImage = compile('WxImage', { '../platform/images': { resolveImagePath: () => Promise.reject(Error('offline')) } })
    const instance = mount(defineComponent({ setup: () => () => h(WxImage, { src:'current', onError:() => errors.push('error') }) }))
    await Promise.resolve(); await nextTick()
    expect(errors).toEqual(['error'])
    instance.app.unmount()
  })
})
