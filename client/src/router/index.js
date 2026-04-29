import { createRouter, createWebHashHistory } from 'vue-router'
import { useAuthStore } from '../stores/authStore'
import HomeView from '../views/HomeView.vue'
import LoginView from '../views/LoginView.vue'
import RegisterView from '../views/RegisterView.vue'
import JournalView from '../views/JournalView.vue'
import EarningsView from '../views/EarningsView.vue'  
import MarketView from '../views/MarketAnalyzer.vue'


const routes = [
  { path: '/', component: HomeView },
  { 
    path: '/login', 
    component: LoginView,
    meta: { guest: true }
  },
  { 
    path: '/register', 
    component: RegisterView,
    meta: { guest: true }
  },
  {
    path: '/journal',
    component: JournalView,
    meta: { requiresAuth: true }
  },
  { 
    path: '/earnings', 
    component: EarningsView, 
    meta: { requiresAuth: true }
  },
  { 
    path: '/markets', 
    component: MarketView, 
    meta: { requiresAuth: true }
  }
]

const router = createRouter({
  history: createWebHashHistory(),
  routes
})

// Auth guard - redirect to login if route requires auth and user isn't logged in
// Redirect to home if user is already logged in and trying to access guest pages
router.beforeEach((to, from) => {
  const authStore = useAuthStore()
  
  if (to.meta.requiresAuth && !authStore.isLoggedIn) {
    return '/login'
  }
  
  if (to.meta.guest && authStore.isLoggedIn) {
    return '/'
  }
})

export default router