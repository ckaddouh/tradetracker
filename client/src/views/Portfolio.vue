<template>
  <div class="page">
    <div class="page-header">
      <div>
        <h1 class="page-title">Portfolio</h1>
        <p class="page-sub">Paper trading performance</p>
      </div>
      <div class="time-filters">
        <button v-for="f in timeFilters" :key="f.val"
          :class="['pill', timeFilter === f.val && 'active']"
          @click="timeFilter = f.val">
          {{ f.label }}
        </button>
      </div>
    </div>

    <!-- Summary cards -->
    <div class="summary-grid">
      <template v-if="!loading">
        <div class="stat-card">
          <span class="stat-label">Total P&amp;L</span>
          <span :class="['stat-val', portfolio.totalPnl >= 0 ? 'pos' : 'neg']">
            {{ formatPnl(portfolio.totalPnl) }}
          </span>
        </div>
        <div class="stat-card">
          <span class="stat-label">Realised</span>
          <span :class="['stat-val', portfolio.realisedPnl >= 0 ? 'pos' : 'neg']">
            {{ formatPnl(portfolio.realisedPnl) }}
          </span>
        </div>
        <div class="stat-card">
          <span class="stat-label">Unrealised</span>
          <span :class="['stat-val', portfolio.unrealisedPnl >= 0 ? 'pos' : 'neg']">
            {{ formatPnl(portfolio.unrealisedPnl) }}
          </span>
        </div>
        <div class="stat-card">
          <span class="stat-label">Open Positions</span>
          <span class="stat-val mono">{{ portfolio.openPositions ? portfolio.openPositions.length : 0 }}</span>
        </div>
      </template>
      <template v-else>
        <div v-for="i in 4" :key="i" class="skeleton stat-skeleton"></div>
      </template>
    </div>

    <!-- Chart card -->
    <div class="chart-card">
      <div class="chart-card-header">
        <span class="chart-card-title">Cumulative P&amp;L</span>
      </div>
      <div class="chart-wrap">
        <canvas ref="chartCanvas"></canvas>
        <div v-if="chartLoading" class="chart-overlay">
          <div class="skeleton" style="width:100%;height:100%;border-radius:8px;"></div>
        </div>
        <div v-else-if="performance.length === 0" class="chart-empty">
          <p>Close some trades to see your equity curve.</p>
        </div>
      </div>
    </div>

    <!-- Open Positions -->
    <div class="positions-card">
      <h2 class="section-title">Open Positions</h2>
      <div v-if="loading" class="pos-list">
        <div v-for="i in 3" :key="i" class="skeleton" style="height:56px; border-radius:8px;"></div>
      </div>
      <div v-else-if="!portfolio.openPositions || portfolio.openPositions.length === 0" class="pos-empty">
        <p>No open positions. Create a trade idea and log a trade.</p>
      </div>
      <div v-else class="pos-list">
        <div v-for="pos in portfolio.openPositions" :key="pos.ticker" class="pos-row fade-up">
          <div class="pos-left">
            <span class="pos-ticker">{{ pos.ticker }}</span>
            <span class="pos-qty">{{ pos.quantity }} shares</span>
          </div>
          <div class="pos-right">
            <span :class="['pos-pnl', pnlClass(pos)]">
              {{ formatPnl(pos.currentValue - pos.costBasis) }}
            </span>
            <span class="pos-cost">Cost {{ formatMoney(pos.costBasis) }}</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { api } from '../api'

export default {
  name: 'Portfolio',
  data() {
    return {
      portfolio: {},
      performance: [],
      loading: true,
      chartLoading: true,
      timeFilter: 'all',
      chart: null,
      timeFilters: [
        { label: 'Month',    val: 'month' },
        { label: 'Year',     val: 'year' },
        { label: 'All Time', val: 'all' },
      ],
    }
  },
  async created() {
    await Promise.all([this.fetchPortfolio(), this.fetchPerformance()])
  },
  mounted() { this.drawChart() },
  watch: {
    performance() { this.drawChart() },
    timeFilter()   { this.drawChart() },
  },
  methods: {
    async fetchPortfolio() {
      this.loading = true
      try { this.portfolio = await api.get('/portfolio') }
      finally { this.loading = false }
    },
    async fetchPerformance() {
      this.chartLoading = true
      try { this.performance = await api.get('/portfolio/performance') }
      finally { this.chartLoading = false }
    },
    filteredPerformance() {
      if (this.timeFilter === 'all' || !this.performance.length) return this.performance
      const now = new Date()
      const cutoff = new Date()
      if (this.timeFilter === 'month') cutoff.setMonth(now.getMonth() - 1)
      if (this.timeFilter === 'year')  cutoff.setFullYear(now.getFullYear() - 1)
      return this.performance.filter((p) => new Date(p.date) >= cutoff)
    },
    async drawChart() {
      await this.$nextTick()
      const canvas = this.$refs.chartCanvas
      if (!canvas) return
      const data = this.filteredPerformance()
      if (!data.length) return
      const { Chart, LineElement, PointElement, LinearScale, CategoryScale, Filler, Tooltip } = await import('chart.js')
      Chart.register(LineElement, PointElement, LinearScale, CategoryScale, Filler, Tooltip)
      if (this.chart) this.chart.destroy()
      const labels = data.map((p) => new Date(p.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }))
      const values = data.map((p) => p.cumulativePnl)
      const isUp   = values[values.length - 1] >= 0
      const color  = isUp ? '#4ade80' : '#f87171'
      this.chart = new Chart(canvas, {
        type: 'line',
        data: {
          labels,
          datasets: [{
            data: values,
            borderColor: color,
            borderWidth: 2,
            pointRadius: 0,
            pointHoverRadius: 5,
            pointHoverBackgroundColor: color,
            fill: true,
            backgroundColor: (ctx) => {
              const gradient = ctx.chart.ctx.createLinearGradient(0, 0, 0, 220)
              gradient.addColorStop(0, isUp ? 'rgba(74,222,128,0.15)' : 'rgba(248,113,113,0.15)')
              gradient.addColorStop(1, 'rgba(0,0,0,0)')
              return gradient
            },
            tension: 0.35,
          }],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false },
            tooltip: {
              callbacks: { label: (ctx) => ` $${ctx.parsed.y.toFixed(2)}` },
              backgroundColor: '#222', titleColor: '#e8e8e8', bodyColor: '#e8e8e8',
              borderColor: '#2a2a2a', borderWidth: 1,
            },
          },
          scales: {
            x: { grid: { color: '#1e1e1e' }, ticks: { color: '#6b6b6b', font: { family: 'DM Mono', size: 11 } } },
            y: { grid: { color: '#1e1e1e' }, ticks: { color: '#6b6b6b', font: { family: 'DM Mono', size: 11 }, callback: (v) => `$${v}` } },
          },
        },
      })
    },
    pnlClass(pos) {
      return (pos.currentValue - pos.costBasis) >= 0 ? 'pos' : 'neg'
    },
    formatPnl(v) {
      if (v == null || isNaN(v)) return '—'
      const sign = v >= 0 ? '+' : ''
      return `${sign}$${Math.abs(v).toFixed(2)}`
    },
    formatMoney(v) {
      if (v == null || isNaN(v)) return '—'
      return `$${v.toFixed(2)}`
    },
  },
}
</script>

<style scoped>
.page { max-width: 1000px; margin: 0 auto; padding: 40px 28px 80px; }

.page-header {
  display: flex; align-items: flex-start; justify-content: space-between;
  margin-bottom: 28px; gap: 16px; flex-wrap: wrap;
}
.page-title { font-size: 1.75rem; font-weight: 800; letter-spacing: -0.03em; }
.page-sub { color: var(--muted); font-size: 0.82rem; margin-top: 3px; font-family: var(--font-mono); }
.time-filters { display: flex; gap: 6px; flex-wrap: wrap; align-self: flex-end; }

.summary-grid {
  display: grid; grid-template-columns: repeat(4, 1fr);
  gap: 12px; margin-bottom: 20px;
}
.stat-card {
  background: var(--surface); border: 1px solid var(--border);
  border-radius: var(--radius-lg); padding: 18px 20px;
  display: flex; flex-direction: column; gap: 10px;
}
.stat-skeleton { height: 82px; border-radius: var(--radius-lg); }
.stat-label { font-size: 0.72rem; color: var(--muted); text-transform: uppercase; letter-spacing: 0.07em; font-weight: 600; }
.stat-val { font-size: 1.3rem; font-family: var(--font-mono); font-weight: 500; }
.pos { color: var(--bullish); font-family: var(--font-mono); }
.neg { color: var(--bearish); font-family: var(--font-mono); }
.mono { font-family: var(--font-mono); }

.chart-card {
  background: var(--surface); border: 1px solid var(--border);
  border-radius: var(--radius-lg); padding: 20px 24px;
  margin-bottom: 20px;
}
.chart-card-header { margin-bottom: 16px; }
.chart-card-title { font-size: 0.78rem; color: var(--muted); font-weight: 600; text-transform: uppercase; letter-spacing: 0.07em; }
.chart-wrap { position: relative; height: 220px; }
.chart-overlay { position: absolute; inset: 0; }
.chart-empty { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; color: var(--muted); font-size: 0.875rem; }

.positions-card {
  background: var(--surface); border: 1px solid var(--border);
  border-radius: var(--radius-lg); padding: 20px 24px;
}
.section-title { font-size: 1rem; font-weight: 700; margin-bottom: 18px; }
.pos-list { display: flex; flex-direction: column; gap: 8px; }
.pos-row {
  display: flex; align-items: center; justify-content: space-between;
  padding: 14px 0; border-bottom: 1px solid var(--border);
}
.pos-row:last-child { border-bottom: none; padding-bottom: 0; }
.pos-left { display: flex; align-items: center; gap: 14px; }
.pos-ticker { font-family: var(--font-mono); font-size: 0.95rem; font-weight: 500; }
.pos-qty { font-size: 0.8rem; color: var(--muted); }
.pos-right { display: flex; flex-direction: column; align-items: flex-end; gap: 2px; }
.pos-pnl { font-family: var(--font-mono); font-size: 0.95rem; font-weight: 500; }
.pos-cost { font-family: var(--font-mono); font-size: 0.72rem; color: var(--muted); }
.pos-empty { text-align: center; padding: 40px; color: var(--muted); font-size: 0.875rem; }

@keyframes fadeUp {
  from { opacity: 0; transform: translateY(8px); }
  to   { opacity: 1; transform: translateY(0); }
}
.fade-up { animation: fadeUp 0.3s ease both; }

@media (max-width: 640px) { .summary-grid { grid-template-columns: repeat(2, 1fr); } }
@media (max-width: 380px) { .summary-grid { grid-template-columns: 1fr; } }
</style>