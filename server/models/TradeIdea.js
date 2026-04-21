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
  horizon: {
    type: String,
    enum: ['intraday', 'swing', 'weeks', 'months', 'long-term'],
    required: true
  },
  reason: {
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