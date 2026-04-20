<template>
  <div class="page">
    <div class="page-header">
      <div>
        <h1 class="page-title">Earnings</h1>
        <p class="page-sub">{{ activeTab==='calendar' ? `${filtered.length} upcoming` : activeTab==='watchlist' ? `${watchlist.length} watching` : 'browse by sector' }}</p>
      </div>
      <button class="btn btn-primary" @click="showAdd=true">+ Add event</button>
    </div>

    <div class="filters">
      <button v-for="t in tabs" :key="t.val" :class="['pill', activeTab===t.val&&'active']" @click="activeTab=t.val">
        {{ t.label }}
      </button>
    </div>

    <!-- ── Calendar tab ── -->
    <div v-if="activeTab==='calendar'">
      <div v-if="loading" class="ev-grid">
        <div v-for="i in 6" :key="i" class="skeleton" style="height:110px;border-radius:8px;"></div>
      </div>
      <div v-else-if="filtered.length===0" class="empty-state">
        <div class="empty-icon">📅</div>
        <p class="empty-msg">No upcoming earnings. Add one manually or browse the Discover list.</p>
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
            <button
              class="watch-btn"
              :class="{ 'watch-btn--added': isWatched(ev.ticker) }"
              @click="!isWatched(ev.ticker) && addWatch(ev.ticker)"
            >{{ isWatched(ev.ticker) ? '✓ Watching' : '+ Watch' }}</button>
          </div>
        </div>
      </div>
    </div>

    <!-- ── My Watchlist tab ── -->
    <div v-if="activeTab==='watchlist'">
      <div class="wl-search-bar">
        <div class="search-wrap">
          <svg class="search-icon" viewBox="0 0 16 16" fill="none"><circle cx="6.5" cy="6.5" r="4" stroke="currentColor" stroke-width="1.2"/><path d="M10.5 10.5L14 14" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/></svg>
          <input
            v-model="searchQuery"
            class="search-input"
            placeholder="Search ticker or company to add…"
            @input="onSearchInput"
            @keydown.enter="searchResults.length && addSearchResult(searchResults[0])"
            @keydown.escape="searchResults=[]"
            autocomplete="off"
          />
          <button v-if="searchQuery" class="search-clear" @click="searchQuery='';searchResults=[]">✕</button>
        </div>
        <div v-if="searchResults.length" class="search-dropdown">
          <button
            v-for="r in searchResults"
            :key="r.ticker"
            class="search-result"
            @click="addSearchResult(r)"
          >
            <span class="sr-ticker">{{ r.ticker }}</span>
            <span class="sr-name">{{ r.name }}</span>
            <span v-if="isWatched(r.ticker)" class="sr-badge">watching</span>
            <span v-else class="sr-add">+ add</span>
          </button>
        </div>
      </div>

      <div v-if="wlLoading" class="wl-grid">
        <div v-for="i in 6" :key="i" class="skeleton" style="height:130px;border-radius:8px;"></div>
      </div>
      <div v-else-if="watchlist.length===0" class="empty-state">
        <div class="empty-icon">👀</div>
        <p class="empty-msg">Nothing on your watchlist yet. Search above or browse Discover.</p>
      </div>
      <div v-else class="wl-grid">
        <div v-for="(item,i) in enrichedWatchlist" :key="item._id" class="wl-card fade-up" :style="{animationDelay:`${i*0.03}s`}">
          <div class="wl-card-top">
            <span class="wl-ticker">{{ item.ticker }}</span>
            <button class="wl-remove" @click="removeWatch(item._id)" title="Remove">✕</button>
          </div>
          <p class="wl-company">{{ item.companyName || item.ticker }}</p>
          <div class="wl-earnings-block" v-if="item.earningsDate">
            <span :class="['ev-time', item.time==='BMO'?'ev-bmo':'ev-amc']" style="font-size:0.58rem;">{{ item.time || 'AMC' }}</span>
            <span class="wl-date">{{ fmtDate(item.earningsDate) }}</span>
            <span class="wl-countdown">{{ countdown(item.earningsDate) }}</span>
          </div>
          <div class="wl-earnings-block wl-no-date" v-else>
            <span class="wl-tbd">Date TBD</span>
          </div>
        </div>
      </div>
    </div>

    <!-- ── Discover tab ── -->
    <div v-if="activeTab==='discover'">
      <div v-for="sector in sectors" :key="sector.name" class="sector-section">
        <div class="sector-header">
          <span class="sector-icon">{{ sector.icon }}</span>
          <h2 class="sector-name">{{ sector.name }}</h2>
          <span class="sector-count">{{ sector.tickers.length }}</span>
        </div>
        <div class="ev-grid">
          <div
            v-for="(co,i) in sector.tickers"
            :key="co.ticker"
            class="ev-card default-card fade-up"
            :style="{animationDelay:`${i*0.03}s`}"
          >
            <div class="ev-top">
              <span class="ev-ticker">{{ co.ticker }}</span>
              <button
                :class="['add-btn', isWatched(co.ticker) && 'add-btn--added']"
                @click="!isWatched(co.ticker) && addWatch(co.ticker)"
                :title="isWatched(co.ticker) ? 'Already watching' : 'Add to watchlist'"
              >{{ isWatched(co.ticker) ? '✓' : '+' }}</button>
            </div>
            <p class="ev-company">{{ co.name }}</p>
            <div class="ev-foot">
              <span class="ev-date" v-if="getEarnings(co.ticker)">{{ fmtDate(getEarnings(co.ticker).earningsDate) }}</span>
              <span class="ev-date wl-tbd" v-else>Date TBD</span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- ── Add event modal ── -->
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

const SECTORS = [
  {
    name: 'Mega-cap Tech', icon: '💻',
    tickers: [
      { ticker: 'AAPL', name: 'Apple' }, { ticker: 'MSFT', name: 'Microsoft' },
      { ticker: 'NVDA', name: 'NVIDIA' }, { ticker: 'GOOGL', name: 'Alphabet' },
      { ticker: 'META', name: 'Meta' }, { ticker: 'AMZN', name: 'Amazon' },
      { ticker: 'TSLA', name: 'Tesla' }, { ticker: 'AMD', name: 'AMD' },
      { ticker: 'INTC', name: 'Intel' }, { ticker: 'CRM', name: 'Salesforce' },
    ],
  },
  {
    name: 'Finance', icon: '🏦',
    tickers: [
      { ticker: 'JPM', name: 'JPMorgan Chase' }, { ticker: 'GS', name: 'Goldman Sachs' },
      { ticker: 'MS', name: 'Morgan Stanley' }, { ticker: 'BAC', name: 'Bank of America' },
      { ticker: 'WFC', name: 'Wells Fargo' }, { ticker: 'BLK', name: 'BlackRock' },
      { ticker: 'C', name: 'Citigroup' }, { ticker: 'AXP', name: 'American Express' },
      { ticker: 'V', name: 'Visa' }, { ticker: 'MA', name: 'Mastercard' },
    ],
  },
  {
    name: 'Healthcare', icon: '🏥',
    tickers: [
      { ticker: 'JNJ', name: 'Johnson & Johnson' }, { ticker: 'PFE', name: 'Pfizer' },
      { ticker: 'UNH', name: 'UnitedHealth' }, { ticker: 'ABBV', name: 'AbbVie' },
      { ticker: 'MRK', name: 'Merck' }, { ticker: 'LLY', name: 'Eli Lilly' },
      { ticker: 'BMY', name: 'Bristol-Myers Squibb' }, { ticker: 'AMGN', name: 'Amgen' },
      { ticker: 'GILD', name: 'Gilead Sciences' }, { ticker: 'CVS', name: 'CVS Health' },
    ],
  },
  {
    name: 'Energy', icon: '⚡',
    tickers: [
      { ticker: 'XOM', name: 'ExxonMobil' }, { ticker: 'CVX', name: 'Chevron' },
      { ticker: 'COP', name: 'ConocoPhillips' }, { ticker: 'SLB', name: 'SLB' },
      { ticker: 'OXY', name: 'Occidental Petroleum' },
    ],
  },
  {
    name: 'Consumer', icon: '🛒',
    tickers: [
      { ticker: 'WMT', name: 'Walmart' }, { ticker: 'TGT', name: 'Target' },
      { ticker: 'COST', name: 'Costco' }, { ticker: 'MCD', name: "McDonald's" },
      { ticker: 'SBUX', name: 'Starbucks' }, { ticker: 'NKE', name: 'Nike' },
      { ticker: 'DIS', name: 'Disney' }, { ticker: 'NFLX', name: 'Netflix' },
    ],
  },
  {
    name: 'Industrial', icon: '🏗️',
    tickers: [
      { ticker: 'BA', name: 'Boeing' }, { ticker: 'CAT', name: 'Caterpillar' },
      { ticker: 'GE', name: 'GE Aerospace' }, { ticker: 'HON', name: 'Honeywell' },
      { ticker: 'UPS', name: 'UPS' }, { ticker: 'FDX', name: 'FedEx' },
    ],
  },
  {
    name: 'Other', icon: '🚀',
    tickers: [
      { ticker: 'UBER', name: 'Uber' }, { ticker: 'ABNB', name: 'Airbnb' },
      { ticker: 'SQ', name: 'Block' }, { ticker: 'PYPL', name: 'PayPal' },
      { ticker: 'SHOP', name: 'Shopify' }, { ticker: 'SNAP', name: 'Snap' },
      { ticker: 'X', name: 'X Corp' }, { ticker: 'GME', name: 'GameStop' },
    ],
  },
]

const ALL_COMPANIES = SECTORS.flatMap(s => s.tickers.map(t => ({ ...t, sector: s.name })))

export default {
  name: 'Earnings',
  data() {
    return {
      events: [], watchlist: [], loading: true, wlLoading: true,
      activeTab: 'calendar', showAdd: false, evSaving: false, evErr: null,
      evForm: { ticker: '', companyName: '', earningsDate: '', time: 'AMC' },
      tabs: [
        { label: 'Calendar', val: 'calendar' },
        { label: 'My watchlist', val: 'watchlist' },
        { label: 'Discover', val: 'discover' },
      ],
      sectors: SECTORS,
      searchQuery: '',
      searchResults: [],
    }
  },
  computed: {
    filtered() {
      const now = new Date(); now.setHours(0, 0, 0, 0)
      return this.events.filter(e => new Date(e.earningsDate) >= now)
    },
    watchedTickers() {
      return new Set(this.watchlist.map(w => w.ticker))
    },
    enrichedWatchlist() {
      return this.watchlist.map(item => {
        const ev = this.getEarnings(item.ticker)
        const co = ALL_COMPANIES.find(c => c.ticker === item.ticker)
        return {
          ...item,
          companyName: item.companyName || co?.name || item.ticker,
          earningsDate: ev?.earningsDate || item.earningsDate || null,
          time: ev?.time || item.time || null,
        }
      })
    },
  },
  async created() {
    await Promise.all([this.fetchEvents(), this.fetchWatchlist()])
  },
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
        const ev = await api.post('/earnings', { ...this.evForm, ticker: this.evForm.ticker.toUpperCase() })
        this.events.unshift(ev)
        this.showAdd = false
        this.evForm = { ticker: '', companyName: '', earningsDate: '', time: 'AMC' }
      } catch (e) { this.evErr = e.message }
      finally { this.evSaving = false }
    },
    async addWatch(ticker) {
      if (this.isWatched(ticker)) return
      const co = ALL_COMPANIES.find(c => c.ticker === ticker)
      try {
        const item = await api.post('/watchlist', { ticker, companyName: co?.name || ticker })
        this.watchlist.unshift(item)
      } catch (e) {
        if (!e.message.includes('already')) alert(e.message)
      }
    },
    async removeWatch(id) {
      await api.delete(`/watchlist/${id}`)
      this.watchlist = this.watchlist.filter(w => w._id !== id)
    },
    isWatched(ticker) { return this.watchedTickers.has(ticker) },
    getEarnings(ticker) {
      const now = new Date(); now.setHours(0, 0, 0, 0)
      return this.events
        .filter(e => e.ticker === ticker && new Date(e.earningsDate) >= now)
        .sort((a, b) => new Date(a.earningsDate) - new Date(b.earningsDate))[0] || null
    },
    fmtDate(d) {
      return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    },
    countdown(d) {
      const now = new Date(); now.setHours(0, 0, 0, 0)
      const target = new Date(d); target.setHours(0, 0, 0, 0)
      const days = Math.round((target - now) / 86400000)
      if (days === 0) return 'Today'
      if (days === 1) return 'Tomorrow'
      if (days < 0) return `${Math.abs(days)}d ago`
      return `in ${days}d`
    },
    onSearchInput() {
      const q = this.searchQuery.trim().toLowerCase()
      if (!q) { this.searchResults = []; return }
      this.searchResults = ALL_COMPANIES
        .filter(c => c.ticker.toLowerCase().includes(q) || c.name.toLowerCase().includes(q))
        .slice(0, 6)
    },
    async addSearchResult(result) {
      this.searchQuery = ''
      this.searchResults = []
      if (!this.isWatched(result.ticker)) await this.addWatch(result.ticker)
    },
  },
}
</script>

<style scoped>
.ev-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(190px, 1fr));
  gap: 10px;
}
.wl-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 10px;
}

/* Calendar cards */
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
  font-family: var(--mono); font-size: 0.6rem; font-weight: 600;
  padding: 2px 6px; border-radius: 3px; text-transform: uppercase;
}
.ev-bmo { background: rgba(61,220,132,0.1); color: var(--green); border: 1px solid rgba(61,220,132,0.2); }
.ev-amc { background: rgba(255,107,107,0.1); color: var(--red); border: 1px solid rgba(255,107,107,0.2); }
.ev-company { font-size: 0.82rem; font-weight: 600; line-height: 1.3; flex: 1; }
.ev-foot { display: flex; align-items: center; justify-content: space-between; margin-top: auto; }
.ev-date { font-family: var(--mono); font-size: 0.65rem; color: var(--muted); }
.watch-btn {
  background: none; border: 1px solid var(--border); color: var(--muted2);
  font-family: var(--sans); font-size: 0.72rem; font-weight: 500;
  cursor: pointer; padding: 3px 9px; border-radius: var(--r); transition: all 0.12s;
}
.watch-btn:hover { color: var(--accent); border-color: rgba(201,242,49,0.3); }
.watch-btn--added { color: var(--green); border-color: rgba(61,220,132,0.3); cursor: default; }

/* Watchlist cards */
.wl-card {
  background: var(--surface); border: 1px solid var(--border);
  border-radius: var(--r-lg); padding: 14px 16px;
  display: flex; flex-direction: column; gap: 6px;
  transition: border-color 0.15s;
}
.wl-card:hover { border-color: var(--border2); }
.wl-card-top { display: flex; align-items: center; justify-content: space-between; }
.wl-ticker { font-family: var(--mono); font-size: 0.95rem; font-weight: 500; }
.wl-company { font-size: 0.8rem; color: var(--muted2); line-height: 1.3; }
.wl-remove {
  background: none; border: none; color: var(--muted); font-size: 0.75rem;
  cursor: pointer; padding: 2px 4px; border-radius: 3px; transition: color 0.12s; line-height: 1;
}
.wl-remove:hover { color: var(--red); }
.wl-earnings-block {
  display: flex; align-items: center; gap: 8px; margin-top: 6px;
  padding-top: 8px; border-top: 1px solid var(--border);
}
.wl-date { font-family: var(--mono); font-size: 0.68rem; color: var(--muted2); }
.wl-countdown { font-family: var(--mono); font-size: 0.65rem; font-weight: 500; color: var(--accent); margin-left: auto; }
.wl-no-date { opacity: 0.5; }
.wl-tbd { font-family: var(--mono); font-size: 0.68rem; color: var(--muted); }

/* Search */
.wl-search-bar { position: relative; margin-bottom: 20px; }
.search-wrap { position: relative; display: flex; align-items: center; }
.search-icon {
  position: absolute; left: 12px; width: 14px; height: 14px;
  color: var(--muted); pointer-events: none;
}
.search-input {
  width: 100%; padding: 10px 36px !important;
  background: var(--surface); border: 1px solid var(--border);
  border-radius: var(--r-lg); font-family: var(--sans); font-size: 0.88rem;
  color: var(--text); outline: none; transition: border-color 0.15s;
}
.search-input:focus { border-color: var(--accent); }
.search-clear {
  position: absolute; right: 10px; background: none; border: none;
  color: var(--muted); cursor: pointer; font-size: 0.8rem; padding: 4px; transition: color 0.12s;
}
.search-clear:hover { color: var(--text); }
.search-dropdown {
  position: absolute; top: calc(100% + 4px); left: 0; right: 0;
  background: var(--surface2); border: 1px solid var(--border2);
  border-radius: var(--r-lg); z-index: 50; overflow: hidden;
}
.search-result {
  width: 100%; background: none; border: none; text-align: left;
  display: flex; align-items: center; gap: 10px;
  padding: 10px 14px; cursor: pointer; transition: background 0.1s;
  border-bottom: 1px solid var(--border);
}
.search-result:last-child { border-bottom: none; }
.search-result:hover { background: var(--surface3); }
.sr-ticker { font-family: var(--mono); font-size: 0.88rem; font-weight: 500; color: var(--text); min-width: 52px; }
.sr-name { font-size: 0.82rem; color: var(--muted2); flex: 1; }
.sr-badge { font-family: var(--mono); font-size: 0.65rem; color: var(--green); }
.sr-add { font-family: var(--mono); font-size: 0.65rem; color: var(--accent); }

/* Discover */
.sector-section { margin-bottom: 32px; }
.sector-header {
  display: flex; align-items: center; gap: 8px;
  margin-bottom: 12px; padding-bottom: 8px; border-bottom: 1px solid var(--border);
}
.sector-icon { font-size: 1rem; }
.sector-name { font-size: 0.88rem; font-weight: 600; color: var(--text); }
.sector-count {
  font-family: var(--mono); font-size: 0.68rem; color: var(--muted);
  background: var(--surface2); border: 1px solid var(--border); padding: 1px 7px; border-radius: 10px;
}
.default-card { position: relative; }
.add-btn {
  width: 24px; height: 24px; display: flex; align-items: center; justify-content: center;
  background: none; border: 1px solid var(--border); border-radius: 50%;
  font-size: 1rem; line-height: 1; font-weight: 400;
  color: var(--muted2); cursor: pointer; transition: all 0.12s; flex-shrink: 0;
}
.add-btn:hover { color: var(--accent); border-color: rgba(201,242,49,0.4); background: rgba(201,242,49,0.05); }
.add-btn--added { color: var(--green); border-color: rgba(61,220,132,0.35); cursor: default; font-size: 0.75rem; }

/* Misc */
.empty-state { display: flex; flex-direction: column; align-items: center; gap: 14px; padding: 80px 24px; text-align: center; }
.empty-icon { font-size: 2rem; }
.empty-msg { color: var(--muted); font-size: 0.88rem; }
</style>