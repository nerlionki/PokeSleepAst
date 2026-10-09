const { createHash } = require('node:crypto')
const { parse, compileStyle } = require('@vue/compiler-sfc')
const { parse: parseTemplate } = require('@vue/compiler-dom')

// Taro's native templates preserve class, but not Vue's data-v-* attributes.
// Give every template element a stable class and compile scoped selectors to it.
exports.nativeScopedStyles = function nativeScopedStyles(source, filename) {
  const { descriptor } = parse(source)
  if (!descriptor.styles.some(style => style.scoped)) return source
  const scope = 'wx-s-' + createHash('sha256').update(filename).digest('hex').slice(0, 10)
  const edits = []
  const visit = node => {
    if (node.type === 1 && !['template', 'slot'].includes(node.tag)) {
      const cls = node.props.find(prop => prop.type === 6 && prop.name === 'class' && prop.value)
      edits.push(cls ? { start: cls.value.loc.start.offset + 1, length: 0, value: scope + ' ' }
        : { start: node.loc.start.offset + 1 + node.tag.length, length: 0, value: ' class="' + scope + '"' })
    }
    for (const child of node.children ?? []) visit(child)
  }
  const template = descriptor.template
  if (template) {
    visit(parseTemplate(template.content))
    let content = template.content
    for (const edit of edits.sort((a, b) => b.start - a.start)) content = content.slice(0, edit.start) + edit.value + content.slice(edit.start + edit.length)
    edits.length = 0
    edits.push({ start: template.loc.start.offset, length: template.content.length, value: content })
  }
  for (const style of descriptor.styles.filter(style => style.scoped)) {
    const compiled = compileStyle({ source: style.content, filename, id: 'data-v-' + scope, scoped: true })
    if (compiled.errors.length) throw new Error('Native style compile failed: ' + filename + ': ' + compiled.errors.join(', '))
    const css = compiled.code.replaceAll('[data-v-' + scope + ']', '.' + scope)
    edits.push({ start: style.loc.start.offset, length: style.content.length, value: css })
  }
  for (const edit of edits.sort((a, b) => b.start - a.start)) source = source.slice(0, edit.start) + edit.value + source.slice(edit.start + edit.length)
  return source.replace(/(<style\b[^>]*?)\s+scoped(?=\s|>)/g, '$1')
}
