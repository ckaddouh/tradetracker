<template>
  <transition name="panel-slide">
    <div v-if="node" class="node-panel">
      <div class="panel-header">
        <div class="panel-type-badge" :class="node.type">{{ node.type }}</div>
        <button class="panel-close" @click="$emit('close')">✕</button>
      </div>

      <h2 class="panel-title">{{ node.name }}</h2>
      <p v-if="node.revenueShare" class="panel-revenue">{{ node.revenueShare }} of revenue</p>
      <p class="panel-description">{{ node.description }}</p>

      <div class="panel-tags">
        <span v-if="node.commodity" class="tag commodity">◆ Commodity</span>
        <span v-if="node.geographicRisk" class="tag geo-risk">⚠ {{ node.geographicRisk }}</span>
      </div>

      <div v-if="node.relatedTickers?.length" class="panel-section">
        <h3>Related Companies</h3>
        <div class="ticker-list">
          <span v-for="t in node.relatedTickers" :key="t" class="ticker-chip">{{ t }}</span>
        </div>
      </div>

      <!-- Exposed companies (loaded on demand) -->
      <div class="panel-section">
        <div class="section-header">
          <h3>Companies Exposed to This</h3>
          <button
            v-if="!exposedCompanies && !loadingExposed"
            class="load-btn"
            @click="$emit('loadExposed', node)"
          >Analyze →</button>
        </div>

        <div v-if="loadingExposed" class="loading-row">
          <span class="spinner" />
          <span>Querying Groq...</span>
        </div>

        <div v-else-if="exposedCompanies" class="exposed-list">
          <div
            v-for="co in exposedCompanies.companies"
            :key="co.ticker"
            class="exposed-row"
            :class="co.direction"
          >
            <div class="exposed-left">
              <span class="exposed-ticker">{{ co.ticker }}</span>
              <span class="exposed-name">{{ co.name }}</span>
            </div>
            <div class="exposed-right">
              <span class="exposure-badge" :class="co.exposure">{{ co.exposure }}</span>
              <span class="direction-icon">{{ co.direction === 'positive' ? '▲' : co.direction === 'negative' ? '▼' : '↔' }}</span>
            </div>
            <p class="exposed-reason">{{ co.reason }}</p>
            <p class="exposed-direction-reason">{{ co.directionReason }}</p>
          </div>
        </div>
      </div>

      <div v-if="node.children?.length" class="panel-section">
        <h3>Sub-dependencies ({{ node.children.length }})</h3>
        <div class="children-list">
          <div v-for="child in node.children" :key="child.id" class="child-item">
            <span class="child-dot" :class="child.type" />
            {{ child.name }}
          </div>
        </div>
      </div>
    </div>
  </transition>
</template>

<script setup>
defineProps({
  node: Object,
  exposedCompanies: Object,
  loadingExposed: Boolean,
})
defineEmits(['close', 'loadExposed'])
</script>

<style scoped>
.node-panel {
  width: 340px;
  flex-shrink: 0;
  background: #0d1220;
  border-left: 1px solid #1e2535;
  padding: 1.5rem;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 1rem;
  font-family: 'DM Mono', monospace;
}

.panel-slide-enter-active, .panel-slide-leave-active { transition: all 0.25s ease; }
.panel-slide-enter-from, .panel-slide-leave-to { transform: translateX(40px); opacity: 0; }

.panel-header { display: flex; justify-content: space-between; align-items: center; }

.panel-type-badge {
  font-size: 0.7rem;
  font-weight: 600;
  padding: 0.2rem 0.6rem;
  border-radius: 4px;
  text-transform: uppercase;
  letter-spacing: 0.08em;
}
.panel-type-badge.company { background: #1a3a2a; color: #4ade80; }
.panel-type-badge.segment { background: #1a2535; color: #60a5fa; }
.panel-type-badge.input { background: #1e1a2d; color: #a78bfa; }

.panel-close { background: none; border: none; color: #555; cursor: pointer; font-size: 1rem; }
.panel-close:hover { color: #e0e0e0; }

.panel-title { font-size: 1.2rem; font-weight: 700; color: #e0e0e0; margin: 0; }
.panel-revenue { color: #4ade80; font-size: 0.85rem; margin: 0; }
.panel-description { color: #888; font-size: 0.82rem; line-height: 1.6; margin: 0; }

.panel-tags { display: flex; gap: 0.5rem; flex-wrap: wrap; }
.tag { font-size: 0.72rem; padding: 0.2rem 0.5rem; border-radius: 4px; }
.tag.commodity { background: #2a1f00; color: #f59e0b; border: 1px solid #f59e0b44; }
.tag.geo-risk { background: #2a1a1a; color: #e05252; border: 1px solid #e0525244; }

.panel-section { display: flex; flex-direction: column; gap: 0.5rem; }
.panel-section h3 { font-size: 0.75rem; color: #555; text-transform: uppercase; letter-spacing: 0.08em; margin: 0; }

.section-header { display: flex; justify-content: space-between; align-items: center; }
.load-btn {
  font-size: 0.75rem; padding: 0.25rem 0.6rem;
  background: none; border: 1px solid #2a2f3e; border-radius: 4px;
  color: #4ade80; cursor: pointer; font-family: inherit;
}
.load-btn:hover { background: #1a3a2a; }

.loading-row { display: flex; align-items: center; gap: 0.5rem; color: #555; font-size: 0.82rem; }
.spinner {
  width: 14px; height: 14px; border: 2px solid #2a2f3e;
  border-top-color: #4ade80; border-radius: 50%;
  animation: spin 0.8s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }

.ticker-list { display: flex; flex-wrap: wrap; gap: 0.4rem; }
.ticker-chip {
  font-size: 0.75rem; padding: 0.2rem 0.5rem;
  background: #1a2535; color: #60a5fa;
  border: 1px solid #1e3050; border-radius: 4px;
}

.exposed-list { display: flex; flex-direction: column; gap: 0.75rem; }
.exposed-row {
  background: #0f1520;
  border: 1px solid #1e2535;
  border-radius: 8px;
  padding: 0.75rem;
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 0.3rem;
}
.exposed-row.positive { border-left: 3px solid #4ade8066; }
.exposed-row.negative { border-left: 3px solid #e0525266; }
.exposed-row.mixed { border-left: 3px solid #f59e0b66; }

.exposed-left { display: flex; align-items: center; gap: 0.5rem; }
.exposed-ticker { color: #e0e0e0; font-weight: 700; font-size: 0.85rem; }
.exposed-name { color: #555; font-size: 0.75rem; }
.exposed-right { display: flex; align-items: center; gap: 0.4rem; }

.exposure-badge {
  font-size: 0.65rem; padding: 0.15rem 0.4rem; border-radius: 3px; text-transform: uppercase;
}
.exposure-badge.high { background: #2a1a1a; color: #e05252; }
.exposure-badge.medium { background: #2a2010; color: #f59e0b; }
.exposure-badge.low { background: #1a2a1a; color: #4ade80; }

.direction-icon { font-size: 0.9rem; }
.exposed-row.positive .direction-icon { color: #4ade80; }
.exposed-row.negative .direction-icon { color: #e05252; }
.exposed-row.mixed .direction-icon { color: #f59e0b; }

.exposed-reason, .exposed-direction-reason {
  grid-column: 1 / -1;
  font-size: 0.75rem;
  color: #777;
  margin: 0;
  line-height: 1.5;
}
.exposed-direction-reason { color: #555; font-style: italic; }

.children-list { display: flex; flex-direction: column; gap: 0.3rem; }
.child-item { display: flex; align-items: center; gap: 0.5rem; font-size: 0.8rem; color: #888; }
.child-dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
.child-dot.company { background: #4ade80; }
.child-dot.segment { background: #60a5fa; }
.child-dot.input { background: #a78bfa; }
</style>