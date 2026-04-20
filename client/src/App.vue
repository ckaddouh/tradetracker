<template>
  <div>
    <nav v-if="auth.isLoggedIn" class="nav">
      <div class="nav-inner">
        <span class="nav-logo">TradeTrackr</span>
        <div class="nav-links">
          <router-link to="/journal"   class="nav-link" active-class="nav-link--active">Journal</router-link>
          <router-link to="/earnings"  class="nav-link" active-class="nav-link--active">Earnings</router-link>
          <router-link to="/portfolio" class="nav-link" active-class="nav-link--active">Portfolio</router-link>
        </div>
        <div class="nav-right">
          <span class="nav-user">{{ auth.user?.name }}</span>
          <button class="nav-logout" @click="logout">Log out</button>
        </div>
      </div>
    </nav>
    <router-view />
  </div>
</template>

<script>
import { useAuthStore } from './stores/auth'
import { useRouter } from 'vue-router'

export default {
  name: 'App',
  setup() {
    const auth = useAuthStore()
    const router = useRouter()
    function logout() {
      auth.logout()
      router.push('/')
    }
    return { auth, logout }
  },
}
</script>

<style scoped>
.nav {
  position: sticky; top: 0; z-index: 50;
  background: rgba(15,15,15,0.9);
  backdrop-filter: blur(16px);
  border-bottom: 1px solid var(--border);
}
.nav-inner {
  max-width: 1000px; margin: 0 auto;
  padding: 0 28px; height: 56px;
  display: flex; align-items: center; gap: 8px;
}
.nav-logo {
  font-weight: 800; font-size: 0.95rem; color: var(--accent);
  letter-spacing: -0.02em; margin-right: 16px; white-space: nowrap;
}
.nav-links { display: flex; gap: 2px; flex: 1; }
.nav-link {
  padding: 6px 14px; border-radius: var(--radius);
  color: var(--muted); text-decoration: none;
  font-size: 0.875rem; font-weight: 600;
  transition: color 0.15s, background 0.15s; white-space: nowrap;
}
.nav-link:hover { color: var(--text); }
.nav-link--active { color: var(--text); background: var(--surface2); }
.nav-right { display: flex; align-items: center; gap: 12px; margin-left: auto; }
.nav-user { font-size: 0.8rem; color: var(--muted); font-family: var(--font-mono); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 140px; }
.nav-logout {
  background: none; border: 1px solid var(--border); color: var(--muted);
  font-family: var(--font-sans); font-size: 0.8rem; font-weight: 600;
  cursor: pointer; padding: 5px 12px; border-radius: var(--radius);
  transition: all 0.15s; white-space: nowrap;
}
.nav-logout:hover { color: var(--text); border-color: var(--muted); }
</style>