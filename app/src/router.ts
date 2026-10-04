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
    { path: '/pokemon', name: 'pokemon', component: PokemonView },
    { path: '/plan', name: 'plan', component: PlanView },
    { path: '/team', name: 'team', component: TeamView },
    { path: '/data', name: 'data', component: DataView },
    { path: '/profile', name: 'profile', component: ProfileView },
  ],
})
