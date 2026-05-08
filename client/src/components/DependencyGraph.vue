<template>
  <div class="graph-wrapper" ref="wrapperRef">
    <svg ref="svgRef" :width="width" :height="height">
      <defs>
        <marker id="arrow" markerWidth="6" markerHeight="6" refX="8" refY="3" orient="auto">
          <path d="M0,0 L0,6 L8,3 z" fill="#2a3550" />
        </marker>
        <marker id="arrow-hl" markerWidth="6" markerHeight="6" refX="8" refY="3" orient="auto">
          <path d="M0,0 L0,6 L8,3 z" fill="#4ade80" />
        </marker>
      </defs>
      <g ref="gRef">
        <!-- Links -->
        <path
          v-for="link in links"
          :key="link.id"
          :d="link.path"
          fill="none"
          :class="['graph-link', { highlighted: isLinkHighlighted(link) }]"
          :marker-end="isLinkHighlighted(link) ? 'url(#arrow-hl)' : 'url(#arrow)'"
        />
        <!-- Nodes -->
        <g
          v-for="node in nodes"
          :key="node.data.id"
          :transform="`translate(${node.x},${node.y})`"
          class="graph-node"
          :class="[
            node.data.type,
            {
              highlighted: highlightedIds.has(node.data.id),
              dimmed: highlightedIds.size > 0 && !highlightedIds.has(node.data.id)
            }
          ]"
          @click="handleNodeClick(node)"
          @mouseenter="$emit('nodeHover', node.data)"
          @mouseleave="$emit('nodeHover', null)"
        >
          <!-- Invisible hit-area circle — prevents off-click issues -->
          <circle
            :r="nodeRadius(node.data) + 8"
            fill="transparent"
            stroke="none"
            style="pointer-events: all"
          />
          <circle
            :r="nodeRadius(node.data)"
            :class="['node-circle', node.data.type]"
          />
          <text
            class="node-label"
            :y="nodeRadius(node.data) + 13"
            text-anchor="middle"
          >{{ truncate(node.data.name, 16) }}</text>
          <text
            v-if="node.data.revenueShare"
            class="node-revenue"
            :y="nodeRadius(node.data) + 24"
            text-anchor="middle"
          >{{ node.data.revenueShare }}</text>
          <text
            v-if="node.data.commodity"
            class="node-tag"
            :y="-nodeRadius(node.data) - 5"
            text-anchor="middle"
          >◆</text>
        </g>
      </g>
    </svg>
    <div class="graph-controls">
      <button class="ctrl-btn" @click="resetZoom" title="Reset view">⌂</button>
      <button class="ctrl-btn" @click="zoomIn" title="Zoom in">+</button>
      <button class="ctrl-btn" @click="zoomOut" title="Zoom out">−</button>
    </div>
    <div class="graph-legend">
      <span class="legend-item company">● Company</span>
      <span class="legend-item segment">● Segment</span>
      <span class="legend-item input">● Input</span>
      <span class="legend-item commodity-tag">◆ Commodity</span>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, watch, nextTick } from 'vue'
import * as d3 from 'd3'

const props = defineProps({
  tree: Object,
  highlightedIds: { type: Set, default: () => new Set() }
})

const emit = defineEmits(['nodeClick', 'nodeHover'])

const svgRef     = ref(null)
const gRef       = ref(null)
const wrapperRef = ref(null)
const width      = ref(900)
const height     = ref(600)
const nodes      = ref([])
const links      = ref([])

let zoomBehavior = null
let currentTransform = d3.zoomIdentity

// ── Layout constants ──────────────────────────────────────────────────────────
const NODE_SEP_X = 52   // horizontal gap between siblings
const NODE_SEP_Y = 110  // vertical gap between levels

function nodeRadius(d) {
  if (d.type === 'company') return 26
  if (d.type === 'segment') return 18
  return 11 // fallback for unknown types — still visible
}

function truncate(str, n) {
  return str && str.length > n ? str.slice(0, n - 1) + '…' : str
}

// ── Build layout ──────────────────────────────────────────────────────────────
function buildLayout() {
  if (!props.tree || !wrapperRef.value) return

  width.value  = wrapperRef.value.clientWidth  || 900
  height.value = wrapperRef.value.clientHeight || 600

  const root = d3.hierarchy(props.tree, d => d.children)

  const treeLayout = d3.tree()
    .nodeSize([NODE_SEP_X, NODE_SEP_Y])
    .separation((a, b) => {
      const ar = nodeRadius(a.data)
      const br = nodeRadius(b.data)
      const base = a.parent === b.parent ? 1 : 1.4
      return base + (ar + br) / NODE_SEP_X
    })

  treeLayout(root)

  const allNodes = root.descendants()
  const minX = d3.min(allNodes, d => d.x)
  const maxX = d3.max(allNodes, d => d.x)
  const treeWidth = maxX - minX

  const offsetX = width.value / 2 - (minX + treeWidth / 2)
  const offsetY = 60

  allNodes.forEach(d => {
    d.x += offsetX
    d.y += offsetY
  })

  nodes.value = allNodes

  links.value = root.links().map(link => ({
    id: `${link.source.data.id}-${link.target.data.id}`,
    source: link.source,
    target: link.target,
    path: smoothPath(link.source, link.target)
  }))
}

function smoothPath(source, target) {
  const sy = source.y + nodeRadius(source.data)
  const ty = target.y - nodeRadius(target.data)
  const mx = (sy + ty) / 2
  return `M${source.x},${sy} C${source.x},${mx} ${target.x},${mx} ${target.x},${ty}`
}

// ── Highlight logic ───────────────────────────────────────────────────────────
function isLinkHighlighted(link) {
  return (
    props.highlightedIds.has(link.source.data.id) &&
    props.highlightedIds.has(link.target.data.id)
  )
}

function handleNodeClick(node) {
  const ids = new Set()
  let current = node
  while (current) {
    ids.add(current.data.id)
    current = current.parent
  }
  node.descendants().forEach(d => ids.add(d.data.id))
  emit('nodeClick', { ...node.data, _highlightIds: ids })
}

// ── Zoom ──────────────────────────────────────────────────────────────────────
function initZoom() {
  const svg = d3.select(svgRef.value)
  const g   = d3.select(gRef.value)

  zoomBehavior = d3.zoom()
    .scaleExtent([0.15, 3])
    // Only allow left-click drag and scroll wheel; ignore ctrl+scroll (browser zoom)
    .filter(event => !event.ctrlKey && (event.type === 'wheel' || event.button === 0))
    .on('zoom', e => {
      currentTransform = e.transform
      g.attr('transform', e.transform)
    })

  svg.call(zoomBehavior)

  nextTick(() => fitView())
}

function fitView() {
  if (!svgRef.value || !nodes.value.length) return
  const allNodes = nodes.value
  const minX = d3.min(allNodes, d => d.x) - 40
  const maxX = d3.max(allNodes, d => d.x) + 40
  const minY = d3.min(allNodes, d => d.y) - 40
  const maxY = d3.max(allNodes, d => d.y) + 60

  const w = maxX - minX
  const h = maxY - minY
  const scale = Math.min(0.9, Math.min(width.value / w, height.value / h))
  const tx = (width.value - w * scale) / 2 - minX * scale
  const ty = (height.value - h * scale) / 2 - minY * scale

  d3.select(svgRef.value)
    .transition().duration(500)
    .call(zoomBehavior.transform, d3.zoomIdentity.translate(tx, ty).scale(scale))
}

function resetZoom() { fitView() }
function zoomIn()    { d3.select(svgRef.value).transition().duration(250).call(zoomBehavior.scaleBy, 1.35) }
function zoomOut()   { d3.select(svgRef.value).transition().duration(250).call(zoomBehavior.scaleBy, 0.75) }

// ── Lifecycle ─────────────────────────────────────────────────────────────────
onMounted(() => {
  if (props.tree) {
    buildLayout()
    initZoom()
  }
})

watch(() => props.tree, async (val) => {
  if (val) {
    buildLayout()
    await nextTick()
    fitView()
  }
})
</script>

<style scoped>
.graph-wrapper {
  width: 100%;
  height: 100%;
  position: relative;
  background: #060c16;
  overflow: hidden;
}

/* Links */
.graph-link {
  stroke: #1e2b40;
  stroke-width: 1.5px;
  transition: stroke 0.2s, stroke-width 0.2s;
}
.graph-link.highlighted {
  stroke: #4ade80;
  stroke-width: 2.5px;
}

/* Nodes */
.graph-node {
  cursor: pointer;
  transition: opacity 0.2s;
}
.graph-node.dimmed { opacity: 0.2; }

/* Fallback so unknown node types are never invisible */
.node-circle {
  fill: #1a1a2e;
  stroke: #555;
  stroke-width: 1.5;
  transition: fill 0.2s, stroke 0.2s, r 0.2s;
}
.node-circle.company {
  fill: #0e2a1a;
  stroke: #4ade80;
  stroke-width: 2.5;
}
.node-circle.segment {
  fill: #0e1e30;
  stroke: #60a5fa;
  stroke-width: 2;
}
.node-circle.input {
  fill: #15112a;
  stroke: #9b87f5;
  stroke-width: 1.5;
}

/* Hover */
.graph-node:hover .node-circle.company { fill: #163d26; }
.graph-node:hover .node-circle.segment { fill: #132a40; }
.graph-node:hover .node-circle.input   { fill: #1e1840; }

/* Highlighted */
.graph-node.highlighted .node-circle.company {
  stroke: #4ade80;
  stroke-width: 3.5;
  fill: #163d26;
  filter: drop-shadow(0 0 6px #4ade8055);
}
.graph-node.highlighted .node-circle.segment {
  stroke: #93c5fd;
  stroke-width: 3;
  fill: #132a40;
  filter: drop-shadow(0 0 5px #60a5fa44);
}
.graph-node.highlighted .node-circle.input {
  stroke: #c4b5fd;
  stroke-width: 2.5;
  fill: #1e1840;
  filter: drop-shadow(0 0 4px #9b87f544);
}

.node-label {
  fill: #b0bec5;
  font-size: 10px;
  font-family: 'DM Mono', monospace;
  pointer-events: none;
  user-select: none;
}
.node-revenue {
  fill: #4ade8077;
  font-size: 9px;
  font-family: 'DM Mono', monospace;
  pointer-events: none;
}
.node-tag {
  fill: #f59e0b;
  font-size: 9px;
  pointer-events: none;
}

/* Controls */
.graph-controls {
  position: absolute;
  top: 0.75rem;
  right: 0.75rem;
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.ctrl-btn {
  width: 28px;
  height: 28px;
  background: #0f1a2a;
  border: 1px solid #1e2b40;
  border-radius: 6px;
  color: #60a5fa;
  font-size: 0.9rem;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.15s;
}
.ctrl-btn:hover { background: #162336; }

/* Legend */
.graph-legend {
  position: absolute;
  bottom: 0.75rem;
  left: 0.75rem;
  display: flex;
  gap: 1rem;
  font-size: 0.7rem;
  font-family: 'DM Mono', monospace;
}
.legend-item { opacity: 0.45; }
.legend-item.company       { color: #4ade80; }
.legend-item.segment       { color: #60a5fa; }
.legend-item.input         { color: #9b87f5; }
.legend-item.commodity-tag { color: #f59e0b; }
</style>