import { defineStore } from 'pinia'
import axios from 'axios'
import { useAuthStore } from './authStore'

export const useEarningsStore = defineStore('earnings', {
  state: () => ({
    watches: [],
    calendar: []
  }),

  getters: {
    upcoming: (state) => state.watches.filter(w => w.actualMove === null || w.actualMove === undefined),
    completed: (state) => state.watches.filter(w => w.actualMove !== null && w.actualMove !== undefined),
    watchedTickers: (state) => state.watches.map(w => w.ticker)
  },

  actions: {
    getHeaders() {
      const authStore = useAuthStore()
      return { Authorization: `Bearer ${authStore.token}` }
    },

    async fetchCalendar() {
      const res = await axios.get('http://localhost:3000/api/earnings/calendar', {
        headers: this.getHeaders()
      })
      this.calendar = res.data
    },

    async fetchWatches() {
      const res = await axios.get('http://localhost:3000/api/earnings', {
        headers: this.getHeaders()
      })
      this.watches = res.data
    },

    async lookupTicker(ticker) {
      const res = await axios.get(`http://localhost:3000/api/earnings/lookup/${ticker}`, {
        headers: this.getHeaders()
      })
      return res.data
    },

    async addWatch(data) {
      const res = await axios.post('http://localhost:3000/api/earnings', data, {
        headers: this.getHeaders()
      })
      this.watches.push(res.data)
    },

    async updateWatch(id, updates) {
      const res = await axios.patch(`http://localhost:3000/api/earnings/${id}`, updates, {
        headers: this.getHeaders()
      })
      const index = this.watches.findIndex(w => w._id === id)
      if (index !== -1) this.watches[index] = res.data
    },

    async deleteWatch(id) {
      await axios.delete(`http://localhost:3000/api/earnings/${id}`, {
        headers: this.getHeaders()
      })
      this.watches = this.watches.filter(w => w._id !== id)
    }
  }
})