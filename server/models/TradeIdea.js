const mongoose = require('mongoose')

const tradeIdeaSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  ticker: {
    type: String,
    required: true,
    uppercase: true,
    trim: true
  },
  direction: {
    type: String,
    enum: ['long', 'short'],
    required: true
  },
  assetClass: {
    type: String,
    enum: ['equity', 'option', 'ETF', 'futures', 'other'],
    required: true
  },
  conviction: {
    type: Number,
    min: 1,
    max: 5,
    required: true
  },
  entryPrice: {
    type: Number
  },
  targetPrice: {
    type: Number
  },
  stopLoss: {
    type: Number
  },
  thesis: {
    type: String,
    required: true,
    trim: true
  },
  status: {
    type: String,
    enum: ['open', 'closed', 'monitoring'],
    default: 'open'
  },
  outcome: {
    type: String,
    enum: ['win', 'loss', 'breakeven', null],
    default: null
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  closedAt: {
    type: Date
  }
})

module.exports = mongoose.model('TradeIdea', tradeIdeaSchema)