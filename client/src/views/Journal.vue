<template>
  <div class="page">
    <div class="page-header">
      <div>
        <h1 class="page-title">Trade Journal</h1>
        <p class="page-sub font-mono">{{ ideas.length }} idea{{ ideas.length !== 1 ? 's' : '' }}</p>
      </div>
      <button class="btn btn-primary" @click="openModal()">+ New Idea</button>
    </div>

    <div class="filters">
      <button v-for="f in filters" :key="f.val"
        :class="['pill', activeFilter === f.val && 'active']"
        @click="activeFilter = f.val">
        {{ f.label }}
      </button>
    </div>

    <div v-if="loading" class="list">
      <div v-for="i in 3" :key="i" class="skeleton idea-skeleton"></div>
    </div>

    <div v-else-if="filtered.length === 0" class="empty">
      <div class="empty-icon">📋</div>
      <p class="empty-msg">No ideas yet. Log your first trade thesis.</p>
      <button class="btn btn-primary" @click="openModal()">+ New Idea</button>
    </div>

    <div v-else class="list">
      <div v-for="(idea, i) in filtered" :key="idea._id"
        class="idea-card fade-up"
        :style="{ animationDelay: `${i * 0.04}s` }">

        <div class="idea-head">
          <div class="idea-head-left">
            <span class="idea-ticker">{{ idea.ticker }}</span>
            <span :class="`badge badge-${idea.direction}`">{{ idea.direction }}</span>
            <span class="badge badge-neutral">{{ idea.timeHorizon }}</span>
          </div>
          <span class="idea-date">{{ formatDate(idea.createdAt) }}</span>
        </div>

        <h3 class="idea-title">{{ idea.title }}</h3>
        <p class="idea-thesis">{{ idea.thesis }}</p>

        <div v-if="idea.catalysts && idea.catalysts.length" class="tags-row">
          <span v-for="c in idea.catalysts" :key="c" class="tag">{{ c }}</span>
        </div>

        <div class="idea-foot">
          <select class="status-select" :value="idea.status" @change="updateStatus(idea, $event.target.value)">
            <option value="researching">Researching</option>
            <option value="active">Active</option>
            <option value="closed">Closed</option>
          </select>
          <div class="idea-actions">
            <button class="action-btn" @click="openModal(idea)">Edit</button>
            <button class="action-btn action-btn--danger" @click="deleteIdea(idea._id)">Delete</button>
          </div>
        </div>
      </div>
    </div>

    <!-- Modal -->
    <div v-if="showModal" class="modal-overlay" @click.self="closeModal">
      <div class="modal">
        <div class="modal-header">
          <h2 class="modal-title">{{ editing ? 'Edit Idea' : 'New Idea' }}</h2>
          <button class="modal-close" @click="closeModal">✕</button>
        </div>
        <form @submit.prevent="saveIdea" class="modal-form">
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
            <input v-model="form.title" placeholder="Short summary of your thesis" required />
          </div>
          <div class="form-group">
            <label>Thesis</label>
            <textarea v-model="form.thesis" placeholder="Why do you believe this trade will work?" required></textarea>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label>Time Horizon</label>
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
            <label>Catalysts <span class="form-hint">(comma separated)</span></label>
            <input v-model="catalystsRaw" placeholder="earnings, FOMC, product launch" />
          </div>
          <div class="form-group">
            <label>Tags <span class="form-hint">(comma separated)</span></label>
            <input v-model="tagsRaw" placeholder="tech, growth, options" />
          </div>
          <p v-if="formError" class="form-error">{{ formError }}</p>
          <div class="modal-actions">
            <button type="button" class="btn btn-ghost" @click="closeModal">Cancel</button>
            <button type="submit" class="btn btn-primary" :disabled="saving">
              {{ saving ? 'Saving…' : (editing ? 'Update' : 'Create Idea') }}
            </button>
          </div>
        </form>
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
      ideas: [],
      loading: true,
      showModal: false,
      editing: null,
      saving: false,
      formError: null,
      activeFilter: 'all',
      catalystsRaw: '',
      tagsRaw: '',
      form: this.blankForm(),
      filters: [
        { label: 'All',         val: 'all' },
        { label: 'Researching', val: 'researching' },
        { label: 'Active',      val: 'active' },
        { label: 'Closed',      val: 'closed' },
      ],
    }
  },
  computed: {
    filtered() {
      if (this.activeFilter === 'all') return this.ideas
      return this.ideas.filter((i) => i.status === this.activeFilter)
    },
  },
  async created() { await this.fetchIdeas() },
  methods: {
    blankForm() {
      return { ticker: '', title: '', direction: 'bullish', thesis: '', timeHorizon: 'short', status: 'researching' }
    },
    async fetchIdeas() {
      this.loading = true
      try { this.ideas = await api.get('/ideas') }
      finally { this.loading = false }
    },
    openModal(idea = null) {
      this.formError = null
      if (idea) {
        this.editing = idea._id
        this.form = { ticker: idea.ticker, title: idea.title, direction: idea.direction, thesis: idea.thesis, timeHorizon: idea.timeHorizon, status: idea.status }
        this.catalystsRaw = (idea.catalysts || []).join(', ')
        this.tagsRaw = (idea.tags || []).join(', ')
      } else {
        this.editing = null
        this.form = this.blankForm()
        this.catalystsRaw = ''
        this.tagsRaw = ''
      }
      this.showModal = true
    },
    closeModal() { this.showModal = false },
    async saveIdea() {
      this.formError = null
      this.saving = true
      const payload = {
        ...this.form,
        ticker: this.form.ticker.toUpperCase(),
        catalysts: this.catalystsRaw.split(',').map((s) => s.trim()).filter(Boolean),
        tags: this.tagsRaw.split(',').map((s) => s.trim()).filter(Boolean),
      }
      try {
        if (this.editing) {
          const updated = await api.put(`/ideas/${this.editing}`, payload)
          const idx = this.ideas.findIndex((i) => i._id === this.editing)
          if (idx !== -1) this.ideas[idx] = updated
        } else {
          const created = await api.post('/ideas', payload)
          this.ideas.unshift(created)
        }
        this.closeModal()
      } catch (e) {
        this.formError = e.message
      } finally {
        this.saving = false
      }
    },
    async updateStatus(idea, status) {
      try {
        const updated = await api.put(`/ideas/${idea._id}`, { status })
        const idx = this.ideas.findIndex((i) => i._id === idea._id)
        if (idx !== -1) this.ideas[idx] = updated
      } catch (e) { alert(e.message) }
    },
    async deleteIdea(id) {
      if (!confirm('Delete this idea?')) return
      await api.delete(`/ideas/${id}`)
      this.ideas = this.ideas.filter((i) => i._id !== id)
    },
    formatDate(d) {
      return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    },
  },
}
</script>

<style scoped>
.page { max-width: 860px; margin: 0 auto; padding: 40px 28px 80px; }

.page-header {
  display: flex; align-items: flex-start; justify-content: space-between;
  margin-bottom: 28px; gap: 16px;
}
.page-title { font-size: 1.75rem; font-weight: 800; letter-spacing: -0.03em; }
.page-sub { color: var(--muted); font-size: 0.82rem; margin-top: 3px; font-family: var(--font-mono); }

.filters { display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 28px; }

.list { display: flex; flex-direction: column; gap: 12px; }
.idea-skeleton { height: 148px; border-radius: var(--radius-lg); }

.idea-card {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  padding: 20px 22px;
  transition: border-color 0.2s;
}
.idea-card:hover { border-color: #3a3a3a; }

.idea-head {
  display: flex; align-items: center; justify-content: space-between;
  margin-bottom: 12px; gap: 8px; flex-wrap: wrap;
}
.idea-head-left { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.idea-ticker { font-family: var(--font-mono); font-size: 1rem; font-weight: 500; color: var(--text); }

.badge {
  display: inline-flex; align-items: center;
  font-family: var(--font-mono); font-size: 0.68rem; font-weight: 600;
  padding: 3px 9px; border-radius: 4px; text-transform: uppercase; letter-spacing: 0.05em;
}
.badge-bullish { background: rgba(74,222,128,0.1); color: var(--bullish); border: 1px solid rgba(74,222,128,0.2); }
.badge-bearish { background: rgba(248,113,113,0.1); color: var(--bearish); border: 1px solid rgba(248,113,113,0.2); }
.badge-neutral { background: var(--surface2); color: var(--muted); border: 1px solid var(--border); }

.idea-date { font-family: var(--font-mono); font-size: 0.72rem; color: var(--muted); white-space: nowrap; }

.idea-title { font-size: 1rem; font-weight: 700; margin-bottom: 6px; line-height: 1.3; }
.idea-thesis {
  color: var(--muted); font-size: 0.875rem; line-height: 1.55;
  margin-bottom: 14px;
  display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;
}

.tags-row { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 16px; }
.tag {
  background: var(--surface2); border: 1px solid var(--border);
  border-radius: 4px; padding: 2px 9px;
  font-size: 0.72rem; color: var(--neutral); font-family: var(--font-mono);
}

.idea-foot {
  display: flex; align-items: center; justify-content: space-between;
  gap: 12px; flex-wrap: wrap;
  padding-top: 14px; border-top: 1px solid var(--border);
}
.status-select {
  background: var(--surface2); border: 1px solid var(--border); border-radius: var(--radius);
  color: var(--text); font-family: var(--font-sans); font-size: 0.8rem;
  padding: 6px 10px; cursor: pointer; outline: none; width: auto;
}
.idea-actions { display: flex; gap: 6px; }
.action-btn {
  background: none; border: 1px solid var(--border); color: var(--muted);
  font-family: var(--font-sans); font-size: 0.78rem; font-weight: 600;
  cursor: pointer; padding: 5px 12px; border-radius: var(--radius); transition: all 0.15s;
}
.action-btn:hover { color: var(--text); border-color: var(--muted); }
.action-btn--danger:hover { color: var(--bearish); border-color: rgba(248,113,113,0.4); background: rgba(248,113,113,0.05); }

.empty { text-align: center; padding: 80px 24px; display: flex; flex-direction: column; align-items: center; gap: 16px; }
.empty-icon { font-size: 2.5rem; }
.empty-msg { color: var(--muted); font-size: 0.9rem; }

.modal-form { display: flex; flex-direction: column; gap: 16px; }
.form-row { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
.form-hint { color: var(--muted); font-size: 0.75rem; font-weight: 400; text-transform: none; letter-spacing: 0; }
.modal-actions { display: flex; gap: 10px; justify-content: flex-end; margin-top: 4px; }
.form-error {
  color: var(--bearish); font-size: 0.85rem;
  background: rgba(248,113,113,0.07); border: 1px solid rgba(248,113,113,0.2);
  border-radius: var(--radius); padding: 10px 14px;
}

@keyframes fadeUp {
  from { opacity: 0; transform: translateY(8px); }
  to   { opacity: 1; transform: translateY(0); }
}
.fade-up { animation: fadeUp 0.3s ease both; }

@media (max-width: 500px) { .form-row { grid-template-columns: 1fr; } }
</style>