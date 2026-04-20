import { defineStore } from 'pinia'
import axios from 'axios'

export const useAuthStore = defineStore('auth', {
  state: () => ({
    token: localStorage.getItem('token') || null,
    email: localStorage.getItem('email') || null,
    userId: localStorage.getItem('userId') || null
  }),

  getters: {
    isLoggedIn: (state) => !!state.token
  },

  actions: {
    async register(email, password) {
      const res = await axios.post('http://localhost:3000/api/auth/register', { email, password })
      return res.data
    },

    async login(email, password) {
      const res = await axios.post('http://localhost:3000/api/auth/login', { email, password })
      this.token = res.data.token
      this.email = res.data.email
      this.userId = res.data.userId
      localStorage.setItem('token', this.token)
      localStorage.setItem('email', this.email)
      localStorage.setItem('userId', this.userId)
    },

    logout() {
      this.token = null
      this.email = null
      this.userId = null
      localStorage.removeItem('token')
      localStorage.removeItem('email')
      localStorage.removeItem('userId')
    }
  }
})