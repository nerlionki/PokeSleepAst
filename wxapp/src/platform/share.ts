import Taro from '@tarojs/taro'
import { t } from '../../../core/src/ui/i18n'
import { commitPageQuery, route } from './router'

/** 五个 tab 页各自注册。Taro 不会把 app.ts 里的分享函数套到全部页面上。 */
export type SharePage = 'pokemon' | 'plan' | 'team' | 'data' | 'profile'

const COVER = '/assets/tabbar/pokemon-selected.png'
const HOME: SharePage = 'pokemon'
const LEGACY = new Set(['catch', 'baby', 'completion'])
const PLAN = new Set(['encounter', 'sleep', 'split', 'candy', 'train', 'whistle', 'sp'])
const DATA = new Set(['island', 'berry', 'ing', 'recipe', 'skill', 'nature', 'pot', 'item', 'flower', 'bundles', 'calendar'])

export function isPrivateSharePage(page: string) {
  return page === 'team' || page === 'profile'
}

function weapp() {
  return Taro.getEnv() === Taro.ENV_TYPE.WEAPP
}

export function isSinglePageMode() {
  if (!weapp()) return false
  try {
    const enter = Taro.getEnterOptionsSync()
    return enter.scene === 1154 || enter.apiCategory === 'browseOnly'
  } catch {
    return false
  }
}

function token(value: unknown) {
  const text = typeof value === 'number' && Number.isSafeInteger(value) ? String(value) : value
  if (typeof text !== 'string') return
  const trimmed = text.trim()
  if (!trimmed || trimmed.length > 32 || /[^a-zA-Z0-9_-]/.test(trimmed)) return
  return trimmed
}

function readRaw(raw: Record<string, unknown> | undefined) {
  const query: Record<string, string> = {}
  if (!raw) return query
  for (const key in raw) {
    if (key === '$taroTimestamp' || key === 'stamp') continue
    const name = token(key)
    const value = token(raw[key])
    if (name && value) query[name] = value
  }
  return query
}

function liveQuery(page: SharePage) {
  return route.name === page ? readRaw(route.query) : {}
}

function publicTarget(page: SharePage, current: Record<string, string>) {
  if (page === 'pokemon') return { page, query: { tab: current.tab === 'wall' ? 'wall' : 'dex' } }
  if (page === 'plan') {
    if (current.tab && LEGACY.has(current.tab)) {
      return { page, query: { tab: 'encounter', encounterVersion: 'legacy', legacyTab: current.tab } }
    }
    const tab = current.tab && PLAN.has(current.tab) ? current.tab : 'sleep'
    const query: Record<string, string> = { tab }
    if (tab === 'encounter' && current.encounterVersion === 'legacy') {
      query.encounterVersion = 'legacy'
      if (current.legacyTab && LEGACY.has(current.legacyTab)) query.legacyTab = current.legacyTab
    }
    return { page, query }
  }
  if (page === 'data') {
    const tab = current.tab && DATA.has(current.tab) ? current.tab : 'island'
    const query: Record<string, string> = { tab }
    if (tab === 'skill' && current.skill && /^\d{1,6}$/.test(current.skill)) query.skill = current.skill
    return { page, query }
  }
  return { page: HOME, query: { tab: 'dex' } }
}

function entryQuery(page: SharePage, raw: Record<string, unknown> | undefined) {
  if (isPrivateSharePage(page)) return {}
  const share = publicTarget(page, readRaw(raw))
  return share.page === page ? share.query : {}
}

function shareTitle(page: SharePage, query: Record<string, string>) {
  if (page === 'pokemon') return t(query.tab === 'wall' ? '睡姿图鉴 - 宝睡助手' : '宝可梦图鉴 - 宝睡助手')
  if (page === 'plan') return t('规划 - 宝睡助手')
  if (page === 'data') return t(query.tab === 'skill' ? '主技能资料 - 宝睡助手' : '资料 - 宝睡助手')
  return t('宝睡助手')
}

function queryString(query: Record<string, string>) {
  let out = ''
  for (const key in query) {
    if (out) out += '&'
    out += encodeURIComponent(key) + '=' + encodeURIComponent(query[key])
  }
  return out
}

function resolveShare(page: SharePage) {
  return publicTarget(page, liveQuery(page))
}

export function buildShareAppMessage(page: SharePage) {
  const share = resolveShare(page)
  const query = queryString(share.query)
  const path = '/pages/' + share.page + '/index'
  return { title: shareTitle(share.page, share.query), path: query ? path + '?' + query : path, imageUrl: COVER }
}

export function buildShareTimeline(page: SharePage) {
  const share = resolveShare(page)
  // 朋友圈不能改路径。私密页只保留公开标题和现有图标。
  if (share.page !== page) return { title: t('宝睡助手'), imageUrl: COVER }
  const query = queryString(share.query)
  return query ? { title: shareTitle(page, share.query), query, imageUrl: COVER } : { title: shareTitle(page, share.query), imageUrl: COVER }
}

function enableShareMenus() {
  if (!weapp()) return
  void Taro.showShareMenu({ showShareItems: ['shareAppMessage', 'shareTimeline'] }).catch(() => {})
}

export function createPageShare(page: SharePage) {
  return {
    onLoad(options?: Record<string, unknown>) {
      if (queryString(readRaw(options))) commitPageQuery(page, entryQuery(page, options))
      enableShareMenus()
    },
    onShow() { enableShareMenus() },
    onShareAppMessage() { return buildShareAppMessage(page) },
    onShareTimeline() { return buildShareTimeline(page) },
  }
}
