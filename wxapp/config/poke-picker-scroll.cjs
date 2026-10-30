const { parse } = require('@vue/compiler-sfc')
const { parse: parseTemplate } = require('@vue/compiler-dom')

/** Native views do not implement web overflow scrolling. Keep the header outside
 * a bounded scroll-view, and keep the grid inside its natural-height content. */
exports.nativePokePickerScroll = function nativePokePickerScroll(source) {
  const template = parse(source).descriptor.template
  if (!template) throw new Error('PokePicker template is missing')
  let body
  const visit = node => {
    if (node.type === 1 && node.props.some(prop => prop.type === 6 && prop.name === 'class' && prop.value?.content.split(/\s+/).includes('picker-body'))) body = node
    for (const child of node.children ?? []) visit(child)
  }
  visit(parseTemplate(template.content))
  if (!body) throw new Error('PokePicker scroll content is missing')
  const start = template.loc.start.offset + body.loc.start.offset
  const end = template.loc.start.offset + body.loc.end.offset
  const content = source.slice(start, end)
  return source.slice(0, start)
    + '<view class="picker-scroll-viewport"><scroll-view :scroll-y="true" class="picker-scroll">'
    + content + '</scroll-view></view>' + source.slice(end)
    + `\n<style scoped>
.picker-scroll-viewport { flex: 1; height: 0; min-height: 0; min-width: 0; position: relative; overflow: hidden; }
.picker-scroll { position: absolute; top: 0; left: 0; width: 100%; height: 100%; }
.picker-body { flex: none; min-height: 0; overflow: visible; }
</style>\n`
}
