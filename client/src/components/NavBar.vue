<template>
    <nav class="navbar">
      <RouterLink to="/" class="brand">TradeTracker</RouterLink>
      <div class="nav-links">
        <template v-if="authStore.isLoggedIn">
          <span class="email">{{ authStore.email }}</span>
          <RouterLink to="/journal">Journal</RouterLink>
          <RouterLink to="/earnings">Earnings</RouterLink>  
          <RouterLink to="/markets">Analyzer</RouterLink>  
          <button @click="handleLogout" class="logout-btn">Logout</button>
        </template>
        <template v-else>
          <RouterLink to="/login">Login</RouterLink>
          <RouterLink to="/register">Register</RouterLink>
        </template>
      </div>
    </nav>
  </template>
  
  <script setup>
  import { useAuthStore } from '../stores/authStore'
  import { useRouter } from 'vue-router'
  
  const authStore = useAuthStore()
  const router = useRouter()
  
  function handleLogout() {
    authStore.logout()
    router.push('/login')
  }
  </script>
  
  <style scoped>
  .navbar {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 1rem 2rem;
    background-color: #161b27;
    border-bottom: 1px solid #2a2f3e;
  }
  
  .brand {
    font-size: 1.3rem;
    font-weight: 700;
    color: #4ade80;
    text-decoration: none;
  }
  
  .nav-links {
    display: flex;
    align-items: center;
    gap: 1.5rem;
  }
  
  .nav-links a {
    color: #e0e0e0;
    text-decoration: none;
    font-size: 0.95rem;
  }
  
  .nav-links a:hover {
    color: #4ade80;
  }
  
  .email {
    font-size: 0.85rem;
    color: #888;
  }
  
  .logout-btn {
    background: none;
    border: 1px solid #4ade80;
    color: #4ade80;
    padding: 0.3rem 0.8rem;
    border-radius: 4px;
    cursor: pointer;
    font-size: 0.9rem;
  }
  
  .logout-btn:hover {
    background-color: #4ade80;
    color: #0f1117;
  }
  </style>