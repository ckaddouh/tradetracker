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

    <div class="card-footer" @click.stop>
      <div class="status-controls">
        <select :value="trade.status" @change="e => emit('update', trade._id, { status: e.target.value })" class="status-select">
          <option value="open">Open</option>
          <option value="monitoring">Monitoring</option>
          <option value="closed">Closed</option>
        </select>
        <select v-if="trade.status === 'closed'" :value="trade.outcome" @change="e => emit('update', trade._id, { outcome: e.target.value })" class="outcome-select">
          <option value="">Outcome...</option>
          <option value="win">Win</option>
          <option value="loss">Loss</option>
          <option value="breakeven">Breakeven</option>
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
            <span v-if="priceChange !== null" :class="['pnl-badge', priceChange >= 0 ? 'positive' : 'negative']">
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

        <div class="chart-area">
          <div v-if="chartLoading" class="chart-loading">Loading price history...</div>
          <div v-else-if="chartError" class="chart-error">{{ chartError }}</div>
          <canvas v-else ref="chartCanvas" class="chart-canvas"></canvas>
        </div>

        <div class="modal-footer" @click.stop>
          <div class="status-controls">
            <select :value="trade.status" @change="e => emit('update', trade._id, { status: e.target.value })" class="status-select">
              <option value="open">Open</option>
              <option value="monitoring">Monitoring</option>
              <option value="closed">Closed</option>
            </select>
            <select v-if="trade.status === 'closed'" :value="trade.outcome" @change="e => emit('update', trade._id, { outcome: e.target.value })" class="outcome-select">
              <option value="">Outcome...</option>
              <option value="win">Win</option>
              <option value="loss">Loss</option>
              <option value="breakeven">Breakeven</option>
            </select>
          </div>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup>
import { ref, nextTick } from 'vue'

const props = defineProps({ trade: Object })
const emit = defineEmits(['update', 'delete'])

const showModal = ref(false)
const chartCanvas = ref(null)
const chartLoading = ref(false)
const chartError = ref('')
const priceChange = ref(null)
const ideaPrice = ref(null)
const currentPrice = ref(null)
let chartInstance = null

function horizonLabel(h) {
  const map = { intraday: 'Intraday', swing: 'Swing', weeks: 'Weeks', months: 'Months', 'long-term': 'Long term' }
  return map[h] || h || ''
}

function formatDate(dateStr) {
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function openChart() {
  showModal.value = true
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
  chartError.value = ''
}

async function loadChart() {
  chartLoading.value = true
  chartError.value = ''

  try {
    const ticker = props.trade.ticker
    const ideaTs = Math.floor(new Date(props.trade.createdAt).getTime() / 1000)
    // Start 30 days before idea for context
    const fromTs = ideaTs - 60 * 60 * 24 * 30

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
    filtered.forEach((p, i) => {
      const diff = Math.abs(p.t - ideaTs)
      if (diff < minDiff) { minDiff = diff; closestIdx = i }
    })

    ideaPrice.value = filtered[closestIdx].c
    currentPrice.value = filtered[filtered.length - 1].c
    priceChange.value = ((currentPrice.value - ideaPrice.value) / ideaPrice.value) * 100

    const labels = filtered.map(p =>
      new Date(p.t * 1000).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    )
    const prices = filtered.map(p => p.c)

    await nextTick()
    renderChart(labels, prices, closestIdx, ideaPrice.value)
  } catch (err) {
    chartError.value = err.message || 'Could not load price data'
  } finally {
    chartLoading.value = false
  }
}

async function renderChart(labels, prices, ideaIdx, ideaPriceVal) {
  // Dynamically import Chart.js to avoid SSR issues
  const { Chart, registerables } = await import('chart.js')
  Chart.register(...registerables)

  if (chartInstance) chartInstance.destroy()

  const canvas = chartCanvas.value
  if (!canvas) return
  const ctx = canvas.getContext('2d')

  // Colour the line: grey before idea, green/red after
  const isLong = props.trade.direction === 'long'
  const afterColour = priceChange.value >= 0
    ? (isLong ? '#4ade80' : '#e05252')
    : (isLong ? '#e05252' : '#4ade80')

  // Build per-segment colours
  const pointColors = prices.map((_, i) => {
    if (i < ideaIdx) return '#555'
    return afterColour
  })

  const pointRadius = prices.map((_, i) => (i === ideaIdx ? 7 : 0))
  const pointBorderColor = prices.map((_, i) => (i === ideaIdx ? '#fff' : 'transparent'))
  const pointBorderWidth = prices.map((_, i) => (i === ideaIdx ? 2 : 0))

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
        pointBackgroundColor: prices.map((_, i) => (i === ideaIdx ? '#fff' : 'transparent')),
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
        const point = meta.data[ideaIdx]
        if (!point) return
        const { ctx: c, chartArea: { top, bottom } } = chart
        c.save()
        c.beginPath()
        c.setLineDash([4, 4])
        c.strokeStyle = '#f59e0b'
        c.lineWidth = 1.5
        c.moveTo(point.x, top)
        c.lineTo(point.x, bottom)
        c.stroke()

        // Label
        c.font = '11px monospace'
        c.fillStyle = '#f59e0b'
        c.textAlign = 'center'
        c.fillText(`$${ideaPriceVal.toFixed(2)}`, point.x, top + 28)
        c.restore()
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