import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
const require = createRequire(import.meta.url)
const { nativeScopedStyles } = require('../config/native-scoped-styles.cjs')
test('scoped CSS uses the exact classes attached to native template elements', () => {
  const source = '<template><div class="outer"><span :class="{active: on}">text</span><template v-if="on"><button>save</button></template></div></template><style scoped>.outer { display:flex; gap:10px } .outer :deep(.sprite) { width:36px } button:hover { color:red }</style>'
  const native = nativeScopedStyles(source, 'sample.vue')
  const scope = /wx-s-[a-f0-9]{10}/.exec(native)[0]
  assert.ok(native.includes('class="' + scope + ' outer"'))
  assert.ok(native.includes('<span class="' + scope + '" :class='))
  assert.ok(native.includes('<button class="' + scope + '"'))
  assert.ok(native.includes('.outer.' + scope))
  assert.ok(native.includes('.sprite'))
  assert.ok(!native.includes('data-v-'))
  assert.ok(!native.includes(':deep('))
  assert.ok(!native.includes('<style scoped'))
  assert.ok(!native.includes('<template class='))
})
test('unscoped source is untouched and scopes stay separate between components', () => {
  const plain = '<template><view /></template><style>.row { gap:10px }</style>'
  assert.equal(nativeScopedStyles(plain, 'plain.vue'), plain)
  const scoped = plain.replace('<style>', '<style scoped>')
  assert.notEqual(nativeScopedStyles(scoped, 'one.vue'), nativeScopedStyles(scoped, 'two.vue'))
})
