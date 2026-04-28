import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '../stores/authStore'
import HomeView from '../views/HomeView.vue'
import LoginView from '../views/LoginView.vue'
import RegisterView from '../views/RegisterView.vue'
import JournalView from '../views/JournalView.vue'
import EarningsView from '../views/EarningsView.vue'  
import MarketView from '../views/MarketAnalyzer.vue'


const routes = [
  { path: '/', component: HomeView },
  { path: '/login', component: LoginView },
  { path: '/register', component: RegisterView },
  {
    path: '/journal',
    component: JournalView,
    meta: { requiresAuth: true }
  },
  { path: '/earnings', component: EarningsView, meta: { requiresAuth: true }},
  { path: '/markets', component: MarketView, meta: { requiresAuth: true }}
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

// Redirect to login if route requires auth and user isn't logged in
router.beforeEach((to) => {
  const authStore = useAuthStore()
  if (to.meta.requiresAuth && !authStore.token) {
    return '/login'
  }
})

export default router