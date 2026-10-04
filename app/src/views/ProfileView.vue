<script setup lang="ts">
import { Filesystem, Directory, Encoding } from '@capacitor/filesystem'
import { Share } from '@capacitor/share'
import { shallowRef } from 'vue'
import { exportNative, exportSdrice, parseBoxText } from '../calc/boxio'
import meta from '../data/meta.json'
import { useBoxStore } from '../stores/box'
import { useSettingsStore } from '../stores/settings'

const box = useBoxStore()
const settings = useSettingsStore()
const msg = shallowRef('')
const incoming = shallowRef('')
const mode = shallowRef<'native' | 'sdrice'>('native')

const SOURCES = [
  {
    name: 'RaenonX',
    note: '图鉴、树果与食材能量、食谱、主技能等级、性格修正、经验、活力，以及睡姿名称和各地图出没。',
    links: [
      { label: '资料站', href: 'https://pks.raenonx.cc/zh' },
      { label: '图鉴', href: 'https://pks.raenonx.cc/zh/pokedex' },
      { label: '树果', href: 'https://pks.raenonx.cc/zh/berry/info' },
      { label: '食材', href: 'https://pks.raenonx.cc/zh/ingredient/info' },
      { label: '食谱', href: 'https://pks.raenonx.cc/zh/meal' },
      { label: '主技能', href: 'https://pks.raenonx.cc/zh/mainskill/info' },
      { label: '性格', href: 'https://pks.raenonx.cc/zh/stats/nature' },
      { label: '经验', href: 'https://pks.raenonx.cc/zh/xp' },
      { label: '活力', href: 'https://pks.raenonx.cc/zh/energy' },
      { label: '睡姿名称', href: 'https://pks.raenonx.cc/zh/sleepdex/lookup' },
      { label: '各地图睡姿', href: 'https://pks.raenonx.cc/zh/map' },
      { label: '睡意之力说明', href: 'https://pks.raenonx.cc/zh/docs/view/help/sleep-styles' },
      { label: '公式备忘', href: 'https://hackmd.io/@raenonx-pokemon-sleep/ByCr_TEebx' },
    ],
  },
  {
    name: 'PokeSleepCalc',
    note: '帮忙间隔、持有上限、食材率、技能率、遇见只数，以及睡姿抽取。食材率与技能率该站注明来自 RaenonX。',
    links: [
      { label: '睡眠计算', href: 'https://sdrice.name/pokesleepcalc/zh/sleepcalc' },
      { label: '抽取实现', href: 'https://github.com/bennyhe/pokeSleepCalc' },
    ],
  },
  {
    name: '喵喵',
    note: '捕捉刷糖和糖果增强的规划对照。',
    links: [
      { label: '数据汇', href: 'https://miaomiao-sleep.pages.dev/?version=3.8.2' },
      { label: '捕捉刷糖', href: 'https://miaomiao-sleep.pages.dev/catch-planner' },
      { label: '糖果增强', href: 'https://miaomiao-sleep.pages.dev/candy-planner' },
    ],
  },
  {
    name: '官方',
    note: '午睡岛每天 150 点经验、放松券额外 450 点，以及未满 7 天领回减半。',
    links: [
      { label: '小卡比兽的午睡岛', href: 'https://www.pokemonsleep.net/zh/news/343231333934393334303030353137313236/' },
    ],
  },
] as const

async function exportBox() {
  const payload = mode.value === 'sdrice' ? exportSdrice(box.pokemon) : exportNative(box.pokemon)
  const text = JSON.stringify(payload, null, 2)
  try {
    await Filesystem.writeFile({
      path: mode.value === 'sdrice' ? 'sdrice-box.json' : 'pokesleep-box.json',
      data: text,
      directory: Directory.Cache,
      encoding: Encoding.UTF8,
    })
    const uri = await Filesystem.getUri({ path: mode.value === 'sdrice' ? 'sdrice-box.json' : 'pokesleep-box.json', directory: Directory.Cache })
    await Share.share({ title: '宝睡盒子', url: uri.uri, dialogTitle: '导出 Box' })
    msg.value = '已调起系统分享'
  }
  catch {
    await navigator.clipboard.writeText(text)
    msg.value = '已复制到剪贴板（网页回退）'
  }
}

function applyImport(replace: boolean) {
  try {
    const parsed = parseBoxText(incoming.value)
    if (replace) box.replaceAll(parsed.pokemon)
    else box.merge(parsed.pokemon)
    const label = parsed.source === 'sdrice' ? 'sdrice' : parsed.source === 'rae' ? 'RAE' : parsed.source === 'native' ? '本机' : '混合'
    msg.value = `${replace ? '覆盖' : '合并'}导入 ${parsed.pokemon.length} 只（${label}）${parsed.skipped ? `，跳过 ${parsed.skipped}` : ''}`
  }
  catch {
    msg.value = 'JSON 无法解析'
  }
}

async function wipe() {
  box.replaceAll([])
  settings.reset()
  msg.value = '已清空盒子并重置设置'
}
</script>

<template>
  <div class="stack">
    <article class="card stack">
      <h3>本机备份</h3>
      <p class="muted">可导入本机 / sdrice 盒子数组 / RAE pokebox JSON。</p>
      <div class="field">
        <label>导出格式</label>
        <select v-model="mode">
          <option value="native">本机 schemaVersion 1</option>
          <option value="sdrice">sdrice 盒子数组</option>
        </select>
      </div>
      <button class="btn" type="button" @click="exportBox">导出 Box JSON</button>
      <textarea v-model="incoming" rows="6" placeholder="粘贴本机、sdrice 或 RAE Box JSON"></textarea>
      <div class="row">
        <button class="btn sage" type="button" @click="applyImport(false)">合并导入</button>
        <button class="btn ghost" type="button" @click="applyImport(true)">覆盖导入</button>
      </div>
      <button class="btn ghost" type="button" @click="wipe">清空本机缓存 / 重置设置</button>
      <p v-if="msg" class="amber">{{ msg }}</p>
    </article>
    <article class="card">
      <p>资料版本 {{ meta.version }}</p>
      <p class="muted">图鉴 {{ meta.pokedex }} · 食谱 {{ meta.recipes }} · 营地 {{ meta.islands }}</p>
    </article>
    <article class="card stack">
      <h3>数值引用</h3>
      <p class="muted">计算在本机完成，不读取这些网站。下面是整理数值时对照过的页面。图鉴卡片上的 DPR 按星级估算，不是 RaenonX 页面上的 SPO。</p>
      <section v-for="source in SOURCES" :key="source.name" class="source-block">
        <strong>{{ source.name }}</strong>
        <p class="muted">{{ source.note }}</p>
        <p class="source-links">
          <a v-for="link in source.links" :key="link.href" :href="link.href" target="_blank" rel="noopener noreferrer">{{ link.label }}</a>
        </p>
      </section>
    </article>
  </div>
</template>
