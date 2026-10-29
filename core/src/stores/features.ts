import { defineStore } from 'pinia'
import { ref } from 'vue'
import { loadJson, saveJson } from '../storage'

export const FEATURE_GROUPS = [
  { page: 'pokemon', label: '宝可梦', tabs: [['dex', '图鉴'], ['box', 'Box'], ['wall', '睡姿图鉴']] },
  { page: 'plan', label: '规划', tabs: [['catch', '捕捉刷糖'], ['sleep', '睡眠规划'], ['split', '目标拆觉'], ['baby', '宝宝效率'], ['completion', '补齐效率'], ['candy', '糖果增强'], ['train', '培养规划'], ['whistle', '吹哨规划']] },
  { page: 'team', label: '配队', tabs: [['team', '我的队伍'], ['cmp', '个体对比'], ['score', '冲分规划']] },
  { page: 'data', label: '资料', tabs: [['island', '营地'], ['berry', '树果'], ['ing', '食材'], ['recipe', '食谱'], ['skill', '技能'], ['nature', '性格'], ['pot', '锅容量'], ['item', '道具'], ['flower', '彩庆花']] },
] as const
export const useFeaturesStore = defineStore('features', () => {
  const hidden = ref<string[]>([])
  const error = ref('')
  let loading: Promise<void> | undefined
  let saving = Promise.resolve()
  const enabled = (page: string, tab: string) => !hidden.value.includes(`${page}/${tab}`)
  function hydrate() {
    return loading ??= loadJson<unknown>('features', []).then(value => {
      hidden.value = Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : []
    }).catch(cause => { loading = undefined; throw cause })
  }
  function toggle(page: string, tab: string) {
    const key = `${page}/${tab}`
    hidden.value = enabled(page, tab) ? [...hidden.value, key] : hidden.value.filter(item => item !== key)
    const snapshot = [...hidden.value]
    saving = saving.then(() => saveJson('features', snapshot)).then(() => { error.value = '' }, () => { error.value = '设置未能保存，请重试。' })
  }
  return { hidden, error, enabled, hydrate, toggle }
})
