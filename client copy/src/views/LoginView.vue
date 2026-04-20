<template>
    <div class="auth-container">
      <div class="auth-card">
        <h2>Login</h2>
        <p class="subtitle">Welcome back</p>
  
        <div v-if="error" class="error">{{ error }}</div>
  
        <div class="form-group">
          <label>Email</label>
          <input v-model="email" type="email" placeholder="you@example.com" />
        </div>
  
        <div class="form-group">
          <label>Password</label>
          <input v-model="password" type="password" placeholder="••••••••" />
        </div>
  
        <button @click="handleLogin" :disabled="loading" class="btn-primary">
          {{ loading ? 'Logging in...' : 'Login' }}
        </button>
  
        <p class="switch">Don't have an account? <RouterLink to="/register">Register</RouterLink></p>
      </div>
    </div>
  </template>
  
  <script setup>
  import { ref } from 'vue'
  import { useAuthStore } from '../stores/authStore'
  import { useRouter } from 'vue-router'
  
  const authStore = useAuthStore()
  const router = useRouter()
  
  const email = ref('')
  const password = ref('')
  const error = ref('')
  const loading = ref(false)
  
  async function handleLogin() {
    error.value = ''
    loading.value = true
    try {
      await authStore.login(email.value, password.value)
      router.push('/journal')
    } catch (err) {
      error.value = err.response?.data?.error || 'Login failed'
    } finally {
      loading.value = false
    }
  }
  </script>
  
  <style scoped>
  .auth-container {
    display: flex;
    justify-content: center;
    margin-top: 4rem;
  }
  
  .auth-card {
    background-color: #161b27;
    border: 1px solid #2a2f3e;
    border-radius: 10px;
    padding: 2.5rem;
    width: 100%;
    max-width: 420px;
  }
  
  h2 {
    font-size: 1.8rem;
    color: #4ade80;
    margin-bottom: 0.25rem;
  }
  
  .subtitle {
    color: #888;
    margin-bottom: 1.5rem;
    font-size: 0.9rem;
  }
  
  .form-group {
    margin-bottom: 1.2rem;
  }
  
  label {
    display: block;
    margin-bottom: 0.4rem;
    font-size: 0.9rem;
    color: #aaa;
  }
  
  input {
    width: 100%;
    padding: 0.65rem 0.9rem;
    background-color: #0f1117;
    border: 1px solid #2a2f3e;
    border-radius: 6px;
    color: #e0e0e0;
    font-size: 0.95rem;
  }
  
  input:focus {
    outline: none;
    border-color: #4ade80;
  }
  
  .btn-primary {
    width: 100%;
    padding: 0.75rem;
    background-color: #4ade80;
    color: #0f1117;
    border: none;
    border-radius: 6px;
    font-size: 1rem;
    font-weight: 600;
    cursor: pointer;
    margin-top: 0.5rem;
  }
  
  .btn-primary:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
  
  .error {
    background-color: #2d1b1b;
    border: 1px solid #e05252;
    color: #e05252;
    padding: 0.6rem 0.9rem;
    border-radius: 6px;
    margin-bottom: 1rem;
    font-size: 0.9rem;
  }
  
  .switch {
    text-align: center;
    margin-top: 1.2rem;
    font-size: 0.9rem;
    color: #888;
  }
  
  .switch a {
    color: #4ade80;
    text-decoration: none;
  }
  </style>