import { defineStore } from 'pinia'
import { api } from '../api'

export const useAuthStore = defineStore('auth', {
  state: () => ({
    user: JSON.parse(localStorage.getItem('tt_user') || 'null'),
    token: localStorage.getItem('tt_token') || null,
  }),

  getters: {
    isLoggedIn: (s) => !!s.token,
  },

  actions: {
    async register(email, password, name) {
      const data = await api.post('/auth/register', { email, password, name })
      this._persist(data)
    },

    async login(email, password) {
      const data = await api.post('/auth/login', { email, password })
      this._persist(data)
    },

    logout() {
      this.user = null
      this.token = null
      localStorage.removeItem('tt_token')
      localStorage.removeItem('tt_user')
    },

    _persist(data) {
      this.token = data.token
      this.user  = data.user
      localStorage.setItem('tt_token', data.token)
      localStorage.setItem('tt_user', JSON.stringify(data.user))
    },
  },
})
