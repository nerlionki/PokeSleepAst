import { taskNavigationLocked } from '../../../core/src/composables/taskNavigationLock'
import { nextTick, reactive } from 'vue'
import Taro from '@tarojs/taro'
export const route = reactive({ path: '/pokemon', name: 'pokemon', query: {} as Record<string, string> })
const queries = new Map<string, Record<string, string>>()
const positions = new Map<string, number>()
const firstTab: Record<string, string> = { pokemon: 'dex', plan: 'sleep', team: 'team', data: 'island', profile: 'home' }
function scrollKey() {
  return JSON.stringify([route.name, route.query.tab ?? firstTab[route.name], route.query.boxOverview, route.query.encounterVersion])
}
export function recordPageScroll(page: string, top: number) {
  if (route.name === page) positions.set(scrollKey(), top)
}
async function restorePageScroll() {
  const key = scrollKey()
  await nextTick()
  if (key === scrollKey()) void Taro.pageScrollTo({ scrollTop: positions.get(key) ?? 0, duration: 0 }).catch(() => {})
}
export function activatePage(page: string) {
  if (route.name === page) return
  route.path = '/' + page
  route.name = page
  route.query = queries.get(page) ?? {}
  void restorePageScroll()
}
export function commitPageQuery(page: string, query: Record<string, string>) {
  const next = { ...query }
  queries.set(page, next)
  if (route.name === page) route.query = next
}
export function useRoute() { return route }
export function useRouter() {
  async function navigate(target: { path?: string; name?: string; query?: Record<string, string> }) {
    if (taskNavigationLocked.value) return
    const page = target.name ?? target.path?.replace(/^\//, '') ?? route.name
    const previous = route.name
    route.path = '/' + page; route.name = page; route.query = target.query ?? queries.get(page) ?? {}
    queries.set(page, route.query)
    if (page !== previous) await Taro.switchTab({ url: `/pages/${page}/index` })
    await restorePageScroll()
  }
  return { push: navigate, replace: navigate }
}
