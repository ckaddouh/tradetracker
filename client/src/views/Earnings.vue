<template>
  <div class="page">
    <div class="page-header">
      <div>
        <h1 class="page-title">Earnings</h1>
        <p class="page-sub">{{ activeTab==='calendar' ? `${filtered.length} upcoming` : `${watchlist.length} watching` }}</p>
      </div>
      <button class="btn btn-primary" @click="showAdd=true">+ Add event</button>
    </div>

    <div class="filters">
      <button v-for="t in tabs" :key="t.val" :class="['pill', activeTab===t.val&&'active']" @click="activeTab=t.val">
        {{ t.label }}
      </button>
    </div>

    <!-- calendar -->
    <div v-if="activeTab==='calendar'">
      <div v-if="loading" class="ev-grid">
        <div v-for="i in 6" :key="i" class="skeleton" style="height:110px;border-radius:8px;"></div>
      </div>
      <div v-else-if="filtered.length===0" class="empty-state">
        <div class="empty-icon">📅</div>
        <p class="empty-msg">No upcoming earnings. Add one manually.</p>
      </div>
      <div v-else class="ev-grid">
        <div v-for="(ev,i) in filtered" :key="ev._id" class="ev-card fade-up" :style="{animationDelay:`${i*0.04}s`}">
          <div class="ev-top">
            <span class="ev-ticker">{{ ev.ticker }}</span>
            <span :class="['ev-time', ev.time==='BMO'?'ev-bmo':'ev-amc']">{{ ev.time }}</span>
          </div>
          <p class="ev-company">{{ ev.companyName }}</p>
          <div class="ev-foot">
            <span class="ev-date">{{ fmtDate(ev.earningsDate) }}</span>
            <button class="watch-btn" @click="addWatch(ev.ticker)">+ Watch</button>
          </div>
        </div>
      </div>
    </div>

    <!-- watchlist -->
    <div v-if="activeTab==='watchlist'">
      <div v-if="wlLoading" class="wl-list">
        <div v-for="i in 3" :key="i" class="skeleton" style="height:56px;border-radius:8px;"></div>
      </div>
      <div v-else-if="watchlist.length===0" class="empty-state">
        <div class="empty-icon">👀</div>
        <p class="empty-msg">Nothing on your watchlist yet.</p>
      </div>
      <div v-else class="wl-list">
        <div v-for="item in watchlist" :key="item._id" class="wl-row fade-up">
          <span class="wl-ticker">{{ item.ticker }}</span>
          <button class="ic-btn ic-btn--del" @click="removeWatch(item._id)">Remove</button>
        </div>
      </div>
    </div>

    <!-- add modal -->
    <div v-if="showAdd" class="modal-overlay" @click.self="showAdd=false">
      <div class="modal">
        <div class="modal-header">
          <h2 class="modal-title">Add earnings event</h2>
          <button class="modal-close" @click="showAdd=false">✕</button>
        </div>
        <form @submit.prevent="addEvent" class="modal-form">
          <div class="form-row">
            <div class="form-group">
              <label>Ticker</label>
              <input v-model="evForm.ticker" placeholder="AAPL" required style="text-transform:uppercase" />
            </div>
            <div class="form-group">
              <label>Timing</label>
              <select v-model="evForm.time">
                <option value="BMO">BMO</option>
                <option value="AMC">AMC</option>
              </select>
            </div>
          </div>
          <div class="form-group">
            <label>Company name</label>
            <input v-model="evForm.companyName" placeholder="Apple Inc." required />
          </div>
          <div class="form-group">
            <label>Earnings date</label>
            <input v-model="evForm.earningsDate" type="date" required />
          </div>
          <p v-if="evErr" class="form-error">{{ evErr }}</p>
          <div class="modal-actions">
            <button type="button" class="btn btn-ghost" @click="showAdd=false">Cancel</button>
            <button type="submit" class="btn btn-primary" :disabled="evSaving">
              {{ evSaving ? 'Adding…' : 'Add event' }}
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
      events: [], watchlist: [], loading: true, wlLoading: true,
      activeTab: 'calendar', showAdd: false, evSaving: false, evErr: null,
      evForm: {ticker:'',companyName:'',earningsDate:'',time:'AMC'},
      tabs: [{label:'Calendar',val:'calendar'},{label:'My watchlist',val:'watchlist'}],
    }
  },
  computed: {
    filtered() {
      const now = new Date(); now.setHours(0,0,0,0)
      return this.events.filter(e=>new Date(e.earningsDate)>=now)
    },
  },
  async created() { await Promise.all([this.fetchEvents(), this.fetchWatchlist()]) },
  methods: {
    async fetchEvents() {
      this.loading = true
      try { this.events = await api.get('/earnings') } finally { this.loading = false }
    },
    async fetchWatchlist() {
      this.wlLoading = true
      try { this.watchlist = await api.get('/watchlist') } finally { this.wlLoading = false }
    },
    async addEvent() {
      this.evErr = null; this.evSaving = true
      try {
        const ev = await api.post('/earnings', {...this.evForm, ticker:this.evForm.ticker.toUpperCase()})
        this.events.unshift(ev)
        this.showAdd = false
        this.evForm = {ticker:'',companyName:'',earningsDate:'',time:'AMC'}
      } catch(e) { this.evErr = e.message }
      finally { this.evSaving = false }
    },
    async addWatch(ticker) {
      try { this.watchlist.unshift(await api.post('/watchlist', {ticker})) }
      catch(e) { if (!e.message.includes('already')) alert(e.message) }
    },
    async removeWatch(id) {
      await api.delete(`/watchlist/${id}`)
      this.watchlist = this.watchlist.filter(w=>w._id!==id)
    },
    fmtDate(d) { return new Date(d).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'}) },
  },
}
</script>

<style scoped>
.ev-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 10px; }

.ev-card {
  background: var(--surface); border: 1px solid var(--border);
  border-radius: var(--r-lg); padding: 14px 16px;
  display: flex; flex-direction: column; gap: 8px;
  transition: border-color 0.15s;
}
.ev-card:hover { border-color: var(--border2); }
.ev-top { display: flex; align-items: center; justify-content: space-between; }
.ev-ticker { font-family: var(--mono); font-size: 0.9rem; font-weight: 500; }
.ev-time {
  font-family: var(--mono); font-size: 0.62rem; font-weight: 600;
  padding: 2px 7px; border-radius: 3px; text-transform: uppercase;
}
.ev-bmo { background: rgba(61,220,132,0.1);  color: var(--green); border: 1px solid rgba(61,220,132,0.2); }
.ev-amc { background: rgba(255,107,107,0.1); color: var(--red);   border: 1px solid rgba(255,107,107,0.2); }
.ev-company { font-size: 0.82rem; font-weight: 600; line-height: 1.3; flex: 1; }
.ev-foot { display: flex; align-items: center; justify-content: space-between; margin-top: auto; }
.ev-date { font-family: var(--mono); font-size: 0.65rem; color: var(--muted); }
.watch-btn {
  background: none; border: 1px solid var(--border); color: var(--muted2);
  font-family: var(--sans); font-size: 0.72rem; font-weight: 500;
  cursor: pointer; padding: 3px 9px; border-radius: var(--r); transition: all 0.12s;
}
.watch-btn:hover { color: var(--accent); border-color: rgba(201,242,49,0.3); }

.wl-list { display: flex; flex-direction: column; gap: 8px; }
.wl-row {
  background: var(--surface); border: 1px solid var(--border);
  border-radius: var(--r-lg); padding: 14px 16px;
  display: flex; align-items: center; justify-content: space-between;
}
.wl-ticker { font-family: var(--mono); font-size: 0.9rem; font-weight: 500; }

.ic-btn {
  background: none; border: 1px solid var(--border); color: var(--muted2);
  font-family: var(--sans); font-size: 0.75rem; font-weight: 500;
  cursor: pointer; padding: 4px 10px; border-radius: var(--r); transition: all 0.12s;
}
.ic-btn:hover { color: var(--text); border-color: var(--border2); }
.ic-btn--del:hover { color: var(--red); border-color: rgba(255,107,107,0.35); background: rgba(255,107,107,0.05); }

.empty-state { display: flex; flex-direction: column; align-items: center; gap: 14px; padding: 80px 24px; text-align: center; }
.empty-icon { font-size: 2rem; }
.empty-msg { color: var(--muted); font-size: 0.88rem; }
</style>