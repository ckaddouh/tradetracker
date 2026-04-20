import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '../stores/auth'

import Landing   from '../views/Landing.vue'
import Journal   from '../views/Journal.vue'
import Earnings  from '../views/Earnings.vue'
import Portfolio from '../views/Portfolio.vue'

const routes = [
  { path: '/',          component: Landing,   meta: { public: true } },
  { path: '/journal',   component: Journal,   meta: { requiresAuth: true } },
  { path: '/earnings',  component: Earnings,  meta: { requiresAuth: true } },
  { path: '/portfolio', component: Portfolio, meta: { requiresAuth: true } },
]

const router = createRouter({
  history: createWebHistory(),
  routes,
})

router.beforeEach((to) => {
  const auth = useAuthStore()
  if (to.meta.requiresAuth && !auth.isLoggedIn) return '/'
  if (to.path === '/' && auth.isLoggedIn) return '/journal'
})

export default router
