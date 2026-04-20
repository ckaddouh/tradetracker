<template>
    <div>
      <div class="journal-header">
        <h1>Trade Journal</h1>
        <button @click="showForm = !showForm" class="btn-primary">
          {{ showForm ? 'Cancel' : '+ New Idea' }}
        </button>
      </div>
  
      <!-- New trade form -->
      <div v-if="showForm" class="form-card">
        <h3>Log a Trade Idea</h3>
        <div class="form-grid">
          <div class="form-group">
            <label>Ticker</label>
            <input v-model="form.ticker" placeholder="e.g. AAPL" />
          </div>
          <div class="form-group">
            <label>Direction</label>
            <select v-model="form.direction">
              <option value="">Select...</option>
              <option value="long">Long</option>
              <option value="short">Short</option>
            </select>
          </div>
          <div class="form-group">
            <label>Asset Class</label>
            <select v-model="form.assetClass">
              <option value="">Select...</option>
              <option value="equity">Equity</option>
              <option value="option">Option</option>
              <option value="ETF">ETF</option>
              <option value="futures">Futures</option>
              <option value="other">Other</option>
            </select>
          </div>
          <div class="form-group">
            <label>Conviction (1–5)</label>
            <input v-model.number="form.conviction" type="number" min="1" max="5" />
          </div>
          <div class="form-group">
            <label>Entry Price</label>
            <input v-model.number="form.entryPrice" type="number" placeholder="Optional" />
          </div>
          <div class="form-group">
            <label>Target Price</label>
            <input v-model.number="form.targetPrice" type="number" placeholder="Optional" />
          </div>
          <div class="form-group">
            <label>Stop Loss</label>
            <input v-model.number="form.stopLoss" type="number" placeholder="Optional" />
          </div>
        </div>
        <div class="form-group full-width">
          <label>Thesis</label>
          <textarea v-model="form.thesis" placeholder="Why are you making this trade?" rows="3" />
        </div>
        <div v-if="formError" class="error">{{ formError }}</div>
        <button @click="handleSubmit" :disabled="submitting" class="btn-primary">
          {{ submitting ? 'Saving...' : 'Save Idea' }}
        </button>
      </div>
  
      <!-- Filter tabs -->
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
  
      <!-- Trade list -->
      <div v-if="loading" class="empty">Loading trades...</div>
      <div v-else-if="filteredTrades.length === 0" class="empty">No {{ activeTab.toLowerCase() }} trades yet.</div>
      <div v-else class="trade-list">
        <TradeCard
          v-for="trade in filteredTrades"
          :key="trade._id"
          :trade="trade"
          @update="handleUpdate"
          @delete="handleDelete"
        />
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
  
  const form = ref({
    ticker: '',
    direction: '',
    assetClass: '',
    conviction: '',
    entryPrice: '',
    targetPrice: '',
    stopLoss: '',
    thesis: ''
  })
  
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
  
  async function handleSubmit() {
    formError.value = ''
    if (!form.value.ticker || !form.value.direction || !form.value.assetClass || !form.value.conviction || !form.value.thesis) {
      formError.value = 'Please fill in all required fields'
      return
    }
    submitting.value = true
    try {
      await tradeStore.createTrade(form.value)
      showForm.value = false
      form.value = { ticker: '', direction: '', assetClass: '', conviction: '', entryPrice: '', targetPrice: '', stopLoss: '', thesis: '' }
    } catch (err) {
      formError.value = err.response?.data?.error || 'Failed to save trade'
    } finally {
      submitting.value = false
    }
  }
  
  async function handleUpdate(id, updates) {
    await tradeStore.updateTrade(id, updates)
  }
  
  async function handleDelete(id) {
    await tradeStore.deleteTrade(id)
  }
  </script>
  
  <style scoped>
  .journal-header {
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
  
  .form-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
    gap: 1rem;
    margin-bottom: 1rem;
  }
  
  .form-group {
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
  }
  
  .full-width {
    width: 100%;
    margin-bottom: 1rem;
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
  
  .error {
    background-color: #2d1b1b;
    border: 1px solid #e05252;
    color: #e05252;
    padding: 0.6rem 0.9rem;
    border-radius: 6px;
    margin-bottom: 1rem;
    font-size: 0.9rem;
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
  
  .trade-list {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }
  
  .empty {
    color: #555;
    text-align: center;
    padding: 3rem;
  }
  </style>