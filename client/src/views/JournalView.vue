<template>
  <div>
    <div class="journal-header">
      <h1>Trade Journal</h1>
      <button @click="showForm = !showForm" class="btn-primary">
        {{ showForm ? 'Cancel' : '+ New Idea' }}
      </button>
    </div>

    <div v-if="showForm" class="form-card">
      <div class="form-row">
        <div class="form-group">
          <label>Ticker</label>
          <input
            v-model="form.ticker"
            placeholder="e.g. AAPL"
            @input="form.ticker = form.ticker.toUpperCase(); tickerValid = null"
            autocomplete="off"
          />
          <span v-if="tickerValidating" class="ticker-hint">Checking...</span>
          <span v-else-if="tickerValid === false" class="ticker-hint invalid">Ticker not found</span>
        </div>

        <div class="form-group">
          <label>Direction</label>
          <div class="toggle-group">
            <button :class="['toggle-btn', { active: form.direction === 'long' }]" @click="form.direction = 'long'" type="button">▲ Long</button>
            <button :class="['toggle-btn short', { active: form.direction === 'short' }]" @click="form.direction = 'short'" type="button">▼ Short</button>
          </div>
        </div>

        <div class="form-group">
          <label>Horizon</label>
          <select v-model="form.horizon">
            <option value="">Select...</option>
            <option value="intraday">Intraday</option>
            <option value="swing">Swing (days)</option>
            <option value="weeks">Weeks</option>
            <option value="months">Months</option>
            <option value="long-term">Long term (1yr+)</option>
          </select>
        </div>
      </div>

      <div class="form-group">
        <label>Reason</label>
        <textarea v-model="form.reason" placeholder="Why are you making this trade?" rows="3" />
      </div>

      <div v-if="formError" class="error">{{ formError }}</div>

      <button @click="handleSubmit" :disabled="submitting" class="btn-primary submit-btn">
        {{ submitting ? (tickerValidating ? 'Validating ticker...' : 'Saving...') : 'Save Idea' }}
      </button>
    </div>

    <div class="tabs">
      <button v-for="tab in tabs" :key="tab" @click="activeTab = tab" :class="['tab', { active: activeTab === tab }]">{{ tab }}</button>
    </div>

    <div v-if="loading" class="empty">Loading trades...</div>
    <div v-else-if="filteredTrades.length === 0" class="empty">No {{ activeTab.toLowerCase() }} trades yet.</div>
    <div v-else class="trade-list">
      <TradeCard v-for="trade in filteredTrades" :key="trade._id" :trade="trade" @update="handleUpdate" @delete="handleDelete" />
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useTradeStore } from '../stores/tradeStore'
import TradeCard from '../components/TradeCard.vue'

const tradeStore = useTradeStore()
const showForm = ref(false)
const loading = ref(false)
const submitting = ref(false)
const formError = ref('')
const activeTab = ref('Open')
const tabs = ['Open', 'Monitoring', 'Closed']
const tickerValidating = ref(false)
const tickerValid = ref(null)
const form = ref({ ticker: '', direction: 'long', horizon: '', reason: '' })

const filteredTrades = computed(() => {
  if (activeTab.value === 'Open') return tradeStore.openTrades
  if (activeTab.value === 'Monitoring') return tradeStore.monitoringTrades
  if (activeTab.value === 'Closed') return tradeStore.closedTrades
  return tradeStore.trades
})

onMounted(async () => {
  loading.value = true
  await tradeStore.fetchTrades()
  loading.value = false
})

async function validateTicker(ticker) {
  try {
    const fromTs = Math.floor(Date.now() / 1000) - 60 * 60 * 24 * 30
    const res = await fetch(`/api/trades/chart/${encodeURIComponent(ticker)}?from=${fromTs}`, {
      headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
    })
    if (!res.ok) return false
    const data = await res.json()
    return !!(data.chart?.result?.[0]?.meta?.symbol)
  } catch {
    return false
  }
}

async function handleSubmit() {
  formError.value = ''
  tickerValid.value = null
  if (!form.value.ticker || !form.value.direction || !form.value.horizon || !form.value.reason.trim()) {
    formError.value = 'Please fill in all fields'
    return
  }
  tickerValidating.value = true
  submitting.value = true
  const valid = await validateTicker(form.value.ticker)
  tickerValidating.value = false
  tickerValid.value = valid
  if (!valid) {
    formError.value = `"${form.value.ticker}" doesn't look like a valid ticker. Double-check the symbol.`
    submitting.value = false
    return
  }
  try {
    await tradeStore.createTrade(form.value)
    showForm.value = false
    tickerValid.value = null
    form.value = { ticker: '', direction: 'long', horizon: '', reason: '' }
  } catch (err) {
    formError.value = err.response?.data?.error || 'Failed to save trade'
  } finally {
    submitting.value = false
  }
}

async function handleUpdate(id, updates) { await tradeStore.updateTrade(id, updates) }
async function handleDelete(id) { await tradeStore.deleteTrade(id) }
</script>

<style scoped>
.journal-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem; }
h1 { font-size: 1.8rem; color: #4ade80; }

.form-card {
  background-color: #161b27;
  border: 1px solid #2a2f3e;
  border-radius: 10px;
  padding: 1.5rem;
  margin-bottom: 1.5rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.form-row { display: flex; gap: 1rem; flex-wrap: wrap; }

.form-group { display: flex; flex-direction: column; gap: 0.4rem; flex: 1; min-width: 140px; }

label { font-size: 0.85rem; color: #aaa; }

input, select, textarea {
  padding: 0.6rem 0.8rem;
  background-color: #0f1117;
  border: 1px solid #2a2f3e;
  border-radius: 6px;
  color: #e0e0e0;
  font-size: 0.9rem;
  font-family: inherit;
}
input:focus, select:focus, textarea:focus { outline: none; border-color: #4ade80; }
textarea { resize: vertical; }

.toggle-group { display: flex; border-radius: 6px; overflow: hidden; border: 1px solid #2a2f3e; }
.toggle-btn { flex: 1; padding: 0.6rem 0.5rem; background: #0f1117; border: none; color: #555; cursor: pointer; font-size: 0.85rem; font-weight: 600; transition: background 0.15s, color 0.15s; }
.toggle-btn.active { background: #1b2d1b; color: #4ade80; }
.toggle-btn.short.active { background: #2d1b1b; color: #e05252; }

.ticker-hint { font-size: 0.78rem; color: #888; }
.ticker-hint.invalid { color: #e05252; }

.btn-primary { padding: 0.65rem 1.4rem; background-color: #4ade80; color: #0f1117; border: none; border-radius: 6px; font-size: 0.95rem; font-weight: 600; cursor: pointer; }
.btn-primary:disabled { opacity: 0.6; cursor: not-allowed; }
.submit-btn { align-self: flex-start; }

.error { background-color: #2d1b1b; border: 1px solid #e05252; color: #e05252; padding: 0.6rem 0.9rem; border-radius: 6px; font-size: 0.9rem; }

.tabs { display: flex; gap: 0.5rem; margin-bottom: 1.5rem; }
.tab { padding: 0.5rem 1.2rem; border-radius: 20px; border: 1px solid #2a2f3e; background: none; color: #888; cursor: pointer; font-size: 0.9rem; }
.tab.active { background-color: #4ade80; color: #0f1117; border-color: #4ade80; font-weight: 600; }

.trade-list { display: flex; flex-direction: column; gap: 1rem; }
.empty { color: #555; text-align: center; padding: 3rem; }
</style>