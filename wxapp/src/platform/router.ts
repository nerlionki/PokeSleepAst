import { taskNavigationLocked } from '../../../core/src/composables/taskNavigationLock'
import { inject, nextTick, provide, reactive, type InjectionKey } from 'vue'
import Taro from '@tarojs/taro'
export const route = reactive({ path: '/pokemon', name: 'pokemon', query: {} as Record<string, string> })
const pageRoutes = new Map<string, typeof route>()
const pageRouteKey: InjectionKey<typeof route> = Symbol('page route')

function routeForPage(page: string) {
  let value = pageRoutes.get(page)
  if (!value) {
    value = reactive({ path: '/' + page, name: page, query: {} as Record<string, string> })
    pageRoutes.set(page, value)
  }
  return value
}

export function providePageRoute(page: string) {
  const value = routeForPage(page)
  provide(pageRouteKey, value)
  return value
}
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
  const next = routeForPage(page)
  route.path = next.path
  route.query = next.query
  route.name = next.name
  void restorePageScroll()
}
export function commitPageQuery(page: string, query: Record<string, string>) {
  const next = { ...query }
  routeForPage(page).query = next
  if (route.name === page) route.query = next
}
export function useRoute() { return inject(pageRouteKey, route) }
export function useRouter() {
  const current = useRoute()
  async function navigate(target: { path?: string; name?: string; query?: Record<string, string> }) {
    if (taskNavigationLocked.value) return
    const page = target.name ?? target.path?.replace(/^\//, '') ?? current.name
    if (target.query) commitPageQuery(page, target.query)
    if (page === current.name && current.name !== route.name) return
    if (page !== route.name) {
      await Taro.switchTab({ url: `/pages/${page}/index` })
      return
    }
    await restorePageScroll()
  }
  return { push: navigate, replace: navigate }
}
