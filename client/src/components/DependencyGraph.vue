<template>
  <div class="graph-container" ref="containerRef">
    <svg
      ref="svgRef"
      class="graph-svg"
      :viewBox="`0 0 ${svgW} ${svgH}`"
      preserveAspectRatio="xMidYMid meet"
      @mousemove="onSvgMouseMove"
      @mouseleave="hoveredNode = null"
    >
      <defs>
        <filter id="glow-green" x="-40%" y="-40%" width="180%" height="180%">
          <feGaussianBlur stdDeviation="3" result="blur" />
          <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
        <filter id="glow-blue" x="-40%" y="-40%" width="180%" height="180%">
          <feGaussianBlur stdDeviation="4" result="blur" />
          <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
        <marker id="arrow" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
          <path d="M0,0 L6,3 L0,6 Z" fill="#1e2535" />
        </marker>
      </defs>

      <!-- Edges -->
      <g class="edges-layer">
        <path
          v-for="edge in edges"
          :key="edge.id"
          :d="edge.path"
          fill="none"
          :stroke="edgeStroke(edge)"
          :stroke-width="edgeWidth(edge)"
          stroke-linecap="round"
          :opacity="edgeOpacity(edge)"
          class="edge-path"
        />
      </g>

      <!-- Nodes -->
      <g class="nodes-layer">
        <g
          v-for="node in flatNodes"
          :key="node.id"
          :transform="`translate(${node.x}, ${node.y})`"
          class="node-group"
          :class="{ 'node-animated': node.ready }"
          :style="{ '--anim-delay': `${node.animDelay}ms` }"
          @click="$emit('nodeClick', node.data)"
          @mouseenter="onNodeHover(node)"
          @mouseleave="hoveredNode = null"
        >
          <!-- Node circle -->
          <circle
            :r="node.r"
            :fill="nodeFill(node)"
            :stroke="nodeStroke(node)"
            :stroke-width="nodeStrokeWidth(node)"
            :filter="isHighlighted(node) ? 'url(#glow-green)' : (node.data.type === 'company' ? 'url(#glow-blue)' : 'none')"
            class="node-circle"
          />

          <!-- Inner dot for commodities -->
          <circle
            v-if="node.data.commodity"
            :r="Math.max(2, node.r * 0.3)"
            fill="#f59e0b55"
            class="commodity-dot"
          />

          <!-- Type icon -->
          <text
            text-anchor="middle"
            dominant-baseline="central"
            :font-size="node.r * 0.7"
            fill="#ffffff88"
            style="pointer-events:none; user-select:none"
          >{{ nodeIcon(node.data) }}</text>

          <!-- Label -->
          <foreignObject
            :x="-(labelWidth(node) / 2)"
            :y="node.r + 4"
            :width="labelWidth(node)"
            height="60"
            style="pointer-events:none; overflow:visible"
          >
            <div
              xmlns="http://www.w3.org/1999/xhtml"
              class="node-label"
              :class="{
                'label-root': node.data.type === 'company',
                'label-segment': node.data.type === 'segment',
                'label-highlighted': isHighlighted(node),
              }"
            >{{ node.data.name }}</div>
          </foreignObject>
        </g>
      </g>

      <!-- Tooltip -->
      <g v-if="hoveredNode && hoveredNode !== selectedNodeData" :transform="`translate(${tooltipX}, ${tooltipY})`">
        <rect
          :x="-tooltipW / 2" y="0"
          :width="tooltipW" :height="tooltipH"
          rx="6" ry="6"
          fill="#0d1220" stroke="#2a3545" stroke-width="1"
        />
        <text x="0" y="18" text-anchor="middle" fill="#e0e0e0" font-size="11" font-family="DM Mono, monospace" font-weight="600">
          {{ hoveredNode.data.name }}
        </text>
        <text x="0" y="34" text-anchor="middle" fill="#555" font-size="9" font-family="DM Mono, monospace">
          {{ hoveredNode.data.type }}{{ hoveredNode.data.revenueShare ? ' · ' + hoveredNode.data.revenueShare : '' }}
        </text>
        <text v-if="hoveredNode.data.geographicRisk" x="0" y="50" text-anchor="middle" fill="#fb923c" font-size="9" font-family="DM Mono, monospace">
          ⚠ {{ hoveredNode.data.geographicRisk.slice(0, 45) }}
        </text>
      </g>
    </svg>

    <!-- Zoom controls -->
    <div class="zoom-controls">
      <button class="zoom-btn" @click="zoomIn">+</button>
      <button class="zoom-btn" @click="zoomOut">−</button>
      <button class="zoom-btn" @click="resetZoom" title="Reset">⊙</button>
    </div>

    <!-- Legend -->
    <div class="graph-legend">
      <div class="legend-item"><span class="legend-dot company" />Company</div>
      <div class="legend-item"><span class="legend-dot segment" />Segment</div>
      <div class="legend-item"><span class="legend-dot input" />Input / Component</div>
      <div class="legend-item"><span class="legend-dot commodity" />Commodity</div>
      <div class="legend-item"><span class="legend-dot geo" />Geo Risk</div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, nextTick, onMounted, onUnmounted } from 'vue'

const props = defineProps({
  tree: { type: Object, default: null },
  highlightedIds: { type: Object, default: () => new Set() },
})

const emit = defineEmits(['nodeClick', 'nodeHover'])

const containerRef = ref(null)
const svgRef       = ref(null)
const svgW         = ref(1200)
const svgH         = ref(800)

const LEVEL_GAP    = 200
const NODE_VGAP    = 14
const BASE_R       = { company: 22, segment: 16, input: 10 }

const hoveredNode       = ref(null)
const selectedNodeData  = ref(null)
const tooltipW = 220, tooltipH = 60
const tooltipX = ref(0), tooltipY = ref(0)

const flatNodes = ref([])
const edges     = ref([])

function nodeRadius(type, depth) {
  if (type === 'company')  return BASE_R.company
  if (type === 'segment')  return BASE_R.segment
  return Math.max(5, BASE_R.input - depth * 0.5)
}

function buildLayout(tree) {
  if (!tree) return { nodes: [], edges: [] }

  const all = []
  const edgeList = []
  let idCounter = 0

  function traverse(node, depth, parentId) {
    const n = {
      id: node.id || `node_${idCounter++}`,
      data: node,
      depth,
      r: nodeRadius(node.type, depth),
      children: [],
      parentId,
      x: 0, y: 0,
      // ── FIX: stagger delay based on depth + index, keep it snappy ──
      animDelay: depth * 60 + (all.length % 8) * 25,
      ready: false,
    }
    all.push(n)
    if (parentId !== null) {
      edgeList.push({ id: `${parentId}-${n.id}`, from: parentId, to: n.id })
    }
    for (const child of node.children || []) {
      n.children.push(child.id || `node_${idCounter}`)
      traverse(child, depth + 1, n.id)
    }
    return n
  }

  traverse(tree, 0, null)

  const nodeMap = {}
  for (const n of all) nodeMap[n.id] = n

  function subtreeHeight(id) {
    const n = nodeMap[id]
    if (!n || n.children.length === 0) return n.r * 2 + NODE_VGAP
    const childIds = (n.data.children || []).map(c => c.id || c)
    const h = childIds.reduce((sum, cid) => sum + subtreeHeight(cid), 0)
    return Math.max(h, n.r * 2 + NODE_VGAP)
  }

  function assignY(id, top) {
    const n = nodeMap[id]
    if (!n) return top
    const childIds = (n.data.children || []).map(c => c.id || c)
    if (childIds.length === 0) {
      n.y = top + n.r + NODE_VGAP / 2
      return top + n.r * 2 + NODE_VGAP
    }
    let cursor = top
    for (const cid of childIds) {
      cursor = assignY(cid, cursor)
    }
    const firstChild = nodeMap[childIds[0]]
    const lastChild  = nodeMap[childIds[childIds.length - 1]]
    if (firstChild && lastChild) {
      n.y = (firstChild.y + lastChild.y) / 2
    }
    return cursor
  }

  const root = all[0]
  if (!root) return { nodes: [], edges: [] }

  const margin = 80
  for (const n of all) {
    n.x = margin + n.depth * LEVEL_GAP
  }

  assignY(root.id, 0)

  const minY = Math.min(...all.map(n => n.y))
  const maxY = Math.max(...all.map(n => n.y))
  const treeH = maxY - minY
  const offsetY = (svgH.value - treeH) / 2 - minY
  for (const n of all) n.y += offsetY

  const maxX = Math.max(...all.map(n => n.x + n.r + 120))
  const maxYv = Math.max(...all.map(n => n.y + 40))
  svgW.value = Math.max(1200, maxX)
  svgH.value = Math.max(800, maxYv + 40)

  const builtEdges = edgeList.map(e => {
    const from = nodeMap[e.from]
    const to   = nodeMap[e.to]
    if (!from || !to) return null
    const cx = (from.x + to.x) / 2
    return {
      ...e,
      path: `M${from.x},${from.y} C${cx},${from.y} ${cx},${to.y} ${to.x},${to.y}`,
      fromNode: from,
      toNode: to,
    }
  }).filter(Boolean)

  return { nodes: all, edges: builtEdges }
}

watch(() => props.tree, async (tree) => {
  if (!tree) { flatNodes.value = []; edges.value = []; return }
  const { nodes, edges: builtEdges } = buildLayout(tree)

  // ── FIX: set ready=false initially, then stagger-set ready=true ──
  // Nodes are invisible via keyframe `from` state, not via a persistent CSS rule,
  // so we just need to add the class with the right delay.
  flatNodes.value = nodes
  edges.value = builtEdges

  await nextTick()
  for (let i = 0; i < nodes.length; i++) {
    setTimeout(() => {
      nodes[i].ready = true
    }, nodes[i].animDelay)
  }
}, { immediate: true })

function isHighlighted(node) {
  return props.highlightedIds.has(node.id)
}

function nodeFill(node) {
  if (isHighlighted(node)) return '#0f3a1f'
  if (node.data.type === 'company')  return '#0c1e3a'
  if (node.data.type === 'segment')  return '#101a2c'
  if (node.data.commodity)           return '#1c1200'
  if (node.data.geographicRisk)      return '#1c0a00'
  return '#0d1220'
}

function nodeStroke(node) {
  if (isHighlighted(node)) return '#4ade80'
  if (node.data.type === 'company')  return '#60a5fa'
  if (node.data.type === 'segment')  return '#7dd3fc44'
  if (node.data.commodity)           return '#f59e0b66'
  if (node.data.geographicRisk)      return '#fb923c55'
  return '#1e2535'
}

function nodeStrokeWidth(node) {
  if (isHighlighted(node)) return 2
  if (node.data.type === 'company')  return 2
  if (node.data.type === 'segment')  return 1.5
  return 1
}

function nodeIcon(data) {
  if (data.type === 'company')  return '◈'
  if (data.type === 'segment')  return '◆'
  if (data.commodity)           return '◇'
  if (data.geographicRisk)      return '⚑'
  return ''
}

function labelWidth(node) {
  return Math.max(120, Math.min(200, node.data.name.length * 6.5))
}

function edgeStroke(edge) {
  if (props.highlightedIds.has(edge.from) && props.highlightedIds.has(edge.to)) return '#4ade8044'
  return '#1a2030'
}
function edgeWidth(edge) {
  if (props.highlightedIds.has(edge.from) && props.highlightedIds.has(edge.to)) return 1.5
  return 1
}
function edgeOpacity(edge) {
  if (!props.highlightedIds.size) return 0.6
  if (props.highlightedIds.has(edge.from) || props.highlightedIds.has(edge.to)) return 1
  return 0.15
}

function onNodeHover(node) {
  hoveredNode.value = node
  tooltipX.value = node.x + node.r + 10
  tooltipY.value = node.y - tooltipH / 2
  emit('nodeHover', node.data)
}

function onSvgMouseMove(e) {
  // intentionally empty — tooltip position is set on node enter
}

const zoomLevel = ref(1)

function zoomIn()    { applyZoom(zoomLevel.value * 1.2) }
function zoomOut()   { applyZoom(zoomLevel.value / 1.2) }
function resetZoom() { applyZoom(1) }

function applyZoom(z) {
  zoomLevel.value = Math.max(0.3, Math.min(3, z))
  if (svgRef.value) {
    const w = svgW.value / zoomLevel.value
    const h = svgH.value / zoomLevel.value
    const cx = svgW.value / 2
    const cy = svgH.value / 2
    svgRef.value.setAttribute('viewBox', `${cx - w/2} ${cy - h/2} ${w} ${h}`)
  }
}

let ro
onMounted(() => {
  if (containerRef.value) {
    ro = new ResizeObserver(() => {})
    ro.observe(containerRef.value)
  }
})
onUnmounted(() => ro?.disconnect())
</script>

<style scoped>
.graph-container {
  flex: 1;
  position: relative;
  overflow: hidden;
  background: #060a10;
}

.graph-svg {
  width: 100%;
  height: 100%;
  cursor: grab;
}
.graph-svg:active { cursor: grabbing; }

/* ── Node animation ──
   Base state: invisible (no persistent rule).
   The keyframe itself starts from opacity:0/scale:0.2 so nodes are invisible
   until their animation fires. fill-mode:both keeps them visible after. */
.node-group {
  cursor: pointer;
  /* No opacity:0 here — that was killing nodes that missed their animation window */
}

.node-group.node-animated {
  animation: nodePopIn 0.45s cubic-bezier(0.34, 1.56, 0.64, 1) both;
  animation-delay: var(--anim-delay, 0ms);
}

/* Nodes that haven't fired yet should be invisible */
.node-group:not(.node-animated) {
  opacity: 0;
  pointer-events: none;
}

@keyframes nodePopIn {
  0%   { opacity: 0; transform: scale(0.15); }
  55%  { opacity: 1; transform: scale(1.12); }
  75%  { transform: scale(0.94); }
  100% { opacity: 1; transform: scale(1); }
}

.node-circle {
  transition: r 0.2s ease, stroke 0.2s ease, fill 0.2s ease;
}
.node-group:hover .node-circle {
  stroke-width: 2;
  filter: brightness(1.3);
}

.commodity-dot {
  animation: pulse 2s ease-in-out infinite;
}
@keyframes pulse {
  0%, 100% { opacity: 0.4; }
  50%       { opacity: 0.9; }
}

/* ── Edge animation ── */
.edge-path {
  transition: stroke 0.3s, opacity 0.3s, stroke-width 0.2s;
  animation: edgeFadeIn 0.6s ease both;
  animation-delay: 200ms;
}
@keyframes edgeFadeIn {
  from { opacity: 0; }
  to   { opacity: 1; }
}

/* ── Labels ── */
.node-label {
  font-family: 'DM Mono', monospace;
  font-size: 9px;
  color: #6b7280;
  text-align: center;
  line-height: 1.35;
  white-space: normal;
  word-break: break-word;
  hyphens: auto;
  pointer-events: none;
  max-width: 200px;
  padding: 0 2px;
}
.label-root {
  font-size: 11px;
  font-weight: 700;
  color: #93c5fd;
  font-family: 'Syne', sans-serif;
}
.label-segment {
  font-size: 10px;
  color: #94a3b8;
  font-weight: 600;
}
.label-highlighted {
  color: #4ade80 !important;
}

/* ── Zoom controls ── */
.zoom-controls {
  position: absolute;
  bottom: 1.5rem;
  right: 1.5rem;
  display: flex;
  flex-direction: column;
  gap: 3px;
}
.zoom-btn {
  width: 28px; height: 28px;
  background: #0d1220;
  border: 1px solid #1e2535;
  color: #4ade80;
  border-radius: 5px;
  font-size: 1rem;
  cursor: pointer;
  display: flex; align-items: center; justify-content: center;
  transition: background 0.15s, border-color 0.15s;
}
.zoom-btn:hover { background: #0f2a1a; border-color: #4ade80; }

/* ── Legend ── */
.graph-legend {
  position: absolute;
  top: 1rem;
  right: 1rem;
  background: #0d1220cc;
  border: 1px solid #1e2535;
  border-radius: 8px;
  padding: 0.6rem 0.8rem;
  display: flex;
  flex-direction: column;
  gap: 5px;
  backdrop-filter: blur(4px);
}
.legend-item {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 0.65rem;
  color: #555;
  font-family: 'DM Mono', monospace;
}
.legend-dot {
  width: 8px; height: 8px;
  border-radius: 50%;
  border: 1.5px solid transparent;
  flex-shrink: 0;
}
.legend-dot.company   { background: #0c1e3a; border-color: #60a5fa; }
.legend-dot.segment   { background: #101a2c; border-color: #7dd3fc66; }
.legend-dot.input     { background: #0d1220; border-color: #1e2535; }
.legend-dot.commodity { background: #1c1200; border-color: #f59e0b66; }
.legend-dot.geo       { background: #1c0a00; border-color: #fb923c55; }
</style>