<template>
  <div>
    <div class="page-header">
      <h1>Earnings Calendar</h1>
    </div>

    <div class="tabs">
      <button v-for="tab in tabs" :key="tab" @click="activeTab = tab" :class="['tab', { active: activeTab === tab }]">
        {{ tab }}
      </button>
    </div>

    <!-- ═══════════════════════════════════════════════
         MY WATCHLIST TAB
    ═══════════════════════════════════════════════ -->
    <div v-if="activeTab === 'My Watchlist'">
      <div v-if="watchlistLoading" class="empty">Loading...</div>
      <div v-else-if="earningsStore.upcoming.length === 0" class="empty-watchlist">
        Nothing on your watchlist yet — go to <strong>Upcoming & Add</strong> to add stocks.
      </div>
      <div v-else class="earnings-list">
        <div v-for="watch in earningsStore.upcoming" :key="watch._id" class="earnings-card">
          <div class="card-header">
            <div class="ticker-info">
              <span class="ticker">{{ watch.ticker }}</span>
            </div>
            <div class="card-meta">
              <span class="report-date">{{ watch.reportDate ? formatDate(watch.reportDate) : 'Date TBD' }}</span>
              <!-- Mark Complete: only shown if report date has passed -->
              <button
                v-if="watch.reportDate && isPast(watch.reportDate)"
                @click="handleMarkComplete(watch)"
                class="complete-btn"
                title="Move to Completed"
              >✓ Mark Complete</button>
              <button @click="earningsStore.deleteWatch(watch._id)" class="delete-btn">Delete</button>
            </div>
          </div>
          <p v-if="watch.notes" class="notes">{{ watch.notes }}</p>
          <div class="post-earnings">
            <div class="stat-pill">
              <span class="stat-label">Result</span>
              <span v-if="watch.result" :class="['result-badge', watch.result]">{{ resultLabel(watch.result) }}</span>
              <span v-else class="pending-badge">Pending...</span>
            </div>
            <div class="stat-pill">
              <span class="stat-label">AI Summary</span>
              <button
                v-if="watch.reportDate && isPast(watch.reportDate)"
                @click="openSummary(watch)"
                class="summarize-btn"
              >✦ Summary</button>
              <span v-else class="pending-badge">After earnings</span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- ═══════════════════════════════════════════════
         UPCOMING & ADD TAB
    ═══════════════════════════════════════════════ -->
    <div v-if="activeTab === 'Upcoming & Add'">
      <!-- Search / Add form -->
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
              <label>Notes</label>
              <input v-model="form.notes" placeholder="Optional notes" />
            </div>
          </div>
          <button @click="handleSubmit" :disabled="submitting" class="btn-primary">
            {{ submitting ? 'Saving...' : 'Add to Watchlist' }}
          </button>
        </div>
      </div>

      <div v-if="calendarLoading" class="empty">Loading upcoming earnings...</div>
      <div v-else-if="earningsStore.calendar.length > 0" class="calendar-grid">
        <div v-for="item in earningsStore.calendar" :key="item.ticker" class="calendar-card">
          <div class="calendar-card-header">
            <span class="ticker">{{ item.ticker }}</span>
            <span class="report-date">{{ formatDate(item.reportDate) }}</span>
          </div>
          <p class="company-name">{{ item.name }}</p>
          <p class="eps" v-if="item.estimatedEPS">Est. EPS: {{ item.estimatedEPS }}</p>
          <button v-if="!earningsStore.watchedTickers.includes(item.ticker)" @click="quickWatch(item)" class="watch-btn">+ Watch</button>
          <span v-else class="watching-badge">Watching ✓</span>
        </div>
      </div>
    </div>

    <!-- ═══════════════════════════════════════════════
         COMPLETED TAB
    ═══════════════════════════════════════════════ -->
    <div v-if="activeTab === 'Completed'">
      <div v-if="completedLoading" class="empty">Loading results...</div>
      <div v-else-if="earningsStore.completed.length === 0" class="empty">No completed earnings yet.</div>
      <div v-else class="earnings-list">
        <div v-for="watch in earningsStore.completed" :key="watch._id" class="earnings-card">
          <div class="card-header">
            <div class="ticker-info">
              <span class="ticker">{{ watch.ticker }}</span>
              <span
                v-if="watch.result || completedResults[watch.ticker]?.result"
                :class="['result-badge', watch.result || completedResults[watch.ticker]?.result]"
              >{{ resultLabel(watch.result || completedResults[watch.ticker]?.result) }}</span>
            </div>
            <div class="card-meta">
              <span class="report-date">{{ watch.reportDate ? formatDate(watch.reportDate) : '' }}</span>
              <button @click="openSummary(watch)" class="summarize-btn">✦ AI Summary</button>
              <button @click="earningsStore.deleteWatch(watch._id)" class="delete-btn">Delete</button>
            </div>
          </div>
          <p v-if="watch.notes" class="notes">{{ watch.notes }}</p>
          <div v-if="completedResults[watch.ticker] && completedResults[watch.ticker] !== 'loading'" class="facts-panel">
            <div class="fact-box">
              <span class="fact-label">Reported EPS</span>
              <span class="fact-value">{{ completedResults[watch.ticker].epsActual != null ? '$' + completedResults[watch.ticker].epsActual.toFixed(2) : '—' }}</span>
            </div>
            <div class="fact-box">
              <span class="fact-label">Est. EPS</span>
              <span class="fact-value">{{ completedResults[watch.ticker].epsEstimate != null ? '$' + completedResults[watch.ticker].epsEstimate.toFixed(2) : '—' }}</span>
            </div>
            <div class="fact-box">
              <span class="fact-label">Surprise</span>
              <span :class="['fact-value', (completedResults[watch.ticker].surprisePct || 0) >= 0 ? 'positive' : 'negative']">
                {{ completedResults[watch.ticker].surprisePct != null ? ((completedResults[watch.ticker].surprisePct >= 0 ? '+' : '') + completedResults[watch.ticker].surprisePct.toFixed(1) + '%') : '—' }}
              </span>
            </div>
            <div class="fact-box">
              <span class="fact-label">Quarter</span>
              <span class="fact-value fiscal-date">{{ completedResults[watch.ticker].fiscalDate || '—' }}</span>
            </div>
          </div>
          <div v-else-if="completedResults[watch.ticker] === 'loading'" class="facts-panel">
            <span class="pending-badge">Loading results...</span>
          </div>
          <div v-else class="facts-panel">
            <span class="pending-badge">No EPS data available yet</span>
          </div>
        </div>
      </div>
    </div>
  </div>

  <!-- ═══════════════════════════════════════════════
       EARNINGS SUMMARY MODAL
  ═══════════════════════════════════════════════ -->
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
            <span v-if="summaryData?.fiscalDate" class="fiscal-label">{{ summaryData.fiscalDate }}</span>
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

          <div class="metrics-grid">
            <div class="metric-box">
              <span class="metric-label">Reported EPS</span>
              <span class="metric-value">${{ summaryData.epsActual?.toFixed(2) }}</span>
            </div>
            <div class="metric-box">
              <span class="metric-label">Est. EPS</span>
              <span class="metric-value">${{ summaryData.epsEstimate?.toFixed(2) }}</span>
            </div>
            <div class="metric-box">
              <span class="metric-label">EPS Surprise</span>
              <span :class="['metric-value', summaryData.surprisePct >= 0 ? 'positive' : 'negative']">
                {{ summaryData.surprisePct >= 0 ? '+' : '' }}{{ summaryData.surprisePct?.toFixed(1) }}%
              </span>
            </div>
            <div v-if="summaryData.revenue" class="metric-box">
              <span class="metric-label">Revenue</span>
              <span class="metric-value">{{ summaryData.revenue }}</span>
            </div>
            <div v-if="summaryData.revenueGrowthYoY" class="metric-box">
              <span class="metric-label">Rev. Growth YoY</span>
              <span :class="['metric-value', summaryData.revenueGrowthYoY?.startsWith('+') ? 'positive' : summaryData.revenueGrowthYoY?.startsWith('-') ? 'negative' : '']">
                {{ summaryData.revenueGrowthYoY }}
              </span>
            </div>
            <div v-if="summaryData.grossMargin" class="metric-box">
              <span class="metric-label">Gross Margin</span>
              <span class="metric-value">{{ summaryData.grossMargin }}</span>
            </div>
            <div v-if="summaryData.operatingIncome" class="metric-box">
              <span class="metric-label">Operating Income</span>
              <span class="metric-value">{{ summaryData.operatingIncome }}</span>
            </div>
            <div v-if="summaryData.netIncome" class="metric-box">
              <span class="metric-label">Net Income</span>
              <span class="metric-value">{{ summaryData.netIncome }}</span>
            </div>
            <div v-if="summaryData.analystTarget" class="metric-box">
              <span class="metric-label">Analyst Target</span>
              <span class="metric-value">${{ summaryData.analystTarget }}</span>
            </div>
          </div>

          <div v-if="summaryData.guidance" class="guidance-box">
            <span class="guidance-label">📋 Guidance</span>
            <span>{{ summaryData.guidance }}</span>
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
import { ref, onMounted, onUnmounted, watch } from 'vue'
import { useEarningsStore } from '../stores/earningsStore'

const earningsStore = useEarningsStore()

const calendarLoading = ref(false)
const watchlistLoading = ref(false)
const completedLoading = ref(false)
const submitting = ref(false)
const looking = ref(false)
const formError = ref('')
const lookupMessage = ref('')
// Three tabs now
const tabs = ['My Watchlist', 'Upcoming & Add', 'Completed']
const activeTab = ref('My Watchlist')

const completedResults = ref({})

const summaryModal = ref({ open: false, ticker: '' })
const summaryLoading = ref(false)
const summaryError = ref('')
const summaryData = ref(null)

const form = ref({ ticker: '', reportDate: '', notes: '' })

let pollInterval = null

// ─── Helpers ───────────────────────────────────────────────────────────────

function resultLabel(result) {
  if (result === 'beat') return '✓ Beat'
  if (result === 'miss') return '✗ Miss'
  if (result === 'inline') return '— Inline'
  return result
}

function formatDate(dateStr) {
  if (!dateStr) return 'TBD'
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

/**
 * Returns true if the reportDate is strictly before today (not just today).
 * We add 1 day of buffer so a report dated "today" counts as past
 * (avoids UTC-midnight timezone edge case).
 */
function isPast(dateStr) {
  if (!dateStr) return false
  const report = new Date(dateStr)
  report.setDate(report.getDate() + 1) // +1 day buffer
  return report < new Date()
}

// ─── Mark Complete ──────────────────────────────────────────────────────────

async function handleMarkComplete(watch) {
  try {
    // Try to auto-fetch the result before moving to completed
    const token = localStorage.getItem('token')
    const res = await fetch(`/api/earnings/results/${encodeURIComponent(watch.ticker)}`, {
      headers: { Authorization: `Bearer ${token}` }
    })
    const data = await res.json()
    const updates = { status: 'completed' }
    if (data.found && !watch.result) updates.result = data.result
    await earningsStore.updateWatch(watch._id, updates)
  } catch {
    // Mark complete even if results fetch fails
    await earningsStore.updateWatch(watch._id, { status: 'completed' })
  }
}

// ─── Completed results panel ────────────────────────────────────────────────

async function fetchCompletedResults() {
  if (!earningsStore.completed.length) return
  completedLoading.value = true
  const token = localStorage.getItem('token')
  const toFetch = earningsStore.completed.filter(w => !completedResults.value[w.ticker])

  await Promise.allSettled(
    toFetch.map(async (watch) => {
      completedResults.value[watch.ticker] = 'loading'
      try {
        const res = await fetch(`/api/earnings/results/${encodeURIComponent(watch.ticker)}`, {
          headers: { Authorization: `Bearer ${token}` }
        })
        const data = await res.json()
        if (data.found) {
          completedResults.value[watch.ticker] = {
            result: data.result,
            epsActual: data.epsActual,
            epsEstimate: data.epsEstimate,
            surprisePct: data.surprisePct,
            fiscalDate: data.fiscalDate,
          }
          if (!watch.result) {
            await earningsStore.updateWatch(watch._id, { result: data.result })
          }
        } else {
          completedResults.value[watch.ticker] = null
        }
      } catch {
        completedResults.value[watch.ticker] = null
      }
    })
  )
  completedLoading.value = false
}

// Re-fetch completed results whenever the completed list changes
// (e.g. user just moved something to completed)
watch(() => earningsStore.completed.length, () => {
  fetchCompletedResults()
})

// ─── AI Summary modal ───────────────────────────────────────────────────────

async function openSummary(earningsWatch) {
  // Reset state fully before opening
  summaryData.value = null
  summaryError.value = ''
  summaryLoading.value = true
  summaryModal.value = { open: true, ticker: earningsWatch.ticker }

  try {
    const token = localStorage.getItem('token')
    const res = await fetch(`/api/earnings/summarize/${encodeURIComponent(earningsWatch.ticker)}`, {
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

// ─── Auto-fill results for due watches ─────────────────────────────────────

async function autoFillResults() {
  const now = new Date()
  const dueWatches = earningsStore.watches.filter(w => {
    if (w.result || !w.reportDate) return false
    // reportDate + 1 day to handle UTC offset
    const reportDate = new Date(w.reportDate)
    reportDate.setDate(reportDate.getDate() + 1)
    return reportDate <= now
  })
  if (!dueWatches.length) return

  for (const w of dueWatches) {
    try {
      const token = localStorage.getItem('token')
      const res = await fetch(`/api/earnings/results/${encodeURIComponent(w.ticker)}`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      const data = await res.json()
      if (!data.found) continue
      await earningsStore.updateWatch(w._id, { result: data.result })
    } catch (err) {
      console.log(`Could not auto-fill results for ${w.ticker}:`, err.message)
    }
  }
}

function schedulePolling() {
  const todayStr = new Date().toDateString()
  const hasTodayWatches = earningsStore.watches.some(w => {
    if (w.result || !w.reportDate) return false
    return new Date(w.reportDate).toDateString() === todayStr
  })
  if (pollInterval) clearInterval(pollInterval)
  if (hasTodayWatches) {
    pollInterval = setInterval(async () => {
      await autoFillResults()
      const stillPending = earningsStore.watches.some(w => {
        if (w.result || !w.reportDate) return false
        return new Date(w.reportDate).toDateString() === new Date().toDateString()
      })
      if (!stillPending) { clearInterval(pollInterval); pollInterval = null }
    }, 5 * 60 * 1000)
  }
}

// ─── Watchlist actions ──────────────────────────────────────────────────────

async function quickWatch(item) {
  try {
    const reportDate = item.reportDate || (await earningsStore.lookupTicker(item.ticker)).reportDate || null
    await earningsStore.addWatch({ ticker: item.ticker, reportDate, notes: '' })
  } catch (err) { console.error('Failed to watch:', err) }
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
  } catch { lookupMessage.value = 'Lookup failed — set the date manually.' }
  finally { looking.value = false }
}

async function populateMissingDates() {
  for (const w of earningsStore.watches) {
    if (!w.reportDate) {
      try {
        const data = await earningsStore.lookupTicker(w.ticker)
        if (data.reportDate) await earningsStore.updateWatch(w._id, { reportDate: data.reportDate })
      } catch (err) { console.log(`Could not lookup date for ${w.ticker}:`, err.message) }
    }
  }
}

async function handleSubmit() {
  if (!form.value.ticker) { formError.value = 'Ticker is required'; return }
  submitting.value = true
  formError.value = ''
  try {
    let reportDate = form.value.reportDate
    if (!reportDate) {
      try {
        const data = await earningsStore.lookupTicker(form.value.ticker.toUpperCase())
        reportDate = data.reportDate || null
      } catch {}
    }
    await earningsStore.addWatch({
      ticker: form.value.ticker.toUpperCase(),
      reportDate,
      notes: form.value.notes
    })
    form.value = { ticker: '', reportDate: '', notes: '' }
    lookupMessage.value = ''
    activeTab.value = 'My Watchlist' // switch back after adding
  } catch (err) { formError.value = err.response?.data?.error || 'Failed to add watch' }
  finally { submitting.value = false }
}

// ─── Lifecycle ──────────────────────────────────────────────────────────────

onMounted(async () => {
  calendarLoading.value = true
  watchlistLoading.value = true
  await Promise.all([earningsStore.fetchCalendar(), earningsStore.fetchWatches()])
  calendarLoading.value = false
  watchlistLoading.value = false
  await populateMissingDates()
  await autoFillResults()
  await fetchCompletedResults()
  schedulePolling()
})

onUnmounted(() => { if (pollInterval) clearInterval(pollInterval) })
</script>

<style scoped>
.page-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem; }
h1 { font-size: 1.8rem; color: #4ade80; }

.form-row { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-bottom: 1rem; }
.form-group { display: flex; flex-direction: column; gap: 0.4rem; }
label { font-size: 0.85rem; color: #aaa; }
input, select, textarea { padding: 0.6rem 0.8rem; background-color: #0f1117; border: 1px solid #2a2f3e; border-radius: 6px; color: #e0e0e0; font-size: 0.9rem; }
input:focus, select:focus, textarea:focus { outline: none; border-color: #4ade80; }

.btn-primary { padding: 0.65rem 1.4rem; background-color: #4ade80; color: #0f1117; border: none; border-radius: 6px; font-size: 0.95rem; font-weight: 600; cursor: pointer; }
.btn-primary:disabled { opacity: 0.6; cursor: not-allowed; }
.btn-secondary { padding: 0.6rem 1rem; background: none; border: 1px solid #4ade80; color: #4ade80; border-radius: 6px; cursor: pointer; font-size: 0.9rem; }
.btn-secondary:disabled { opacity: 0.6; cursor: not-allowed; }

.tabs { display: flex; gap: 0.5rem; margin-bottom: 1.5rem; }
.tab { padding: 0.5rem 1.2rem; border-radius: 20px; border: 1px solid #2a2f3e; background: none; color: #888; cursor: pointer; font-size: 0.9rem; }
.tab.active { background-color: #4ade80; color: #0f1117; border-color: #4ade80; font-weight: 600; }

.calendar-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 1rem; }
.calendar-card { background-color: #161b27; border: 1px solid #2a2f3e; border-radius: 10px; padding: 1rem; }
.calendar-card-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.4rem; }
.ticker { font-size: 1.1rem; font-weight: 700; color: #e0e0e0; }
.report-date { font-size: 0.8rem; color: #f59e0b; }
.company-name { font-size: 0.8rem; color: #888; margin-bottom: 0.4rem; }
.eps { font-size: 0.8rem; color: #555; margin-bottom: 0.75rem; }
.watch-btn { width: 100%; padding: 0.4rem; background: none; border: 1px solid #4ade80; color: #4ade80; border-radius: 6px; cursor: pointer; font-size: 0.85rem; }
.watch-btn:hover { background-color: #4ade80; color: #0f1117; }
.watching-badge { display: block; text-align: center; font-size: 0.85rem; color: #4ade80; padding: 0.4rem; }

.earnings-list { display: flex; flex-direction: column; gap: 1rem; }
.earnings-card { background-color: #161b27; border: 1px solid #2a2f3e; border-radius: 10px; padding: 1.25rem 1.5rem; }
.card-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.75rem; }
.ticker-info { display: flex; align-items: center; gap: 0.75rem; }

.view-badge { padding: 0.2rem 0.6rem; border-radius: 4px; font-size: 0.8rem; font-weight: 600; }
.view-badge.bullish { background-color: #1b2d1b; color: #4ade80; }
.view-badge.bearish { background-color: #2d1b1b; color: #e05252; }
.view-badge.neutral { background-color: #2a2f3e; color: #aaa; }

.result-badge { padding: 0.2rem 0.6rem; border-radius: 4px; font-size: 0.8rem; font-weight: 600; }
.result-badge.beat { background-color: #1b2d1b; color: #4ade80; }
.result-badge.miss { background-color: #2d1b1b; color: #e05252; }
.result-badge.inline { background-color: #2a2f3e; color: #aaa; }

.card-meta { display: flex; align-items: center; gap: 0.75rem; }
.notes { color: #aaa; font-size: 0.9rem; margin-bottom: 1rem; }

.post-earnings { display: flex; gap: 1.5rem; padding-top: 0.75rem; border-top: 1px solid #1e2535; }
.stat-pill { display: flex; flex-direction: column; gap: 0.4rem; flex: 1; }
.stat-label { font-size: 0.75rem; color: #555; text-transform: uppercase; letter-spacing: 0.05em; }
.pending-badge { font-size: 0.82rem; color: #555; font-style: italic; }

.delete-btn { background: none; border: 1px solid #2a2f3e; color: #555; padding: 0.35rem 0.75rem; border-radius: 6px; cursor: pointer; font-size: 0.85rem; }
.delete-btn:hover { border-color: #e05252; color: #e05252; }

/* Mark Complete button */
.complete-btn { background: none; border: 1px solid #818cf8; color: #818cf8; padding: 0.35rem 0.75rem; border-radius: 6px; cursor: pointer; font-size: 0.85rem; transition: all 0.15s; }
.complete-btn:hover { background: #1e1b3a; }

.info { background-color: #1b2233; border: 1px solid #3a4a6a; color: #88aadd; padding: 0.6rem 0.9rem; border-radius: 6px; margin-bottom: 1rem; font-size: 0.9rem; }
.error { background-color: #2d1b1b; border: 1px solid #e05252; color: #e05252; padding: 0.6rem 0.9rem; border-radius: 6px; margin-bottom: 1rem; font-size: 0.9rem; }

.add-section { background-color: #161b27; border: 1px solid #2a2f3e; border-radius: 10px; padding: 1.25rem 1.5rem; margin-bottom: 1.5rem; }
.search-row { display: flex; gap: 0.75rem; align-items: center; margin-bottom: 0.75rem; }
.search-input { flex: 1; }
.quick-add-form { margin-top: 0.75rem; border-top: 1px solid #2a2f3e; padding-top: 0.75rem; }

.empty-watchlist { text-align: center; color: #555; padding: 1.5rem; font-size: 0.9rem; }
.empty { color: #555; text-align: center; padding: 3rem; }

/* Completed facts panel */
.facts-panel { display: flex; gap: 0.75rem; margin-top: 0.75rem; padding-top: 0.75rem; border-top: 1px solid #1e2535; flex-wrap: wrap; }
.fact-box { flex: 1; min-width: 90px; background: #0f1117; border: 1px solid #2a2f3e; border-radius: 8px; padding: 0.6rem 0.85rem; display: flex; flex-direction: column; gap: 0.25rem; }
.fact-label { font-size: 0.72rem; color: #555; text-transform: uppercase; letter-spacing: 0.05em; }
.fact-value { font-size: 1rem; font-weight: 700; color: #e0e0e0; }
.fact-value.positive { color: #4ade80; }
.fact-value.negative { color: #e05252; }
.fact-value.fiscal-date { font-size: 0.85rem; font-weight: 500; color: #888; }

.summarize-btn { background: none; border: 1px solid #4ade8055; color: #4ade80; padding: 0.3rem 0.75rem; border-radius: 6px; cursor: pointer; font-size: 0.82rem; font-weight: 600; transition: background 0.15s; align-self: flex-start; white-space: nowrap; }
.summarize-btn:hover { background: #1b2d1b; }

/* Modal */
.modal-backdrop { position: fixed; inset: 0; background: rgba(0,0,0,0.75); display: flex; align-items: center; justify-content: center; z-index: 1000; padding: 1rem; }
.summary-modal { background: #0f1117; border: 1px solid #2a2f3e; border-radius: 14px; width: 100%; max-width: 680px; padding: 1.75rem; display: flex; flex-direction: column; gap: 1.25rem; max-height: 90vh; overflow-y: auto; }

.summary-header { display: flex; justify-content: space-between; align-items: flex-start; }
.summary-title-row { display: flex; align-items: center; gap: 0.75rem; flex-wrap: wrap; }
.summary-ticker { font-size: 1.5rem; font-weight: 800; color: #e0e0e0; }
.fiscal-label { font-size: 0.8rem; color: #555; padding: 0.2rem 0.5rem; border: 1px solid #2a2f3e; border-radius: 4px; }

.verdict-badge { padding: 0.25rem 0.75rem; border-radius: 20px; font-size: 0.85rem; font-weight: 700; }
.verdict-badge.beat { background: #1b2d1b; color: #4ade80; }
.verdict-badge.miss { background: #2d1b1b; color: #e05252; }
.verdict-badge.inline { background: #2a2f3e; color: #aaa; }

.sentiment-badge { padding: 0.25rem 0.75rem; border-radius: 20px; font-size: 0.82rem; border: 1px solid #2a2f3e; color: #888; text-transform: capitalize; }

.close-btn { background: none; border: none; color: #555; font-size: 1.2rem; cursor: pointer; padding: 0.2rem 0.5rem; border-radius: 4px; transition: color 0.15s; flex-shrink: 0; }
.close-btn:hover { color: #e0e0e0; }

.summary-loading { display: flex; flex-direction: column; align-items: center; gap: 1rem; padding: 2rem; color: #555; font-size: 0.9rem; }
.spinner { width: 28px; height: 28px; border: 2px solid #2a2f3e; border-top-color: #4ade80; border-radius: 50%; animation: spin 0.8s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }

.summary-error { color: #e05252; padding: 1rem; background: #2d1b1b; border-radius: 8px; font-size: 0.9rem; }
.summary-headline { font-size: 1rem; color: #e0e0e0; line-height: 1.6; font-weight: 500; }

.metrics-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(130px, 1fr)); gap: 0.75rem; }
.metric-box { background: #161b27; border: 1px solid #2a2f3e; border-radius: 8px; padding: 0.75rem 1rem; display: flex; flex-direction: column; gap: 0.3rem; }
.metric-label { font-size: 0.72rem; color: #555; text-transform: uppercase; letter-spacing: 0.05em; }
.metric-value { font-size: 1rem; font-weight: 700; color: #e0e0e0; }
.metric-value.positive { color: #4ade80; }
.metric-value.negative { color: #e05252; }

.guidance-box { background: #161b27; border: 1px solid #2a2f3e; border-left: 3px solid #818cf8; border-radius: 6px; padding: 0.75rem 1rem; font-size: 0.9rem; color: #bbb; line-height: 1.5; }
.guidance-label { color: #818cf8; font-weight: 600; margin-right: 0.5rem; }

.key-points h4 { font-size: 0.8rem; text-transform: uppercase; letter-spacing: 0.07em; color: #555; margin-bottom: 0.6rem; }
.key-points ul { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 0.5rem; }
.key-points li { font-size: 0.9rem; color: #bbb; padding-left: 1.1rem; position: relative; line-height: 1.5; }
.key-points li::before { content: '›'; position: absolute; left: 0; color: #4ade80; font-weight: 700; }

.watch-for { background: #161b27; border: 1px solid #2a2f3e; border-left: 3px solid #f59e0b; border-radius: 6px; padding: 0.75rem 1rem; font-size: 0.9rem; color: #bbb; line-height: 1.5; }
.watch-label { color: #f59e0b; font-weight: 600; margin-right: 0.5rem; }
</style>