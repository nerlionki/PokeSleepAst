import { reactive } from 'vue'
import Taro from '@tarojs/taro'
export const route = reactive({ path: '/pokemon', name: 'pokemon', query: {} as Record<string, string> })
export function useRoute() { return route }
export function useRouter() {
  return { async push(target: { path?: string; name?: string; query?: Record<string, string> }) {
    const page = target.name ?? target.path?.replace(/^\//, '') ?? route.name
    const previous = route.name
    route.path = '/' + page; route.name = page; route.query = target.query ?? {}
    if (page !== previous) await Taro.switchTab({ url: `/pages/${page}/index` })
  } }
}
