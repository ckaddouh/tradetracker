<template>
  <div class="page">
    <div class="page-header">
      <div>
        <h1 class="page-title">Journal</h1>
        <p class="page-sub">{{ ideas.length }} idea{{ ideas.length !== 1 ? 's' : '' }}</p>
      </div>
      <button class="btn btn-primary" @click="openModal()">+ New idea</button>
    </div>

    <div class="filters">
      <button v-for="f in filters" :key="f.val" :class="['pill', activeFilter===f.val&&'active']" @click="activeFilter=f.val">
        {{ f.label }}
      </button>
    </div>

    <!-- loading -->
    <div v-if="loading" class="idea-list">
      <div v-for="i in 4" :key="i" class="skeleton" style="height:130px;"></div>
    </div>

    <!-- empty -->
    <div v-else-if="filtered.length===0" class="empty-state">
      <div class="empty-icon">📋</div>
      <p class="empty-msg">No ideas yet.</p>
      <button class="btn btn-primary" @click="openModal()">Log your first thesis</button>
    </div>

    <!-- list -->
    <div v-else class="idea-list">
      <div v-for="(idea,i) in filtered" :key="idea._id" class="idea-card fade-up" :style="{animationDelay:`${i*0.04}s`}">
        <div class="ic-head">
          <div class="ic-head-left">
            <span class="ic-ticker">{{ idea.ticker }}</span>
            <span :class="['ic-dir', `ic-dir--${idea.direction}`]">{{ idea.direction }}</span>
            <span class="ic-horizon">{{ idea.timeHorizon }}</span>
          </div>
          <span class="ic-date">{{ fmtDate(idea.createdAt) }}</span>
        </div>
        <p class="ic-title">{{ idea.title }}</p>
        <p class="ic-thesis">{{ idea.thesis }}</p>
        <div v-if="idea.catalysts&&idea.catalysts.length" class="ic-tags">
          <span v-for="c in idea.catalysts" :key="c" class="ic-tag">{{ c }}</span>
        </div>
        <div class="ic-foot">
          <select class="status-sel" :value="idea.status" @change="updateStatus(idea,$event.target.value)">
            <option value="researching">Researching</option>
            <option value="active">Active</option>
            <option value="closed">Closed</option>
          </select>
          <div class="ic-actions">
            <button class="ic-btn" @click="openModal(idea)">Edit</button>
            <button class="ic-btn ic-btn--del" @click="del(idea._id)">Delete</button>
          </div>
        </div>
        <div v-if="ideaTrades(idea._id).length" class="ic-trades">
          <div v-for="trade in ideaTrades(idea._id)" :key="trade._id" class="ic-trade" @click="console.log('Trade clicked:', trade); openTradeModal(trade)">
            <span class="ic-trade-type">{{ trade.type }} {{ trade.quantity }} @ {{ fmtMoney(trade.entryPrice) }}</span>
            <span class="ic-trade-status">{{ trade.status }}</span>
          </div>
        </div>
        <!-- Debug: Show trade count -->
        <div style="font-size: 0.7rem; color: red; margin-top: 5px;">
          Debug: {{ ideaTrades(idea._id).length }} trades for idea {{ idea._id }}
        </div>
      </div>
    </div>

    <!-- modal -->
    <div v-if="showModal" class="modal-overlay" @click.self="closeModal">
      <div class="modal">
        <div class="modal-header">
          <h2 class="modal-title">{{ editing ? 'Edit idea' : 'New idea' }}</h2>
          <button class="modal-close" @click="closeModal">✕</button>
        </div>
        <form @submit.prevent="save" class="modal-form">
          <div class="form-row">
            <div class="form-group">
              <label>Ticker</label>
              <input v-model="form.ticker" placeholder="AAPL" required style="text-transform:uppercase" />
            </div>
            <div class="form-group">
              <label>Direction</label>
              <select v-model="form.direction" required>
                <option value="bullish">Bullish</option>
                <option value="bearish">Bearish</option>
                <option value="neutral">Neutral</option>
              </select>
            </div>
          </div>
          <div class="form-group">
            <label>Title</label>
            <input v-model="form.title" placeholder="One-line thesis summary" required />
          </div>
          <div class="form-group">
            <label>Thesis</label>
            <textarea v-model="form.thesis" placeholder="Why will this trade work?" required></textarea>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label>Horizon</label>
              <select v-model="form.timeHorizon" required>
                <option value="short">Short</option>
                <option value="medium">Medium</option>
                <option value="long">Long</option>
              </select>
            </div>
            <div class="form-group">
              <label>Status</label>
              <select v-model="form.status">
                <option value="researching">Researching</option>
                <option value="active">Active</option>
                <option value="closed">Closed</option>
              </select>
            </div>
          </div>
          <div class="form-group">
            <label>Catalysts <span class="form-hint">comma-separated</span></label>
            <input v-model="catalystsRaw" placeholder="earnings, FOMC, product launch" />
          </div>
          <div class="form-group">
            <label>Tags <span class="form-hint">comma-separated</span></label>
            <input v-model="tagsRaw" placeholder="tech, growth, options" />
          </div>
          <p v-if="formErr" class="form-error">{{ formErr }}</p>
          <div class="modal-actions">
            <button type="button" class="btn btn-ghost" @click="closeModal">Cancel</button>
            <button type="submit" class="btn btn-primary" :disabled="saving">
              {{ saving ? 'Saving…' : editing ? 'Update' : 'Create' }}
            </button>
          </div>
        </form>
      </div>
    </div>

    <!-- trade modal -->
    <div v-if="showTradeModal" class="modal-overlay" @click.self="closeTradeModal">
      <div class="modal modal--wide">
        <div class="modal-header">
          <h2 class="modal-title">{{ selectedTrade.ticker }} Trade</h2>
          <button class="modal-close" @click="closeTradeModal">✕</button>
        </div>
        <div class="modal-body">
          <div class="trade-details">
            <div class="trade-info">
              <p><strong>Type:</strong> {{ selectedTrade.type }}</p>
              <p><strong>Quantity:</strong> {{ selectedTrade.quantity }}</p>
              <p><strong>Entry Price:</strong> {{ fmtMoney(selectedTrade.entryPrice) }}</p>
              <p><strong>Opened:</strong> {{ fmtDate(selectedTrade.openedAt) }}</p>
              <p v-if="selectedTrade.closedAt"><strong>Closed:</strong> {{ fmtDate(selectedTrade.closedAt) }}</p>
              <p><strong>Status:</strong> {{ selectedTrade.status }}</p>
            </div>
            <div class="trade-chart">
              <div class="chart-controls">
                <button v-for="tf in timeFrames" :key="tf.val" :class="['pill', chartPeriod===tf.val&&'active']" @click="chartPeriod=tf.val; fetchChartData()">
                  {{ tf.label }}
                </button>
              </div>
              <div class="chart-area">
                <canvas ref="tradeChartCanvas"></canvas>
                <div v-if="chartLoading" class="chart-cover">
                  <div class="skeleton" style="width:100%;height:100%;border-radius:6px;"></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>

</template>

<script>
import { api } from '../api'
export default {
  name: 'Journal',
  data() {
    return {
      ideas: [], trades: [], loading: true, showModal: false, editing: null,
      saving: false, formErr: null, activeFilter: 'all',
      catalystsRaw: '', tagsRaw: '',
      form: this.blank(),
      filters: [
        {label:'All',val:'all'},{label:'Researching',val:'researching'},
        {label:'Active',val:'active'},{label:'Closed',val:'closed'},
      ],
      showTradeModal: false, selectedTrade: {}, chartData: [], chartLoading: false, chartPeriod: '1M', tradeChart: null,
      timeFrames: [
        {label:'1M',val:'1M'},{label:'3M',val:'3M'},{label:'6M',val:'6M'},{label:'1Y',val:'1Y'},
      ],
    }
  },
  computed: {
    filtered() {
      return this.activeFilter==='all' ? this.ideas : this.ideas.filter(i=>i.status===this.activeFilter)
    },
    ideaTrades() {
      return (ideaId) => {
        const filtered = this.trades.filter(t => t.ideaId === ideaId || t.ideaId === ideaId.toString())
        console.log('ideaTrades for', ideaId, 'found', filtered.length, 'trades')
        return filtered
      }
    },
  },
  async created() { await this.fetch() },
  methods: {
    blank() { return {ticker:'',title:'',direction:'bullish',thesis:'',timeHorizon:'short',status:'researching'} },
    async fetch() {
      this.loading = true
      try {
        const [ideas, trades] = await Promise.all([api.get('/ideas'), api.get('/trades')])
        this.ideas = ideas
        this.trades = trades
        console.log('Fetched ideas:', ideas.length, 'trades:', trades.length)
        console.log('Trades:', trades)
      } finally { this.loading = false }
    },
    openModal(idea=null) {
      this.formErr = null
      if (idea) {
        this.editing = idea._id
        this.form = {ticker:idea.ticker,title:idea.title,direction:idea.direction,thesis:idea.thesis,timeHorizon:idea.timeHorizon,status:idea.status}
        this.catalystsRaw = (idea.catalysts||[]).join(', ')
        this.tagsRaw      = (idea.tags||[]).join(', ')
      } else {
        this.editing = null; this.form = this.blank(); this.catalystsRaw=''; this.tagsRaw=''
      }
      this.showModal = true
    },
    closeModal() { this.showModal = false },
    async save() {
      this.formErr = null; this.saving = true
      const payload = {
        ...this.form, ticker: this.form.ticker.toUpperCase(),
        catalysts: this.catalystsRaw.split(',').map(s=>s.trim()).filter(Boolean),
        tags: this.tagsRaw.split(',').map(s=>s.trim()).filter(Boolean),
      }
      try {
        if (this.editing) {
          const u = await api.put(`/ideas/${this.editing}`, payload)
          const idx = this.ideas.findIndex(i=>i._id===this.editing)
          if (idx!==-1) this.ideas[idx]=u
        } else {
          this.ideas.unshift(await api.post('/ideas', payload))
        }
        this.closeModal()
      } catch(e) { this.formErr = e.message }
      finally { this.saving = false }
    },
    async updateStatus(idea, status) {
      try {
        const u = await api.put(`/ideas/${idea._id}`, {status})
        const idx = this.ideas.findIndex(i=>i._id===idea._id)
        if (idx!==-1) this.ideas[idx]=u
      } catch(e) { alert(e.message) }
    },
    async del(id) {
      if (!confirm('Delete this idea?')) return
      await api.delete(`/ideas/${id}`)
      this.ideas = this.ideas.filter(i=>i._id!==id)
    },
    fmtDate(d) { return new Date(d).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'}) },
    fmtMoney(v) { return `$${v.toFixed(2)}` },
    openTradeModal(trade) {
      console.log('Opening trade modal for:', trade)
      this.selectedTrade = trade
      this.showTradeModal = true
      this.fetchChartData()
    },
    closeTradeModal() {
      this.showTradeModal = false
      if (this.tradeChart) this.tradeChart.destroy()
    },
    async fetchChartData() {
      this.chartLoading = true
      try {
        console.log('Fetching chart data for:', this.selectedTrade.ticker, this.chartPeriod)
        this.chartData = await api.get(`/prices/historical?ticker=${this.selectedTrade.ticker}&period=${this.chartPeriod}`)
        console.log('Chart data received:', this.chartData)
        await this.$nextTick()
        this.drawChart()
      } catch(e) {
        console.error('Error fetching chart data:', e)
        this.chartData = []
      } finally {
        this.chartLoading = false
      }
    },
    async drawChart() {
      const canvas = this.$refs.tradeChartCanvas
      if (!canvas || !this.chartData.length) return
      const { Chart, LineElement, PointElement, LinearScale, CategoryScale, Filler, Tooltip } = await import('chart.js')
      const annotationPlugin = await import('chartjs-plugin-annotation')
      Chart.register(LineElement, PointElement, LinearScale, CategoryScale, Filler, Tooltip, annotationPlugin)
      if (this.tradeChart) this.tradeChart.destroy()
      const labels = this.chartData.map(p => new Date(p.date).toLocaleDateString('en-US',{month:'short',day:'numeric'}))
      const values = this.chartData.map(p => p.close)
      const entryDate = new Date(this.selectedTrade.openedAt).toISOString().split('T')[0]
      const entryIndex = this.chartData.findIndex(p => p.date === entryDate)
      const entryValue = entryIndex !== -1 ? values[entryIndex] : null
      console.log('Chart data:', this.chartData.length, 'Entry date:', entryDate, 'Entry index:', entryIndex, 'Entry value:', entryValue)
      this.tradeChart = new Chart(canvas, {
        type: 'line',
        data: {
          labels,
          datasets: [{
            data: values, borderColor: '#3ddc84', borderWidth: 1.5,
            pointRadius: 0, pointHoverRadius: 4, pointHoverBackgroundColor: '#3ddc84',
            fill: true,
            backgroundColor: ctx => {
              const g = ctx.chart.ctx.createLinearGradient(0,0,0,200)
              g.addColorStop(0, 'rgba(61,220,132,0.14)')
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
              callbacks: {label:ctx=>`$${ctx.parsed.y.toFixed(2)}`},
            },
            annotation: entryValue ? {
              annotations: {
                entryPoint: {
                  type: 'point',
                  xValue: entryIndex,
                  yValue: entryValue,
                  backgroundColor: '#ff6b6b',
                  borderColor: '#ff6b6b',
                  borderWidth: 2,
                  radius: 6,
                  label: {
                    content: 'Entry',
                    enabled: true,
                    position: 'top'
                  }
                }
              }
            } : {},
          },
        },
      })
    },
  },
}
</script>

<style scoped>
.idea-list { display: flex; flex-direction: column; gap: 10px; }

.idea-card {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--r-lg);
  padding: 16px 18px;
  transition: border-color 0.15s;
}
.idea-card:hover { border-color: var(--border2); }

.ic-head {
  display: flex; align-items: center; justify-content: space-between;
  gap: 8px; margin-bottom: 10px; flex-wrap: wrap;
}
.ic-head-left { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.ic-ticker { font-family: var(--mono); font-size: 0.9rem; font-weight: 500; }
.ic-dir {
  font-family: var(--mono); font-size: 0.62rem; font-weight: 600;
  padding: 2px 7px; border-radius: 3px; text-transform: uppercase;
}
.ic-dir--bullish { background: rgba(61,220,132,0.1); color: var(--green); border: 1px solid rgba(61,220,132,0.2); }
.ic-dir--bearish { background: rgba(255,107,107,0.1); color: var(--red);   border: 1px solid rgba(255,107,107,0.2); }
.ic-dir--neutral { background: var(--surface2); color: var(--muted2); border: 1px solid var(--border); }
.ic-horizon { font-size: 0.72rem; color: var(--muted); background: var(--surface2); padding: 2px 7px; border-radius: 3px; }
.ic-date { font-family: var(--mono); font-size: 0.68rem; color: var(--muted); white-space: nowrap; }

.ic-title { font-size: 0.9rem; font-weight: 600; margin-bottom: 5px; line-height: 1.35; }
.ic-thesis {
  font-size: 0.82rem; color: var(--muted2); line-height: 1.55;
  margin-bottom: 10px;
  display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;
}
.ic-tags { display: flex; flex-wrap: wrap; gap: 5px; margin-bottom: 12px; }
.ic-tag {
  font-family: var(--mono); font-size: 0.65rem; color: var(--muted2);
  background: var(--surface2); border: 1px solid var(--border);
  border-radius: 3px; padding: 2px 7px;
}

.ic-foot {
  display: flex; align-items: center; justify-content: space-between;
  gap: 10px; padding-top: 12px; border-top: 1px solid var(--border); flex-wrap: wrap;
}
.status-sel {
  background: var(--surface2); border: 1px solid var(--border); border-radius: var(--r);
  color: var(--text); font-family: var(--sans); font-size: 0.78rem;
  padding: 5px 28px 5px 9px; cursor: pointer; width: auto;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6'%3E%3Cpath d='M0 0l5 6 5-6z' fill='%235a5a5a'/%3E%3C/svg%3E");
  background-repeat: no-repeat; background-position: right 8px center; appearance: none;
}
.ic-actions { display: flex; gap: 6px; }
.ic-btn {
  background: none; border: 1px solid var(--border); color: var(--muted2);
  font-family: var(--sans); font-size: 0.75rem; font-weight: 500;
  cursor: pointer; padding: 4px 10px; border-radius: var(--r); transition: all 0.12s;
}
.ic-btn:hover { color: var(--text); border-color: var(--border2); }
.ic-btn--del:hover { color: var(--red); border-color: rgba(255,107,107,0.35); background: rgba(255,107,107,0.05); }

.ic-trades { margin-top: 12px; padding-top: 12px; border-top: 1px solid var(--border); }
.ic-trade {
  display: flex; justify-content: space-between; align-items: center;
  padding: 8px 12px; margin-bottom: 6px; background: var(--surface2);
  border: 1px solid var(--border); border-radius: var(--r); cursor: pointer;
  transition: all 0.12s;
}
.ic-trade:hover { border-color: var(--border2); background: var(--surface); }
.ic-trade-type { font-family: var(--mono); font-size: 0.75rem; color: var(--text); }
.ic-trade-status {
  font-family: var(--mono); font-size: 0.65rem; color: var(--muted);
  background: var(--surface); padding: 2px 6px; border-radius: 3px;
}

.empty-state {
  display: flex; flex-direction: column; align-items: center; gap: 14px;
  padding: 80px 24px; text-align: center;
}
.empty-icon { font-size: 2rem; }
.empty-msg { color: var(--muted); font-size: 0.88rem; }

/* Modal styles */
.modal-overlay {
  position: fixed; top: 0; left: 0; right: 0; bottom: 0;
  background: rgba(0,0,0,0.6); display: flex; align-items: center; justify-content: center;
  z-index: 1000; padding: 20px;
}
.modal {
  background: var(--surface); border-radius: var(--r); max-width: 500px; width: 100%;
  max-height: 90vh; overflow-y: auto; box-shadow: 0 10px 40px rgba(0,0,0,0.3);
}
.modal--wide { max-width: 800px; }
.modal-header {
  display: flex; align-items: center; justify-content: space-between;
  padding: 20px 24px; border-bottom: 1px solid var(--border);
}
.modal-title { font-size: 1.1rem; font-weight: 600; }
.modal-close {
  background: none; border: none; font-size: 1.2rem; cursor: pointer;
  color: var(--muted2); padding: 4px; border-radius: 4px;
  transition: all 0.12s;
}
.modal-close:hover { background: var(--surface2); color: var(--text); }
.modal-body { padding: 24px; }
.modal-form { display: flex; flex-direction: column; gap: 16px; }
.modal-actions {
  display: flex; gap: 10px; justify-content: flex-end; padding-top: 16px;
  border-top: 1px solid var(--border);
}

/* Trade modal specific */
.trade-details { display: flex; gap: 24px; }
.trade-info { flex: 1; }
.trade-info p { margin-bottom: 8px; font-size: 0.9rem; }
.trade-chart { flex: 2; }
.chart-controls { display: flex; gap: 8px; margin-bottom: 16px; }
.chart-area { height: 300px; position: relative; }
</style>