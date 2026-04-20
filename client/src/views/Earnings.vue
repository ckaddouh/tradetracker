<template>
  <div class="page">
    <div class="page-header">
      <div>
        <h1 class="page-title">Earnings Calendar</h1>
        <p class="page-sub">{{ activeTab === 'calendar' ? `${filtered.length} upcoming` : `${watchlist.length} on watchlist` }}</p>
      </div>
      <button class="btn btn-primary" @click="showAddModal = true">+ Add Event</button>
    </div>

    <div class="filters">
      <button v-for="t in tabs" :key="t.val"
        :class="['pill', activeTab === t.val && 'active']"
        @click="activeTab = t.val">
        {{ t.label }}
      </button>
    </div>

    <!-- Calendar tab -->
    <div v-if="activeTab === 'calendar'">
      <div v-if="loading" class="grid">
        <div v-for="i in 6" :key="i" class="skeleton" style="height:120px; border-radius:12px;"></div>
      </div>
      <div v-else-if="filtered.length === 0" class="empty">
        <div class="empty-icon">📅</div>
        <p>No upcoming earnings events. Add one manually.</p>
      </div>
      <div v-else class="grid">
        <div v-for="(ev, i) in filtered" :key="ev._id"
          class="event-card fade-up"
          :style="{ animationDelay: `${i * 0.04}s` }">
          <div class="event-top">
            <span class="event-ticker">{{ ev.ticker }}</span>
            <span :class="['event-time-badge', ev.time === 'BMO' ? 'bmo' : 'amc']">{{ ev.time }}</span>
          </div>
          <p class="event-company">{{ ev.companyName }}</p>
          <div class="event-foot">
            <span class="event-date">{{ formatDate(ev.earningsDate) }}</span>
            <button class="watch-btn" @click="addToWatchlist(ev.ticker)">+ Watch</button>
          </div>
        </div>
      </div>
    </div>

    <!-- Watchlist tab -->
    <div v-if="activeTab === 'watchlist'">
      <div v-if="wlLoading" class="list">
        <div v-for="i in 3" :key="i" class="skeleton" style="height:64px; border-radius:12px;"></div>
      </div>
      <div v-else-if="watchlist.length === 0" class="empty">
        <div class="empty-icon">👀</div>
        <p>Your watchlist is empty. Click + Watch on any earnings event.</p>
      </div>
      <div v-else class="list">
        <div v-for="item in watchlist" :key="item._id" class="wl-card fade-up">
          <div class="wl-left">
            <span class="wl-ticker">{{ item.ticker }}</span>
            <span v-if="item.notes" class="wl-notes">{{ item.notes }}</span>
          </div>
          <button class="remove-btn" @click="removeFromWatchlist(item._id)">Remove</button>
        </div>
      </div>
    </div>

    <!-- Add Event Modal -->
    <div v-if="showAddModal" class="modal-overlay" @click.self="showAddModal = false">
      <div class="modal">
        <div class="modal-header">
          <h2 class="modal-title">Add Earnings Event</h2>
          <button class="modal-close" @click="showAddModal = false">✕</button>
        </div>
        <form @submit.prevent="addEvent" class="modal-form">
          <div class="form-row">
            <div class="form-group">
              <label>Ticker</label>
              <input v-model="evForm.ticker" placeholder="AAPL" required style="text-transform:uppercase" />
            </div>
            <div class="form-group">
              <label>Time</label>
              <select v-model="evForm.time">
                <option value="BMO">BMO (Before Open)</option>
                <option value="AMC">AMC (After Close)</option>
              </select>
            </div>
          </div>
          <div class="form-group">
            <label>Company Name</label>
            <input v-model="evForm.companyName" placeholder="Apple Inc." required />
          </div>
          <div class="form-group">
            <label>Earnings Date</label>
            <input v-model="evForm.earningsDate" type="date" required />
          </div>
          <p v-if="evError" class="form-error">{{ evError }}</p>
          <div class="modal-actions">
            <button type="button" class="btn btn-ghost" @click="showAddModal = false">Cancel</button>
            <button type="submit" class="btn btn-primary" :disabled="evSaving">
              {{ evSaving ? 'Adding…' : 'Add Event' }}
            </button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>

<script>
import { api } from '../api'

export default {
  name: 'Earnings',
  data() {
    return {
      events: [],
      watchlist: [],
      loading: true,
      wlLoading: true,
      activeTab: 'calendar',
      showAddModal: false,
      evSaving: false,
      evError: null,
      evForm: { ticker: '', companyName: '', earningsDate: '', time: 'AMC' },
      tabs: [
        { label: 'Calendar',     val: 'calendar' },
        { label: 'My Watchlist', val: 'watchlist' },
      ],
    }
  },
  computed: {
    filtered() {
      const now = new Date()
      now.setHours(0,0,0,0)
      return this.events.filter((e) => new Date(e.earningsDate) >= now)
    },
  },
  async created() {
    await Promise.all([this.fetchEvents(), this.fetchWatchlist()])
  },
  methods: {
    async fetchEvents() {
      this.loading = true
      try { this.events = await api.get('/earnings') }
      finally { this.loading = false }
    },
    async fetchWatchlist() {
      this.wlLoading = true
      try { this.watchlist = await api.get('/watchlist') }
      finally { this.wlLoading = false }
    },
    async addEvent() {
      this.evError = null; this.evSaving = true
      try {
        const ev = await api.post('/earnings', { ...this.evForm, ticker: this.evForm.ticker.toUpperCase() })
        this.events.unshift(ev)
        this.showAddModal = false
        this.evForm = { ticker: '', companyName: '', earningsDate: '', time: 'AMC' }
      } catch (e) { this.evError = e.message }
      finally { this.evSaving = false }
    },
    async addToWatchlist(ticker) {
      try {
        const item = await api.post('/watchlist', { ticker })
        this.watchlist.unshift(item)
      } catch (e) {
        if (!e.message.includes('already')) alert(e.message)
      }
    },
    async removeFromWatchlist(id) {
      await api.delete(`/watchlist/${id}`)
      this.watchlist = this.watchlist.filter((w) => w._id !== id)
    },
    formatDate(d) {
      return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    },
  },
}
</script>

<style scoped>
.page { max-width: 980px; margin: 0 auto; padding: 40px 28px 80px; }
.page-header {
  display: flex; align-items: flex-start; justify-content: space-between;
  margin-bottom: 28px; gap: 16px;
}
.page-title { font-size: 1.75rem; font-weight: 800; letter-spacing: -0.03em; }
.page-sub { color: var(--muted); font-size: 0.82rem; margin-top: 3px; font-family: var(--font-mono); }
.filters { display: flex; gap: 8px; margin-bottom: 28px; flex-wrap: wrap; }

.grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(230px, 1fr)); gap: 12px; }

.event-card {
  background: var(--surface); border: 1px solid var(--border);
  border-radius: var(--radius-lg); padding: 18px 20px;
  display: flex; flex-direction: column; gap: 10px;
  transition: border-color 0.2s;
}
.event-card:hover { border-color: #3a3a3a; }
.event-top { display: flex; justify-content: space-between; align-items: center; }
.event-ticker { font-family: var(--font-mono); font-size: 0.95rem; font-weight: 500; }
.event-time-badge {
  font-family: var(--font-mono); font-size: 0.68rem; font-weight: 600;
  padding: 3px 8px; border-radius: 4px; text-transform: uppercase;
}
.bmo { background: rgba(74,222,128,0.1); color: var(--bullish); border: 1px solid rgba(74,222,128,0.2); }
.amc { background: rgba(248,113,113,0.1); color: var(--bearish); border: 1px solid rgba(248,113,113,0.2); }
.event-company { font-size: 0.875rem; font-weight: 600; color: var(--text); line-height: 1.3; flex: 1; }
.event-foot { display: flex; align-items: center; justify-content: space-between; margin-top: auto; }
.event-date { font-family: var(--font-mono); font-size: 0.72rem; color: var(--muted); }
.watch-btn {
  background: none; border: 1px solid var(--border); color: var(--muted);
  font-family: var(--font-sans); font-size: 0.75rem; font-weight: 600;
  cursor: pointer; padding: 4px 10px; border-radius: var(--radius); transition: all 0.15s;
}
.watch-btn:hover { color: var(--accent); border-color: rgba(200,241,53,0.4); }

.list { display: flex; flex-direction: column; gap: 10px; }
.wl-card {
  background: var(--surface); border: 1px solid var(--border);
  border-radius: var(--radius-lg); padding: 16px 20px;
  display: flex; align-items: center; justify-content: space-between;
}
.wl-left { display: flex; flex-direction: column; gap: 3px; }
.wl-ticker { font-family: var(--font-mono); font-size: 0.95rem; font-weight: 500; }
.wl-notes { font-size: 0.8rem; color: var(--muted); }
.remove-btn {
  background: none; border: 1px solid var(--border); color: var(--muted);
  font-family: var(--font-sans); font-size: 0.78rem; font-weight: 600;
  cursor: pointer; padding: 5px 12px; border-radius: var(--radius); transition: all 0.15s;
}
.remove-btn:hover { color: var(--bearish); border-color: rgba(248,113,113,0.4); background: rgba(248,113,113,0.05); }

.empty { text-align: center; padding: 80px 24px; display: flex; flex-direction: column; align-items: center; gap: 16px; }
.empty-icon { font-size: 2.5rem; }
.empty p { color: var(--muted); font-size: 0.9rem; }

.modal-form { display: flex; flex-direction: column; gap: 16px; }
.form-row { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
.modal-actions { display: flex; gap: 10px; justify-content: flex-end; margin-top: 4px; }
.form-error {
  color: var(--bearish); font-size: 0.85rem;
  background: rgba(248,113,113,0.07); border: 1px solid rgba(248,113,113,0.2);
  border-radius: var(--radius); padding: 10px 14px;
}

@keyframes fadeUp {
  from { opacity: 0; transform: translateY(8px); }
  to   { opacity: 1; transform: translateY(0); }
}
.fade-up { animation: fadeUp 0.3s ease both; }

@media (max-width: 500px) { .form-row { grid-template-columns: 1fr; } }
</style>