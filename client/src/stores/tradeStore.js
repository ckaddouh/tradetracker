import { defineStore } from 'pinia'
import axios from 'axios'
import { useAuthStore } from './authStore'

export const useTradeStore = defineStore('trades', {
  state: () => ({
    trades: []
  }),

  getters: {
    openTrades: (state) => state.trades.filter(t => t.status === 'open'),
    closedTrades: (state) => state.trades.filter(t => t.status === 'closed')
  },

  actions: {
    getHeaders() {
      const authStore = useAuthStore()
      return { Authorization: `Bearer ${authStore.token}` }
    },

    async fetchTrades() {
      const res = await axios.get('http://localhost:3000/api/trades', {
        headers: this.getHeaders()
      })
      this.trades = res.data
    },

    async createTrade(tradeData) {
      const res = await axios.post('http://localhost:3000/api/trades', tradeData, {
        headers: this.getHeaders()
      })
      this.trades.unshift(res.data)
    },

    async updateTrade(id, updates) {
      const res = await axios.patch(`http://localhost:3000/api/trades/${id}`, updates, {
        headers: this.getHeaders()
      })
      const index = this.trades.findIndex(t => t._id === id)
      if (index !== -1) this.trades[index] = res.data
    },

    async deleteTrade(id) {
      await axios.delete(`http://localhost:3000/api/trades/${id}`, {
        headers: this.getHeaders()
      })
      this.trades = this.trades.filter(t => t._id !== id)
    }
  }
})