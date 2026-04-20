const mongoose = require('mongoose');

const earningsEventSchema = new mongoose.Schema(
  {
    ticker: { type: String, required: true, uppercase: true, trim: true },
    companyName: { type: String, required: true, trim: true },
    earningsDate: { type: Date, required: true },
    time: { type: String, enum: ['BMO', 'AMC'], required: true },
    source: { type: String, default: 'manual' },
  },
  { timestamps: true }
);

module.exports = mongoose.model('EarningsEvent', earningsEventSchema);
