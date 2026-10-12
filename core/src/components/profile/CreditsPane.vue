<script setup lang="ts">
const SOURCES = [
  {
    name: 'RaenonX',
    note: '资料与研究来源：RaenonX Pokémon Sleep 攻略及其研究团队。引用图鉴、树果与食材能量、食谱、主副技能、十项全能、性格、经验、活力、睡姿与地图资料，以及 DPR 和睡姿抽选规则；道具分类、进化道具获取途径与活动资料亦参考该站。食材率与技能率原始研究来自 RP Model。',
    links: [
      { label: '来源署名说明', href: 'https://pks.raenonx.cc/zh/docs/view/site/credits' },
      { label: '资料站', href: 'https://pks.raenonx.cc/zh' },
      { label: '图鉴', href: 'https://pks.raenonx.cc/zh/pokedex' },
      { label: '树果', href: 'https://pks.raenonx.cc/zh/berry/info' },
      { label: '食材', href: 'https://pks.raenonx.cc/zh/ingredient/info' },
      { label: '食谱', href: 'https://pks.raenonx.cc/zh/meal' },
      { label: '主技能', href: 'https://pks.raenonx.cc/zh/mainskill/info' },
      { label: '副技能', href: 'https://pks.raenonx.cc/zh/stats/subskill' },
      { label: '副技能抽选概率（研究推定）', href: 'https://pks.raenonx.cc/zh/docs/view/mechanics/subskill-probability' },
      { label: '十项全能', href: 'https://pks.raenonx.cc/zh/mainskill/info/34' },
      { label: '进化道具来源', href: 'https://pks.raenonx.cc/zh/item/source/21' },
      { label: '三周年活动资料', href: 'https://pks.raenonx.cc/zh/event/list/3rdAnniv' },
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
    name: '日文 Wiki',
    note: '副技能、养成经验、活力与持有数、薰香和哨子规则，以及末位与耗尽保底排序、跨睡眠类型抽选等机制参考。普通出现率尚未完全确定；哨子产物在取整边界附近可能与实测存在少量差异。',
    links: [
      { label: '睡姿出现场景与保底', href: 'https://wikiwiki.jp/poke_sleep/睡眠リサーチ/ねむけパワー/寝顔出現の法則' },
      { label: 'EX 营地效果与研究', href: 'https://wikiwiki.jp/poke_sleep/リサーチフィールド/EXモード' },
      { label: '跨睡眠类型验证', href: 'https://wikiwiki.jp/poke_sleep/検証/他の睡眠タイプのポケモンの出現確率' },
      { label: '睡姿图鉴', href: 'https://wikiwiki.jp/poke_sleep/寝顔図鑑' },
      { label: '副技能', href: 'https://wikiwiki.jp/poke_sleep/サブスキル' },
      { label: '等级与经验', href: 'https://wikiwiki.jp/poke_sleep/育成/レベル' },
      { label: '活力', href: 'https://wikiwiki.jp/poke_sleep/げんき' },
      { label: '持有上限', href: 'https://wikiwiki.jp/poke_sleep/最大所持数' },
      { label: '薰香', href: 'https://wikiwiki.jp/poke_sleep/どうぐ/おこう' },
      { label: '哨子规则与 EX 加成', href: 'https://wikiwiki.jp/poke_sleep/どうぐ/おてつだいホイッスル' },
    ],
  },
  {
    name: 'PokeSleepCalc',
    note: '帮忙间隔、持有上限、遇见只数与实现参考。经该站整理的食材率、技能率，原始来源为 RaenonX / RP Model。',
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
    name: 'PokéSleep Super Wiki',
    note: '进化道具的常驻兑换处资料参考。',
    links: [
      { label: '常驻兑换处', href: 'https://wiki.pokesleep.com/zht/shop' },
    ],
  },
  {
    name: 'なまけもの的实测记录',
    note: '帮手哨子产物与取整方式的实测参考。',
    links: [
      { label: '吹哨产物实测', href: 'https://namakemono289.hatenablog.com/entry/2025/12/23/011054' },
    ],
  },
  {
    name: '官方',
    note: '游戏版本更新、机制调整与活动规则的优先参考，包括等级与糖果经验、技能种子、午睡岛及三周年彩庆花活动。资料存在冲突时，按官方公告、RaenonX、Wiki 的顺序采用。',
    links: [
      { label: '游戏公告', href: 'https://www.pokemonsleep.net/zh/news/' },
      { label: '友情徽章与金色副技能规则', href: 'https://www.pokemonsleep.net/zh/news/323537323733323635393039363631363937/' },
      { label: '小卡比兽的午睡岛', href: 'https://www.pokemonsleep.net/zh/news/343231333934393334303030353137313236/' },
      { label: '官方三周年活动说明', href: 'https://www.pokemonsleep.net/news/343138353434383532363837333838363733/' },
    ],
  },
] as const

</script>
<template>
    <article class="card stack">
      <h3>数据来源与致谢</h3>
      <section v-for="source in SOURCES" :key="source.name" class="source-block">
        <strong>{{ source.name }}</strong>
        <p class="muted">{{ source.note }}</p>
        <p class="source-links">
          <a v-for="link in source.links" :key="link.href" :href="link.href" target="_blank" rel="noopener noreferrer">{{ link.label }}</a>
        </p>
      </section>
    </article>

</template>
