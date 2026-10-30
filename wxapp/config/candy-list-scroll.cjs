const { parse } = require('@vue/compiler-sfc')
const { parse: parseTemplate } = require('@vue/compiler-dom')

exports.nativeCandyListScroll = function nativeCandyListScroll(source) {
  const template = parse(source).descriptor.template
  if (!template) throw new Error('CandyPane template is missing')
  let list
  const visit = node => {
    if (node.type === 1 && node.props.some(prop => prop.type === 6 && prop.name === 'class' && prop.value?.content.split(/\s+/).includes('candy-list'))) list = node
    for (const child of node.children ?? []) visit(child)
  }
  visit(parseTemplate(template.content))
  if (!list) throw new Error('CandyPane list is missing')
  const start = template.loc.start.offset + list.loc.start.offset
  const end = template.loc.start.offset + list.loc.end.offset
  return source.slice(0, start)
    + '<view class="candy-list-viewport"><scroll-view :scroll-y="true" class="candy-list-scroll">'
    + source.slice(start, end) + '</scroll-view></view>' + source.slice(end)
    + `\n<style scoped>
.candy-list-viewport { flex: 1; height: 0; min-height: 0; min-width: 0; position: relative; overflow: hidden; }
.candy-list-scroll { position: absolute; top: 0; left: 0; width: 100%; height: 100%; }
.candy-list { flex: none; overflow: visible; }
</style>\n`
}
