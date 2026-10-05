import { createRouter, createWebHashHistory } from 'vue-router'
import DataView from './views/DataView.vue'
import PlanView from './views/PlanView.vue'
import PokemonView from './views/PokemonView.vue'
import ProfileView from './views/ProfileView.vue'
import TeamView from './views/TeamView.vue'

export const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    { path: '/', redirect: '/pokemon' },
    { path: '/pokemon', name: 'pokemon', component: PokemonView, meta: { backTabs: ['dex', 'box', 'wall'] } },
    { path: '/plan', name: 'plan', component: PlanView, meta: { backTabs: ['sleep', 'catch', 'candy', 'train'] } },
    { path: '/team', name: 'team', component: TeamView, meta: { backTabs: ['team', 'cmp'] } },
    { path: '/data', name: 'data', component: DataView, meta: { backTabs: ['island', 'berry', 'ing', 'recipe', 'skill', 'nature', 'pot'] } },
    { path: '/profile', name: 'profile', component: ProfileView, meta: { backTabs: [] } },
  ],
})
