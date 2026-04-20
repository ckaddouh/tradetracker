<template>
  <div>
    <nav v-if="auth.isLoggedIn" class="nav">
      <div class="nav-inner">
        <span class="nav-brand">TradeTrackr</span>
        <div class="nav-links">
          <router-link to="/journal"   class="nav-link" active-class="is-active">Journal</router-link>
          <router-link to="/earnings"  class="nav-link" active-class="is-active">Earnings</router-link>
          <router-link to="/portfolio" class="nav-link" active-class="is-active">Portfolio</router-link>
        </div>
        <div class="nav-end">
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
    return { auth, logout() { auth.logout(); router.push('/') } }
  },
}
</script>

<style scoped>
.nav {
  position: sticky;
  top: 0;
  z-index: 100;
  background: rgba(12,12,12,0.92);
  backdrop-filter: blur(12px);
  border-bottom: 1px solid var(--border);
}
.nav-inner {
  max-width: var(--page-width);
  margin: 0 auto;
  padding: 0 var(--page-pad);
  height: 52px;
  display: flex;
  align-items: center;
  gap: 0;
}
.nav-brand {
  font-family: var(--mono);
  font-size: 0.82rem;
  font-weight: 500;
  color: var(--accent);
  letter-spacing: 0.02em;
  margin-right: 28px;
  white-space: nowrap;
}
.nav-links {
  display: flex;
  gap: 2px;
  flex: 1;
}
.nav-link {
  padding: 5px 12px;
  border-radius: var(--r);
  color: var(--muted);
  text-decoration: none;
  font-size: 0.85rem;
  font-weight: 500;
  transition: color 0.12s, background 0.12s;
}
.nav-link:hover { color: var(--text); }
.nav-link.is-active { color: var(--text); background: var(--surface2); }
.nav-end {
  display: flex;
  align-items: center;
  gap: 14px;
  margin-left: auto;
}
.nav-user {
  font-family: var(--mono);
  font-size: 0.72rem;
  color: var(--muted);
  max-width: 160px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.nav-logout {
  background: none;
  border: 1px solid var(--border);
  color: var(--muted);
  font-family: var(--sans);
  font-size: 0.78rem;
  font-weight: 500;
  cursor: pointer;
  padding: 4px 11px;
  border-radius: var(--r);
  transition: all 0.12s;
  white-space: nowrap;
}
.nav-logout:hover { color: var(--text); border-color: var(--border2); }
</style>