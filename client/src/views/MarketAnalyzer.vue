<template>
  <div class="analyzer-page">

    <!-- Top bar -->
    <div class="top-bar">
      <div class="top-left">
        <h1 class="page-title">Market<span class="accent">Analyzer</span></h1>
        <p class="page-sub">Trace supply chains. Surface hidden exposures.</p>
      </div>

      <div class="search-area">
        <div class="ticker-input-wrap">
          <input
            v-model="tickerInput"
            class="ticker-input"
            placeholder="Enter ticker (e.g. AAPL)"
            @keyup.enter="loadCompany"
            @input="tickerInput = tickerInput.toUpperCase()"
            :disabled="loading"
          />
          <button class="analyze-btn" @click="loadCompany" :disabled="loading || !tickerInput">
            <span v-if="loading" class="btn-spinner" />
            <span v-else>Analyze →</span>
          </button>
        </div>
        <div v-if="loadingStage" class="loading-stage">{{ loadingStage }}</div>
        <div v-if="error" class="error-msg">{{ error }}</div>
      </div>

      <div class="top-right">
        <button
          :class="['tab-toggle', { active: activePanel === 'graph' }]"
          @click="activePanel = 'graph'"
        >Supply Chain</button>
        <button
          :class="['tab-toggle', { active: activePanel === 'news' }]"
          @click="activePanel = 'news'"
          :disabled="!tree"
        >News Analysis</button>
      </div>
    </div>

    <!-- Main content -->
    <div class="main-content">

      <!-- ── GRAPH VIEW ── -->
      <template v-if="activePanel === 'graph'">
        <div v-if="!tree" class="empty-state">
          <div class="empty-icon">⬡</div>
          <p>Enter a ticker above to map its supply chain dependency graph.</p>
          <div class="example-tickers">
            <span class="example-label">Try:</span>
            <button v-for="t in exampleTickers" :key="t" class="example-ticker" @click="quickLoad(t)">{{ t }}</button>
          </div>
        </div>

        <div v-else class="graph-layout">
          <DependencyGraph
            :tree="tree"
            :highlightedIds="highlightedIds"
            @nodeClick="onNodeClick"
            @nodeHover="onNodeHover"
          />
          <NodePanel
            :node="selectedNode"
            :exposedCompanies="exposedCompanies[selectedNode?.id]"
            :loadingExposed="loadingExposed"
            @close="selectedNode = null"
            @loadExposed="loadExposed"
          />
        </div>
      </template>

      <!-- ── NEWS ANALYSIS VIEW ── -->
      <template v-if="activePanel === 'news'">
        <div class="news-layout">
          <div class="news-input-panel">
            <h2>Paste Article</h2>
            <p class="news-hint">Paste any news article, earnings report, or market update. The analyzer will identify which nodes in the supply chain graph are affected and surface analogous historical events.</p>
            <textarea
              v-model="articleText"
              class="article-textarea"
              placeholder="Paste article text here..."
              rows="14"
            />
            <button
              class="analyze-btn full-width"
              @click="analyzeArticle"
              :disabled="!articleText.trim() || analyzingNews || !tree"
            >
              <span v-if="analyzingNews" class="btn-spinner" />
              <span v-else>Analyze Impact →</span>
            </button>
            <p v-if="!tree" class="news-warn">⚠ Load a company first via the Supply Chain tab.</p>
          </div>

          <div class="news-results-panel" v-if="newsResult">
            <!-- Summary -->
            <div class="result-section">
              <h3 class="result-heading">Event Summary</h3>
              <p class="result-summary">{{ newsResult.summary }}</p>
            </div>

            <!-- Affected nodes -->
            <div class="result-section">
              <h3 class="result-heading">Affected Supply Chain Nodes</h3>
              <div class="affected-list">
                <div
                  v-for="n in newsResult.affectedNodes"
                  :key="n.nodeId"
                  class="affected-card"
                  :class="n.impact"
                  @click="highlightNode(n.nodeId)"
                >
                  <div class="affected-header">
                    <span class="affected-name">{{ n.nodeName }}</span>
                    <span class="affected-magnitude" :class="n.magnitude">{{ n.magnitude }}</span>
                    <span class="affected-impact" :class="n.impact">
                      {{ n.impact === 'positive' ? '▲' : n.impact === 'negative' ? '▼' : '–' }} {{ n.impact }}
                    </span>
                  </div>
                  <p class="affected-reasoning">{{ n.reasoning }}</p>
                </div>
              </div>
            </div>

            <!-- Historical analogs -->
            <div class="result-section" v-if="newsResult.historicalAnalogs?.length">
              <h3 class="result-heading">Historical Analogs</h3>
              <div class="analog-list">
                <div v-for="a in newsResult.historicalAnalogs" :key="a.event" class="analog-card">
                  <div class="analog-header">
                    <span class="analog-event">{{ a.event }}</span>
                    <span class="analog-year">{{ a.year }}</span>
                  </div>
                  <p class="analog-outcome">{{ a.outcome }}</p>
                  <p class="analog-relevance">{{ a.relevance }}</p>
                </div>
              </div>
            </div>

            <!-- Watchlist -->
            <div class="result-section" v-if="newsResult.watchlist?.length">
              <h3 class="result-heading">Watchlist</h3>
              <div class="watchlist">
                <div v-for="w in newsResult.watchlist" :key="w.ticker" class="watchlist-row" :class="w.action">
                  <div class="watch-left">
                    <span class="watch-ticker">{{ w.ticker }}</span>
                    <span class="watch-name">{{ w.name }}</span>
                  </div>
                  <span class="watch-action" :class="w.action">{{ w.action }}</span>
                  <p class="watch-reasoning">{{ w.reasoning }}</p>
                </div>
              </div>
            </div>
          </div>

          <div v-else-if="!analyzingNews" class="news-empty">
            <p>Paste an article and click Analyze Impact to see results.</p>
          </div>
          <div v-else class="news-empty">
            <span class="spinner-lg" />
            <p>Groq is analyzing the article against the supply chain graph...</p>
          </div>
        </div>
      </template>

    </div>
  </div>
</template>

<script setup>
import { ref, reactive } from 'vue'
import DependencyGraph from '../components/DependencyGraph.vue'
import NodePanel from '../components/NodePanel.vue'
import { fetchCompany10K } from '../utils/secEdgar.js'
import { extractDependencyTree, findExposedCompanies, analyzeNewsArticle } from '../utils/groqAnalyzer.js'

const tickerInput = ref('')
const loading = ref(false)
const loadingStage = ref('')
const error = ref('')
const tree = ref(null)
const selectedNode = ref(null)
const exposedCompanies = reactive({})
const loadingExposed = ref(false)
const highlightedIds = ref(new Set())
const activePanel = ref('graph')
const articleText = ref('')
const analyzingNews = ref(false)
const newsResult = ref(null)

const exampleTickers = ['AAPL', 'XOM', 'ADM', 'CAT', 'TSLA']

async function loadCompany() {
  if (!tickerInput.value) return
  error.value = ''
  loading.value = true
  tree.value = null
  selectedNode.value = null

  try {
    loadingStage.value = 'Fetching 10-K from SEC EDGAR...'
    const { text, name, filingDate } = await fetchCompany10K(tickerInput.value)

    loadingStage.value = `Extracting dependency tree with Groq (${name})...`
    const extracted = await extractDependencyTree(tickerInput.value, name, text)
    tree.value = extracted
    loadingStage.value = ''
  } catch (e) {
    error.value = e.message || 'Failed to load company data'
    loadingStage.value = ''
  } finally {
    loading.value = false
  }
}

async function quickLoad(ticker) {
  tickerInput.value = ticker
  await loadCompany()
}

function onNodeClick(node) {
  selectedNode.value = node
  highlightedIds.value = new Set(getAncestorIds(tree.value, node.id))
}

function onNodeHover(node) {
  if (node && !selectedNode.value) {
    highlightedIds.value = new Set([node.id])
  } else if (!node && !selectedNode.value) {
    highlightedIds.value = new Set()
  }
}

function getAncestorIds(root, targetId, path = []) {
  if (!root) return null
  const current = [...path, root.id]
  if (root.id === targetId) return current
  for (const child of root.children || []) {
    const result = getAncestorIds(child, targetId, current)
    if (result) return result
  }
  return null
}

async function loadExposed(node) {
  loadingExposed.value = true
  try {
    const result = await findExposedCompanies(node.name, node.description)
    exposedCompanies[node.id] = result
  } catch (e) {
    exposedCompanies[node.id] = { companies: [], error: e.message }
  } finally {
    loadingExposed.value = false
  }
}

async function analyzeArticle() {
  analyzingNews.value = true
  newsResult.value = null
  try {
    newsResult.value = await analyzeNewsArticle(articleText.value, tree.value)
  } catch (e) {
    error.value = e.message
  } finally {
    analyzingNews.value = false
  }
}

function highlightNode(nodeId) {
  activePanel.value = 'graph'
  highlightedIds.value = new Set(getAncestorIds(tree.value, nodeId) || [nodeId])
}
</script>

<style scoped>
@import url('https://fonts.googleapis.com/css2?family=DM+Mono:ital,wght@0,300;0,400;0,500;1,300&family=Syne:wght@400;600;700;800&display=swap');

.analyzer-page {
  display: flex;
  flex-direction: column;
  height: 100vh;
  background: #060a10;
  color: #e0e0e0;
  font-family: 'DM Mono', monospace;
  overflow: hidden;
}

/* ── Top bar ── */
.top-bar {
  display: flex;
  align-items: center;
  gap: 2rem;
  padding: 1rem 1.5rem;
  border-bottom: 1px solid #1e2535;
  background: #080c14;
  flex-shrink: 0;
  flex-wrap: wrap;
}

.page-title {
  font-family: 'Syne', sans-serif;
  font-size: 1.4rem;
  font-weight: 800;
  color: #e0e0e0;
  margin: 0;
  letter-spacing: -0.02em;
}
.accent { color: #4ade80; }
.page-sub { font-size: 0.72rem; color: #444; margin: 0; }
.top-left { display: flex; flex-direction: column; gap: 0.2rem; min-width: 180px; }

.search-area { flex: 1; display: flex; flex-direction: column; gap: 0.4rem; min-width: 280px; }
.ticker-input-wrap { display: flex; gap: 0.5rem; }

.ticker-input {
  flex: 1;
  padding: 0.6rem 1rem;
  background: #0f1520;
  border: 1px solid #2a2f3e;
  border-radius: 8px;
  color: #e0e0e0;
  font-family: 'DM Mono', monospace;
  font-size: 0.9rem;
  letter-spacing: 0.05em;
}
.ticker-input:focus { outline: none; border-color: #4ade80; }

.analyze-btn {
  padding: 0.6rem 1.4rem;
  background: #4ade80;
  color: #060a10;
  border: none;
  border-radius: 8px;
  font-family: 'DM Mono', monospace;
  font-size: 0.85rem;
  font-weight: 600;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 0.4rem;
  white-space: nowrap;
}
.analyze-btn:disabled { opacity: 0.5; cursor: not-allowed; }
.analyze-btn.full-width { width: 100%; justify-content: center; }

.btn-spinner {
  width: 14px; height: 14px;
  border: 2px solid #060a1044;
  border-top-color: #060a10;
  border-radius: 50%;
  animation: spin 0.7s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }

.loading-stage { font-size: 0.75rem; color: #4ade8099; }
.error-msg { font-size: 0.75rem; color: #e05252; }

.top-right { display: flex; gap: 0.4rem; }
.tab-toggle {
  padding: 0.5rem 1rem;
  background: none;
  border: 1px solid #2a2f3e;
  border-radius: 6px;
  color: #555;
  font-family: 'DM Mono', monospace;
  font-size: 0.8rem;
  cursor: pointer;
  transition: all 0.15s;
}
.tab-toggle.active { border-color: #4ade80; color: #4ade80; background: #0f2a1a; }
.tab-toggle:disabled { opacity: 0.3; cursor: not-allowed; }

/* ── Main content ── */
.main-content { flex: 1; overflow: hidden; display: flex; }

/* ── Empty state ── */
.empty-state {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 1rem;
  color: #333;
}
.empty-icon { font-size: 4rem; opacity: 0.3; }
.empty-state p { font-size: 0.9rem; color: #444; }
.example-tickers { display: flex; align-items: center; gap: 0.5rem; }
.example-label { font-size: 0.75rem; color: #444; }
.example-ticker {
  padding: 0.3rem 0.7rem;
  background: #0f1520;
  border: 1px solid #1e2535;
  border-radius: 4px;
  color: #60a5fa;
  font-family: 'DM Mono', monospace;
  font-size: 0.8rem;
  cursor: pointer;
}
.example-ticker:hover { border-color: #60a5fa; background: #0f1a2a; }

/* ── Graph layout ── */
.graph-layout {
  flex: 1;
  display: flex;
  overflow: hidden;
}

/* ── News layout ── */
.news-layout {
  flex: 1;
  display: grid;
  grid-template-columns: 380px 1fr;
  overflow: hidden;
}

.news-input-panel {
  padding: 1.5rem;
  border-right: 1px solid #1e2535;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  overflow-y: auto;
}
.news-input-panel h2 {
  font-family: 'Syne', sans-serif;
  font-size: 1rem;
  font-weight: 700;
  margin: 0;
  color: #e0e0e0;
}
.news-hint { font-size: 0.75rem; color: #555; line-height: 1.6; margin: 0; }
.news-warn { font-size: 0.75rem; color: #f59e0b; margin: 0; }

.article-textarea {
  flex: 1;
  padding: 0.75rem;
  background: #0f1520;
  border: 1px solid #1e2535;
  border-radius: 8px;
  color: #ccc;
  font-family: 'DM Mono', monospace;
  font-size: 0.8rem;
  line-height: 1.6;
  resize: none;
}
.article-textarea:focus { outline: none; border-color: #4ade80; }

.news-results-panel {
  padding: 1.5rem;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.news-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 1rem;
  color: #333;
  padding: 2rem;
}
.spinner-lg {
  width: 32px; height: 32px;
  border: 3px solid #1e2535;
  border-top-color: #4ade80;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

.result-section { display: flex; flex-direction: column; gap: 0.75rem; }
.result-heading {
  font-size: 0.7rem;
  color: #444;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  margin: 0;
}
.result-summary { color: #aaa; font-size: 0.85rem; line-height: 1.7; margin: 0; }

/* Affected nodes */
.affected-list { display: flex; flex-direction: column; gap: 0.5rem; }
.affected-card {
  background: #0d1220;
  border: 1px solid #1e2535;
  border-radius: 8px;
  padding: 0.75rem 1rem;
  cursor: pointer;
  transition: border-color 0.15s;
}
.affected-card:hover { border-color: #2a3545; }
.affected-card.positive { border-left: 3px solid #4ade8066; }
.affected-card.negative { border-left: 3px solid #e0525266; }
.affected-card.neutral { border-left: 3px solid #55555566; }

.affected-header { display: flex; align-items: center; gap: 0.75rem; margin-bottom: 0.4rem; }
.affected-name { font-weight: 600; font-size: 0.85rem; color: #e0e0e0; flex: 1; }
.affected-magnitude {
  font-size: 0.65rem; padding: 0.15rem 0.4rem;
  border-radius: 3px; text-transform: uppercase;
}
.affected-magnitude.high { background: #2a1a1a; color: #e05252; }
.affected-magnitude.medium { background: #2a2010; color: #f59e0b; }
.affected-magnitude.low { background: #1a2a1a; color: #4ade80; }
.affected-impact { font-size: 0.75rem; }
.affected-impact.positive { color: #4ade80; }
.affected-impact.negative { color: #e05252; }
.affected-reasoning { font-size: 0.78rem; color: #666; margin: 0; line-height: 1.5; }

/* Analogs */
.analog-list { display: flex; flex-direction: column; gap: 0.5rem; }
.analog-card {
  background: #0d1220;
  border: 1px solid #1e2535;
  border-left: 3px solid #f59e0b44;
  border-radius: 8px;
  padding: 0.75rem 1rem;
}
.analog-header { display: flex; justify-content: space-between; margin-bottom: 0.4rem; }
.analog-event { font-weight: 600; font-size: 0.85rem; color: #f59e0b; }
.analog-year { font-size: 0.8rem; color: #555; }
.analog-outcome { font-size: 0.78rem; color: #888; margin: 0 0 0.3rem; line-height: 1.5; }
.analog-relevance { font-size: 0.75rem; color: #555; margin: 0; font-style: italic; }

/* Watchlist */
.watchlist { display: flex; flex-direction: column; gap: 0.5rem; }
.watchlist-row {
  background: #0d1220;
  border: 1px solid #1e2535;
  border-radius: 8px;
  padding: 0.75rem 1rem;
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 0.3rem;
}
.watchlist-row.buy-signal { border-left: 3px solid #4ade8066; }
.watchlist-row.sell-signal { border-left: 3px solid #e0525266; }
.watchlist-row.monitor { border-left: 3px solid #f59e0b44; }

.watch-left { display: flex; align-items: center; gap: 0.5rem; }
.watch-ticker { font-weight: 700; font-size: 0.9rem; color: #e0e0e0; }
.watch-name { font-size: 0.75rem; color: #555; }

.watch-action {
  font-size: 0.7rem; padding: 0.2rem 0.5rem;
  border-radius: 4px; text-transform: uppercase; letter-spacing: 0.05em;
  font-weight: 600; align-self: start;
}
.watch-action.buy-signal { background: #1a3a2a; color: #4ade80; }
.watch-action.sell-signal { background: #2a1a1a; color: #e05252; }
.watch-action.monitor { background: #2a2010; color: #f59e0b; }

.watch-reasoning {
  grid-column: 1 / -1;
  font-size: 0.75rem; color: #666; margin: 0; line-height: 1.5;
}
</style>