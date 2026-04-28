<template>
  <div class="graph-wrapper" ref="wrapperRef">
    <svg ref="svgRef" :width="width" :height="height">
      <defs>
        <marker id="arrow" markerWidth="8" markerHeight="8" refX="16" refY="3" orient="auto">
          <path d="M0,0 L0,6 L8,3 z" fill="#2a2f3e" />
        </marker>
        <filter id="glow">
          <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
          <feMerge><feMergeNode in="coloredBlur"/><feMergeNode in="SourceGraphic"/></feMerge>
        </filter>
      </defs>
      <g ref="gRef">
        <line
          v-for="link in links"
          :key="link.id"
          :x1="link.source.x" :y1="link.source.y"
          :x2="link.target.x" :y2="link.target.y"
          class="graph-link"
          :class="{ highlighted: highlightedIds.has(link.source.id) && highlightedIds.has(link.target.id) }"
          marker-end="url(#arrow)"
        />
        <g
          v-for="node in nodes"
          :key="node.id"
          :transform="`translate(${node.x},${node.y})`"
          class="graph-node"
          :class="[node.type, { highlighted: highlightedIds.has(node.id), dimmed: highlightedIds.size > 0 && !highlightedIds.has(node.id) }]"
          @click="$emit('nodeClick', node)"
          @mouseenter="$emit('nodeHover', node)"
          @mouseleave="$emit('nodeHover', null)"
        >
          <circle
            :r="nodeRadius(node)"
            :class="['node-circle', node.type]"
            :filter="highlightedIds.has(node.id) ? 'url(#glow)' : ''"
          />
          <text class="node-label" :y="nodeRadius(node) + 14" text-anchor="middle">
            {{ truncate(node.name, 18) }}
          </text>
          <text v-if="node.revenueShare" class="node-revenue" :y="nodeRadius(node) + 26" text-anchor="middle">
            {{ node.revenueShare }}
          </text>
          <text v-if="node.commodity" class="node-tag" :y="-nodeRadius(node) - 6" text-anchor="middle">◆</text>
        </g>
      </g>
    </svg>
    <div class="graph-legend">
      <span class="legend-item company">● Company</span>
      <span class="legend-item segment">● Segment</span>
      <span class="legend-item input">● Input</span>
      <span class="legend-item commodity-tag">◆ Commodity</span>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, watch, computed } from 'vue'
import * as d3 from 'd3'

const props = defineProps({
  tree: Object,
  highlightedIds: { type: Set, default: () => new Set() }
})

const emit = defineEmits(['nodeClick', 'nodeHover'])

const svgRef = ref(null)
const gRef = ref(null)
const wrapperRef = ref(null)
const width = ref(800)
const height = ref(600)
const nodes = ref([])
const links = ref([])

let simulation = null

function flattenTree(node, parent = null, depth = 0) {
  const n = { ...node, depth, fx: depth === 0 ? width.value / 2 : null, fy: depth === 0 ? height.value / 2 : null }
  const result = [n]
  if (node.children) {
    for (const child of node.children) {
      result.push(...flattenTree(child, node, depth + 1))
    }
  }
  return result
}

function buildLinks(node) {
  const result = []
  if (node.children) {
    for (const child of node.children) {
      result.push({ id: `${node.id}-${child.id}`, source: node.id, target: child.id })
      result.push(...buildLinks(child))
    }
  }
  return result
}

function nodeRadius(node) {
  if (node.type === 'company') return 28
  if (node.type === 'segment') return 20
  return 13
}

function truncate(str, n) {
  return str && str.length > n ? str.slice(0, n - 1) + '…' : str
}

function initGraph() {
  if (!props.tree) return

  const flatNodes = flattenTree(props.tree)
  const flatLinks = buildLinks(props.tree)

  // Resize
  if (wrapperRef.value) {
    width.value = wrapperRef.value.clientWidth || 800
    height.value = wrapperRef.value.clientHeight || 600
  }

  if (simulation) simulation.stop()

  simulation = d3.forceSimulation(flatNodes)
    .force('link', d3.forceLink(flatLinks).id(d => d.id).distance(d => {
      if (d.source.type === 'company') return 160
      if (d.source.type === 'segment') return 120
      return 90
    }).strength(0.8))
    .force('charge', d3.forceManyBody().strength(d => {
      if (d.type === 'company') return -600
      if (d.type === 'segment') return -300
      return -150
    }))
    .force('center', d3.forceCenter(width.value / 2, height.value / 2))
    .force('collision', d3.forceCollide().radius(d => nodeRadius(d) + 30))
    .on('tick', () => {
      nodes.value = [...flatNodes]
      links.value = flatLinks.map(l => ({
        ...l,
        source: typeof l.source === 'object' ? l.source : flatNodes.find(n => n.id === l.source),
        target: typeof l.target === 'object' ? l.target : flatNodes.find(n => n.id === l.target),
      }))
    })

  // D3 zoom
  const svg = d3.select(svgRef.value)
  const g = d3.select(gRef.value)
  svg.call(d3.zoom().scaleExtent([0.3, 3]).on('zoom', e => {
    g.attr('transform', e.transform)
  }))
}

onMounted(() => {
  if (props.tree) initGraph()
})

watch(() => props.tree, (val) => {
  if (val) initGraph()
})
</script>

<style scoped>
.graph-wrapper {
  width: 100%;
  height: 100%;
  position: relative;
  background: #080c14;
  border-radius: 12px;
  overflow: hidden;
}

.graph-link {
  stroke: #1e2535;
  stroke-width: 1.5;
  transition: stroke 0.2s;
}
.graph-link.highlighted { stroke: #4ade8066; stroke-width: 2; }

.graph-node { cursor: pointer; transition: opacity 0.2s; }
.graph-node.dimmed { opacity: 0.25; }

.node-circle {
  transition: r 0.2s, fill 0.2s;
}
.node-circle.company { fill: #1a3a2a; stroke: #4ade80; stroke-width: 2.5; }
.node-circle.segment { fill: #1a2535; stroke: #60a5fa; stroke-width: 2; }
.node-circle.input { fill: #1e1a2d; stroke: #a78bfa; stroke-width: 1.5; }

.graph-node:hover .node-circle.company { fill: #1f4a35; }
.graph-node:hover .node-circle.segment { fill: #1f3048; }
.graph-node:hover .node-circle.input { fill: #2a2540; }

.graph-node.highlighted .node-circle.company { stroke: #4ade80; stroke-width: 3; fill: #1f4a35; }
.graph-node.highlighted .node-circle.segment { stroke: #93c5fd; stroke-width: 3; fill: #1f3048; }
.graph-node.highlighted .node-circle.input { stroke: #c4b5fd; stroke-width: 2.5; fill: #2a2540; }

.node-label {
  fill: #ccc;
  font-size: 11px;
  font-family: 'DM Mono', monospace;
  pointer-events: none;
  user-select: none;
}
.node-revenue {
  fill: #4ade8099;
  font-size: 10px;
  font-family: 'DM Mono', monospace;
  pointer-events: none;
}
.node-tag {
  fill: #f59e0b;
  font-size: 10px;
  pointer-events: none;
}

.graph-legend {
  position: absolute;
  bottom: 1rem;
  left: 1rem;
  display: flex;
  gap: 1rem;
  font-size: 0.75rem;
  font-family: 'DM Mono', monospace;
}
.legend-item { opacity: 0.5; }
.legend-item.company { color: #4ade80; }
.legend-item.segment { color: #60a5fa; }
.legend-item.input { color: #a78bfa; }
.legend-item.commodity-tag { color: #f59e0b; }
</style>