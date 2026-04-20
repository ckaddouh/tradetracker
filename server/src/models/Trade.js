const mongoose = require('mongoose');

const tradeSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    ideaId: { type: mongoose.Schema.Types.ObjectId, ref: 'Idea', required: true },
    ticker: { type: String, required: true, uppercase: true, trim: true },
    type: { type: String, enum: ['stock', 'option'], required: true },
    quantity: { type: Number, required: true },
    entryPrice: { type: Number, required: true },
    currentPrice: { type: Number, default: null },
    openedAt: { type: Date, default: Date.now },
    closedAt: { type: Date, default: null },
    status: { type: String, enum: ['open', 'closed'], default: 'open' },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Trade', tradeSchema);
