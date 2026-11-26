import { taskNavigationLocked } from '../../core/src/composables/taskNavigationLock'
import { createRouter, createWebHashHistory, type LocationQuery, type RouteLocationNormalized } from 'vue-router'
import { shallowReactive } from 'vue'
import DataView from './views/DataView.vue'
import PlanView from './views/PlanView.vue'
import PokemonView from './views/PokemonView.vue'
import ProfileView from './views/ProfileView.vue'
import TeamView from './views/TeamView.vue'

const pageScroll = new Map<string, number>()
const lastPageQueries = shallowReactive(new Map<string, LocationQuery>())

export function tabDestination(name: string) {
  return { name, query: lastPageQueries.get(name) }
}
function scrollKey(route: Pick<RouteLocationNormalized, 'path' | 'query' | 'meta'>) {
  const tab = route.query.tab ?? (Array.isArray(route.meta.backTabs) ? route.meta.backTabs[0] : '')
  return JSON.stringify([route.path, tab, route.query.boxOverview, route.query.encounterVersion])
}

export const router = createRouter({
  history: createWebHashHistory(),
  scrollBehavior(to) { return { top: pageScroll.get(scrollKey(to)) ?? 0 } },
  routes: [
    { path: '/', redirect: '/pokemon' },
    { path: '/pokemon', name: 'pokemon', component: PokemonView, meta: { backTabs: ['dex', 'box', 'wall'] } },
    { path: '/plan', name: 'plan', component: PlanView, meta: { backTabs: ['sleep', 'encounter', 'catch', 'split', 'baby', 'completion', 'candy', 'train', 'sp'] } },
    { path: '/team', name: 'team', component: TeamView, meta: { backTabs: ['team', 'cmp', 'meal'] } },
    { path: '/data', name: 'data', component: DataView, meta: { backTabs: ['island', 'berry', 'ing', 'recipe', 'skill', 'nature', 'pot', 'bundles', 'calendar'] } },
    { path: '/profile', name: 'profile', component: ProfileView, meta: { backTabs: ['home', 'backup', 'settings', 'recipe-levels', 'appearance', 'credits', 'update'] } },
  ],
})

router.afterEach((to, _from, failure) => {
  if (!failure && typeof to.name === 'string') lastPageQueries.set(to.name, to.query)
})

router.beforeEach((_to, from) => {
  if (taskNavigationLocked.value) return false
  if (from.matched.length) pageScroll.set(scrollKey(from), window.scrollY)
  return true
})
