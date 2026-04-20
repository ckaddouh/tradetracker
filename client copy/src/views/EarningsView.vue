<template>
    <div>
      <div class="page-header">
        <h1>Earnings Calendar</h1>
        <button @click="showForm = !showForm" class="btn-primary">
          {{ showForm ? 'Cancel' : '+ Watch Custom Ticker' }}
        </button>
      </div>
  
      <!-- Custom ticker form -->
      <div v-if="showForm" class="form-card">
        <h3>Watch a Custom Ticker</h3>
        <div class="form-row">
          <div class="form-group">
            <label>Ticker</label>
            <div class="input-col">
              <input v-model="form.ticker" placeholder="e.g. AAPL" />
              <button @click="handleLookup" :disabled="looking" class="btn-secondary">
                {{ looking ? 'Looking up...' : 'Lookup Date' }}
              </button>
            </div>
          </div>
          <div class="form-group">
            <label>Report Date</label>
            <input v-model="form.reportDate" type="date" />
          </div>
          <div class="form-group">
            <label>Your View</label>
            <select v-model="form.view">
              <option value="">No view yet</option>
              <option value="bullish">Bullish</option>
              <option value="bearish">Bearish</option>
              <option value="neutral">Neutral</option>
            </select>
          </div>
        </div>
        <div class="form-group">
          <label>Notes</label>
          <textarea v-model="form.notes" placeholder="What are you watching for?" rows="2" />
        </div>
        <div v-if="lookupMessage" class="info">{{ lookupMessage }}</div>
        <div v-if="formError" class="error">{{ formError }}</div>
        <button @click="handleSubmit" :disabled="submitting" class="btn-primary">
          {{ submitting ? 'Saving...' : 'Add to Watchlist' }}
        </button>
      </div>
  
      <!-- Tabs -->
      <div class="tabs">
        <button
          v-for="tab in tabs"
          :key="tab"
          @click="activeTab = tab"
          :class="['tab', { active: activeTab === tab }]"
        >
          {{ tab }}
        </button>
      </div>
  
      <!-- CALENDAR TAB -->
      <div v-if="activeTab === 'Calendar'">
        <div v-if="calendarLoading" class="empty">Loading earnings calendar...</div>
        <div v-else-if="earningsStore.calendar.length === 0" class="empty">No upcoming earnings found.</div>
        <div v-else>
          <p class="calendar-subtitle">Showing upcoming earnings for major names. Click "Watch" to track your view.</p>
          <div class="calendar-grid">
            <div
              v-for="item in earningsStore.calendar"
              :key="item.ticker"
              class="calendar-card"
            >
              <div class="calendar-card-header">
                <span class="ticker">{{ item.ticker }}</span>
                <span class="report-date">{{ formatDate(item.reportDate) }}</span>
              </div>
              <p class="company-name">{{ item.name }}</p>
              <p class="eps" v-if="item.estimatedEPS">Est. EPS: {{ item.estimatedEPS }}</p>
              <button
                v-if="!earningsStore.watchedTickers.includes(item.ticker)"
                @click="quickWatch(item)"
                class="watch-btn"
              >
                + Watch
              </button>
              <span v-else class="watching-badge">Watching ✓</span>
            </div>
          </div>
        </div>
      </div>
  
      <!-- WATCHLIST TAB -->
      <div v-if="activeTab === 'My Watchlist'">
        <div v-if="watchlistLoading" class="empty">Loading...</div>
        <div v-else-if="earningsStore.upcoming.length === 0" class="empty">
          No tickers on your watchlist yet — add from the calendar or use the custom ticker button.
        </div>
        <div v-else class="earnings-list">
          <div v-for="watch in earningsStore.upcoming" :key="watch._id" class="earnings-card">
            <div class="card-header">
              <div class="ticker-info">
                <span class="ticker">{{ watch.ticker }}</span>
                <span v-if="watch.view" :class="['view-badge', watch.view]">{{ watch.view }}</span>
              </div>
              <div class="card-meta">
                <span class="report-date">{{ watch.reportDate ? formatDate(watch.reportDate) : 'Date TBD' }}</span>
                <button @click="earningsStore.deleteWatch(watch._id)" class="delete-btn">Delete</button>
              </div>
            </div>
            <p v-if="watch.notes" class="notes">{{ watch.notes }}</p>
            <div class="post-earnings">
              <div class="form-group">
                <label>Your View</label>
                <select :value="watch.view" @change="e => earningsStore.updateWatch(watch._id, { view: e.target.value })">
                  <option value="">No view</option>
                  <option value="bullish">Bullish</option>
                  <option value="bearish">Bearish</option>
                  <option value="neutral">Neutral</option>
                </select>
              </div>
              <div class="form-group">
                <label>Result</label>
                <select :value="watch.result" @change="e => earningsStore.updateWatch(watch._id, { result: e.target.value })">
                  <option value="">Pending...</option>
                  <option value="beat">Beat</option>
                  <option value="miss">Miss</option>
                  <option value="inline">Inline</option>
                </select>
              </div>
              <div class="form-group">
                <label>Actual Move %</label>
                <input
                  type="number"
                  :value="watch.actualMove"
                  @change="e => earningsStore.updateWatch(watch._id, { actualMove: parseFloat(e.target.value) })"
                  placeholder="e.g. 5.2 or -3.1"
                />
              </div>
            </div>
          </div>
        </div>
      </div>
  
      <!-- COMPLETED TAB -->
      <div v-if="activeTab === 'Completed'">
        <div v-if="earningsStore.completed.length === 0" class="empty">No completed earnings yet.</div>
        <div v-else class="earnings-list">
          <div v-for="watch in earningsStore.completed" :key="watch._id" class="earnings-card">
            <div class="card-header">
              <div class="ticker-info">
                <span class="ticker">{{ watch.ticker }}</span>
                <span v-if="watch.view" :class="['view-badge', watch.view]">{{ watch.view }}</span>
                <span v-if="watch.result" :class="['result-badge', watch.result]">{{ watch.result }}</span>
              </div>
              <div class="card-meta">
                <span :class="['move', watch.actualMove >= 0 ? 'positive' : 'negative']">
                  {{ watch.actualMove >= 0 ? '+' : '' }}{{ watch.actualMove }}%
                </span>
                <button @click="earningsStore.deleteWatch(watch._id)" class="delete-btn">Delete</button>
              </div>
            </div>
            <p v-if="watch.notes" class="notes">{{ watch.notes }}</p>
          </div>
        </div>
      </div>
  
    </div>
  </template>
  
  <script setup>
  import { ref, onMounted } from 'vue'
  import { useEarningsStore } from '../stores/earningsStore'
  
  const earningsStore = useEarningsStore()
  
  const showForm = ref(false)
  const calendarLoading = ref(false)
  const watchlistLoading = ref(false)
  const submitting = ref(false)
  const looking = ref(false)
  const formError = ref('')
  const lookupMessage = ref('')
  const activeTab = ref('Calendar')
  const tabs = ['Calendar', 'My Watchlist', 'Completed']
  
  const form = ref({
    ticker: '',
    reportDate: '',
    view: '',
    notes: ''
  })
  
  onMounted(async () => {
    calendarLoading.value = true
    watchlistLoading.value = true
    await Promise.all([
      earningsStore.fetchCalendar(),
      earningsStore.fetchWatches()
    ])
    calendarLoading.value = false
    watchlistLoading.value = false
  })
  
  async function quickWatch(item) {
    try {
      await earningsStore.addWatch({
        ticker: item.ticker,
        reportDate: item.reportDate || null,
        view: null,
        notes: ''
      })
    } catch (err) {
      console.error('Failed to watch:', err)
    }
  }
  
  async function handleLookup() {
    if (!form.value.ticker) return
    looking.value = true
    lookupMessage.value = ''
    try {
      const data = await earningsStore.lookupTicker(form.value.ticker.toUpperCase())
      if (data.reportDate) {
        form.value.reportDate = data.reportDate
        lookupMessage.value = `Found report date: ${data.reportDate}`
      } else {
        lookupMessage.value = 'No upcoming date found — set it manually.'
      }
    } catch {
      lookupMessage.value = 'Lookup failed — set the date manually.'
    } finally {
      looking.value = false
    }
  }
  
  async function handleSubmit() {
    formError.value = ''
    if (!form.value.ticker) {
      formError.value = 'Ticker is required'
      return
    }
    submitting.value = true
    try {
      await earningsStore.addWatch({
        ticker: form.value.ticker.toUpperCase(),
        reportDate: form.value.reportDate || null,
        view: form.value.view || null,
        notes: form.value.notes
      })
      showForm.value = false
      form.value = { ticker: '', reportDate: '', view: '', notes: '' }
      lookupMessage.value = ''
    } catch (err) {
      formError.value = err.response?.data?.error || 'Failed to add watch'
    } finally {
      submitting.value = false
    }
  }
  
  function formatDate(dateStr) {
    if (!dateStr) return 'TBD'
    return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  }
  </script>
  
  <style scoped>
  .page-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 1.5rem;
  }
  
  h1 {
    font-size: 1.8rem;
    color: #4ade80;
  }
  
  .form-card {
    background-color: #161b27;
    border: 1px solid #2a2f3e;
    border-radius: 10px;
    padding: 1.5rem;
    margin-bottom: 1.5rem;
  }
  
  h3 {
    margin-bottom: 1rem;
    color: #e0e0e0;
  }
  
  .form-row {
    display: grid;
    grid-template-columns: 1fr 1fr 1fr;
    gap: 1rem;
    margin-bottom: 1rem;
  }
  
  .input-col {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }
  
  .input-col input {
    width: 100%;
  }
  
  .input-col .btn-secondary {
    width: 100%;
    text-align: center;
  }
  
  .form-group {
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
  }
  
  label {
    font-size: 0.85rem;
    color: #aaa;
  }
  
  input, select, textarea {
    padding: 0.6rem 0.8rem;
    background-color: #0f1117;
    border: 1px solid #2a2f3e;
    border-radius: 6px;
    color: #e0e0e0;
    font-size: 0.9rem;
  }
  
  input:focus, select:focus, textarea:focus {
    outline: none;
    border-color: #4ade80;
  }
  
  textarea {
    resize: vertical;
    font-family: inherit;
    margin-bottom: 1rem;
  }
  
  .btn-primary {
    padding: 0.65rem 1.4rem;
    background-color: #4ade80;
    color: #0f1117;
    border: none;
    border-radius: 6px;
    font-size: 0.95rem;
    font-weight: 600;
    cursor: pointer;
  }
  
  .btn-primary:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
  
  .btn-secondary {
    padding: 0.6rem 1rem;
    background: none;
    border: 1px solid #4ade80;
    color: #4ade80;
    border-radius: 6px;
    cursor: pointer;
    font-size: 0.9rem;
  }
  
  .btn-secondary:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
  
  .tabs {
    display: flex;
    gap: 0.5rem;
    margin-bottom: 1.5rem;
  }
  
  .tab {
    padding: 0.5rem 1.2rem;
    border-radius: 20px;
    border: 1px solid #2a2f3e;
    background: none;
    color: #888;
    cursor: pointer;
    font-size: 0.9rem;
  }
  
  .tab.active {
    background-color: #4ade80;
    color: #0f1117;
    border-color: #4ade80;
    font-weight: 600;
  }
  
  .calendar-subtitle {
    color: #888;
    font-size: 0.9rem;
    margin-bottom: 1rem;
  }
  
  .calendar-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
    gap: 1rem;
  }
  
  .calendar-card {
    background-color: #161b27;
    border: 1px solid #2a2f3e;
    border-radius: 10px;
    padding: 1rem;
  }
  
  .calendar-card-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 0.4rem;
  }
  
  .ticker {
    font-size: 1.1rem;
    font-weight: 700;
    color: #e0e0e0;
  }
  
  .report-date {
    font-size: 0.8rem;
    color: #f59e0b;
  }
  
  .company-name {
    font-size: 0.8rem;
    color: #888;
    margin-bottom: 0.4rem;
  }
  
  .eps {
    font-size: 0.8rem;
    color: #555;
    margin-bottom: 0.75rem;
  }
  
  .watch-btn {
    width: 100%;
    padding: 0.4rem;
    background: none;
    border: 1px solid #4ade80;
    color: #4ade80;
    border-radius: 6px;
    cursor: pointer;
    font-size: 0.85rem;
  }
  
  .watch-btn:hover {
    background-color: #4ade80;
    color: #0f1117;
  }
  
  .watching-badge {
    display: block;
    text-align: center;
    font-size: 0.85rem;
    color: #4ade80;
    padding: 0.4rem;
  }
  
  .earnings-list {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }
  
  .earnings-card {
    background-color: #161b27;
    border: 1px solid #2a2f3e;
    border-radius: 10px;
    padding: 1.25rem 1.5rem;
  }
  
  .card-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 0.75rem;
  }
  
  .ticker-info {
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }
  
  .view-badge {
    padding: 0.2rem 0.6rem;
    border-radius: 4px;
    font-size: 0.8rem;
    font-weight: 600;
  }
  
  .view-badge.bullish { background-color: #1b2d1b; color: #4ade80; }
  .view-badge.bearish { background-color: #2d1b1b; color: #e05252; }
  .view-badge.neutral { background-color: #2a2f3e; color: #aaa; }
  
  .result-badge {
    padding: 0.2rem 0.6rem;
    border-radius: 4px;
    font-size: 0.8rem;
    font-weight: 600;
  }
  
  .result-badge.beat { background-color: #1b2d1b; color: #4ade80; }
  .result-badge.miss { background-color: #2d1b1b; color: #e05252; }
  .result-badge.inline { background-color: #2a2f3e; color: #aaa; }
  
  .card-meta {
    display: flex;
    align-items: center;
    gap: 1rem;
  }
  
  .move {
    font-size: 1rem;
    font-weight: 700;
  }
  
  .move.positive { color: #4ade80; }
  .move.negative { color: #e05252; }
  
  .notes {
    color: #aaa;
    font-size: 0.9rem;
    margin-bottom: 1rem;
  }
  
  .post-earnings {
    display: flex;
    gap: 1rem;
  }
  
  .post-earnings .form-group {
    flex: 1;
  }
  
  .delete-btn {
    background: none;
    border: 1px solid #2a2f3e;
    color: #555;
    padding: 0.35rem 0.75rem;
    border-radius: 6px;
    cursor: pointer;
    font-size: 0.85rem;
  }
  
  .delete-btn:hover {
    border-color: #e05252;
    color: #e05252;
  }
  
  .info {
    background-color: #1b2233;
    border: 1px solid #3a4a6a;
    color: #88aadd;
    padding: 0.6rem 0.9rem;
    border-radius: 6px;
    margin-bottom: 1rem;
    font-size: 0.9rem;
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
  
  .empty {
    color: #555;
    text-align: center;
    padding: 3rem;
  }
  </style>