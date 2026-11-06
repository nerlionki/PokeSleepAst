export type GuidePage = 'pokemon' | 'plan' | 'team' | 'data'

interface GuideAction { label: string; tab: string }
interface GuideSection { title: string; text: string }
interface PageGuide {
  title: string
  intro?: string
  sections: GuideSection[]
  steps?: string[]
  note?: string
  actions: GuideAction[]
}

// Reviewed onboarding copy. Keep both clients on the same wording.
export const OVERVIEW_STEPS = [
  {
    page: 'pokemon', label: '宝可梦', title: '从 Box 开始，管理你的伙伴',
    paragraphs: ['把已有宝可梦录入 Box，查看个体表现，也为配队和规划准备数据。', '可以手动新增，或导入游戏截图。截图识别后，记得核对信息。'],
  },
  {
    page: 'plan', label: '规划', title: '围绕目标，选择规划工具',
    paragraphs: ['想捕捉伙伴、刷糖或收集睡姿？试试「遇见规划」。', '想比较整觉和拆觉的收益？打开「睡眠规划」。', '准备使用糖果增强？先算算能升多少级、需要多少梦之碎片。'],
  },
  {
    page: 'team', label: '配队', title: '让 Box 帮你规划冲分',
    paragraphs: ['在「冲分规划」中设置营地、规划条件和初始库存，根据 Box 查看推荐队伍与料理策略。', '先把常用伙伴录入完整，规划才能更贴近你的实际情况。'],
  },
  {
    page: 'data', label: '资料', title: '查食谱，也看看活动礼包',
    paragraphs: ['在「食谱」查询料理所需食材和锅容量，为料理提前做准备。', '在「活动礼包」查看礼包内容，比较适合自己的选择。'],
    note: '以后可以通过「我的 → 重新查看引导」再次查看。',
  },
] as const

export const PAGE_GUIDES: Record<GuidePage, PageGuide> = {
  pokemon: {
    title: '先把伙伴放进 Box',
    intro: 'Box 是管理已有宝可梦的地方，录入的伙伴可以继续用于配队与规划。',
    sections: [],
    steps: ['打开「Box」，点击「新增宝可梦」手动录入，或点击「导入」识别游戏截图。', '核对等级、性格、副技能与食材等信息。', '查看个体表现，再带着这些伙伴尝试配队和冲分规划。'],
    note: '想查某只宝可梦的基础资料，也可以切换到「图鉴」。',
    actions: [{ label: '打开 Box', tab: 'box' }],
  },
  plan: {
    title: '从这三个工具开始',
    sections: [
      { title: '遇见规划', text: '添加捕捉、刷糖或指定睡姿目标，比较适合的营地与条件。先添加一个最想达成的目标，再查看规划结果。' },
      { title: '睡眠规划', text: '设置营地与卡比兽能量，比较整觉和拆觉的遭遇数量，并模拟研究收益，帮助安排睡眠方案。' },
      { title: '糖果增强', text: '选择增强模式，添加要培养的宝可梦，填写糖果库存和培养目标，查看预计提升与梦之碎片消耗。' },
    ],
    note: '开始计算前，请核对营地、活动与输入条件。模拟结果用于比较方案，实际收益可能不同。',
    actions: [{ label: '遇见规划', tab: 'encounter' }, { label: '睡眠规划', tab: 'sleep' }, { label: '糖果增强', tab: 'candy' }],
  },
  team: {
    title: '用 Box 规划冲分',
    intro: '「冲分规划」会根据 Box 和你填写的条件，搜索队伍与料理方案，估算规划期间的能量收益。',
    sections: [],
    steps: ['先在 Box 录入可用伙伴，核对面板信息。', '设置营地、规划条件和开始时持有的食材等库存。', '查看推荐队伍、料理策略与预计收益，作为实际安排的参考。'],
    note: '想进一步比较伙伴，也可以使用「我的队伍」和「个体对比」。',
    actions: [{ label: '打开冲分规划', tab: 'score' }],
  },
  data: {
    title: '先看食谱与活动礼包',
    sections: [
      { title: '食谱', text: '查询料理需要哪些食材、需要多大的锅，帮助确定想做的料理并提前备料。' },
      { title: '活动礼包', text: '查看活动礼包内容，结合自己的需求比较选择。' },
    ],
    note: '其他营地、树果、食材、技能和道具资料，也可以通过分类随时查阅。',
    actions: [{ label: '查看食谱', tab: 'recipe' }, { label: '查看活动礼包', tab: 'bundles' }],
  },
}
