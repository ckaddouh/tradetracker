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
        <button
          :class="['tab-toggle', { active: activePanel === 'global' }]"
          @click="activePanel = 'global'"
        >Global Impact</button>
        <button
        :class="['tab-toggle', { active: activePanel === 'factor' }]"
        @click="activePanel = 'factor'"
      >Factor Regression</button>
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
            :tree="tree"
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
            <div class="result-section">
              <h3 class="result-heading">Event Summary</h3>
              <p class="result-summary">{{ newsResult.summary }}</p>
            </div>

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
                <!-- Header row -->
                <div class="affected-header">
                  <span class="affected-name">{{ n.nodeName }}</span>
                  <span class="affected-magnitude" :class="n.magnitude">{{ n.magnitude }}</span>
                  <span class="affected-impact" :class="n.impact">
                    {{ n.impact === 'positive' ? '▲' : n.impact === 'negative' ? '▼' : '–' }} {{ n.impact }}
                  </span>
                </div>

                <!-- Segment + revenue share pill -->
                <div v-if="n.segmentName || n.segmentRevShare" class="affected-segment-row">
                  <span class="seg-label">Segment</span>
                  <span class="seg-name">{{ n.segmentName }}</span>
                  <span v-if="n.segmentRevShare" class="seg-rev">{{ n.segmentRevShare }} of revenue</span>
                </div>

                <!-- Geographic risk -->
                <div v-if="n.geographicRisk" class="affected-geo">
                  <span class="geo-icon">⚑</span>
                  <span class="geo-text">{{ n.geographicRisk }}</span>
                </div>

                <!-- Quantified exposure detail -->
                <p v-if="n.exposureDetail" class="affected-exposure-detail">{{ n.exposureDetail }}</p>

                <!-- Causal chain -->
                <div v-if="n.causalChain" class="causal-chain">
                  <span class="chain-label">causal chain</span>
                  <span class="chain-text">{{ n.causalChain }}</span>
                </div>

                <!-- Related tickers -->
                <div v-if="n.relatedTickers?.length" class="affected-tickers">
                  <span v-for="t in n.relatedTickers" :key="t" class="related-ticker">{{ t }}</span>
                </div>

                <!-- General reasoning (collapsible feel via smaller muted text) -->
                <p class="affected-reasoning">{{ n.reasoning }}</p>
              </div>
            </div>
          </div>

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

            <div class="result-section" v-if="newsResult.watchlist?.length">
              <h3 class="result-heading">Watchlist</h3>
              <div class="watchlist">
                <div v-for="w in newsResult.watchlist" :key="w.ticker" class="watchlist-row" :class="w.action">
                  <div class="watch-left">
                    <span class="watch-ticker">{{ w.ticker }}</span>
                    <span class="watch-name">{{ w.name }}</span>
                    <p v-if="w.exposureSummary" class="watch-exposure">{{ w.exposureSummary }}</p>
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

      <!-- ── GLOBAL IMPACT VIEW ── -->
      <template v-if="activePanel === 'global'">
        <div class="news-layout">

          <!-- Left: input panel -->
          <div class="news-input-panel">
            <h2>Global Impact Scanner</h2>
            <p class="news-hint">
              Scan a news article against every company stored in the database —
              not just the one you've loaded. Surfaces indirect exposures deep
              in the supply chain (depth 3, 4, 5+).
            </p>

            <!-- Mode toggle -->
            <div class="mode-toggle">
              <button
                :class="['mode-btn', { active: globalMode === 'paste' }]"
                @click="globalMode = 'paste'"
              >Paste Text</button>
              <button
                :class="['mode-btn', { active: globalMode === 'url' }]"
                @click="globalMode = 'url'"
              >From URL</button>
            </div>

            <!-- Paste mode -->
            <textarea
              v-if="globalMode === 'paste'"
              v-model="globalArticleText"
              class="article-textarea"
              placeholder="Paste the full article text here..."
              rows="12"
            />

            <!-- URL mode -->
            <div v-else class="url-row">
              <input
                v-model="globalArticleUrl"
                class="ticker-input"
                placeholder="https://reuters.com/article/..."
                @keyup.enter="fetchArticleFromUrl"
              />
              <button
                class="analyze-btn"
                @click="fetchArticleFromUrl"
                :disabled="fetchingUrl || !globalArticleUrl.trim()"
              >
                <span v-if="fetchingUrl" class="btn-spinner" />
                <span v-else>Fetch</span>
              </button>
            </div>

            <div v-if="globalArticleText && globalMode === 'url'" class="fetch-success">
              ✓ Article loaded ({{ globalArticleText.length.toLocaleString() }} chars)
            </div>

            <button
              class="analyze-btn full-width"
              @click="runGlobalAnalysis"
              :disabled="!globalArticleText.trim() || globalAnalyzing"
            >
              <span v-if="globalAnalyzing" class="btn-spinner" />
              <span v-else>Scan All Companies →</span>
            </button>

            <div v-if="globalError" class="error-msg">{{ globalError }}</div>

            <!-- Concepts panel (shown after analysis) -->
            <template v-if="globalResult">
              <div class="concepts-section">
                <p class="result-heading">Concepts Extracted</p>
                <div class="concept-pills">
                  <span
                    v-for="c in globalResult.conceptsExtracted"
                    :key="c.concept"
                    class="concept-pill"
                    :class="c.impact"
                    :title="c.reasoning"
                  >
                    <span class="pill-dot" :class="c.impact" />
                    {{ c.concept }}
                    <span class="pill-mag">
                      <span v-for="i in 3" :key="i" class="mag-dot" :class="{ filled: i <= magnitudeLevel(c.magnitude) }" />
                    </span>
                  </span>
                </div>
              </div>
            </template>
          </div>

          <!-- Right: results panel -->
          <div class="news-results-panel" v-if="globalResult">

            <!-- Summary -->
            <div class="result-section">
              <h3 class="result-heading">Event Summary</h3>
              <p class="result-summary">{{ globalResult.articleSummary }}</p>
            </div>

            <!-- Stats + filter bar -->
            <div class="global-stats-bar">
              <div class="stat-chip">
                <span class="stat-num">{{ globalResult.companiesAffected }}</span>
                <span class="stat-label">companies affected</span>
              </div>
              <div class="stat-chip">
                <span class="stat-num">{{ globalResult.conceptsExtracted?.length }}</span>
                <span class="stat-label">concepts found</span>
              </div>
              <div class="stat-chip accent-chip">
                <span class="stat-num">{{ indirectCount }}</span>
                <span class="stat-label">indirect (depth 3+)</span>
              </div>

              <div class="filter-pills">
                <button
                  v-for="f in filters"
                  :key="f.key"
                  :class="['filter-pill', { active: globalFilter === f.key }]"
                  @click="globalFilter = f.key"
                >{{ f.label }}</button>
              </div>
            </div>

            <!-- Company cards -->
            <div class="global-company-list">
              <div
                v-for="company in filteredGlobalResults"
                :key="company.ticker"
                class="global-company-card"
                :class="company.overallImpact"
              >
                <!-- Card header -->
                <div
                  class="global-card-header"
                  @click="toggleCompany(company.ticker)"
                >
                  <div class="global-card-left">
                    <span class="impact-dot" :class="company.overallImpact" />
                    <div class="global-card-info">
                      <div class="global-card-top">
                        <span class="global-ticker">{{ company.ticker }}</span>
                        <span class="global-name">{{ company.companyName }}</span>
                      </div>
                      <div class="global-card-meta">
                        <span v-if="negCount(company)" class="meta-neg">↓ {{ negCount(company) }} negative</span>
                        <span v-if="posCount(company)" class="meta-pos">↑ {{ posCount(company) }} positive</span>
                        <span class="meta-neutral">{{ company.exposures.length }} exposure{{ company.exposures.length !== 1 ? 's' : '' }}</span>
                      </div>
                    </div>
                  </div>
                  <div class="global-card-right">
                    <span
                      v-if="company.maxDepth >= 3"
                      class="depth-badge"
                    >depth {{ company.maxDepth }} — indirect</span>
                    <span class="expand-icon">{{ expandedCompanies.has(company.ticker) ? '▲' : '▼' }}</span>
                  </div>
                </div>

                <!-- Exposures (expanded) -->
                <div v-if="expandedCompanies.has(company.ticker)" class="global-exposures">
                  <div
                    v-for="(exp, i) in company.exposures"
                    :key="i"
                    class="exposure-row"
                    :class="exp.impact"
                  >
                    <!-- Node name + badges -->
                    <div class="exposure-header">
                      <span class="exposure-node">{{ exp.matchedNode }}</span>
                      <span v-if="exp.geographicRisk" class="geo-badge">{{ exp.geographicRisk }}</span>
                      <span v-if="exp.commodity" class="commodity-badge">commodity</span>
                      <span class="exp-mag">
                        <span v-for="j in 3" :key="j" class="mag-dot" :class="{ filled: j <= magnitudeLevel(exp.magnitude) }" />
                      </span>
                    </div>

                    <!-- Display path breadcrumb -->
                    <div class="path-crumb">
                      <template v-for="(part, pi) in exp.displayPath.split(' → ')" :key="pi">
                        <span
                          class="crumb"
                          :class="{
                            'crumb-root': pi === 0,
                            'crumb-leaf': pi === exp.displayPath.split(' → ').length - 1
                          }"
                        >{{ part }}</span>
                        <span v-if="pi < exp.displayPath.split(' → ').length - 1" class="crumb-arrow">▶</span>
                      </template>
                    </div>

                    <!-- Reasoning (toggle) -->
                    <div class="exposure-detail">
                      <span class="concept-tag">{{ exp.concept }}</span>
                      <span class="exposure-reasoning">{{ exp.reasoning }}</span>
                      <span v-if="exp.revenueShare" class="rev-share">Segment: {{ exp.revenueShare }}</span>
                    </div>
                  </div>
                </div>

              </div>
            </div>

          </div>

          <!-- Empty / loading states -->
          <div v-else-if="globalAnalyzing" class="news-empty">
            <span class="spinner-lg" />
            <div class="loading-steps">
              <p class="loading-step active">Extracting supply chain concepts from article...</p>
              <p class="loading-step">Searching dependency trees across all stored companies...</p>
              <p class="loading-step">Mapping exposure paths...</p>
            </div>
          </div>
          <div v-else class="news-empty">
            <div class="empty-icon" style="font-size:2rem;opacity:0.2">⬡</div>
            <p>Paste or link a news article, then click Scan All Companies.</p>
            <p class="news-hint" style="max-width:340px;text-align:center">
              This scans every company stored in the database — not just the one loaded in the Supply Chain tab.
            </p>
          </div>

        </div>
      </template>
      <!-- ── FACTOR REGRESSION VIEW ── -->
<template v-if="activePanel === 'factor'">
  <div class="factor-layout">

    <!-- Left panel -->
    <div class="factor-input-panel">
      <h2 class="panel-title">Factor Regression</h2>
      <p class="news-hint">
        LASSO regression against ~65 FRED macro series to find which
        economic factors statistically drive a stock's weekly returns.
      </p>

      <div class="field-group">
        <label class="field-label">Ticker</label>
        <div class="ticker-input-wrap">
          <input
            v-model="factorTicker"
            class="ticker-input"
            placeholder="e.g. AAPL"
            @input="factorTicker = factorTicker.toUpperCase()"
            @keyup.enter="runFactorRegression"
            :disabled="factorRunning"
          />
        </div>
      </div>

      <div class="field-group">
        <label class="field-label">Lookback period</label>
        <div class="option-pills">
          <button
            v-for="y in [3, 5, 7, 10]"
            :key="y"
            :class="['option-pill', { active: factorLookback === y }]"
            @click="factorLookback = y"
          >{{ y }}Y</button>
        </div>
      </div>

      <div class="field-group">
        <label class="field-label">Lags to test</label>
        <div class="option-pills">
          <button
            v-for="l in factorLagOptions"
            :key="l.value"
            :class="['option-pill', 'toggle', { active: factorSelectedLags.includes(l.value) }]"
            @click="toggleFactorLag(l.value)"
          >{{ l.label }}</button>
        </div>
        <p class="news-hint" style="margin:0">LASSO picks the best lag per factor automatically.</p>
      </div>

      <div class="field-group">
        <label class="field-label">Top factors shown: <span style="color:#e0e0e0">{{ factorTopN }}</span></label>
        <input type="range" v-model.number="factorTopN" min="5" max="20" class="range-input" />
      </div>

      <button
        class="analyze-btn full-width"
        @click="runFactorRegression"
        :disabled="!factorTicker.trim() || factorRunning"
      >
        <span v-if="factorRunning" class="btn-spinner" />
        <span v-else>Run Regression →</span>
      </button>

      <div v-if="factorError" class="error-msg">{{ factorError }}</div>

      <template v-if="factorResult">
        <div class="model-meta">
          <div class="meta-row">
            <span class="meta-key">R²</span>
            <span class="meta-val" :class="factorR2Class">{{ (factorResult.r2_score * 100).toFixed(1) }}%</span>
          </div>
          <div class="meta-row">
            <span class="meta-key">Adj. R²</span>
            <span class="meta-val" :class="factorR2Class">{{ (factorResult.r2_adj * 100).toFixed(1) }}%</span>
          </div>
          <div class="meta-row">
            <span class="meta-key">Observations</span>
            <span class="meta-val">{{ factorResult.n_observations }} weeks</span>
          </div>
          <div class="meta-row">
            <span class="meta-key">Non-zero factors</span>
            <span class="meta-val">{{ factorResult.factors.length }}</span>
          </div>
        </div>
        <p class="news-hint" style="font-style:italic;margin:0">{{ factorResult.model_note }}</p>
      </template>
    </div>

    <!-- Right panel -->
    <div class="factor-results-panel">

      <!-- Empty state -->
      <div v-if="!factorResult && !factorRunning" class="factor-empty">
        <div class="empty-grid">
          <div v-for="i in 12" :key="i" class="empty-bar" :style="{ height: factorEmptyBarHeight(i) }" />
        </div>
        <p>Enter a ticker and run regression to see which macro factors drive its returns.</p>
        <div class="example-tickers">
          <span class="example-label">Try:</span>
          <button
            v-for="t in ['AAPL','XOM','JPM','GLD','CAT']"
            :key="t"
            class="example-ticker"
            @click="quickFactorRun(t)"
          >{{ t }}</button>
        </div>
      </div>

      <!-- Loading -->
      <div v-else-if="factorRunning" class="factor-loading">
        <div class="spinner-lg" />
        <div class="loading-steps">
          <p :class="['loading-step', { active: factorLoadStep >= 1 }]">Fetching {{ factorTicker }} price history from Yahoo Finance...</p>
          <p :class="['loading-step', { active: factorLoadStep >= 2 }]">Pulling ~65 FRED macro series...</p>
          <p :class="['loading-step', { active: factorLoadStep >= 3 }]">Building factor matrix with {{ factorSelectedLags.length }} lag windows...</p>
          <p :class="['loading-step', { active: factorLoadStep >= 4 }]">Running LASSO with time-series cross-validation...</p>
          <p :class="['loading-step', { active: factorLoadStep >= 5 }]">Ranking factor importance...</p>
        </div>
      </div>

      <!-- Results -->
      <template v-else-if="factorResult">

        <div class="results-header">
          <div>
            <h2 class="results-title">{{ factorResult.company_name }}</h2>
            <p class="news-hint" style="margin:0">Top macro drivers of weekly returns · LASSO regression</p>
          </div>
          <div class="r2-badge" :class="factorR2Class">
            R² {{ (factorResult.r2_score * 100).toFixed(1) }}%
          </div>
        </div>

        <div class="cat-filters">
          <button
            v-for="cat in factorAvailableCategories"
            :key="cat"
            :class="['cat-pill', { active: factorActiveCat === cat }]"
            @click="factorActiveCat = factorActiveCat === cat ? null : cat"
          >{{ cat }}</button>
        </div>

        <div class="factor-bars">
          <div
            v-for="(f, i) in factorFilteredFactors"
            :key="f.series_id + f.lag_weeks"
            class="factor-row"
            :class="f.direction"
            :style="{ '--delay': `${i * 40}ms` }"
          >
            <div class="factor-name-row">
              <span class="factor-name">{{ f.name }}</span>
              <span class="factor-lag">{{ f.lag_weeks }}W lag</span>
              <span class="factor-cat-tag">{{ f.category }}</span>
            </div>
            <div class="factor-bar-wrap">
              <div class="factor-bar" :class="f.direction" :style="{ width: factorBarWidth(f) }" />
              <span class="factor-pct">{{ f.importance_pct }}%</span>
              <span class="factor-coef" :class="f.direction">
                {{ f.direction === 'positive' ? '+' : '' }}{{ f.coefficient.toFixed(4) }}
              </span>
            </div>
          </div>
        </div>

        <div class="chart-section">
          <h3 class="result-heading">Predicted vs Actual Weekly Returns</h3>
          <div class="chart-wrap">
            <svg :viewBox="`0 0 ${fcw} ${fch}`" class="return-chart" preserveAspectRatio="none">
              <line :x1="fpad" :y1="factorZeroY" :x2="fcw - fpad" :y2="factorZeroY" stroke="#1e2535" stroke-width="1" />
              <path :d="factorActualArea" fill="#4ade8012" stroke="none" />
              <path :d="factorActualLine" fill="none" stroke="#4ade80" stroke-width="1.5" opacity="0.7" />
              <path :d="factorPredictedLine" fill="none" stroke="#f59e0b" stroke-width="1.5" stroke-dasharray="4 2" opacity="0.85" />
              <text
                v-for="tick in factorXTicks"
                :key="tick.label"
                :x="tick.x"
                :y="fch - 2"
                fill="#334155"
                font-size="8"
                text-anchor="middle"
                font-family="DM Mono, monospace"
              >{{ tick.label }}</text>
            </svg>
            <div class="chart-legend">
              <span class="legend-actual">— Actual</span>
              <span class="legend-pred">- - Predicted</span>
            </div>
          </div>
        </div>

      </template>
    </div>
  </div>
</template>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, computed } from 'vue'
import DependencyGraph from '../components/DependencyGraph.vue'
import NodePanel from '../components/NodePanel.vue'
import { getOrBuildTree, findExposedCompanies, analyzeNewsArticle } from '../utils/groqAnalyzer.js'

const API = `${import.meta.env.VITE_API_URL || ''}/api/markets`


// ── Existing state ────────────────────────────────────────────────────────────
const tickerInput    = ref('')
const loading        = ref(false)
const loadingStage   = ref('')
const error          = ref('')
const tree           = ref(null)
const selectedNode   = ref(null)
const exposedCompanies = reactive({})
const loadingExposed = ref(false)
const highlightedIds = ref(new Set())
const activePanel    = ref('graph')
const articleText    = ref('')
const analyzingNews  = ref(false)
const newsResult     = ref(null)
const exampleTickers = ['AAPL', 'XOM', 'ADM', 'CAT', 'TSLA']

// ── Global Impact state ───────────────────────────────────────────────────────
const globalMode        = ref('paste')
const globalArticleText = ref('')
const globalArticleUrl  = ref('')
const fetchingUrl       = ref(false)
const globalAnalyzing   = ref(false)
const globalResult      = ref(null)
const globalError       = ref('')
const globalFilter      = ref('all')
const expandedCompanies = ref(new Set())

const filters = [
  { key: 'all',      label: 'All'      },
  { key: 'negative', label: 'Negative' },
  { key: 'positive', label: 'Positive' },
  { key: 'indirect', label: 'Indirect (3+)' },
]


// ── Factor Regression state ───────────────────────────────────────────────────
const factorTicker       = ref('')
const factorLookback     = ref(5)
const factorTopN         = ref(12)
const factorSelectedLags = ref([1, 2, 4])
const factorRunning      = ref(false)
const factorLoadStep     = ref(0)
const factorError        = ref('')
const factorResult       = ref(null)
const factorActiveCat    = ref(null)

const factorLagOptions = [
  { label: '1W', value: 1 },
  { label: '2W', value: 2 },
  { label: '1M', value: 4 },
  { label: '6W', value: 6 },
  { label: '2M', value: 8 },
]

function toggleFactorLag(val) {
  const idx = factorSelectedLags.value.indexOf(val)
  if (idx === -1) factorSelectedLags.value.push(val)
  else if (factorSelectedLags.value.length > 1) factorSelectedLags.value.splice(idx, 1)
}

const factorAvailableCategories = computed(() =>
  factorResult.value ? [...new Set(factorResult.value.factors.map(f => f.category))] : []
)

const factorFilteredFactors = computed(() => {
  if (!factorResult.value) return []
  const all = factorResult.value.factors.slice(0, factorTopN.value)
  return factorActiveCat.value ? all.filter(f => f.category === factorActiveCat.value) : all
})

const factorMaxImportance = computed(() =>
  factorFilteredFactors.value.length
    ? Math.max(...factorFilteredFactors.value.map(f => f.importance_pct))
    : 1
)

function factorBarWidth(f) {
  return `${(f.importance_pct / factorMaxImportance.value) * 100}%`
}

const factorR2Class = computed(() => {
  if (!factorResult.value) return ''
  const r = factorResult.value.r2_score
  return r >= 0.3 ? 'r2-good' : r >= 0.1 ? 'r2-ok' : 'r2-low'
})

async function runFactorRegression() {
  if (!factorTicker.value.trim() || factorRunning.value) return
  factorRunning.value  = true
  factorError.value    = ''
  factorResult.value   = null
  factorLoadStep.value = 0
  factorActiveCat.value = null

  const stepTimer = setInterval(() => {
    if (factorLoadStep.value < 5) factorLoadStep.value++
  }, 1800)

  try {
    const token = localStorage.getItem('token')
    const res = await fetch(`${API}/factor-regression`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token && { Authorization: `Bearer ${token}` }),
      },
      body: JSON.stringify({
        ticker:         factorTicker.value.trim(),
        lookback_years: factorLookback.value,
        top_n_factors:  factorTopN.value,
        lag_weeks:      [...factorSelectedLags.value].sort((a, b) => a - b),
      }),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.detail || data.error || 'Regression failed')
    factorResult.value = data
  } catch (e) {
    factorError.value = e.message
  } finally {
    clearInterval(stepTimer)
    factorRunning.value  = false
    factorLoadStep.value = 0
  }
}

async function quickFactorRun(t) {
  factorTicker.value = t
  await runFactorRegression()
}

// ── Factor chart math ─────────────────────────────────────────────────────────
const fcw = 800, fch = 140, fpad = 30

const factorChartData = computed(() => factorResult.value?.predicted_vs_actual ?? [])

function makeFactorLinePath(key) {
  const data = factorChartData.value
  if (!data.length) return ''
  const vals = data.flatMap(d => [d.actual, d.predicted])
  const mn = Math.min(...vals), mx = Math.max(...vals)
  const range = mx - mn || 1
  const xStep = (fcw - fpad * 2) / (data.length - 1)
  return data.map((d, i) => {
    const x = fpad + i * xStep
    const y = fpad + ((mx - d[key]) / range) * (fch - fpad * 2)
    return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`
  }).join(' ')
}

function makeFactorAreaPath() {
  const data = factorChartData.value
  if (!data.length) return ''
  const vals = data.flatMap(d => [d.actual, d.predicted])
  const mn = Math.min(...vals), mx = Math.max(...vals)
  const range = mx - mn || 1
  const xStep = (fcw - fpad * 2) / (data.length - 1)
  const zeroY = fpad + (mx / range) * (fch - fpad * 2)
  const top = data.map((d, i) => {
    const x = fpad + i * xStep
    const y = fpad + ((mx - d.actual) / range) * (fch - fpad * 2)
    return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`
  }).join(' ')
  const lastX = fpad + (data.length - 1) * xStep
  return `${top} L${lastX},${zeroY.toFixed(1)} L${fpad},${zeroY.toFixed(1)} Z`
}

const factorActualLine    = computed(() => makeFactorLinePath('actual'))
const factorPredictedLine = computed(() => makeFactorLinePath('predicted'))
const factorActualArea    = computed(() => makeFactorAreaPath())

const factorXTicks = computed(() => {
  const data = factorChartData.value
  if (data.length < 2) return []
  const n = 6
  const step = Math.floor((data.length - 1) / (n - 1))
  const xStep = (fcw - fpad * 2) / (data.length - 1)
  return Array.from({ length: n }, (_, i) => {
    const idx = i * step
    return { x: fpad + idx * xStep, label: data[idx]?.date?.slice(0, 7) ?? '' }
  })
})

const factorZeroY = computed(() => {
  const vals = factorChartData.value.flatMap(d => [d.actual, d.predicted])
  if (!vals.length) return fch / 2
  const mn = Math.min(...vals), mx = Math.max(...vals)
  const range = mx - mn || 1
  return fpad + (mx / range) * (fch - fpad * 2)
})

function factorEmptyBarHeight(i) {
  const heights = [40, 65, 30, 80, 55, 90, 45, 70, 35, 60, 85, 50]
  return `${heights[(i - 1) % heights.length]}%`
}

// ── Computed ──────────────────────────────────────────────────────────────────
const filteredGlobalResults = computed(() => {
  if (!globalResult.value) return []
  return globalResult.value.results.filter(c => {
    if (globalFilter.value === 'negative') return c.overallImpact === 'negative'
    if (globalFilter.value === 'positive') return c.overallImpact === 'positive'
    if (globalFilter.value === 'indirect') return c.maxDepth >= 3
    return true
  })
})

const indirectCount = computed(() =>
  globalResult.value?.results.filter(c => c.maxDepth >= 3).length ?? 0
)

// ── Helpers ───────────────────────────────────────────────────────────────────
function magnitudeLevel(mag) {
  return mag === 'high' ? 3 : mag === 'medium' ? 2 : 1
}
function negCount(company) {
  return company.exposures.filter(e => e.impact === 'negative').length
}
function posCount(company) {
  return company.exposures.filter(e => e.impact === 'positive').length
}
function toggleCompany(ticker) {
  const s = new Set(expandedCompanies.value)
  s.has(ticker) ? s.delete(ticker) : s.add(ticker)
  expandedCompanies.value = s
}

// ── Global Impact actions ─────────────────────────────────────────────────────
async function fetchArticleFromUrl() {
  if (!globalArticleUrl.value.trim()) return
  fetchingUrl.value = true
  globalError.value = ''
  try {
    const token = localStorage.getItem('token')
    const res = await fetch(`${API}/fetch-article`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token && { Authorization: `Bearer ${token}` }),
      },
      body: JSON.stringify({ url: globalArticleUrl.value }),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || 'Could not fetch article')
    globalArticleText.value = data.text
    globalMode.value = 'paste'
  } catch (e) {
    globalError.value = e.message
  } finally {
    fetchingUrl.value = false
  }
}

async function runGlobalAnalysis() {
  if (!globalArticleText.value.trim()) return
  globalAnalyzing.value = true
  globalResult.value    = null
  globalError.value     = ''
  expandedCompanies.value = new Set()
  try {
    const token = localStorage.getItem('token')
    const res = await fetch(`${API}/analyze-news-global`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token && { Authorization: `Bearer ${token}` }),
      },
      body: JSON.stringify({ articleText: globalArticleText.value }),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || 'Analysis failed')
    globalResult.value = data
  } catch (e) {
    globalError.value = e.message
  } finally {
    globalAnalyzing.value = false
  }
}

// ── Existing actions (unchanged) ──────────────────────────────────────────────
async function loadCompany() {
  if (!tickerInput.value) return
  error.value = ''
  loading.value = true
  tree.value = null
  selectedNode.value = null
  try {
    loadingStage.value = 'Checking cache / fetching 10-K from SEC...'
    const result = await getOrBuildTree(tickerInput.value)
    ensureTreeIds(result.tree)
    tree.value = result.tree        // getOrBuildTree returns { source, tree, filingDate, companyName }
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

function ensureTreeIds(root) {
  let counter = 0
  function assign(node) {
    if (!node) return
    if (!node.id) node.id = `node_${counter++}`
    for (const child of node.children || []) assign(child)
  }
  assign(root)
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

/* ── All your existing styles (unchanged) ── */
/* ── Enhanced News Analysis node cards ── */
.affected-segment-row {
  display: flex; align-items: center; gap: 6px;
  margin: 4px 0 2px; flex-wrap: wrap;
}
.seg-label {
  font-size: 0.6rem; text-transform: uppercase; letter-spacing: 0.08em;
  color: #334155; padding: 1px 5px; border-radius: 3px;
  border: 1px solid #1e2535; background: #070b12;
}
.seg-name { font-size: 0.75rem; color: #7dd3fc; font-weight: 500; }
.seg-rev  {
  font-size: 0.7rem; color: #f59e0b; font-weight: 600;
  background: #78350f22; border: 1px solid #78350f55;
  padding: 1px 6px; border-radius: 4px;
}

.affected-geo {
  display: flex; align-items: center; gap: 5px;
  margin: 4px 0; font-size: 0.72rem;
}
.geo-icon { color: #fb923c; font-size: 0.7rem; }
.geo-text { color: #fb923c; }

.affected-exposure-detail {
  font-size: 0.78rem; color: #94a3b8; line-height: 1.6;
  margin: 5px 0 0; padding: 6px 8px;
  background: #0a0f1a; border-radius: 4px;
  border-left: 2px solid #334155;
}

.causal-chain {
  display: flex; flex-direction: column; gap: 2px;
  margin: 6px 0 0; padding: 6px 8px;
  background: #070b12; border-radius: 4px;
  border: 1px solid #1e2535;
}
.chain-label {
  font-size: 0.58rem; text-transform: uppercase; letter-spacing: 0.1em; color: #334155;
}
.chain-text { font-size: 0.74rem; color: #64748b; line-height: 1.6; font-style: italic; }

.affected-tickers { display: flex; gap: 4px; flex-wrap: wrap; margin: 5px 0 0; }
.related-ticker {
  font-size: 0.65rem; padding: 1px 7px; border-radius: 3px;
  background: #0f2240; color: #60a5fa; border: 1px solid #1e3a5f;
  font-family: 'DM Mono', monospace;
}

.watch-exposure {
  grid-column: 1 / -1; font-size: 0.72rem; color: #f59e0b;
  margin: 2px 0 0; font-weight: 500;
}

.analyzer-page {
  display: flex; flex-direction: column; height: 100vh;
  background: #060a10; color: #e0e0e0;
  font-family: 'DM Mono', monospace; overflow: hidden;
}
.top-bar {
  display: flex; align-items: center; gap: 2rem;
  padding: 1rem 1.5rem; border-bottom: 1px solid #1e2535;
  background: #080c14; flex-shrink: 0; flex-wrap: wrap;
}
.page-title { font-family: 'Syne', sans-serif; font-size: 1.4rem; font-weight: 800; color: #e0e0e0; margin: 0; letter-spacing: -0.02em; }
.accent { color: #4ade80; }
.page-sub { font-size: 0.72rem; color: #444; margin: 0; }
.top-left { display: flex; flex-direction: column; gap: 0.2rem; min-width: 180px; }
.search-area { flex: 1; display: flex; flex-direction: column; gap: 0.4rem; min-width: 280px; }
.ticker-input-wrap { display: flex; gap: 0.5rem; }
.ticker-input {
  flex: 1; padding: 0.6rem 1rem; background: #0f1520;
  border: 1px solid #2a2f3e; border-radius: 8px; color: #e0e0e0;
  font-family: 'DM Mono', monospace; font-size: 0.9rem; letter-spacing: 0.05em;
}
.ticker-input:focus { outline: none; border-color: #4ade80; }
.analyze-btn {
  padding: 0.6rem 1.4rem; background: #4ade80; color: #060a10;
  border: none; border-radius: 8px; font-family: 'DM Mono', monospace;
  font-size: 0.85rem; font-weight: 600; cursor: pointer;
  display: flex; align-items: center; gap: 0.4rem; white-space: nowrap;
}
.analyze-btn:disabled { opacity: 0.5; cursor: not-allowed; }
.analyze-btn.full-width { width: 100%; justify-content: center; }
.btn-spinner {
  width: 14px; height: 14px; border: 2px solid #060a1044;
  border-top-color: #060a10; border-radius: 50%;
  animation: spin 0.7s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }
.loading-stage { font-size: 0.75rem; color: #4ade8099; }
.error-msg { font-size: 0.75rem; color: #e05252; }
.top-right { display: flex; gap: 0.4rem; }
.tab-toggle {
  padding: 0.5rem 1rem; background: none; border: 1px solid #2a2f3e;
  border-radius: 6px; color: #555; font-family: 'DM Mono', monospace;
  font-size: 0.8rem; cursor: pointer; transition: all 0.15s;
}
.tab-toggle.active { border-color: #4ade80; color: #4ade80; background: #0f2a1a; }
.tab-toggle:disabled { opacity: 0.3; cursor: not-allowed; }
.main-content { flex: 1; overflow: hidden; display: flex; }
.empty-state {
  flex: 1; display: flex; flex-direction: column;
  align-items: center; justify-content: center; gap: 1rem; color: #333;
}
.empty-icon { font-size: 4rem; opacity: 0.3; }
.empty-state p { font-size: 0.9rem; color: #444; }
.example-tickers { display: flex; align-items: center; gap: 0.5rem; }
.example-label { font-size: 0.75rem; color: #444; }
.example-ticker {
  padding: 0.3rem 0.7rem; background: #0f1520; border: 1px solid #1e2535;
  border-radius: 4px; color: #60a5fa; font-family: 'DM Mono', monospace;
  font-size: 0.8rem; cursor: pointer;
}
.example-ticker:hover { border-color: #60a5fa; background: #0f1a2a; }
.graph-layout { flex: 1; display: flex; overflow: hidden; }
.news-layout { flex: 1; display: grid; grid-template-columns: 380px 1fr; overflow: hidden; }
.news-input-panel {
  padding: 1.5rem; border-right: 1px solid #1e2535;
  display: flex; flex-direction: column; gap: 0.75rem; overflow-y: auto;
}
.news-input-panel h2 { font-family: 'Syne', sans-serif; font-size: 1rem; font-weight: 700; margin: 0; color: #e0e0e0; }
.news-hint { font-size: 0.75rem; color: #555; line-height: 1.6; margin: 0; }
.news-warn { font-size: 0.75rem; color: #f59e0b; margin: 0; }
.article-textarea {
  flex: 1; padding: 0.75rem; background: #0f1520; border: 1px solid #1e2535;
  border-radius: 8px; color: #ccc; font-family: 'DM Mono', monospace;
  font-size: 0.8rem; line-height: 1.6; resize: none;
}
.article-textarea:focus { outline: none; border-color: #4ade80; }
.news-results-panel { padding: 1.5rem; overflow-y: auto; display: flex; flex-direction: column; gap: 1.5rem; }
.news-empty { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 1rem; color: #333; padding: 2rem; }
.spinner-lg {
  width: 32px; height: 32px; border: 3px solid #1e2535;
  border-top-color: #4ade80; border-radius: 50%;
  animation: spin 0.8s linear infinite;
}
.result-section { display: flex; flex-direction: column; gap: 0.75rem; }
.result-heading { font-size: 0.7rem; color: #444; text-transform: uppercase; letter-spacing: 0.1em; margin: 0; }
.result-summary { color: #aaa; font-size: 0.85rem; line-height: 1.7; margin: 0; }
.affected-list { display: flex; flex-direction: column; gap: 0.5rem; }
.affected-card {
  background: #0d1220; border: 1px solid #1e2535; border-radius: 8px;
  padding: 0.75rem 1rem; cursor: pointer; transition: border-color 0.15s;
}
.affected-card:hover { border-color: #2a3545; }
.affected-card.positive { border-left: 3px solid #4ade8066; }
.affected-card.negative { border-left: 3px solid #e0525266; }
.affected-card.neutral  { border-left: 3px solid #55555566; }
.affected-header { display: flex; align-items: center; gap: 0.75rem; margin-bottom: 0.4rem; }
.affected-name { font-weight: 600; font-size: 0.85rem; color: #e0e0e0; flex: 1; }
.affected-magnitude { font-size: 0.65rem; padding: 0.15rem 0.4rem; border-radius: 3px; text-transform: uppercase; }
.affected-magnitude.high   { background: #2a1a1a; color: #e05252; }
.affected-magnitude.medium { background: #2a2010; color: #f59e0b; }
.affected-magnitude.low    { background: #1a2a1a; color: #4ade80; }
.affected-impact { font-size: 0.75rem; }
.affected-impact.positive { color: #4ade80; }
.affected-impact.negative { color: #e05252; }
.affected-reasoning { font-size: 0.78rem; color: #666; margin: 0; line-height: 1.5; }
.analog-list { display: flex; flex-direction: column; gap: 0.5rem; }
.analog-card { background: #0d1220; border: 1px solid #1e2535; border-left: 3px solid #f59e0b44; border-radius: 8px; padding: 0.75rem 1rem; }
.analog-header { display: flex; justify-content: space-between; margin-bottom: 0.4rem; }
.analog-event { font-weight: 600; font-size: 0.85rem; color: #f59e0b; }
.analog-year { font-size: 0.8rem; color: #555; }
.analog-outcome { font-size: 0.78rem; color: #888; margin: 0 0 0.3rem; line-height: 1.5; }
.analog-relevance { font-size: 0.75rem; color: #555; margin: 0; font-style: italic; }
.watchlist { display: flex; flex-direction: column; gap: 0.5rem; }
.watchlist-row {
  background: #0d1220; border: 1px solid #1e2535; border-radius: 8px;
  padding: 0.75rem 1rem; display: grid; grid-template-columns: 1fr auto; gap: 0.3rem;
}
.watchlist-row.buy-signal  { border-left: 3px solid #4ade8066; }
.watchlist-row.sell-signal { border-left: 3px solid #e0525266; }
.watchlist-row.monitor     { border-left: 3px solid #f59e0b44; }
.watch-left { display: flex; align-items: center; gap: 0.5rem; }
.watch-ticker { font-weight: 700; font-size: 0.9rem; color: #e0e0e0; }
.watch-name   { font-size: 0.75rem; color: #555; }
.watch-action { font-size: 0.7rem; padding: 0.2rem 0.5rem; border-radius: 4px; text-transform: uppercase; letter-spacing: 0.05em; font-weight: 600; align-self: start; }
.watch-action.buy-signal  { background: #1a3a2a; color: #4ade80; }
.watch-action.sell-signal { background: #2a1a1a; color: #e05252; }
.watch-action.monitor     { background: #2a2010; color: #f59e0b; }
.watch-reasoning { grid-column: 1 / -1; font-size: 0.75rem; color: #666; margin: 0; line-height: 1.5; }

/* ── Global Impact — new styles ── */
.mode-toggle { display: flex; gap: 2px; background: #0d1117; border-radius: 6px; padding: 3px; width: fit-content; }
.mode-btn {
  padding: 4px 12px; border-radius: 4px; border: none; cursor: pointer;
  font-size: 0.72rem; font-family: 'DM Mono', monospace; letter-spacing: 0.05em;
  background: transparent; color: #555; transition: all 0.15s;
}
.mode-btn.active { background: #1e293b; color: #e0e0e0; }

.url-row { display: flex; gap: 0.5rem; }

.fetch-success { font-size: 0.72rem; color: #4ade80; }

.concepts-section { display: flex; flex-direction: column; gap: 0.5rem; margin-top: 0.25rem; }
.concept-pills { display: flex; flex-wrap: wrap; gap: 4px; }
.concept-pill {
  display: inline-flex; align-items: center; gap: 5px;
  padding: 3px 8px; border-radius: 5px; font-size: 0.7rem;
  background: #0f1520; border: 1px solid #1e2535; color: #94a3b8;
  cursor: default;
}
.concept-pill.negative { border-color: #450a0a44; }
.concept-pill.positive { border-color: #05291644; }
.pill-dot { width: 5px; height: 5px; border-radius: 50%; flex-shrink: 0; }
.pill-dot.negative { background: #e05252; }
.pill-dot.positive { background: #4ade80; }
.pill-dot.neutral  { background: #555; }
.pill-mag { display: flex; gap: 2px; align-items: center; }
.mag-dot { width: 4px; height: 4px; border-radius: 50%; background: #1e2535; }
.mag-dot.filled { background: #f59e0b; }

.global-stats-bar {
  display: flex; align-items: center; gap: 0.75rem; flex-wrap: wrap;
  padding-bottom: 0.75rem; border-bottom: 1px solid #1e2535;
}
.stat-chip { display: flex; flex-direction: column; align-items: center; padding: 0.3rem 0.75rem; background: #0d1220; border: 1px solid #1e2535; border-radius: 6px; }
.stat-num   { font-size: 1.1rem; font-weight: 700; color: #e0e0e0; line-height: 1; }
.stat-label { font-size: 0.62rem; color: #444; white-space: nowrap; }
.accent-chip { border-color: #1e3a5f; }
.accent-chip .stat-num { color: #60a5fa; }

.filter-pills { display: flex; gap: 4px; margin-left: auto; }
.filter-pill {
  padding: 3px 10px; border-radius: 5px; border: 1px solid #1e2535;
  background: transparent; color: #555; cursor: pointer;
  font-size: 0.7rem; font-family: 'DM Mono', monospace; transition: all 0.15s;
}
.filter-pill.active { background: #1e293b; color: #e0e0e0; border-color: #2a3545; }

.global-company-list { display: flex; flex-direction: column; gap: 8px; }

.global-company-card {
  background: #0d1220; border: 1px solid #1e2535; border-radius: 10px; overflow: hidden;
  transition: border-color 0.15s;
}
.global-company-card.negative { border-color: #450a0a; }
.global-company-card.positive { border-color: #05291655; }

.global-card-header {
  display: flex; align-items: center; justify-content: space-between;
  padding: 12px 16px; cursor: pointer; transition: background 0.1s;
}
.global-card-header:hover { background: #0f172a; }

.global-card-left  { display: flex; align-items: center; gap: 10px; }
.global-card-right { display: flex; align-items: center; gap: 10px; }
.global-card-info  { display: flex; flex-direction: column; gap: 3px; }
.global-card-top   { display: flex; align-items: center; gap: 8px; }
.global-card-meta  { display: flex; gap: 10px; }

.impact-dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
.impact-dot.negative { background: #e05252; box-shadow: 0 0 6px #e0525266; }
.impact-dot.positive { background: #4ade80; box-shadow: 0 0 6px #4ade8066; }
.impact-dot.neutral  { background: #555; }

.global-ticker { font-family: 'DM Mono', monospace; font-weight: 700; font-size: 0.9rem; color: #e0e0e0; letter-spacing: 0.05em; }
.global-name   { font-size: 0.75rem; color: #555; }
.meta-neg     { font-size: 0.68rem; color: #e05252; }
.meta-pos     { font-size: 0.68rem; color: #4ade80; }
.meta-neutral { font-size: 0.68rem; color: #444; }

.depth-badge {
  font-size: 0.65rem; padding: 2px 7px; border-radius: 4px;
  background: #1e1b4b; color: #a5b4fc; border: 1px solid #312e81;
}
.expand-icon { font-size: 0.7rem; color: #334155; }

/* Exposures */
.global-exposures { border-top: 1px solid #1e2535; padding: 4px 16px 14px; }

.exposure-row {
  border-left: 3px solid #1e2535; padding: 10px 0 10px 12px; margin-top: 10px;
}
.exposure-row.negative { border-left-color: #e05252; }
.exposure-row.positive { border-left-color: #4ade80; }
.exposure-row.neutral  { border-left-color: #555; }

.exposure-header { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; margin-bottom: 6px; }
.exposure-node   { font-size: 0.82rem; font-weight: 600; color: #e0e0e0; }

.geo-badge {
  font-size: 0.62rem; padding: 1px 6px; border-radius: 3px;
  background: #451a03; color: #fb923c; border: 1px solid #7c2d12;
}
.commodity-badge {
  font-size: 0.62rem; padding: 1px 6px; border-radius: 3px;
  background: #1c1917; color: #78716c; border: 1px solid #292524;
}
.exp-mag { display: flex; gap: 2px; align-items: center; margin-left: auto; }

/* Breadcrumb path */
.path-crumb {
  display: flex; flex-wrap: wrap; align-items: center;
  gap: 3px; margin-bottom: 6px;
}
.crumb {
  padding: 1px 7px; border-radius: 3px; font-size: 0.68rem;
  font-family: 'DM Mono', monospace;
  background: #0f172a; color: #94a3b8; border: 1px solid #1e2535;
}
.crumb-root { color: #60a5fa; background: #1e3a5f22; border-color: #1e3a5f; }
.crumb-leaf { color: #fbbf24; background: #78350f22; border-color: #78350f; font-weight: 600; }
.crumb-arrow { font-size: 0.55rem; color: #334155; }

/* Exposure detail */
.exposure-detail { display: flex; flex-wrap: wrap; align-items: baseline; gap: 6px; }
.concept-tag {
  font-size: 0.65rem; padding: 1px 6px; border-radius: 3px;
  background: #0f1a30; color: #7dd3fc; border: 1px solid #1e3a5f;
  font-family: 'DM Mono', monospace; white-space: nowrap;
}
.exposure-reasoning { font-size: 0.73rem; color: #555; line-height: 1.5; }
.rev-share { font-size: 0.68rem; color: #f59e0b; white-space: nowrap; }

/* Loading steps */
.loading-steps { display: flex; flex-direction: column; gap: 6px; }
.loading-step  { font-size: 0.75rem; color: #334155; margin: 0; }
.loading-step.active { color: #4ade8099; }


/* ── Factor Regression tab ── */
.factor-layout {
  flex: 1; display: grid; grid-template-columns: 320px 1fr; overflow: hidden;
}
.factor-input-panel {
  padding: 1.5rem; border-right: 1px solid #1e2535;
  display: flex; flex-direction: column; gap: 1rem;
  overflow-y: auto; background: #070b12;
}
.panel-title {
  font-family: 'Syne', sans-serif; font-size: 1rem;
  font-weight: 700; color: #e0e0e0; margin: 0;
}
.field-group  { display: flex; flex-direction: column; gap: 0.4rem; }
.field-label  { font-size: 0.68rem; color: #445; text-transform: uppercase; letter-spacing: 0.08em; }
.option-pills { display: flex; gap: 4px; flex-wrap: wrap; }
.option-pill  {
  padding: 3px 10px; border-radius: 5px; border: 1px solid #1e2535;
  background: transparent; color: #445; font-size: 0.72rem;
  font-family: 'DM Mono', monospace; cursor: pointer; transition: all 0.12s;
}
.option-pill.active        { background: #0f2240; border-color: #60a5fa; color: #60a5fa; }
.option-pill.toggle.active { background: #0f2a1a; border-color: #4ade80; color: #4ade80; }
.range-input  { width: 100%; accent-color: #60a5fa; cursor: pointer; }
.model-meta   {
  background: #0d1220; border: 1px solid #1e2535; border-radius: 8px;
  padding: 0.75rem; display: flex; flex-direction: column; gap: 0.4rem;
}
.meta-row { display: flex; justify-content: space-between; align-items: center; }
.meta-key { font-size: 0.7rem; color: #445; }
.meta-val { font-size: 0.8rem; color: #e0e0e0; font-weight: 600; }
.meta-val.r2-good { color: #4ade80; }
.meta-val.r2-ok   { color: #f59e0b; }
.meta-val.r2-low  { color: #94a3b8; }

.factor-results-panel {
  padding: 1.5rem; overflow-y: auto;
  display: flex; flex-direction: column; gap: 1.25rem;
}
.factor-empty {
  flex: 1; display: flex; flex-direction: column;
  align-items: center; justify-content: center; gap: 1.25rem;
}
.empty-grid   { display: flex; align-items: flex-end; gap: 6px; height: 80px; opacity: 0.07; }
.empty-bar    { width: 18px; background: #60a5fa; border-radius: 3px 3px 0 0; }
.factor-loading {
  flex: 1; display: flex; flex-direction: column;
  align-items: center; justify-content: center; gap: 2rem;
}
.results-header {
  display: flex; justify-content: space-between; align-items: flex-start;
}
.results-title {
  font-family: 'Syne', sans-serif; font-size: 1.1rem;
  font-weight: 700; color: #e0e0e0; margin: 0;
}
.r2-badge {
  padding: 4px 12px; border-radius: 6px; font-size: 0.8rem; font-weight: 700;
  font-family: 'DM Mono', monospace; background: #0d1220; border: 1px solid #1e2535; color: #94a3b8;
}
.r2-badge.r2-good { border-color: #15422a; color: #4ade80; background: #0a2015; }
.r2-badge.r2-ok   { border-color: #3d2800; color: #f59e0b; background: #1c1400; }
.cat-filters  { display: flex; gap: 5px; flex-wrap: wrap; }
.cat-pill     {
  padding: 2px 9px; border-radius: 5px; border: 1px solid #1e2535;
  background: transparent; color: #445; font-size: 0.67rem;
  font-family: 'DM Mono', monospace; cursor: pointer; transition: all 0.12s;
}
.cat-pill.active { background: #0f1a30; border-color: #60a5fa55; color: #7dd3fc; }
.factor-bars  { display: flex; flex-direction: column; gap: 2px; }
.factor-row   {
  padding: 8px 10px; border-radius: 6px; border-left: 3px solid transparent;
  background: #0a0f1a; animation: slideIn 0.3s ease both;
  animation-delay: var(--delay, 0ms);
}
.factor-row.positive { border-left-color: #4ade8055; }
.factor-row.negative { border-left-color: #e0525255; }
@keyframes slideIn {
  from { opacity: 0; transform: translateX(-8px); }
  to   { opacity: 1; transform: translateX(0); }
}
.factor-name-row { display: flex; align-items: center; gap: 6px; margin-bottom: 6px; }
.factor-name     { font-size: 0.78rem; color: #b0c0d0; flex: 1; }
.factor-lag      {
  font-size: 0.62rem; padding: 1px 6px; border-radius: 3px;
  background: #0f172a; color: #475569; border: 1px solid #1e2535;
}
.factor-cat-tag  {
  font-size: 0.6rem; padding: 1px 5px; border-radius: 3px;
  background: #120f22; color: #4a3f70; border: 1px solid #1e1835;
}
.factor-bar-wrap { display: flex; align-items: center; gap: 8px; height: 14px; }
.factor-bar      { height: 6px; border-radius: 3px; transition: width 0.6s cubic-bezier(0.16, 1, 0.3, 1); min-width: 4px; }
.factor-bar.positive { background: linear-gradient(90deg, #4ade8044, #4ade80); }
.factor-bar.negative { background: linear-gradient(90deg, #e0525244, #e05252); }
.factor-pct  { font-size: 0.68rem; color: #445; font-family: 'DM Mono', monospace; min-width: 36px; }
.factor-coef { font-size: 0.68rem; font-family: 'DM Mono', monospace; margin-left: auto; }
.factor-coef.positive { color: #4ade8077; }
.factor-coef.negative { color: #e0525277; }
.chart-section { display: flex; flex-direction: column; gap: 0.5rem; }
.chart-wrap    { position: relative; }
.return-chart  {
  width: 100%; height: 140px; display: block;
  background: #070b12; border: 1px solid #1e2535; border-radius: 8px;
}
.chart-legend  { display: flex; gap: 1rem; font-size: 0.65rem; font-family: 'DM Mono', monospace; margin-top: 4px; justify-content: flex-end; }
.legend-actual { color: #4ade8077; }
.legend-pred   { color: #f59e0b77; }
</style>