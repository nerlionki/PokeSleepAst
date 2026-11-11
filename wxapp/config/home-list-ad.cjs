// WeChat-only adaptation: retain the native ad in the dex's normal layout flow.
// API: https://developers.weixin.qq.com/miniprogram/dev/component/ad-custom.html
exports.withHomeListAd = function withHomeListAd(source) {
  const anchor = '<VirtualPokedex :items="list" @pick="selected = $event" />';
  const pane =
    /\.dex-pane\s*\{[^}]*flex:\s*1;[^}]*min-height:\s*0;[^}]*display:\s*flex;[^}]*flex-direction:\s*column;[^}]*overflow:\s*hidden;[^}]*\}/;
  const fixed = /\.dex-fixed\s*\{\s*flex-shrink:\s*0;\s*\}/;
  if (!source.includes(anchor))
    throw new Error('PokedexPane ad insertion point is missing');
  if (!pane.test(source) || !fixed.test(source))
    throw new Error('PokedexPane ad overflow layout has changed');
  return (
    source
      .replace(
        '<script setup lang="ts">',
        `<script setup lang="ts">
import HomeListAd from '../../../components/HomeListAd.vue'`
      )
      .replace(
        anchor,
        `${anchor}
    <HomeListAd />`
      )
      // Keep the ad reachable when a small viewport/keyboard cannot fit both areas.
      // The virtual list keeps its own scrolling; excess height scrolls the dex pane.
      .replace(
        pane,
        `.dex-pane { flex: 1; min-height: 0; display: flex; flex-direction: column; overflow-x: hidden; overflow-y: auto; }`
      )
      .replace(
        fixed,
        `.dex-fixed { flex-shrink: 0; }\n.dex-pane > .virtual-dex-viewport { flex-shrink: 0; min-height: 120px; }`
      )
  );
};
