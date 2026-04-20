<template>
    <div class="trade-card">
      <div class="card-header">
        <div class="ticker-info">
          <span class="ticker">{{ trade.ticker }}</span>
          <span :class="['direction', trade.direction]">{{ trade.direction.toUpperCase() }}</span>
          <span class="asset-class">{{ trade.assetClass }}</span>
        </div>
        <div class="meta">
          <span class="conviction">⭐ {{ trade.conviction }}/5</span>
          <span class="date">{{ formatDate(trade.createdAt) }}</span>
        </div>
      </div>
  
      <p class="thesis">{{ trade.thesis }}</p>
  
      <div class="prices" v-if="trade.entryPrice || trade.targetPrice || trade.stopLoss">
        <span v-if="trade.entryPrice">Entry: ${{ trade.entryPrice }}</span>
        <span v-if="trade.targetPrice">Target: ${{ trade.targetPrice }}</span>
        <span v-if="trade.stopLoss">Stop: ${{ trade.stopLoss }}</span>
      </div>
  
      <div class="card-footer">
        <div class="status-controls">
          <select :value="trade.status" @change="e => emit('update', trade._id, { status: e.target.value })" class="status-select">
            <option value="open">Open</option>
            <option value="monitoring">Monitoring</option>
            <option value="closed">Closed</option>
          </select>
          <select v-if="trade.status === 'closed'" :value="trade.outcome" @change="e => emit('update', trade._id, { outcome: e.target.value })" class="outcome-select">
            <option value="">Outcome...</option>
            <option value="win">Win</option>
            <option value="loss">Loss</option>
            <option value="breakeven">Breakeven</option>
          </select>
        </div>
        <button @click="emit('delete', trade._id)" class="delete-btn">Delete</button>
      </div>
    </div>
  </template>
  
  <script setup>
  const props = defineProps({ trade: Object })
  const emit = defineEmits(['update', 'delete'])
  
  function formatDate(dateStr) {
    return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  }
  </script>
  
  <style scoped>
  .trade-card {
    background-color: #161b27;
    border: 1px solid #2a2f3e;
    border-radius: 10px;
    padding: 1.25rem 1.5rem;
  }
  
  .card-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 0.75rem;
  }
  
  .ticker-info {
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }
  
  .ticker {
    font-size: 1.2rem;
    font-weight: 700;
    color: #e0e0e0;
  }
  
  .direction {
    padding: 0.2rem 0.6rem;
    border-radius: 4px;
    font-size: 0.8rem;
    font-weight: 600;
  }
  
  .direction.long {
    background-color: #1b2d1b;
    color: #4ade80;
  }
  
  .direction.short {
    background-color: #2d1b1b;
    color: #e05252;
  }
  
  .asset-class {
    font-size: 0.8rem;
    color: #888;
    border: 1px solid #2a2f3e;
    padding: 0.2rem 0.5rem;
    border-radius: 4px;
  }
  
  .meta {
    display: flex;
    gap: 1rem;
    align-items: center;
  }
  
  .conviction {
    font-size: 0.85rem;
    color: #f59e0b;
  }
  
  .date {
    font-size: 0.8rem;
    color: #555;
  }
  
  .thesis {
    color: #aaa;
    font-size: 0.9rem;
    line-height: 1.5;
    margin-bottom: 0.75rem;
  }
  
  .prices {
    display: flex;
    gap: 1.5rem;
    font-size: 0.85rem;
    color: #888;
    margin-bottom: 0.75rem;
  }
  
  .card-footer {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-top: 0.5rem;
  }
  
  .status-controls {
    display: flex;
    gap: 0.75rem;
  }
  
  .status-select, .outcome-select {
    padding: 0.35rem 0.6rem;
    background-color: #0f1117;
    border: 1px solid #2a2f3e;
    border-radius: 6px;
    color: #e0e0e0;
    font-size: 0.85rem;
    cursor: pointer;
  }
  
  .delete-btn {
    background: none;
    border: 1px solid #2a2f3e;
    color: #555;
    padding: 0.35rem 0.75rem;
    border-radius: 6px;
    cursor: pointer;
    font-size: 0.85rem;
  }
  
  .delete-btn:hover {
    border-color: #e05252;
    color: #e05252;
  }
  </style>