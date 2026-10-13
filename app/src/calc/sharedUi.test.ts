import { describe, expect, it } from 'vitest'
import * as Vue from 'vue'
import { createRenderer, h, nextTick, type Component } from 'vue'
import { readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { parse, compileScript } from '@vue/compiler-sfc'
import ts from 'typescript'
import * as navigationLock from '../../../core/src/composables/taskNavigationLock'
import { acquireTaskNavigationLock } from '../../../core/src/composables/taskNavigationLock'

// Compile the client render function explicitly: these tests run with a custom
// renderer, whereas Vite's node test environment otherwise compiles SFCs for SSR.
const componentCache = new Map<string, Component>()
function loadComponent(file: string): Component {
  const path = resolve(file)
  const existing = componentCache.get(path)
  if (existing) return existing
  const { descriptor } = parse(readFileSync(path, 'utf8'), { filename: path })
  const compiled = compileScript(descriptor, { id: path, inlineTemplate: true })
  const code = ts.transpileModule(compiled.content, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText
  const exports: Record<string, any> = {}
  const require = (name: string) => {
    if (name === 'vue') return Vue
    if (name.endsWith('taskNavigationLock')) return navigationLock
    if (name.endsWith('.vue')) return { __esModule: true, default: loadComponent(resolve(dirname(path), name)) }
    throw new Error('Unexpected component dependency: ' + name)
  }
  new Function('require', 'exports', code)(require, exports)
  componentCache.set(path, exports.default)
  return exports.default
}
const shared = '../core/src/components/shared/'
const FormField = loadComponent(shared + 'FormField.vue')
const FallbackImage = loadComponent(shared + 'FallbackImage.vue')
const SegmentedControl = loadComponent(shared + 'SegmentedControl.vue')
const Segmented = loadComponent(shared + 'Segmented.vue')

interface TestNode { type: string, props: Record<string, any>, children: TestNode[], parent?: TestNode, text?: string }
const node = (type: string): TestNode => ({ type, props: {}, children: [] })
// A Vue host renderer exercises component updates/events without a browser dependency.
const renderer = createRenderer<TestNode, TestNode>({
  createElement: node,
  createText: text => ({ ...node('#text'), text }),
  createComment: text => ({ ...node('#comment'), text }),
  setText: (target, text) => { target.text = text },
  setElementText: (target, text) => { target.text = text; target.children = [] },
  patchProp: (target, key, _previous, value) => { target.props[key] = value },
  parentNode: target => target.parent ?? null,
  nextSibling: target => target.parent?.children[target.parent.children.indexOf(target) + 1] ?? null,
  insert: (target, parent, anchor) => {
    if (target.parent) target.parent.children.splice(target.parent.children.indexOf(target), 1)
    target.parent = parent
    const index = anchor ? parent.children.indexOf(anchor) : -1
    if (index < 0) parent.children.push(target)
    else parent.children.splice(index, 0, target)
  },
  remove: target => { if (target.parent) target.parent.children.splice(target.parent.children.indexOf(target), 1) },
})
function find(root: TestNode, type: string): TestNode[] {
  return [...(root.type === type ? [root] : []), ...root.children.flatMap(child => find(child, type))]
}
function mount(component: Component, props: Record<string, unknown>, slots?: Record<string, any>) {
  const root = node('root')
  const update = (patch: Record<string, unknown>) => renderer.render(h(component, { ...props, ...patch }, slots), root)
  update({})
  return { root, update, unmount: () => renderer.render(null, root) }
}

describe('shared UI contracts', () => {
  it('associates labels with unique generated IDs and supports caller IDs', () => {
    const root = node('root')
    const app = renderer.createApp({ render: () => h('section', [
      h(FormField, { label: 'Level' }, { default: ({ id }: { id: string }) => h('input', { id }) }),
      h(FormField, { label: 'Nature' }, { default: ({ id }: { id: string }) => h('select', { id }) }),
      h(FormField, { label: 'Custom', id: 'custom' }, { default: ({ id }: { id: string }) => h('input', { id }) }),
    ]) })
    app.mount(root)
    const ids = find(root, 'label').map(label => label.props.for)
    expect(new Set(ids).size).toBe(3)
    expect(ids[2]).toBe('custom')
    expect(find(root, 'input').map(input => input.props.id)).toEqual([ids[0], 'custom'])
    expect(find(root, 'select')[0]!.props.id).toBe(ids[1])
    app.unmount()
  })
  it('forwards image attrs, displays fallback on error and retries when source changes', async () => {
    let errors = 0
    const view = mount(FallbackImage, { src: 'one.png', alt: 'One', class: 'rae-icon', onError: () => errors++ }, { fallback: () => h('span', 'fallback') })
    const image = find(view.root, 'img')[0]!
    expect(image.props.class).toBe('rae-icon')
    expect(image.props.alt).toBe('One')
    image.props.onError()
    await nextTick()
    expect(find(view.root, 'img')).toHaveLength(0)
    expect(find(view.root, 'span')[0]!.text).toBe('fallback')
    expect(errors).toBe(1)
    view.update({ src: 'two.png' })
    await nextTick()
    expect(find(view.root, 'img')[0]!.props.src).toBe('two.png')
    view.unmount()
  })
  it('hides missing images and retries the same URL when resetKey changes', async () => {
    const view = mount(FallbackImage, { src: '', alt: '', resetKey: 1 })
    expect(find(view.root, 'img')).toHaveLength(0)
    view.update({ src: 'same.png' })
    await nextTick()
    find(view.root, 'img')[0]!.props.onError()
    await nextTick()
    view.update({ src: 'same.png', resetKey: 2 })
    await nextTick()
    expect(find(view.root, 'img')).toHaveLength(1)
    view.unmount()
  })
  it('exposes selected state and emits a selection without mutating options', async () => {
    const selected: string[] = []
    const options = Object.freeze([Object.freeze({ id: 'a', label: 'A' }), Object.freeze({ id: 'b', label: 'B', disabled: true }), Object.freeze({ id: 'c', label: 'C' })])
    const view = mount(SegmentedControl, { options, modelValue: 'a', 'onUpdate:modelValue': (value: string) => selected.push(value) })
    const buttons = find(view.root, 'button')
    expect(buttons[0]!.props['aria-pressed']).toBe(true)
    expect(buttons[1]!.props.disabled).toBe(true)
    buttons[2]!.props.onClick()
    expect(selected).toEqual(['c'])
    view.update({ disabled: true })
    await nextTick()
    expect(find(view.root, 'button').every(button => button.props.disabled)).toBe(true)
    view.unmount()
  })
  it('keeps navigation locking in the compatibility wrapper only', async () => {
    const props = { options: [{ id: 'a', label: 'A' }], modelValue: 'a' }
    const raw = mount(SegmentedControl, props)
    const wrapper = mount(Segmented, props)
    const release = acquireTaskNavigationLock()
    try {
      await nextTick()
      expect(find(raw.root, 'button')[0]!.props.disabled).toBeFalsy()
      expect(find(wrapper.root, 'button')[0]!.props.disabled).toBe(true)
      release()
      await nextTick()
      expect(find(wrapper.root, 'button')[0]!.props.disabled).toBeFalsy()
    } finally { release(); raw.unmount(); wrapper.unmount() }
  })
})
