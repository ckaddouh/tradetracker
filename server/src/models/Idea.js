const mongoose = require('mongoose');

const ideaSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    ticker: { type: String, required: true, uppercase: true, trim: true },
    title: { type: String, required: true, trim: true },
    direction: { type: String, enum: ['bullish', 'bearish', 'neutral'], required: true },
    thesis: { type: String, required: true },
    catalysts: [{ type: String }],
    timeHorizon: { type: String, enum: ['short', 'medium', 'long'], required: true },
    status: {
      type: String,
      enum: ['researching', 'active', 'closed'],
      default: 'researching',
    },
    tags: [{ type: String }],
  },
  { timestamps: true }
);

module.exports = mongoose.model('Idea', ideaSchema);
