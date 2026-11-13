const { parse } = require('@vue/compiler-sfc')
const { parse: parseTemplate } = require('@vue/compiler-dom')

/** Native views do not implement web overflow scrolling. Keep the header outside
 * a bounded scroll-view, and keep the grid inside its natural-height content. */
exports.nativePokePickerScroll = function nativePokePickerScroll(source) {
  const template = parse(source).descriptor.template
  if (!template) throw new Error('PokePicker template is missing')
  let body
  const visit = node => {
    if (node.type === 1 && node.props.some(prop => prop.type === 6 && prop.name === 'class' && prop.value?.content.split(/\s+/).includes('picker-results'))) body = node
    for (const child of node.children ?? []) visit(child)
  }
  visit(parseTemplate(template.content))
  if (!body) throw new Error('PokePicker scroll content is missing')
  const start = template.loc.start.offset + body.loc.start.offset
  const end = template.loc.start.offset + body.loc.end.offset
  // Preserve the native scroller across renders. Use a scroll command for filter changes.
  const key = body.props.find(prop => prop.type === 7 && prop.name === 'bind' && prop.arg?.content === 'key')
  const content = key
    ? source.slice(start, template.loc.start.offset + key.loc.start.offset)
      + source.slice(template.loc.start.offset + key.loc.end.offset, end)
    : source.slice(start, end)
  return source.slice(0, start)
    + '<view class="picker-scroll-viewport"><scroll-view :scroll-y="true" :scroll-into-view="resultsRevision ? (resultsRevision % 2 ? \'picker-results-top\' : \'picker-results-start\') : undefined" class="picker-scroll">'
    + '<view id="picker-results-top" /><view id="picker-results-start" />'
    // Route asynchronous image updates through the content's own setData boundary.
    + '<custom-wrapper>' + content + '</custom-wrapper></scroll-view></view>' + source.slice(end)
    + `\n<style scoped>
.picker-scroll-viewport { flex: 1; height: 0; min-height: 0; min-width: 0; position: relative; overflow: hidden; }
.picker-scroll { position: absolute; top: 0; left: 0; width: 100%; height: 100%; }
.picker-results { flex: none; min-height: 0; overflow: visible; }
</style>\n`
}
