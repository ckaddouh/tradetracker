const mongoose = require('mongoose')

// Recursive node schema — stored flat in an array for efficient querying
// Each node carries its full ancestry path so we can trace upward without recursion
const treeNodeSchema = new mongoose.Schema({
  id: { type: String, required: true },          // e.g. "seg_1", "inp_1_2_3"
  name: { type: String, required: true },         // e.g. "x86 Architecture"
  type: { type: String, required: true },         // company | segment | input
  description: { type: String },
  revenueShare: { type: String },                 // e.g. "10%" — populated for segments
  commodity: { type: Boolean },
  geographicRisk: { type: String },
  relatedTickers: [{ type: String }],
  depth: { type: Number, required: true },        // 0 = root, 1 = segment, 2+ = input
  // Full ancestor path from root down to this node — enables upward tracing
  // e.g. ["root", "seg_2", "inp_2_1"] for a depth-3 node
  ancestorPath: [{ type: String }],
  // Human-readable path for display: "Apple Inc → Mac (10%) → CPUs → x86 Architecture"
  displayPath: { type: String },
}, { _id: false })

const supplyChainTreeSchema = new mongoose.Schema({
  ticker: {
    type: String,
    required: true,
    uppercase: true,
    trim: true,
  },
  companyName: {
    type: String,
    required: true,
  },
  cik: {
    type: String,
    required: true,
  },
  filingDate: {
    type: String,   // "2024-11-01" — used to detect when a newer 10-K is available
    required: true,
  },
  docUrl: {
    type: String,
  },
  // The full nested tree (original structure) — used for tree visualisation
  tree: {
    type: mongoose.Schema.Types.Mixed,
    required: true,
  },
  // Flat list of every node with ancestry — used for fast cross-company keyword search
  // This is what powers "which companies have x86 architecture anywhere in their tree?"
  flatNodes: [treeNodeSchema],

  // Text index on node names + descriptions for full-text search across all companies
  // e.g. db.supplychaintrees.find({ $text: { $search: "x86 architecture" } })
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
})

// Compound index: one document per ticker, fast lookup
supplyChainTreeSchema.index({ ticker: 1 }, { unique: true })

// Text index across all flat node names and descriptions — powers news impact search
supplyChainTreeSchema.index({
  'flatNodes.name': 'text',
  'flatNodes.description': 'text',
  companyName: 'text',
})

// Index on filingDate so the bulk updater can find stale trees efficiently
supplyChainTreeSchema.index({ filingDate: 1 })

// Index on relatedTickers inside flatNodes — useful for "who depends on TSMC?"
supplyChainTreeSchema.index({ 'flatNodes.relatedTickers': 1 })

// ─── Helper: flatten a nested tree into the flatNodes array ──────────────────
// Call this before saving whenever the tree is built or refreshed
supplyChainTreeSchema.statics.flattenTree = function(node, ancestors = [], displayAncestors = []) {
  const currentPath = [...ancestors, node.id]

  const label = node.revenueShare
    ? `${node.name} (${node.revenueShare})`
    : node.name
  const currentDisplay = [...displayAncestors, label]

  const flat = [{
    id: node.id,
    name: node.name,
    type: node.type,
    description: node.description || '',
    revenueShare: node.revenueShare || null,
    commodity: node.commodity || false,
    geographicRisk: node.geographicRisk || null,
    relatedTickers: node.relatedTickers || [],
    depth: ancestors.length,
    ancestorPath: ancestors,
    displayPath: currentDisplay.join(' → '),
  }]

  for (const child of (node.children || [])) {
    flat.push(...supplyChainTreeSchema.statics.flattenTree(child, currentPath, currentDisplay))
  }

  return flat
}

supplyChainTreeSchema.pre('save', function(next) {
  this.updatedAt = new Date()
  next()
})

module.exports = mongoose.model('SupplyChainTree', supplyChainTreeSchema)