import { afterEach, describe, expect, it, vi } from 'vitest'
import * as Vue from 'vue'
import { createRenderer, h, nextTick, reactive, type Component } from 'vue'
import { readFileSync } from 'node:fs'
import { parse, compileScript } from '@vue/compiler-sfc'
import ts from 'typescript'
import * as locks from '../../../../core/src/composables/taskNavigationLock'
import * as focus from '../../platform/progressDialogFocus'
const { handleTaskNavigationBack, taskNavigationLocked } = locks
// Compile the client template for the custom renderer; the Node test transform otherwise selects SSR.
const { descriptor } = parse(readFileSync(new URL('../../../../core/src/components/shared/ProgressDialog.vue', import.meta.url), 'utf8'))
const script = compileScript(descriptor, { id: 'progress-dialog-test', inlineTemplate: true })
const code = ts.transpileModule(script.content, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText
const exports: { default?: Component } = {}
new Function('require', 'exports', code)((name: string) => {
  if (name === 'vue') return Vue
  if (name.endsWith('taskNavigationLock')) return locks
  if (name === '#platform/progressDialogFocus') return focus
  throw new Error('Unexpected component dependency: ' + name)
}, exports)
const ProgressDialog = exports.default!

interface Node { type: string; parent: Node | null; children: Node[]; props: Record<string, unknown>; text: string }
const node = (type: string): Node => ({ type, parent: null, children: [], props: {}, text: '' })
const body = node('body')
const renderer = createRenderer<Node, Node>({
  createElement: node, createText: text => ({ ...node('text'), text }), createComment: node,
  insert(child, parent, anchor) {
    if (child.parent) child.parent.children = child.parent.children.filter(value => value !== child)
    const index = anchor ? parent.children.indexOf(anchor) : -1
    parent.children.splice(index < 0 ? parent.children.length : index, 0, child); child.parent = parent
  },
  remove(child) { if (child.parent) child.parent.children = child.parent.children.filter(value => value !== child); child.parent = null },
  setText: (element, text) => { element.text = text }, setElementText: (element, text) => { element.text = text; element.children = [] },
  parentNode: element => element.parent,
  nextSibling: element => element.parent?.children[element.parent.children.indexOf(element) + 1] ?? null,
  patchProp: (element, key, _previous, value) => { element.props[key] = value },
  querySelector: () => body,
})
function find(predicate: (value: Node) => boolean, root = body): Node | undefined {
  if (predicate(root)) return root
  for (const child of root.children) { const found = find(predicate, child); if (found) return found }
}
const cleanup: Array<() => void> = []
afterEach(() => { cleanup.splice(0).forEach(stop => stop()); body.children = []; expect(taskNavigationLocked.value).toBe(false) })
function mount(initial: { open: boolean; cancellable?: boolean; progress?: number | null }) {
  const props = reactive({ title: '业务进度', ...initial })
  const cancel = vi.fn(() => { props.open = false })
  const app = renderer.createApp({ render: () => h(ProgressDialog, { ...props, onCancel: cancel }) })
  app.directive('back', {})
  app.mount(node('root')); cleanup.push(() => app.unmount())
  return { props, cancel, app }
}
describe('shared progress dialog', () => {
  it('locks while importing, ignores Back and Escape, then unlocks when closed', async () => {
    const { props, cancel } = mount({ open: true, progress: 0 })
    await nextTick()
    expect(taskNavigationLocked.value).toBe(true)
    expect(find(value => value.type === 'button')).toBeUndefined()
    expect(handleTaskNavigationBack()).toBe(true)
    const overlay = find(value => value.props.role === 'dialog')!
    const handlers = Array.isArray(overlay.props.onKeydown) ? overlay.props.onKeydown : [overlay.props.onKeydown]
    for (const handler of handlers) handler({ key: 'Escape', preventDefault: vi.fn() })
    expect(cancel).not.toHaveBeenCalled()
    props.open = false; await nextTick()
    expect(taskNavigationLocked.value).toBe(false)
  })
  it('emits cancellation for a cancellable business and releases its lock', async () => {
    const { cancel } = mount({ open: true, cancellable: true, progress: 62 })
    await nextTick()
    const button = find(value => value.type === 'button')!
    ;(button.props.onClick as () => void)()
    await nextTick()
    expect(cancel).toHaveBeenCalledOnce()
    expect(taskNavigationLocked.value).toBe(false)
  })
  it('keeps another dialog locked when one closes or unmounts', async () => {
    const first = mount({ open: true }), second = mount({ open: true })
    first.props.open = false; await nextTick()
    expect(taskNavigationLocked.value).toBe(true)
    second.app.unmount()
    expect(taskNavigationLocked.value).toBe(false)
  })
  it('clamps determinate progress and handles unknown progress without a fake percentage', async () => {
    const { props } = mount({ open: true, progress: 150 })
    expect(find(value => value.props.role === 'progressbar')?.props['aria-valuenow']).toBe(100)
    props.progress = -1; await nextTick()
    expect(find(value => value.props.role === 'progressbar')?.props['aria-valuenow']).toBe(0)
    props.progress = Number.NaN; await nextTick()
    expect(find(value => value.props.role === 'progressbar')).toBeUndefined()
  })
})
