const mongoose = require('mongoose');

const ideaUpdateSchema = new mongoose.Schema(
  {
    ideaId: { type: mongoose.Schema.Types.ObjectId, ref: 'Idea', required: true },
    type: {
      type: String,
      enum: ['note', 'trade_added', 'thesis_update', 'earnings_reaction'],
      required: true,
    },
    content: { type: String, required: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model('IdeaUpdate', ideaUpdateSchema);
