// WeChat-only adaptation: retain the native ad in the dex's normal layout flow.
// API: https://developers.weixin.qq.com/miniprogram/dev/component/ad-custom.html
exports.withHomeListAd = function withHomeListAd(source) {
  const anchor = '<VirtualPokedex :items="list" @pick="selected = $event" />'
  if (!source.includes(anchor)) throw new Error('PokedexPane ad insertion point is missing')
  if (!source.includes('.dex-pane { flex: 1; min-height: 0; display: flex; flex-direction: column; overflow: hidden; }')
    || !source.includes('.dex-fixed { flex-shrink: 0; }')) throw new Error('PokedexPane ad overflow layout has changed')
  return source
    .replace('<script setup lang="ts">', `<script setup lang="ts">
import HomeListAd from '../../../components/HomeListAd.vue'`)
    .replace(anchor, `${anchor}
    <HomeListAd />`)
    // Keep the ad reachable when a small viewport/keyboard cannot fit both areas.
    // The virtual list keeps its own scrolling; excess height scrolls the dex pane.
    .replace('.dex-pane { flex: 1; min-height: 0; display: flex; flex-direction: column; overflow: hidden; }',
      '.dex-pane { flex: 1; min-height: 0; display: flex; flex-direction: column; overflow-x: hidden; overflow-y: auto; }')
    .replace('.dex-fixed { flex-shrink: 0; }',
      '.dex-fixed { flex-shrink: 0; }\n.dex-pane > .virtual-dex-viewport { flex-shrink: 0; min-height: 120px; }')
}
