<template>
    <div>
      <div class="page-header">
        <h1>Earnings Calendar</h1>
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
  
      <!-- MY WATCHLIST TAB -->
      <div v-if="activeTab === 'My Watchlist'">

        <!-- Custom ticker search -->
        <div class="add-section">
          <div class="search-row">
            <input v-model="form.ticker" placeholder="Search ticker (e.g. AAPL)" class="search-input" @keyup.enter="handleLookup" />
            <button @click="handleLookup" :disabled="looking" class="btn-secondary" type="button">
              {{ looking ? 'Looking up...' : 'Search' }}
            </button>
          </div>
          <div v-if="lookupMessage" class="info">{{ lookupMessage }}</div>
          <div v-if="formError" class="error">{{ formError }}</div>
          <div v-if="form.ticker && (lookupMessage || form.reportDate)" class="quick-add-form">
            <div class="form-row">
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
              <div class="form-group">
                <label>Notes</label>
                <input v-model="form.notes" placeholder="Optional notes" />
              </div>
            </div>
            <button @click="handleSubmit" :disabled="submitting" class="btn-primary">
              {{ submitting ? 'Saving...' : 'Add to Watchlist' }}
            </button>
          </div>
        </div>

        <!-- YOUR WATCHLIST — top section -->
        <div v-if="watchlistLoading" class="empty">Loading...</div>
        <div v-else-if="earningsStore.upcoming.length === 0" class="empty-watchlist">
          Nothing on your watchlist yet — click <strong>+ Watch</strong> below or search above.
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

        <!-- Divider -->
        <div class="suggestions-divider">
          <span>Upcoming earnings — click + Watch to add</span>
        </div>

        <!-- Calendar suggestions -->
        <div v-if="calendarLoading" class="empty">Loading upcoming earnings...</div>
        <div v-else-if="earningsStore.calendar.length > 0" class="calendar-grid">
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
                <span v-if="watch.actualMove != null" :class="['move', watch.actualMove >= 0 ? 'positive' : 'negative']">
                  {{ watch.actualMove >= 0 ? '+' : '' }}{{ watch.actualMove }}%
                </span>
                <button @click="openSummary(watch)" class="summarize-btn">✦ AI Summary</button>
                <button @click="earningsStore.deleteWatch(watch._id)" class="delete-btn">Delete</button>
              </div>
            </div>
            <p v-if="watch.notes" class="notes">{{ watch.notes }}</p>
          </div>
        </div>
      </div>
    </div>

  <!-- Earnings Summary Modal -->
  <Teleport to="body">
    <div v-if="summaryModal.open" class="modal-backdrop" @click.self="summaryModal.open = false">
      <div class="summary-modal">
        <div class="summary-header">
          <div class="summary-title-row">
            <span class="summary-ticker">{{ summaryModal.ticker }}</span>
            <span v-if="summaryData" :class="['verdict-badge', summaryData.verdict]">
              {{ summaryData.verdict === 'beat' ? '✓ Beat' : summaryData.verdict === 'miss' ? '✗ Miss' : '— Inline' }}
            </span>
            <span v-if="summaryData" :class="['sentiment-badge', summaryData.sentiment]">{{ summaryData.sentiment }}</span>
          </div>
          <button class="close-btn" @click="summaryModal.open = false">✕</button>
        </div>

        <div v-if="summaryLoading" class="summary-loading">
          <div class="spinner"></div>
          <span>Analyzing earnings report...</span>
        </div>

        <div v-else-if="summaryError" class="summary-error">{{ summaryError }}</div>

        <div v-else-if="summaryData" class="summary-body">
          <p class="summary-headline">{{ summaryData.headline }}</p>

          <div class="eps-row">
            <div class="eps-box">
              <span class="eps-label">Reported EPS</span>
              <span class="eps-value">${{ summaryData.epsActual?.toFixed(2) }}</span>
            </div>
            <div class="eps-box">
              <span class="eps-label">Estimated EPS</span>
              <span class="eps-value">${{ summaryData.epsEstimate?.toFixed(2) }}</span>
            </div>
            <div class="eps-box">
              <span class="eps-label">Surprise</span>
              <span :class="['eps-value', summaryData.surprisePct >= 0 ? 'positive' : 'negative']">
                {{ summaryData.surprisePct >= 0 ? '+' : '' }}{{ summaryData.surprisePct?.toFixed(1) }}%
              </span>
            </div>
            <div v-if="summaryData.analystTarget" class="eps-box">
              <span class="eps-label">Analyst Target</span>
              <span class="eps-value">${{ summaryData.analystTarget }}</span>
            </div>
          </div>

          <div class="key-points">
            <h4>Key Points</h4>
            <ul>
              <li v-for="(point, i) in summaryData.keyPoints" :key="i">{{ point }}</li>
            </ul>
          </div>

          <div class="watch-for">
            <span class="watch-label">📍 Watch for:</span>
            <span>{{ summaryData.watchFor }}</span>
          </div>
        </div>
      </div>
    </div>
  </Teleport>

  </template>
  
  <script setup>
  import { ref, onMounted } from 'vue'
  import { useEarningsStore } from '../stores/earningsStore'
  
  const earningsStore = useEarningsStore()
  
  const calendarLoading = ref(false)
  const watchlistLoading = ref(false)
  const submitting = ref(false)
  const looking = ref(false)
  const formError = ref('')
  const lookupMessage = ref('')
  const activeTab = ref('My Watchlist')
  const tabs = ['My Watchlist', 'Completed']

  // Earnings summary modal state
  const summaryModal = ref({ open: false, ticker: '' })
  const summaryLoading = ref(false)
  const summaryError = ref('')
  const summaryData = ref(null)

  async function openSummary(watch) {
    summaryModal.value = { open: true, ticker: watch.ticker }
    summaryLoading.value = true
    summaryError.value = ''
    summaryData.value = null
    try {
      const token = localStorage.getItem('token')
      const res = await fetch(`/api/earnings/summarize/${encodeURIComponent(watch.ticker)}`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to load summary')
      summaryData.value = data
    } catch (err) {
      summaryError.value = err.message
    } finally {
      summaryLoading.value = false
    }
  }
  
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
    
    // Try to populate missing dates for watchlist items
    await populateMissingDates()
  })
  
  async function quickWatch(item) {
    try {
      const reportDate = item.reportDate || (await earningsStore.lookupTicker(item.ticker)).reportDate || null
      await earningsStore.addWatch({
        ticker: item.ticker,
        reportDate,
        view: null,
        notes: ''
      })
    } catch (err) {
      console.error('Failed to watch:', err)
    }
  }
  
  async function handleLookup() {
    console.log('handleLookup called with ticker:', form.value.ticker)
    if (!form.value.ticker) {
      console.log('No ticker provided')
      return
    }
    looking.value = true
    lookupMessage.value = ''
    try {
      console.log('Calling lookupTicker for:', form.value.ticker.toUpperCase())
      const data = await earningsStore.lookupTicker(form.value.ticker.toUpperCase())
      console.log('Lookup result:', data)
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
  
  async function populateMissingDates() {
    for (const watch of earningsStore.watches) {
      if (!watch.reportDate) {
        try {
          const data = await earningsStore.lookupTicker(watch.ticker)
          if (data.reportDate) {
            await earningsStore.updateWatch(watch._id, { reportDate: data.reportDate })
          }
        } catch (err) {
          console.log(`Could not lookup date for ${watch.ticker}:`, err.message)
        }
      }
    }
  }

  async function handleSubmit() {
    if (!form.value.ticker) {
      formError.value = 'Ticker is required'
      return
    }
    submitting.value = true
    formError.value = ''
    try {
      let reportDate = form.value.reportDate
      if (!reportDate) {
        try {
          const data = await earningsStore.lookupTicker(form.value.ticker.toUpperCase())
          reportDate = data.reportDate || null
        } catch {
          // Lookup failed, use null
        }
      }
      await earningsStore.addWatch({
        ticker: form.value.ticker.toUpperCase(),
        reportDate,
        view: form.value.view || null,
        notes: form.value.notes
      })
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
  
  .add-section {
    background-color: #161b27;
    border: 1px solid #2a2f3e;
    border-radius: 10px;
    padding: 1.25rem 1.5rem;
    margin-bottom: 1.5rem;
  }
  
  .search-row {
    display: flex;
    gap: 0.75rem;
    align-items: center;
    margin-bottom: 0.75rem;
  }
  
  .search-input {
    flex: 1;
  }
  
  .quick-add-form {
    margin-top: 0.75rem;
    border-top: 1px solid #2a2f3e;
    padding-top: 0.75rem;
  }
  
  .suggestions-divider {
    display: flex;
    align-items: center;
    gap: 1rem;
    margin: 1.75rem 0 1.25rem;
    color: #444;
    font-size: 0.8rem;
    text-transform: uppercase;
    letter-spacing: 0.08em;
  }

  .suggestions-divider::before,
  .suggestions-divider::after {
    content: '';
    flex: 1;
    height: 1px;
    background: #2a2f3e;
  }

  .empty-watchlist {
    text-align: center;
    color: #555;
    padding: 1.5rem;
    font-size: 0.9rem;
  }

  .discover-section {
    margin-bottom: 1.5rem;
  }


  .empty {
    color: #555;
    text-align: center;
    padding: 3rem;
  }

  /* Summarize button */
  .summarize-btn {
    background: none;
    border: 1px solid #4ade8055;
    color: #4ade80;
    padding: 0.3rem 0.75rem;
    border-radius: 6px;
    cursor: pointer;
    font-size: 0.82rem;
    font-weight: 600;
    transition: background 0.15s;
  }
  .summarize-btn:hover { background: #1b2d1b; }

  /* Summary Modal */
  .modal-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(0,0,0,0.75);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
    padding: 1rem;
  }

  .summary-modal {
    background: #0f1117;
    border: 1px solid #2a2f3e;
    border-radius: 14px;
    width: 100%;
    max-width: 640px;
    padding: 1.75rem;
    display: flex;
    flex-direction: column;
    gap: 1.25rem;
    max-height: 90vh;
    overflow-y: auto;
  }

  .summary-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
  }

  .summary-title-row {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    flex-wrap: wrap;
  }

  .summary-ticker {
    font-size: 1.5rem;
    font-weight: 800;
    color: #e0e0e0;
  }

  .verdict-badge {
    padding: 0.25rem 0.75rem;
    border-radius: 20px;
    font-size: 0.85rem;
    font-weight: 700;
  }
  .verdict-badge.beat { background: #1b2d1b; color: #4ade80; }
  .verdict-badge.miss { background: #2d1b1b; color: #e05252; }
  .verdict-badge.inline { background: #2a2f3e; color: #aaa; }

  .sentiment-badge {
    padding: 0.25rem 0.75rem;
    border-radius: 20px;
    font-size: 0.82rem;
    border: 1px solid #2a2f3e;
    color: #888;
    text-transform: capitalize;
  }

  .close-btn {
    background: none;
    border: none;
    color: #555;
    font-size: 1.2rem;
    cursor: pointer;
    padding: 0.2rem 0.5rem;
    border-radius: 4px;
    transition: color 0.15s;
    flex-shrink: 0;
  }
  .close-btn:hover { color: #e0e0e0; }

  .summary-loading {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 1rem;
    padding: 2rem;
    color: #555;
    font-size: 0.9rem;
  }

  .spinner {
    width: 28px;
    height: 28px;
    border: 2px solid #2a2f3e;
    border-top-color: #4ade80;
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }

  @keyframes spin { to { transform: rotate(360deg); } }

  .summary-error {
    color: #e05252;
    padding: 1rem;
    background: #2d1b1b;
    border-radius: 8px;
    font-size: 0.9rem;
  }

  .summary-headline {
    font-size: 1rem;
    color: #e0e0e0;
    line-height: 1.5;
    font-weight: 500;
  }

  .eps-row {
    display: flex;
    gap: 0.75rem;
    flex-wrap: wrap;
  }

  .eps-box {
    flex: 1;
    min-width: 110px;
    background: #161b27;
    border: 1px solid #2a2f3e;
    border-radius: 8px;
    padding: 0.75rem 1rem;
    display: flex;
    flex-direction: column;
    gap: 0.3rem;
  }

  .eps-label {
    font-size: 0.75rem;
    color: #555;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .eps-value {
    font-size: 1.1rem;
    font-weight: 700;
    color: #e0e0e0;
  }
  .eps-value.positive { color: #4ade80; }
  .eps-value.negative { color: #e05252; }

  .key-points h4 {
    font-size: 0.8rem;
    text-transform: uppercase;
    letter-spacing: 0.07em;
    color: #555;
    margin-bottom: 0.6rem;
  }

  .key-points ul {
    list-style: none;
    padding: 0;
    margin: 0;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .key-points li {
    font-size: 0.9rem;
    color: #bbb;
    padding-left: 1.1rem;
    position: relative;
    line-height: 1.5;
  }

  .key-points li::before {
    content: '›';
    position: absolute;
    left: 0;
    color: #4ade80;
    font-weight: 700;
  }

  .watch-for {
    background: #161b27;
    border: 1px solid #2a2f3e;
    border-left: 3px solid #f59e0b;
    border-radius: 6px;
    padding: 0.75rem 1rem;
    font-size: 0.9rem;
    color: #bbb;
    line-height: 1.5;
  }

  .watch-label {
    color: #f59e0b;
    font-weight: 600;
    margin-right: 0.5rem;
  }
  </style>