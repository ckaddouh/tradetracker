<template>
  <transition name="panel-slide">
    <div v-if="node" class="node-panel">

      <!-- Header -->
      <div class="panel-header">
        <div class="panel-header-left">
          <span class="node-type-badge" :class="node.type">{{ node.type }}</span>
          <span v-if="node.commodity" class="commodity-tag">commodity</span>
        </div>
        <button class="close-btn" @click="$emit('close')">✕</button>
      </div>

      <!-- Name -->
      <h2 class="node-name">{{ node.name }}</h2>

      <!-- Description -->
      <p v-if="node.description" class="node-description">{{ node.description }}</p>

      <!-- Metadata chips -->
      <div class="meta-chips">
        <div v-if="node.revenueShare" class="meta-chip rev">
          <span class="chip-label">Revenue</span>
          <span class="chip-val">{{ node.revenueShare }}</span>
        </div>
        <div v-if="node.geographicRisk" class="meta-chip geo">
          <span class="chip-icon">⚑</span>
          <span class="chip-val geo-val">{{ node.geographicRisk }}</span>
        </div>
        <div v-if="node.relatedTickers?.length" class="meta-chip tickers">
          <span class="chip-label">Key players</span>
          <div class="ticker-pills">
            <span v-for="t in node.relatedTickers" :key="t" class="ticker-pill">{{ t }}</span>
          </div>
        </div>
      </div>

      <div class="divider" />

      <!-- Exposed companies section -->
      <div class="exposed-section">
        <div class="exposed-header">
          <h3 class="section-title">Companies Exposed to This</h3>
          <button
            v-if="!exposedCompanies"
            class="load-btn"
            @click="$emit('loadExposed', node)"
            :disabled="loadingExposed"
          >
            <span v-if="loadingExposed" class="btn-spinner" />
            <span v-else>Load →</span>
          </button>
        </div>

        <!-- Legend -->
        <div v-if="exposedCompanies?.companies?.length && allTreeTickers.size" class="expose-legend">
          <span class="legend-known-dot" />
          <span class="legend-known-label">Already in {{ rootCompanyName }}'s supply chain</span>
        </div>

        <!-- Company list -->
        <div v-if="exposedCompanies?.companies?.length" class="companies-list">
          <div
            v-for="c in sortedExposedCompanies"
            :key="c.ticker"
            class="company-row"
            :class="{
              'is-related': isRelatedTicker(c.ticker),
              [`exposure-${c.exposure}`]: true,
              [`direction-${c.direction}`]: true,
            }"
            @mouseenter="hoveredCompany = c"
            @mouseleave="hoveredCompany = null"
          >
            <div class="company-row-main">
              <div class="company-row-left">
                <span v-if="isRelatedTicker(c.ticker)" class="known-badge" title="Already identified in supply chain">★</span>
                <div class="company-info">
                  <span class="company-ticker">{{ c.ticker }}</span>
                  <span class="company-name">{{ c.name }}</span>
                </div>
              </div>
              <div class="company-row-right">
                <span class="exposure-dot" :class="c.direction" />
                <span class="exposure-badge" :class="c.exposure">{{ c.exposure }}</span>
              </div>
            </div>

            <!-- Hover tooltip -->
            <transition name="tooltip-fade">
              <div v-if="hoveredCompany?.ticker === c.ticker" class="company-tooltip">
                <div class="tooltip-reason">{{ c.reason }}</div>
                <div v-if="c.directionReason" class="tooltip-direction" :class="c.direction">
                  <span class="dir-arrow">{{ c.direction === 'positive' ? '▲' : c.direction === 'negative' ? '▼' : '↔' }}</span>
                  {{ c.directionReason }}
                </div>
                <div v-if="isRelatedTicker(c.ticker)" class="tooltip-known">
                  ★ Identified as a key player in {{ rootCompanyName }}'s supply chain
                </div>
              </div>
            </transition>
          </div>
        </div>

        <p v-else-if="exposedCompanies && !exposedCompanies.companies?.length" class="no-results">
          No publicly traded companies found with direct exposure.
        </p>

        <p v-else-if="exposedCompanies?.error" class="error-msg">
          {{ exposedCompanies.error }}
        </p>

        <div v-else-if="!loadingExposed && !exposedCompanies" class="load-prompt">
          Click "Load" to find publicly traded companies exposed to this node.
        </div>

        <div v-else-if="loadingExposed" class="loading-state">
          <span class="btn-spinner dark" />
          <span>Finding exposed companies…</span>
        </div>
      </div>

    </div>
  </transition>
</template>

<script setup>
import { ref, computed } from 'vue'

const props = defineProps({
  node:             { type: Object, default: null },
  exposedCompanies: { type: Object, default: null },
  loadingExposed:   { type: Boolean, default: false },
  tree:             { type: Object, default: null },
})

defineEmits(['close', 'loadExposed'])

const hoveredCompany = ref(null)

// ── Collect ALL relatedTickers across the entire tree ──────────────────────
// This is the key fix: a ticker like "EQIX" might only appear at a different
// node in the tree (e.g. "Data Center Colocation"), not at the specific leaf
// you clicked. We still want to highlight it as "already in supply chain".
const allTreeTickers = computed(() => {
  const set = new Set()
  function walk(n) {
    if (!n) return
    for (const t of (n.relatedTickers || [])) set.add(t)
    for (const c of (n.children || [])) walk(c)
  }
  walk(props.tree)
  return set
})

// A company is "related" if its ticker appears ANYWHERE in the full tree.
// This catches vendors that Groq placed at a sibling or ancestor node.
function isRelatedTicker(ticker) {
  return allTreeTickers.value.has(ticker)
}

const rootCompanyName = computed(() => props.tree?.name || 'this company')

const sortedExposedCompanies = computed(() => {
  const companies = props.exposedCompanies?.companies || []
  const exposureOrder = { high: 0, medium: 1, low: 2 }
  return [...companies].sort((a, b) => {
    // Related tickers (in-tree) always float to the top
    const aRel = isRelatedTicker(a.ticker) ? 0 : 1
    const bRel = isRelatedTicker(b.ticker) ? 0 : 1
    if (aRel !== bRel) return aRel - bRel
    return (exposureOrder[a.exposure] ?? 3) - (exposureOrder[b.exposure] ?? 3)
  })
})
</script>

<style scoped>
.node-panel {
  width: 320px;
  flex-shrink: 0;
  background: #080c14;
  border-left: 1px solid #1e2535;
  display: flex;
  flex-direction: column;
  overflow-y: auto;
  padding: 1.25rem;
  gap: 0.75rem;
  position: relative;
  z-index: 10;
}

.panel-slide-enter-active { transition: transform 0.3s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.25s ease; }
.panel-slide-leave-active { transition: transform 0.2s ease, opacity 0.15s ease; }
.panel-slide-enter-from   { transform: translateX(100%); opacity: 0; }
.panel-slide-leave-to     { transform: translateX(100%); opacity: 0; }

.panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.panel-header-left { display: flex; gap: 6px; align-items: center; }

.node-type-badge {
  font-size: 0.62rem;
  padding: 2px 7px;
  border-radius: 4px;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  font-family: 'DM Mono', monospace;
}
.node-type-badge.company { background: #0c1e3a; color: #60a5fa; border: 1px solid #1e3a5f; }
.node-type-badge.segment { background: #0f172a; color: #7dd3fc; border: 1px solid #1e3a5f44; }
.node-type-badge.input   { background: #0d1220; color: #94a3b8; border: 1px solid #1e2535; }

.commodity-tag {
  font-size: 0.6rem;
  padding: 2px 6px;
  border-radius: 4px;
  background: #1c1200;
  color: #f59e0b;
  border: 1px solid #78350f44;
  font-family: 'DM Mono', monospace;
}

.close-btn {
  background: none;
  border: none;
  color: #334155;
  cursor: pointer;
  font-size: 0.8rem;
  padding: 2px 6px;
  border-radius: 4px;
  transition: color 0.15s, background 0.15s;
}
.close-btn:hover { color: #e0e0e0; background: #1e2535; }

.node-name {
  font-family: 'Syne', sans-serif;
  font-size: 1rem;
  font-weight: 700;
  color: #e0e0e0;
  margin: 0;
  line-height: 1.3;
  word-break: break-word;
}
.node-description {
  font-size: 0.75rem;
  color: #64748b;
  line-height: 1.6;
  margin: 0;
}

.meta-chips { display: flex; flex-direction: column; gap: 6px; }
.meta-chip {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 6px 10px;
  border-radius: 6px;
  background: #0d1220;
  border: 1px solid #1e2535;
}
.meta-chip.geo   { border-color: #7c2d1244; }
.meta-chip.rev   { border-color: #1e3a5f44; }
.chip-label { font-size: 0.62rem; color: #444; text-transform: uppercase; letter-spacing: 0.07em; min-width: 50px; margin-top: 1px; }
.chip-icon  { color: #fb923c; font-size: 0.8rem; }
.chip-val   { font-size: 0.72rem; color: #94a3b8; }
.geo-val    { color: #fb923c; }
.ticker-pills { display: flex; flex-wrap: wrap; gap: 3px; }
.ticker-pill {
  padding: 1px 6px;
  border-radius: 3px;
  background: #1e3a5f22;
  border: 1px solid #1e3a5f;
  color: #60a5fa;
  font-size: 0.65rem;
  font-family: 'DM Mono', monospace;
}

.divider { border: none; border-top: 1px solid #1e2535; margin: 0.25rem 0; }

.exposed-section { display: flex; flex-direction: column; gap: 0.6rem; flex: 1; }
.exposed-header  { display: flex; justify-content: space-between; align-items: center; }
.section-title   { font-size: 0.68rem; color: #444; text-transform: uppercase; letter-spacing: 0.1em; margin: 0; }

.expose-legend {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 8px;
  background: #0d1e14;
  border: 1px solid #1a3a2a;
  border-radius: 5px;
}
.legend-known-dot {
  width: 8px; height: 8px;
  background: #fbbf24;
  border-radius: 50%;
  flex-shrink: 0;
  box-shadow: 0 0 5px #fbbf2488;
}
.legend-known-label { font-size: 0.65rem; color: #64748b; }

.load-btn {
  padding: 3px 10px;
  background: #0f2a1a;
  border: 1px solid #4ade8033;
  color: #4ade80;
  border-radius: 5px;
  font-size: 0.7rem;
  font-family: 'DM Mono', monospace;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 4px;
  transition: all 0.15s;
}
.load-btn:hover:not(:disabled) { background: #0f3a1f; border-color: #4ade8066; }
.load-btn:disabled { opacity: 0.5; cursor: not-allowed; }

.companies-list { display: flex; flex-direction: column; gap: 4px; }

/* ── Company row ── */
.company-row {
  border-radius: 7px;
  border: 1px solid #1e2535;
  background: #0a0f1a;
  /* IMPORTANT: overflow must be visible so the tooltip can escape the row bounds */
  overflow: visible;
  position: relative;
  transition: border-color 0.15s, background 0.15s;
  cursor: default;
}
.company-row:hover { background: #0d1220; }

/* ── In-tree highlight ── */
.company-row.is-related {
  border-color: #fbbf2444;
  background: #13100200;
}
.company-row.is-related:hover {
  border-color: #fbbf2488;
  background: #181200;
}

.company-row-main {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 10px;
  gap: 8px;
}

.company-row-left { display: flex; align-items: center; gap: 6px; flex: 1; min-width: 0; }
.company-info { display: flex; flex-direction: column; gap: 1px; min-width: 0; }
.company-ticker { font-size: 0.8rem; font-weight: 700; color: #e0e0e0; font-family: 'DM Mono', monospace; }
.company-name   { font-size: 0.68rem; color: #445; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 140px; }

.known-badge {
  font-size: 0.75rem;
  color: #fbbf24;
  flex-shrink: 0;
  filter: drop-shadow(0 0 4px #fbbf2466);
  animation: starPulse 2.5s ease-in-out infinite;
}
@keyframes starPulse {
  0%, 100% { opacity: 0.8; }
  50%       { opacity: 1; filter: drop-shadow(0 0 7px #fbbf2488); }
}

.company-row-right { display: flex; align-items: center; gap: 6px; flex-shrink: 0; }
.exposure-dot { width: 7px; height: 7px; border-radius: 50%; }
.exposure-dot.positive { background: #4ade80; box-shadow: 0 0 4px #4ade8066; }
.exposure-dot.negative { background: #e05252; box-shadow: 0 0 4px #e0525266; }
.exposure-dot.mixed    { background: #f59e0b; }

.exposure-badge {
  font-size: 0.6rem;
  padding: 1px 6px;
  border-radius: 3px;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  font-family: 'DM Mono', monospace;
}
.exposure-badge.high   { background: #2a1a1a; color: #e05252; }
.exposure-badge.medium { background: #2a2010; color: #f59e0b; }
.exposure-badge.low    { background: #1a2a1a; color: #4ade80; }

/* ── Tooltip ──
   Positioned above the row. z-index ensures it renders over sibling rows. */
.company-tooltip {
  position: absolute;
  left: 0;
  right: 0;
  bottom: calc(100% + 6px);
  z-index: 200;
  background: #0d1628;
  border: 1px solid #2a3a50;
  border-radius: 8px;
  padding: 9px 11px;
  display: flex;
  flex-direction: column;
  gap: 6px;
  box-shadow: 0 8px 32px #000000bb, 0 0 0 1px #1e2535;
  pointer-events: none;
  /* Prevent tooltip from being clipped by parent scroll containers */
  isolation: isolate;
}

.tooltip-reason {
  font-size: 0.72rem;
  color: #94a3b8;
  line-height: 1.55;
}
.tooltip-direction {
  font-size: 0.68rem;
  line-height: 1.4;
  display: flex;
  gap: 5px;
  align-items: flex-start;
  padding-top: 2px;
  border-top: 1px solid #1e2535;
}
.tooltip-direction.positive { color: #4ade8099; }
.tooltip-direction.negative { color: #e0525299; }
.tooltip-direction.mixed    { color: #f59e0b99; }
.dir-arrow { flex-shrink: 0; font-size: 0.7rem; margin-top: 1px; }
.tooltip-known {
  font-size: 0.65rem;
  color: #fbbf24cc;
  border-top: 1px solid #fbbf2422;
  padding-top: 5px;
  line-height: 1.4;
}

.tooltip-fade-enter-active { transition: opacity 0.15s ease, transform 0.18s ease; }
.tooltip-fade-leave-active { transition: opacity 0.1s ease; }
.tooltip-fade-enter-from   { opacity: 0; transform: translateY(5px); }
.tooltip-fade-leave-to     { opacity: 0; }

.no-results { font-size: 0.75rem; color: #334155; margin: 0; }
.error-msg  { font-size: 0.75rem; color: #e05252; margin: 0; }
.load-prompt { font-size: 0.72rem; color: #334155; line-height: 1.5; }
.loading-state { display: flex; align-items: center; gap: 8px; font-size: 0.72rem; color: #334155; }

.btn-spinner {
  width: 12px; height: 12px;
  border: 2px solid #4ade8044;
  border-top-color: #4ade80;
  border-radius: 50%;
  animation: spin 0.7s linear infinite;
}
.btn-spinner.dark {
  border-color: #1e253544;
  border-top-color: #4ade80;
}
@keyframes spin { to { transform: rotate(360deg); } }
</style>