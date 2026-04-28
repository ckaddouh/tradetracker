<template>
  <div class="trade-card" @click="openChart" title="Click to view chart">
    <div class="card-header">
      <div class="ticker-info">
        <span class="ticker">{{ trade.ticker }}</span>
        <span :class="['direction', trade.direction]">{{ trade.direction.toUpperCase() }}</span>
        <span class="horizon-badge">{{ horizonLabel(trade.horizon) }}</span>
      </div>
      <div class="meta">
        <span class="date">{{ formatDate(trade.createdAt) }}</span>
      </div>
    </div>

    <p class="reason">{{ trade.reason }}</p>

    <div v-if="cardPnl !== null" :class="['card-pnl', cardPnl >= 0 ? 'positive' : 'negative']">
      {{ cardPnl >= 0 ? '+' : '' }}{{ cardPnl.toFixed(2) }}%
      <span class="pnl-label">{{ trade.status === 'closed' ? 'closed' : 'P&L' }}</span>
    </div>

    <div class="card-footer" @click.stop>
      <div class="status-controls">
        <select :value="trade.status" @change="e => emit('update', trade._id, { status: e.target.value })" class="status-select">
          <option value="open">Open</option>
          <option value="closed">Closed</option>
        </select>
      </div>
      <div class="footer-right">
        <button class="chart-btn" @click.stop="openChart">📈 Chart</button>
        <button @click.stop="emit('delete', trade._id)" class="delete-btn">Delete</button>
      </div>
    </div>
  </div>

  <!-- Chart Modal -->
  <Teleport to="body">
    <div v-if="showModal" class="modal-backdrop" @click.self="closeModal">
      <div class="modal">
        <div class="modal-header">
          <div class="modal-title-group">
              <span class="modal-ticker">{{ trade.ticker }}</span>
              <span :class="['direction', trade.direction]">{{ trade.direction.toUpperCase() }}</span>
              <span class="horizon-badge">{{ horizonLabel(trade.horizon) }}</span>
            <span v-if="trade.status === 'closed' && closedPnl !== null" :class="['pnl-badge', closedPnl >= 0 ? 'positive' : 'negative']">
              {{ closedPnl >= 0 ? '+' : '' }}{{ closedPnl.toFixed(2) }}% closed
            </span>
            <span v-else-if="priceChange !== null" :class="['pnl-badge', priceChange >= 0 ? 'positive' : 'negative']">
              {{ priceChange >= 0 ? '+' : '' }}{{ priceChange.toFixed(2) }}% since {{ formatDate(trade.createdAt) }}
            </span>
          </div>
          <button class="close-btn" @click="closeModal">✕</button>
        </div>

        <div class="modal-sub">
          <span class="idea-date-label">Idea logged: {{ formatDate(trade.createdAt) }}</span>
          <span v-if="ideaPrice !== null" class="idea-price-label">Price then: ${{ ideaPrice.toFixed(2) }}</span>
          <span v-if="currentPrice !== null" class="current-price-label">Current: ${{ currentPrice.toFixed(2) }}</span>
        </div>

        <div class="timeframe-controls">
          <button
            v-for="tf in timeframes"
            :key="tf.label"
            :class="['tf-btn', { active: selectedTimeframe === tf.label }]"
            @click="selectTimeframe(tf)"
          >
            {{ tf.label }}
          </button>
        </div>

        <div class="chart-area">
          <div v-if="chartLoading" class="chart-loading">Loading price history...</div>
          <div v-else-if="chartError" class="chart-error">{{ chartError }}</div>
          <canvas v-else ref="chartCanvas" class="chart-canvas"></canvas>
        </div>

        <div class="modal-footer" @click.stop>
          <div class="status-controls">
            <select :value="trade.status" @change="e => emit('update', trade._id, { status: e.target.value })" class="status-select">
              <option value="open">Open</option>
              <option value="closed">Closed</option>
            </select>
          </div>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup>
import { ref, nextTick, onMounted, watch } from 'vue'

const props = defineProps({ trade: Object })
const emit = defineEmits(['update', 'delete'])

const showModal = ref(false)
const chartCanvas = ref(null)
const chartLoading = ref(false)
const chartError = ref('')
const priceChange = ref(null)
const ideaPrice = ref(null)
const currentPrice = ref(null)
const closedPrice = ref(null)
const closedPnl = ref(null)
const cardPnl = ref(null)
const selectedTimeframe = ref('1M')
const timeframes = [
  { label: '1W', days: 7 },
  { label: '1M', days: 30 },
  { label: '3M', days: 90 },
  { label: '6M', days: 180 },
  { label: '1Y', days: 365 },
  { label: '2Y', days: 730 },
  { label: 'All', days: null }
]
let chartInstance = null


// Load P&L on mount and when trade changes
onMounted(() => {
  loadCardPnl()
})

watch(() => props.trade, () => {
  loadCardPnl()
}, { deep: true })

async function loadCardPnl() {
  try {
    const ticker = props.trade.ticker
    const ideaTs = Math.floor(new Date(props.trade.createdAt).getTime() / 1000)
    // Fetch 2 years of data for card display
    const fromTs = ideaTs - 60 * 60 * 24 * 30
    
    const res = await fetch(`/api/trades/chart/${encodeURIComponent(ticker)}?from=${fromTs}`, {
      headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
    })
    if (!res.ok) return
    
    const data = await res.json()
    const result = data.chart?.result?.[0]
    if (!result) return
    
    const timestamps = result.timestamp
    const closes = result.indicators.quote[0].close
    
    const filtered = timestamps
      .map((t, i) => ({ t, c: closes[i] }))
      .filter(p => p.c !== null && p.c !== undefined)
    
    if (!filtered.length) return
    
    // Find idea price
    let closestIdx = 0
    let minDiff = Infinity
    filtered.forEach((p, i) => {
      const diff = Math.abs(p.t - ideaTs)
      if (diff < minDiff) { minDiff = diff; closestIdx = i }
    })
    
    const entryPrice = filtered[closestIdx].c
    
    const isShort = props.trade.direction === 'short'
    if (props.trade.status === 'closed' && props.trade.closedAt) {
      // Calculate P&L from entry to close
      const closeTs = Math.floor(new Date(props.trade.closedAt).getTime() / 1000)
      let closeIdx = null
      let closeMinDiff = Infinity
      filtered.forEach((p, i) => {
        const diff = Math.abs(p.t - closeTs)
        if (diff < closeMinDiff) { closeMinDiff = diff; closeIdx = i }
      })
      if (closeIdx !== null) {
        const exitPrice = filtered[closeIdx].c
        const raw = ((exitPrice - entryPrice) / entryPrice) * 100
  cardPnl.value = isShort ? -raw : raw
      }
    } else {
      // Open trade - P&L from entry to current
      const cur = filtered[filtered.length - 1].c
      const raw = ((cur - entryPrice) / entryPrice) * 100
      cardPnl.value = isShort ? -raw : raw
    }
  } catch (e) {
    // Silently fail - card P&L is optional
  }
}

function horizonLabel(h) {
  const map = { intraday: 'Intraday', swing: 'Swing', weeks: 'Weeks', months: 'Months', 'long-term': 'Long term' }
  return map[h] || h || ''
}

function formatDate(dateStr) {
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function openChart() {
  showModal.value = true
  selectedTimeframe.value = '1M'
  loadChart()
}

function closeModal() {
  showModal.value = false
  if (chartInstance) {
    chartInstance.destroy()
    chartInstance = null
  }
  priceChange.value = null
  ideaPrice.value = null
  currentPrice.value = null
  closedPrice.value = null
  closedPnl.value = null
  chartError.value = ''
}

function selectTimeframe(tf) {
  selectedTimeframe.value = tf.label
  loadChart()
}

async function loadChart() {
  chartLoading.value = true
  chartError.value = ''

  try {
    const ticker = props.trade.ticker
    const ideaTs = Math.floor(new Date(props.trade.createdAt).getTime() / 1000)
    
    // Determine the from timestamp based on selected timeframe
    let fromTs
    const tf = timeframes.find(t => t.label === selectedTimeframe.value)
    
    if (tf && tf.days !== null) {
      // Use the selected timeframe
      fromTs = Math.floor(Date.now() / 1000) - (tf.days * 60 * 60 * 24)
    } else {
      // "All" - fetch maximum history (5 years)
      fromTs = Math.floor(Date.now() / 1000) - (365 * 5 * 60 * 60 * 24)
    }

    const res = await fetch(`/api/trades/chart/${encodeURIComponent(ticker)}?from=${fromTs}`, {
      headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
    })
    if (!res.ok) throw new Error(`Server returned ${res.status}`)
    const data = await res.json()

    const result = data.chart?.result?.[0]
    if (!result) throw new Error('No price data found for this ticker')

    const timestamps = result.timestamp
    const closes = result.indicators.quote[0].close

    const filtered = timestamps
      .map((t, i) => ({ t, c: closes[i] }))
      .filter(p => p.c !== null && p.c !== undefined)

    if (!filtered.length) throw new Error('No valid price data returned')

    // Find closest data point to idea creation date
    let closestIdx = 0
    let minDiff = Infinity
    let ideaInRange = false
    filtered.forEach((p, i) => {
      const diff = Math.abs(p.t - ideaTs)
      if (diff < minDiff) { minDiff = diff; closestIdx = i }
      // Check if idea date is within the data range (within 2 days)
      if (diff < 60 * 60 * 24 * 2) ideaInRange = true
    })

    ideaPrice.value = filtered[closestIdx].c    
    // Handle closed trades - find the close date price
    let closeIdx = null
    let closeInRange = false
    if (props.trade.status === 'closed' && props.trade.closedAt) {
      const closeTs = Math.floor(new Date(props.trade.closedAt).getTime() / 1000)
      let closeMinDiff = Infinity
      filtered.forEach((p, i) => {
        const diff = Math.abs(p.t - closeTs)
        if (diff < closeMinDiff) { closeMinDiff = diff; closeIdx = i }
        if (diff < 60 * 60 * 24 * 2) closeInRange = true
      })
      if (closeIdx !== null) {
        closedPrice.value = filtered[closeIdx].c
        const rawClosed = ((closedPrice.value - ideaPrice.value) / ideaPrice.value) * 100
        closedPnl.value = isShort ? -rawClosed : rawClosed
      }
    }

    const isShort = props.trade.direction === 'short'   // ← hoisted above both usages
    currentPrice.value = filtered[filtered.length - 1].c
    const rawChange = ((currentPrice.value - ideaPrice.value) / ideaPrice.value) * 100
    priceChange.value = isShort ? -rawChange : rawChange

    const labels = filtered.map(p =>
      new Date(p.t * 1000).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    )
    const prices = filtered.map(p => p.c)

    await nextTick()
    renderChart(labels, prices, closestIdx, ideaPrice.value, ideaInRange, closeIdx, closeInRange)
  } catch (err) {
    chartError.value = err.message || 'Could not load price data'
  } finally {
    chartLoading.value = false
  }
}

async function renderChart(labels, prices, ideaIdx, ideaPriceVal, ideaInRange = true, closeIdx = null, closeInRange = false) {
  // Dynamically import Chart.js to avoid SSR issues
  const { Chart, registerables } = await import('chart.js')
  Chart.register(...registerables)

  if (chartInstance) chartInstance.destroy()

  const canvas = chartCanvas.value
  if (!canvas) return
  const ctx = canvas.getContext('2d')

  // Determine colors based on whether trade is closed or open
  let afterColour
  if (props.trade.status === 'closed' && closedPnl.value !== null) {
    afterColour = closedPnl.value >= 0 ? '#4ade80' : '#e05252'
  } else {
    afterColour = priceChange.value >= 0 ? '#4ade80' : '#e05252'
  }

  // Build per-segment colours
  const pointColors = prices.map((_, i) => {
    if (i < ideaIdx) return '#555'
    return afterColour
  })

  // Point styling for idea marker
  const pointRadius = prices.map((_, i) => {
    if (i === ideaIdx && ideaInRange) return 7
    if (i === closeIdx && closeInRange) return 7
    return 0
  })
  const pointBorderColor = prices.map((_, i) => {
    if (i === ideaIdx && ideaInRange) return '#fff'
    if (i === closeIdx && closeInRange) return '#f59e0b'
    return 'transparent'
  })
  const pointBorderWidth = prices.map((_, i) => {
    if (i === ideaIdx && ideaInRange) return 2
    if (i === closeIdx && closeInRange) return 2
    return 0
  })
  const pointBackgroundColor = prices.map((_, i) => {
    if (i === ideaIdx && ideaInRange) return '#fff'
    if (i === closeIdx && closeInRange) return '#f59e0b'
    return 'transparent'
  })

  // Gradient fill
  const gradient = ctx.createLinearGradient(0, 0, 0, 300)
  gradient.addColorStop(0, `${afterColour}33`)
  gradient.addColorStop(1, `${afterColour}00`)

  chartInstance = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [{
        data: prices,
        borderColor: pointColors,
        backgroundColor: gradient,
        borderWidth: 2,
        pointRadius,
        pointBorderColor,
        pointBorderWidth,
        pointBackgroundColor,
        tension: 0.3,
        fill: true,
        segment: {
          borderColor: ctx => {
            const i = ctx.p1DataIndex
            return i <= ideaIdx ? '#444' : afterColour
          }
        }
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: 600 },
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: '#1a2035',
          borderColor: '#2a2f3e',
          borderWidth: 1,
          titleColor: '#e0e0e0',
          bodyColor: '#aaa',
          callbacks: {
            label: ctx => `$${ctx.parsed.y.toFixed(2)}`
          }
        },
        annotation: undefined
      },
      scales: {
        x: {
          grid: { color: '#1e2535' },
          ticks: { color: '#555', maxTicksLimit: 8, font: { size: 11 } }
        },
        y: {
          grid: { color: '#1e2535' },
          ticks: {
            color: '#555',
            font: { size: 11 },
            callback: v => `$${v.toFixed(0)}`
          }
        }
      }
    },
    plugins: [{
      id: 'ideaLine',
      afterDraw(chart) {
        const meta = chart.getDatasetMeta(0)
        
        // Draw idea marker (white)
        if (ideaInRange) {
          const ideaPoint = meta.data[ideaIdx]
          if (ideaPoint) {
            const { ctx: c, chartArea: { top, bottom } } = chart
            c.save()
            c.beginPath()
            c.setLineDash([4, 4])
            c.strokeStyle = '#f59e0b'
            c.lineWidth = 1.5
            c.moveTo(ideaPoint.x, top)
            c.lineTo(ideaPoint.x, bottom)
            c.stroke()
            c.font = '11px monospace'
            c.fillStyle = '#f59e0b'
            c.textAlign = 'center'
            c.fillText(`$${ideaPriceVal.toFixed(2)}`, ideaPoint.x, top + 28)
            c.restore()
          }
        }
        
        // Draw close marker (orange)
        if (closeInRange && closeIdx !== null) {
          const closePoint = meta.data[closeIdx]
          if (closePoint) {
            const { ctx: c, chartArea: { top, bottom } } = chart
            c.save()
            c.beginPath()
            c.setLineDash([4, 4])
            c.strokeStyle = '#22c55e'
            c.lineWidth = 1.5
            c.moveTo(closePoint.x, top)
            c.lineTo(closePoint.x, bottom)
            c.stroke()
            c.font = '11px monospace'
            c.fillStyle = '#22c55e'
            c.textAlign = 'center'
            c.fillText(`$${closedPrice.value.toFixed(2)}`, closePoint.x, top + 28)
            c.restore()
          }
        }
      }
    }]
  })
}
</script>

<style scoped>
.trade-card {
  background-color: #161b27;
  border: 1px solid #2a2f3e;
  border-radius: 10px;
  padding: 1.25rem 1.5rem;
  cursor: pointer;
  transition: border-color 0.18s, box-shadow 0.18s;
}

.trade-card:hover {
  border-color: #4ade8044;
  box-shadow: 0 0 0 1px #4ade8022;
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

.ticker {
  font-size: 1.2rem;
  font-weight: 700;
  color: #e0e0e0;
}

.direction {
  padding: 0.2rem 0.6rem;
  border-radius: 4px;
  font-size: 0.8rem;
  font-weight: 600;
}

.direction.long { background-color: #1b2d1b; color: #4ade80; }
.direction.short { background-color: #2d1b1b; color: #e05252; }

.horizon-badge {
  font-size: 0.8rem;
  color: #888;
  border: 1px solid #2a2f3e;
  padding: 0.2rem 0.5rem;
  border-radius: 4px;
}

.meta {
  display: flex;
  gap: 1rem;
  align-items: center;
}

.date { font-size: 0.8rem; color: #555; }

.reason {
  color: #aaa;
  font-size: 0.9rem;
  line-height: 1.5;
  margin-bottom: 0.75rem;
}

.card-pnl {
  font-size: 1.1rem;
  font-weight: 700;
  margin-bottom: 0.75rem;
}
.card-pnl.positive { color: #4ade80; }
.card-pnl.negative { color: #e05252; }
.pnl-label {
  font-size: 0.75rem;
  font-weight: 400;
  opacity: 0.7;
  margin-left: 0.3rem;
}

.card-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 0.5rem;
}

.footer-right {
  display: flex;
  gap: 0.5rem;
  align-items: center;
}

.chart-btn {
  background: none;
  border: 1px solid #2a2f3e;
  color: #4ade80;
  padding: 0.35rem 0.75rem;
  border-radius: 6px;
  cursor: pointer;
  font-size: 0.85rem;
  transition: background 0.15s;
}

.chart-btn:hover { background: #1b2d1b; }

.status-controls { display: flex; gap: 0.75rem; }

.status-select, .outcome-select {
  padding: 0.35rem 0.6rem;
  background-color: #0f1117;
  border: 1px solid #2a2f3e;
  border-radius: 6px;
  color: #e0e0e0;
  font-size: 0.85rem;
  cursor: pointer;
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

.delete-btn:hover { border-color: #e05252; color: #e05252; }

/* ── Modal ── */
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

.modal {
  background: #0f1117;
  border: 1px solid #2a2f3e;
  border-radius: 14px;
  width: 100%;
  max-width: 820px;
  padding: 1.5rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.modal-title-group {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.modal-ticker {
  font-size: 1.5rem;
  font-weight: 800;
  color: #e0e0e0;
}

.pnl-badge {
  padding: 0.25rem 0.75rem;
  border-radius: 20px;
  font-size: 0.9rem;
  font-weight: 700;
}

.pnl-badge.positive { background: #1b2d1b; color: #4ade80; }
.pnl-badge.negative { background: #2d1b1b; color: #e05252; }

.close-btn {
  background: none;
  border: none;
  color: #555;
  font-size: 1.2rem;
  cursor: pointer;
  padding: 0.2rem 0.5rem;
  border-radius: 4px;
  transition: color 0.15s;
}
.close-btn:hover { color: #e0e0e0; }

.modal-sub {
  display: flex;
  gap: 1.5rem;
  font-size: 0.85rem;
}

.idea-date-label { color: #f59e0b; }
.idea-price-label { color: #888; }
.current-price-label { color: #aaa; }

.timeframe-controls {
  display: flex;
  gap: 0.5rem;
}

.tf-btn {
  padding: 0.4rem 0.8rem;
  background: none;
  border: 1px solid #2a2f3e;
  border-radius: 6px;
  color: #888;
  font-size: 0.8rem;
  cursor: pointer;
  transition: all 0.15s;
}

.tf-btn:hover { border-color: #4ade80; color: #4ade80; }
.tf-btn.active { background: #4ade80; border-color: #4ade80; color: #0f1117; font-weight: 600; }

.chart-area {
  height: 320px;
  position: relative;
}

.chart-canvas {
  width: 100% !important;
  height: 100% !important;
}

.chart-loading, .chart-error {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: #555;
  font-size: 0.9rem;
}

.chart-error { color: #e05252; }

.modal-footer {
  border-top: 1px solid #1e2535;
  padding-top: 1rem;
}
</style>