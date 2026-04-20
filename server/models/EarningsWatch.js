const mongoose = require('mongoose')

const earningsWatchSchema = new mongoose.Schema({
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
  reportDate: {
    type: Date
  },
  view: {
    type: String,
    enum: ['bullish', 'bearish', 'neutral', null],
    default: null
  },
  actualMove: {
    type: Number,
    default: null
  },
  notes: {
    type: String,
    trim: true
  },
  result: {
    type: String,
    enum: ['beat', 'miss', 'inline', null],
    default: null
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
})

module.exports = mongoose.model('EarningsWatch', earningsWatchSchema)