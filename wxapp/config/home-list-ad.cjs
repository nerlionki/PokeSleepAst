// WeChat-only adaptation: keep ad components and state out of the shared/App UI.
// API: https://developers.weixin.qq.com/miniprogram/dev/component/ad-custom.html
exports.withHomeListAd = function withHomeListAd(source) {
  const anchor = '<VirtualPokedex :items="list" @pick="selected = $event" />'
  if (!source.includes(anchor)) throw new Error('PokedexPane ad insertion point is missing')
  return source
    .replace('<script setup lang="ts">', `<script setup lang="ts">
import HomeListAd from '../../../components/HomeListAd.vue'
import { route as adRoute } from '../../../platform/router'
import { taskNavigationLocked as adTaskLocked } from '../../composables/taskNavigationLock'`)
    .replace(anchor, `${anchor}
    <HomeListAd :eligible="adRoute.name === 'pokemon' && !detail && panel === 'none' && !adTaskLocked" />`)
}
