<template>
  <div class="page">
    <div class="page-header">
      <div>
        <h1 class="page-title">Portfolio</h1>
        <p class="page-sub">Paper trading performance</p>
      </div>
      <div class="filters" style="margin-bottom:0">
        <button v-for="f in timeFilters" :key="f.val" :class="['pill', timeFilter===f.val&&'active']" @click="timeFilter=f.val">
          {{ f.label }}
        </button>
      </div>
    </div>

    <!-- stats -->
    <div class="stats-grid">
      <template v-if="!loading">
        <div class="stat-card">
          <div class="stat-label">Total P&amp;L</div>
          <div :class="['stat-val', portfolio.totalPnl>=0?'pnl-pos':'pnl-neg']">{{ fmtPnl(portfolio.totalPnl) }}</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Realised</div>
          <div :class="['stat-val', portfolio.realisedPnl>=0?'pnl-pos':'pnl-neg']">{{ fmtPnl(portfolio.realisedPnl) }}</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Unrealised</div>
          <div :class="['stat-val', portfolio.unrealisedPnl>=0?'pnl-pos':'pnl-neg']">{{ fmtPnl(portfolio.unrealisedPnl) }}</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Open positions</div>
          <div class="stat-val stat-mono">{{ portfolio.openPositions ? portfolio.openPositions.length : 0 }}</div>
        </div>
      </template>
      <template v-else>
        <div v-for="i in 4" :key="i" class="skeleton" style="height:78px;border-radius:8px;"></div>
      </template>
    </div>

    <!-- chart -->
    <div class="panel">
      <div class="panel-label">Cumulative P&amp;L</div>
      <div class="chart-area">
        <canvas ref="chartCanvas"></canvas>
        <div v-if="chartLoading" class="chart-cover">
          <div class="skeleton" style="width:100%;height:100%;border-radius:6px;"></div>
        </div>
        <div v-else-if="performance.length===0" class="chart-empty">
          Close some trades to see your equity curve.
        </div>
      </div>
    </div>

    <!-- positions -->
    <div class="panel">
      <div class="panel-label">Open positions</div>
      <div v-if="loading" class="pos-list">
        <div v-for="i in 3" :key="i" class="skeleton" style="height:50px;border-radius:6px;"></div>
      </div>
      <div v-else-if="!portfolio.openPositions||portfolio.openPositions.length===0" class="pos-empty">
        No open positions yet.
      </div>
      <div v-else class="pos-list">
        <div v-for="pos in portfolio.openPositions" :key="pos.ticker" class="pos-row fade-up">
          <div class="pos-left">
            <span class="pos-ticker">{{ pos.ticker }}</span>
            <span class="pos-qty">{{ pos.quantity }} shares</span>
          </div>
          <div class="pos-right">
            <span :class="['pos-pnl', (pos.currentValue-pos.costBasis)>=0?'pnl-pos':'pnl-neg']">
              {{ fmtPnl(pos.currentValue - pos.costBasis) }}
            </span>
            <span class="pos-cost">Cost {{ fmtMoney(pos.costBasis) }}</span>
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
      portfolio: {}, performance: [], loading: true, chartLoading: true,
      timeFilter: 'all', chart: null,
      timeFilters: [{label:'Month',val:'month'},{label:'Year',val:'year'},{label:'All time',val:'all'}],
    }
  },
  async created() { await Promise.all([this.fetchPortfolio(), this.fetchPerformance()]) },
  mounted() { this.drawChart() },
  watch: {
    performance() { this.drawChart() },
    timeFilter()   { this.drawChart() },
  },
  methods: {
    async fetchPortfolio() {
      this.loading = true
      try { this.portfolio = await api.get('/portfolio') } finally { this.loading = false }
    },
    async fetchPerformance() {
      this.chartLoading = true
      try { this.performance = await api.get('/portfolio/performance') } finally { this.chartLoading = false }
    },
    filteredPerf() {
      if (this.timeFilter==='all'||!this.performance.length) return this.performance
      const cutoff = new Date()
      if (this.timeFilter==='month') cutoff.setMonth(cutoff.getMonth()-1)
      else cutoff.setFullYear(cutoff.getFullYear()-1)
      return this.performance.filter(p=>new Date(p.date)>=cutoff)
    },
    async drawChart() {
      await this.$nextTick()
      const canvas = this.$refs.chartCanvas
      if (!canvas) return
      const data = this.filteredPerf()
      if (!data.length) return
      const { Chart, LineElement, PointElement, LinearScale, CategoryScale, Filler, Tooltip } = await import('chart.js')
      Chart.register(LineElement, PointElement, LinearScale, CategoryScale, Filler, Tooltip)
      if (this.chart) this.chart.destroy()
      const labels = data.map(p=>new Date(p.date).toLocaleDateString('en-US',{month:'short',day:'numeric'}))
      const values = data.map(p=>p.cumulativePnl)
      const isUp = values[values.length-1]>=0
      const col  = isUp ? '#3ddc84' : '#ff6b6b'
      this.chart = new Chart(canvas, {
        type: 'line',
        data: {
          labels,
          datasets: [{
            data: values, borderColor: col, borderWidth: 1.5,
            pointRadius: 0, pointHoverRadius: 4, pointHoverBackgroundColor: col,
            fill: true,
            backgroundColor: ctx => {
              const g = ctx.chart.ctx.createLinearGradient(0,0,0,200)
              g.addColorStop(0, isUp?'rgba(61,220,132,0.14)':'rgba(255,107,107,0.14)')
              g.addColorStop(1, 'rgba(0,0,0,0)')
              return g
            },
            tension: 0.3,
          }],
        },
        options: {
          responsive: true, maintainAspectRatio: false,
          plugins: {
            legend: {display:false},
            tooltip: {
              callbacks: {label:ctx=>` $${ctx.parsed.y.toFixed(2)}`},
              backgroundColor:'#1c1c1c', titleColor:'#e2e2e2', bodyColor:'#e2e2e2',
              borderColor:'#333', borderWidth:1,
            },
          },
          scales: {
            x: {grid:{color:'#1a1a1a'}, ticks:{color:'#5a5a5a', font:{family:'JetBrains Mono',size:10}}},
            y: {grid:{color:'#1a1a1a'}, ticks:{color:'#5a5a5a', font:{family:'JetBrains Mono',size:10}, callback:v=>`$${v}`}},
          },
        },
      })
    },
    fmtPnl(v) {
      if (v==null||isNaN(v)) return '—'
      return `${v>=0?'+':''}$${Math.abs(v).toFixed(2)}`
    },
    fmtMoney(v) { return v==null||isNaN(v) ? '—' : `$${v.toFixed(2)}` },
  },
}
</script>

<style scoped>
.stats-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 10px;
  margin-bottom: 16px;
}
.stat-card {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--r-lg);
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.stat-label { font-size: 0.68rem; color: var(--muted); text-transform: uppercase; letter-spacing: 0.08em; font-weight: 600; }
.stat-val { font-family: var(--mono); font-size: 1.25rem; font-weight: 400; }
.stat-mono { color: var(--text); }

.panel {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--r-lg);
  padding: 16px 18px;
  margin-bottom: 14px;
}
.panel-label { font-size: 0.68rem; color: var(--muted); text-transform: uppercase; letter-spacing: 0.08em; font-weight: 600; margin-bottom: 14px; }

.chart-area { position: relative; height: 200px; }
.chart-cover { position: absolute; inset: 0; }
.chart-empty { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; color: var(--muted); font-size: 0.82rem; }

.pos-list { display: flex; flex-direction: column; }
.pos-row {
  display: flex; align-items: center; justify-content: space-between;
  padding: 12px 0; border-bottom: 1px solid var(--border);
}
.pos-row:last-child { border-bottom: none; padding-bottom: 0; }
.pos-left { display: flex; align-items: center; gap: 12px; }
.pos-ticker { font-family: var(--mono); font-size: 0.88rem; font-weight: 500; }
.pos-qty { font-size: 0.75rem; color: var(--muted); }
.pos-right { display: flex; flex-direction: column; align-items: flex-end; gap: 2px; }
.pos-pnl { font-family: var(--mono); font-size: 0.88rem; }
.pos-cost { font-family: var(--mono); font-size: 0.68rem; color: var(--muted); }
.pos-empty { color: var(--muted); font-size: 0.82rem; padding: 24px 0; text-align: center; }

@media (max-width: 600px) { .stats-grid { grid-template-columns: repeat(2,1fr); } }
@media (max-width: 360px) { .stats-grid { grid-template-columns: 1fr; } }
</style>